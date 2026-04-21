import { useCallback, useEffect, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import { EMOJIS, FRUIT_NAMES, ICON_NAMES } from '../constants';
import { soundManager } from '../lib/sounds';
import { getNextMoveHint } from '../services/geminiService';
import { GamePersistenceService, gamePersistenceService } from '../services/gamePersistenceService';
import { BestScore, CardData, GameSettings, GameStatus } from '../types';

interface UseMatchingGameOptions {
  settings: GameSettings;
  user: User | null;
  soundEnabled: boolean;
  persistenceService?: GamePersistenceService;
  logEvent?: (eventName: string, payload: Record<string, unknown>) => void;
  onWin?: (result: { moves: number; time: number; gridSize: number; theme: GameSettings['theme']; user: User }) => void;
}

const THEME_SOURCES: Record<GameSettings['theme'], readonly string[]> = {
  icons: ICON_NAMES,
  emojis: EMOJIS,
  fruits: FRUIT_NAMES
};

const createShuffledCards = (settings: GameSettings): CardData[] => {
  const pairCount = (settings.gridSize * settings.gridSize) / 2;
  const sourceArray = THEME_SOURCES[settings.theme] ?? ICON_NAMES;
  const selectedItems = [...sourceArray].sort(() => Math.random() - 0.5).slice(0, pairCount);
  const cardPool = [...selectedItems, ...selectedItems];

  for (let i = cardPool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cardPool[i], cardPool[j]] = [cardPool[j], cardPool[i]];
  }

  return cardPool.map((item, index) => ({
    id: `${item}-${index}-${Math.random()}`,
    iconName: item,
    isFlipped: false,
    isMatched: false
  }));
};

export function useMatchingGame({
  settings,
  user,
  soundEnabled,
  persistenceService = gamePersistenceService,
  logEvent,
  onWin
}: UseMatchingGameOptions) {
  const [cards, setCards] = useState<CardData[]>([]);
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [matches, setMatches] = useState(0);
  const [status, setStatus] = useState<GameStatus>('idle');
  const [time, setTime] = useState(0);
  const [bestScore, setBestScore] = useState<BestScore | null>(null);
  const [hintIndex, setHintIndex] = useState<number | null>(null);
  const [hintMessage, setHintMessage] = useState<string | null>(null);
  const [isGettingHint, setIsGettingHint] = useState(false);
  const [hintsRemaining, setHintsRemaining] = useState(3);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const movesRef = useRef(0);
  const timeRef = useRef(0);
  const hintsRemainingRef = useRef(3);
  const isFirstMountRef = useRef(true);

  useEffect(() => {
    movesRef.current = moves;
  }, [moves]);

  useEffect(() => {
    timeRef.current = time;
  }, [time]);

  useEffect(() => {
    hintsRemainingRef.current = hintsRemaining;
  }, [hintsRemaining]);

  useEffect(() => {
    setBestScore(persistenceService.getBestScore(settings.gridSize));
  }, [persistenceService, settings.gridSize]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const startTimer = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => {
      setTime(prev => prev + 1);
    }, 1000);
  }, []);

  const initGame = useCallback(() => {
    const pairCount = (settings.gridSize * settings.gridSize) / 2;
    setCards(createShuffledCards(settings));
    setFlippedIndices([]);
    setMoves(0);
    setMatches(0);
    setStatus('idle');
    setTime(0);
    setHintIndex(null);
    setHintMessage(null);
    setHintsRemaining(3);
    stopTimer();

    // Only fire game_init when the user explicitly triggers a new game,
    // not on the silent first mount caused by settings dependencies.
    if (!isFirstMountRef.current) {
      logEvent?.('game_init', {
        grid_size: settings.gridSize,
        theme: settings.theme,
        pair_count: pairCount
      });
    }
    isFirstMountRef.current = false;
  }, [logEvent, settings, stopTimer]);

  const handleWin = useCallback(() => {
    setStatus('won');
    setHintIndex(null);
    setHintMessage(null);
    stopTimer();

    if (soundEnabled) soundManager.play('win');

    const finalMoves = movesRef.current;
    const finalTime = timeRef.current;

    logEvent?.('game_won', {
      grid_size: settings.gridSize,
      moves: finalMoves,
      time: finalTime,
      hints_used: 3 - hintsRemainingRef.current
    });

    const currentBest = persistenceService.getBestScore(settings.gridSize);
    const isBetter =
      !currentBest ||
      finalMoves < currentBest.moves ||
      (finalMoves === currentBest.moves && finalTime < currentBest.time);

    if (isBetter) {
      const newBest = { moves: finalMoves, time: finalTime };
      persistenceService.setBestScore(settings.gridSize, newBest);
      setBestScore(newBest);
    }

    if (user) {
      onWin?.({
        moves: finalMoves,
        time: finalTime,
        gridSize: settings.gridSize,
        theme: settings.theme,
        user
      });
    }
  }, [logEvent, onWin, persistenceService, settings.gridSize, settings.theme, soundEnabled, stopTimer, user]);

  const handleCardClick = useCallback((index: number) => {
    if (status === 'won' || flippedIndices.length === 2) return;
    if (cards[index].isFlipped || cards[index].isMatched) return;

    if (soundEnabled) soundManager.play('flip');
    setHintIndex(null);
    setHintMessage(null);

    if (status === 'idle') {
      setStatus('playing');
      startTimer();
      logEvent?.('game_start', {
        grid_size: settings.gridSize,
        theme: settings.theme
      });
    }

    const newFlipped = [...flippedIndices, index];
    setFlippedIndices(newFlipped);
    setCards(prev => {
      const updated = [...prev];
      updated[index].isFlipped = true;
      return updated;
    });

    logEvent?.('card_flip', {
      index,
      icon: cards[index].iconName,
      flip_order: newFlipped.length
    });

    if (newFlipped.length === 2) {
      const [first, second] = newFlipped;
      const nextMoves = movesRef.current + 1;

      setMoves(nextMoves);
      movesRef.current = nextMoves;

      if (cards[first].iconName === cards[second].iconName) {
        logEvent?.('match_found', {
          icon: cards[first].iconName,
          moves: nextMoves
        });

        setTimeout(() => {
          if (soundEnabled) soundManager.play('match');

          setCards(prev => {
            const updated = [...prev];
            updated[first].isMatched = true;
            updated[second].isMatched = true;
            return updated;
          });

          setFlippedIndices([]);
          setMatches(prev => {
            const nextMatches = prev + 1;
            if (nextMatches === (settings.gridSize * settings.gridSize) / 2) {
              handleWin();
            }
            return nextMatches;
          });
        }, 500);
      } else {
        logEvent?.('match_failed', {
          icon1: cards[first].iconName,
          icon2: cards[second].iconName
        });

        setTimeout(() => {
          setCards(prev => {
            const updated = [...prev];
            updated[first].isFlipped = false;
            updated[second].isFlipped = false;
            return updated;
          });
          setFlippedIndices([]);
        }, 1000);
      }
    }
  }, [cards, flippedIndices, handleWin, logEvent, settings.gridSize, settings.theme, soundEnabled, startTimer, status]);

  const handleGetHint = useCallback(async () => {
    if (status !== 'playing' || isGettingHint || hintsRemaining <= 0) return;

    setIsGettingHint(true);
    if (soundEnabled) soundManager.play('hint');

    const hint = await getNextMoveHint(cards, flippedIndices, settings.gridSize);
    if (hint) {
      setHintIndex(hint.index);
      setHintMessage(hint.message);
      setHintsRemaining(prev => prev - 1);

      logEvent?.('hint_received', {
        hints_remaining: hintsRemainingRef.current - 1,
        grid_size: settings.gridSize
      });

      setTimeout(() => {
        setHintIndex(null);
        setHintMessage(null);
      }, 5000);
    }

    setIsGettingHint(false);
  }, [cards, flippedIndices, hintsRemaining, isGettingHint, logEvent, settings.gridSize, soundEnabled, status]);

  useEffect(() => {
    initGame();
    return () => stopTimer();
  }, [initGame, stopTimer]);

  return {
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
  };
}
