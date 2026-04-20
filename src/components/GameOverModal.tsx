import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, RotateCcw, Timer, Hash, Send, User } from 'lucide-react';

interface GameOverModalProps {
  isOpen: boolean;
  moves: number;
  time: number;
  bestMoves: number | null;
  onReset: () => void;
  isGuest: boolean;
  onGuestSubmit: (name: string) => Promise<void>;
}

export function GameOverModal({ isOpen, moves, time, bestMoves, onReset, isGuest, onGuestSubmit }: GameOverModalProps) {
  const [guestName, setGuestName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setGuestName('');
      setSubmitted(false);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleGuestSubmit = async () => {
    if (!guestName.trim()) return;
    setIsSubmitting(true);
    try {
      await onGuestSubmit(guestName.trim());
      setSubmitted(true);
    } catch (error) {
      console.error("Failed to submit guest score:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={onReset}
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative bg-surface rounded-[24px] shadow-2xl p-8 max-w-md w-full text-center overflow-hidden border border-border-theme"
          >
            <div className="absolute top-0 left-0 w-full h-1.5 bg-primary-theme" />
            
            <div className="flex justify-center mb-6">
              <div className="p-4 bg-primary-light rounded-full">
                <Trophy className="w-12 h-12 text-primary-theme" />
              </div>
            </div>

            <h2 className="text-3xl font-bold text-text-main mb-2">Victory!</h2>
            <p className="text-text-muted mb-8 text-sm font-medium">You've successfully completed the neural synchronization.</p>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-bg-theme p-4 rounded-xl border border-border-theme">
                <div className="flex items-center justify-center gap-2 text-text-muted text-[10px] mb-1 uppercase tracking-widest font-bold">
                  <Hash className="w-3 h-3" /> Total Moves
                </div>
                <div className="text-2xl font-bold text-text-main font-mono">{moves}</div>
              </div>
              <div className="bg-bg-theme p-4 rounded-xl border border-border-theme">
                <div className="flex items-center justify-center gap-2 text-text-muted text-[10px] mb-1 uppercase tracking-widest font-bold">
                  <Timer className="w-3 h-3" /> Time taken
                </div>
                <div className="text-2xl font-bold text-text-main font-mono">{formatTime(time)}</div>
              </div>
            </div>

            {isGuest && !submitted ? (
              <div className="mb-8 p-5 bg-primary-light/30 border border-primary-theme/10 rounded-2xl">
                <h3 className="text-[10px] font-bold text-primary-theme uppercase tracking-[0.2em] mb-3">Submit to Hall of Fame</h3>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                    <input 
                      type="text" 
                      placeholder="Enter your name..."
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      className="w-full bg-surface border border-border-theme rounded-xl pl-10 pr-4 py-2.5 text-sm text-text-main outline-none focus:ring-1 focus:ring-primary-theme transition-all"
                    />
                  </div>
                  <button
                    onClick={handleGuestSubmit}
                    disabled={!guestName.trim() || isSubmitting}
                    className="aspect-square bg-primary-theme text-white rounded-xl flex items-center justify-center hover:bg-primary-theme/90 disabled:opacity-50 transition-all px-4"
                  >
                    {isSubmitting ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ) : submitted ? (
              <div className="mb-8 py-3 px-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-500 text-xs font-bold">
                ✓ Score submitted to the Hall of Fame!
              </div>
            ) : bestMoves !== null && (
              <div className="mb-8 text-xs font-semibold text-text-muted uppercase tracking-wide">
                Personal Best: <span className="text-primary-theme">{bestMoves} moves</span>
              </div>
            )}

            <button
              onClick={onReset}
              className="w-full py-4 bg-primary-theme hover:bg-primary-theme/90 text-white rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary-theme/20"
            >
              <RotateCcw className="w-5 h-5" /> Start New Session
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
