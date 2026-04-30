
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RotateCcw, Settings, LogIn, User as UserIcon, Box, Sparkles, Volume2, VolumeX } from 'lucide-react';
import { GameBoard } from './components/GameBoard';
import { GameOverModal } from './components/GameOverModal';
import { Leaderboard } from './components/Leaderboard';
import { LocalLlmInstallModule } from './components/LocalLlmInstallModule';
import { SignInModal } from './components/SignInModal';
import { TutorialModal } from './components/TutorialModal';
import type { BestScore, GameSettings } from './types';
import { APP_VERSION } from './constants';
import { cn } from './lib/utils';
import { auth, logOut, syncUserProfile, submitScore, updateUserBest, logGameEvent } from './lib/firebase';
import { soundManager } from './lib/sounds';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useMatchingGame } from './hooks/useMatchingGame';
import { gamePersistenceService } from './services/gamePersistenceService';
import { getLocalLlmInstallStatus, subscribeLocalLlmInstallStatus, warmLocalLlmEngine } from './services/localLlmService';
import { isInstalledWebApp } from './lib/installedWebApp';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<GameSettings>({
    gridSize: 4,
    theme: 'icons'
  });

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [localLlmInstall, setLocalLlmInstall] = useState(getLocalLlmInstallStatus());
  const [syncedBests, setSyncedBests] = useState<Record<string, BestScore | null> | null>(null);
  const currentGridSize = settings.gridSize.toString();
  const {
    cards,
    flippedIndices,
    moves,
    matches,
    status,
    time,
    bestScore,
    hintIndex,
    hintMessage,
    isGettingHint,
    hintsRemaining,
    initGame,
    handleCardClick,
    handleGetHint,
    setBestScore
  } = useMatchingGame({
    settings,
    user,
    soundEnabled,
    persistenceService: gamePersistenceService,
    logEvent: logGameEvent,
    onWin: ({ moves: finalMoves, time: finalTime, gridSize, theme, user: currentUser }) => {
      submitScore(
        currentUser.uid,
        currentUser.displayName || 'Anonymous',
        currentUser.photoURL,
        finalMoves,
        finalTime,
        gridSize,
        theme
      );
      updateUserBest(currentUser.uid, gridSize.toString(), finalMoves, finalTime);
    }
  });

  // Unlock AudioContext on first user gesture (required by mobile browsers)
  useEffect(() => {
    const unlock = () => soundManager.prime();
    window.addEventListener('touchstart', unlock, { once: true, passive: true });
    window.addEventListener('click', unlock, { once: true });
    return () => {
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('click', unlock);
    };
  }, []);

  useEffect(() => {
    return subscribeLocalLlmInstallStatus(setLocalLlmInstall);
  }, []);

  useEffect(() => {
    if (isInstalledWebApp()) {
      warmLocalLlmEngine();
    }
  }, []);

  // Tutorial Flow
  useEffect(() => {
    const hasSeenTutorial = gamePersistenceService.getTutorialSeen();
    if (!hasSeenTutorial) {
      setShowTutorial(true);
    }
  }, []);

  const handleCloseTutorial = () => {
    gamePersistenceService.setTutorialSeen(true);
    setShowTutorial(false);
  };

  // Auth Listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setSyncedBests(null);
      }
    });

    return unsub;
  }, []);

  // Auth Score Sync
  useEffect(() => {
    let isActive = true;

    const handleAuthSync = async () => {
      if (!user?.uid) return;

      try {
        const localBestsByMode = gamePersistenceService.getBestScores([4, 6]);
        const localBests: Record<string, BestScore | null> = {
          '4': localBestsByMode[4],
          '6': localBestsByMode[6]
        };

        const authoritativeData = await syncUserProfile(user, localBests);
        if (!isActive) return;

        const bests = authoritativeData.bests;
        if (bests && typeof bests === 'object' && Object.keys(bests).length > 0) {
          gamePersistenceService.setBestScores({
            4: bests['4'] || null,
            6: bests['6'] || null
          });
          setSyncedBests(bests);
          const syncedGridScore = bests[currentGridSize];
          if (syncedGridScore) {
            setBestScore(syncedGridScore);
          }
        }
      } catch (error) {
        if (isActive) {
          console.error('Sync failed:', error);
        }
      }
    };

    handleAuthSync();

    return () => {
      isActive = false;
    };
  }, [user?.uid, currentGridSize]);

  // Update current best score when grid size changes or sync completes
  useEffect(() => {
    const currentModeStr = settings.gridSize.toString();
    if (syncedBests) {
      const syncedBest = syncedBests[currentModeStr];
      if (syncedBest) {
        setBestScore(syncedBest);
      }
    } else {
      const bests = gamePersistenceService.getBestScores([settings.gridSize]);
      const localBest = bests[settings.gridSize];
      if (localBest) {
        setBestScore(localBest);
      }
    }
  }, [settings.gridSize, syncedBests, setBestScore]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleSound = () => {
    const newVal = !soundEnabled;
    setSoundEnabled(newVal);
    soundManager.setEnabled(newVal);
    logGameEvent('sound_toggle', { enabled: newVal });
    if (newVal) {
      soundManager.play('flip');
    }
  };

  return (
    <div className="min-h-screen bg-bg-theme flex flex-col font-sans">
      {/* App Header */}
      <header className="min-h-20 py-4 lg:py-0 bg-surface border-b border-border-theme flex flex-col lg:flex-row items-center justify-between px-6 lg:px-10 sticky top-0 z-50 gap-4" role="banner">
        <div className="flex items-center justify-between w-full lg:w-auto">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary-theme rounded-md flex items-center justify-center text-white" aria-hidden="true">
              <Box className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tighter text-text-main m-0">MATCHBOX GACHA</h1>
          </div>
          
          <div className="flex lg:hidden items-center gap-2">
            <button
              onClick={toggleSound}
              className="w-11 h-11 rounded-full bg-surface border border-border-theme flex items-center justify-center text-text-muted transition-all"
              aria-label={soundEnabled ? "Mute sound" : "Unmute sound"}
              aria-pressed={!soundEnabled}
              title={soundEnabled ? "Mute sound" : "Unmute sound"}
            >
              {soundEnabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
            </button>
          </div>
        </div>

        <div className="flex gap-2 sm:gap-4 xl:gap-8 items-center justify-center flex-wrap lg:flex-nowrap">
          <div className="flex flex-col items-center lg:items-start text-center lg:text-left min-w-[45px]">
            <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-text-muted font-bold leading-none mb-1">Time</span>
            <span className="text-sm sm:text-base lg:text-base xl:text-lg font-bold font-mono text-text-main leading-none">{formatTime(time)}</span>
          </div>
          <div className="flex flex-col items-center lg:items-start text-center lg:text-left min-w-[45px]">
            <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-text-muted font-bold leading-none mb-1">Moves</span>
            <span className="text-sm sm:text-base lg:text-base xl:text-lg font-bold font-mono text-text-main leading-none">{moves}</span>
          </div>
          <div className="flex flex-col items-center lg:items-start text-center lg:text-left min-w-[55px]">
             <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-text-muted font-bold leading-none mb-1">Matches</span>
             <div className="text-[13px] sm:text-sm lg:text-sm xl:text-base font-bold font-mono text-text-main leading-none flex items-baseline gap-0.5">
               <span>{matches}</span>
               <span className="text-[9px] opacity-40">/</span>
               <span>{(settings.gridSize * settings.gridSize) / 2}</span>
             </div>
          </div>
          
          <div className="h-8 w-[1px] bg-border-theme hidden lg:block mx-1" />

          {(status === 'playing' || status === 'idle') && cards.length > 0 && (
            <button
              onClick={handleGetHint}
              disabled={isGettingHint || hintsRemaining <= 0 || flippedIndices.length !== 1}
              aria-busy={isGettingHint}
              aria-label={
                hintsRemaining <= 0
                  ? 'No hints remaining'
                  : isGettingHint
                    ? 'Getting hint'
                    : `Get AI suggestion, ${hintsRemaining} remaining`
              }
              className={cn(
                "flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-widest transition-all shadow-sm order-last sm:order-none w-full sm:w-auto justify-center whitespace-nowrap",
                (isGettingHint || hintsRemaining <= 0 || flippedIndices.length !== 1) ? "bg-bg-theme text-text-muted cursor-not-allowed border border-border-theme" : "bg-primary-light text-primary-theme hover:bg-primary-theme hover:text-white"
              )}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="sm:hidden">{hintsRemaining}</span>
              <span className="hidden sm:inline line-clamp-1">
                {hintsRemaining <= 0 ? "No More" : (flippedIndices.length === 0 ? "Pick 1st" : `Suggestion (${hintsRemaining})`)}
              </span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 lg:gap-3 w-full lg:w-auto justify-center lg:justify-end">
          <button
            onClick={toggleSound}
            className="hidden lg:flex w-11 h-11 rounded-full bg-surface border border-border-theme items-center justify-center text-text-muted hover:text-primary-theme hover:border-primary-theme transition-all shadow-sm"
            title={soundEnabled ? "Mute" : "Unmute"}
            aria-label={soundEnabled ? "Mute sound" : "Unmute sound"}
            aria-pressed={!soundEnabled}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* User Section (Now consistently next to New Game) */}
          {user ? (
            <div className="flex items-center gap-2">
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-bold text-text-main uppercase tracking-tight">{user.displayName}</span>
                <button onClick={logOut} className="text-[9px] font-bold text-text-muted hover:text-red-500 uppercase tracking-widest transition-colors min-h-11 px-2 rounded-md" aria-label="Sign out">
                  Sign Out
                </button>
              </div>
              <div className="w-8 h-8 rounded-full bg-primary-light border border-border-theme overflow-hidden">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-primary-theme"><UserIcon className="w-4 h-4" /></div>
                )}
              </div>
            </div>
          ) : (
          <button 
              onClick={() => setShowSignIn(true)}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest bg-surface border border-border-theme text-text-main hover:bg-bg-theme transition-all shadow-sm whitespace-nowrap"
            aria-label="Open sign in options"
            >
              <LogIn className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Sign In</span>
            </button>
          )}
          
          <button 
            onClick={initGame}
            className="flex items-center gap-2 px-4 sm:px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest bg-primary-theme text-white hover:bg-primary-theme/90 transition-all shadow-sm whitespace-nowrap"
            aria-label="Start a new game"
          >
            <RotateCcw className="w-3.5 h-3.5" /> <span>New Game</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main id="main-content" className="flex-1 grid grid-cols-1 md:grid-cols-[300px_1fr] xl:grid-cols-[320px_1fr_320px] pt-6 px-4 sm:px-10 pb-10 gap-8 xl:gap-10 auto-rows-min" role="main">
        
        {/* 1. Game Area (Top on Mobile, Grid Right on Tablet, Center on Desktop) */}
        <section className="flex flex-col gap-6 items-center justify-start relative order-1 md:col-start-2 xl:col-start-2 md:row-start-1 xl:row-start-1 xl:row-span-12" aria-label="Game board section">
          {hintMessage && (
            <div role="status" aria-live="polite" className="absolute top-0 left-1/2 -translate-x-1/2 translate-y-2 whitespace-nowrap bg-primary-theme text-white text-[10px] font-bold px-4 py-2 rounded-full shadow-xl z-[70] animate-bounce flex items-center gap-2 border border-white/20">
              <Sparkles className="w-3 h-3" /> {hintMessage}
            </div>
          )}
          <GameBoard
            cards={cards}
            gridSize={settings.gridSize}
            flippedCount={flippedIndices.length}
            hintIndex={hintIndex}
            onCardClick={handleCardClick}
          />
        </section>

        {/* Left Sidebar Content (Desktop & Tablet) */}
        <aside className="flex flex-col gap-6 order-2 md:col-start-1 md:row-start-1 xl:row-span-12" aria-label="Player stats and settings">
          {/* A. Hall of Fame (Top of Left Sidebar for Tablet/Large Tablet) */}
          <div className="xl:hidden flex flex-col gap-6">
            <Leaderboard mode={settings.gridSize} />
            <LocalLlmInstallModule status={localLlmInstall} />
          </div>

          {/* B. Join Matchbox Gacha */}
          {!user && (
            <div className="bg-primary-light border border-primary-theme/20 rounded-xl p-5 flex flex-col gap-3 shadow-sm">
              <h3 className="text-xs font-bold text-primary-theme uppercase tracking-wider">Join Matchbox Gacha</h3>
              <p className="text-[11px] font-medium text-text-muted leading-relaxed">Sign in to track your personal bests across devices and qualify for the global leaderboard.</p>
              <button 
                onClick={() => setShowSignIn(true)}
                className="w-full py-2.5 bg-primary-theme text-white rounded-lg font-bold text-xs hover:bg-primary-theme/90 transition-all shadow-sm flex items-center justify-center gap-2"
              >
                <LogIn className="w-3.5 h-3.5" /> Start Syncing
              </button>
            </div>
          )}

          {/* C. Your Best */}
          <div className="bg-surface border border-border-theme rounded-xl p-5 flex flex-col gap-4 shadow-sm">
            <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider">Your Best</h3>
            <div className="flex justify-between items-center text-sm">
              <span className="text-text-muted">Best Time</span>
              <span className="font-mono font-bold text-text-main">{bestScore ? formatTime(bestScore.time) : "--:--"}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-text-muted">Least Moves</span>
              <span className="font-mono font-bold text-text-main">{bestScore?.moves || "--"}</span>
            </div>
          </div>

          {/* D. Game Settings */}
          <div className="flex flex-col gap-4">
            <div className="bg-surface border border-border-theme rounded-xl p-5 flex flex-col gap-4 shadow-sm">
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider">Game Settings</h3>
              
              <div className="flex flex-col">
                <span className="text-[10px] items-center uppercase tracking-wider text-text-muted font-bold mb-1">Difficulty</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-bold uppercase",
                    settings.gridSize === 6 ? "bg-rose-100 text-rose-900" : "bg-emerald-100 text-emerald-800"
                  )}>
                    {settings.gridSize === 4 ? "Normal" : "Hard"}
                  </span>
                  <span className="text-text-muted text-xs font-medium">({settings.gridSize}x{settings.gridSize})</span>
                </div>
              </div>

              <div className="flex flex-col mt-2">
                <span className="text-[10px] uppercase tracking-wider text-text-muted font-bold mb-1">Theme</span>
                <span className="text-sm font-semibold text-text-main capitalize">{settings.theme}</span>
              </div>
            </div>

            <button 
              onClick={() => setShowSettings(!showSettings)}
              className="w-full py-3 bg-transparent border border-border-theme rounded-lg text-text-main font-bold text-sm hover:bg-surface transition-colors flex items-center justify-center gap-2"
              aria-expanded={showSettings}
              aria-controls="settings-panel"
            >
              <Settings className="w-4 h-4" aria-hidden="true" />
              {showSettings ? "Close Settings" : "Adjust Settings"}
            </button>

            {/* Collapsible Settings */}
            <AnimatePresence>
              {showSettings && (
                <motion.div
                  id="settings-panel"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden bg-surface rounded-xl border border-border-theme p-4 space-y-4"
                >
                  <div>
                    <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-2">Grid Size</label>
                    <div className="flex gap-2">
                      {[4, 6].map(size => (
                        <button
                          key={size}
                          onClick={() => {
                            setSettings(s => ({ ...s, gridSize: size }));
                            logGameEvent('difficulty_change', { size });
                          }}
                          aria-pressed={settings.gridSize === size}
                          aria-label={`Set difficulty to ${size === 6 ? 'Hard 6 by 6' : 'Normal 4 by 4'}`}
                          className={cn(
                            "flex-1 py-1.5 rounded-lg text-xs font-bold transition-all border",
                            settings.gridSize === size 
                              ? size === 4
                                ? "bg-emerald-100 border-emerald-200 text-emerald-800"
                                : "bg-rose-100 border-rose-200 text-rose-900"
                              : "bg-transparent border-border-theme text-text-muted hover:border-text-muted"
                          )}
                        >
                          {size === 6 ? "Hard (6x6)" : "Normal (4x4)"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-2">Theme</label>
                    <div className="flex gap-2">
                      {(['icons', 'emojis', 'fruits'] as GameSettings['theme'][]).map(theme => (
                        <button
                          key={theme}
                          onClick={() => {
                            setSettings(s => ({ ...s, theme }));
                            logGameEvent('theme_change', { theme });
                          }}
                          aria-pressed={settings.theme === theme}
                          aria-label={`Set theme to ${theme}`}
                          className={cn(
                            "flex-1 py-1.5 rounded-lg text-xs font-bold transition-all border capitalize",
                            settings.theme === theme 
                              ? "bg-primary-theme border-primary-theme text-white" 
                              : "bg-transparent border-border-theme text-text-muted hover:border-text-muted"
                          )}
                        >
                          {theme}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </aside>

        {/* Right Sidebar (Desktop only - XL breakpoint) */}
        <aside className="hidden xl:flex flex-col gap-6 order-3 xl:col-start-3 xl:row-start-1 xl:row-span-12">
          <Leaderboard mode={settings.gridSize} />
          <LocalLlmInstallModule status={localLlmInstall} />
        </aside>
      </main>

      <footer className="py-3 px-4 text-center text-[10px] text-text-muted/70 font-mono tracking-wide" role="contentinfo">
        v{APP_VERSION}
      </footer>

      <SignInModal
        isOpen={showSignIn}
        onClose={() => setShowSignIn(false)}
      />

      <TutorialModal
        isOpen={showTutorial}
        onClose={handleCloseTutorial}
      />

      <GameOverModal
        isOpen={status === 'won'}
        moves={moves}
        time={time}
        bestMoves={bestScore?.moves || null}
        onReset={initGame}
        isGuest={!user}
        onGuestSubmit={async (name) => {
          await submitScore('guest', name, null, moves, time, settings.gridSize, settings.theme);
        }}
      />

    </div>
  );
}
