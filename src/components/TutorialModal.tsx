import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Trophy, MousePointer2, X, ChevronRight, Check } from 'lucide-react';
import { cn } from '../lib/utils';
import { logGameEvent } from '../lib/firebase';

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TutorialModal({ isOpen, onClose }: TutorialModalProps) {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: "Welcome to Matchbox!",
      desc: "The goal is simple: flip cards to find matching pairs. Complete the board in the fastest time and with the fewest moves possible.",
      icon: <MousePointer2 className="w-8 h-8 text-primary-theme" />,
      color: "bg-blue-100"
    },
    {
      title: "AI Suggestions",
      desc: "Need a hand? Our AI can read the board and suggest your next move. Just click the Sparkles button when you're stuck!",
      icon: <Sparkles className="w-8 h-8 text-amber-500" />,
      color: "bg-amber-100"
    },
    {
      title: "Global Leaderboards",
      desc: "Switch between Normal and Hard modes, sign in, and compete against other players worldwide for the top spot on the Leaderboard.",
      icon: <Trophy className="w-8 h-8 text-emerald-500" />,
      color: "bg-emerald-100"
    }
  ];

  const handleNext = () => {
    if (step < steps.length - 1) {
      logGameEvent('tutorial_step', { step: step + 1, total_steps: steps.length });
      setStep(step + 1);
    } else {
      logGameEvent('tutorial_completed', { steps_seen: steps.length });
      onClose();
    }
  };

  const handleSkip = () => {
    logGameEvent('tutorial_skipped', { step_reached: step, total_steps: steps.length });
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={handleSkip}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="tutorial-title"
            aria-describedby="tutorial-desc"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative bg-surface rounded-[24px] shadow-2xl p-6 md:p-8 max-w-sm w-full border border-border-theme overflow-hidden flex flex-col gap-6 text-center"
          >
            <div className="flex justify-center mt-2">
              <div className={cn("w-16 h-16 rounded-full flex items-center justify-center transition-colors duration-500", steps[step].color)}>
                {steps[step].icon}
              </div>
            </div>
            
            <div>
              <h2 id="tutorial-title" className="text-xl font-bold text-text-main mb-2 tracking-tight">{steps[step].title}</h2>
              <p id="tutorial-desc" className="text-sm font-medium text-text-muted leading-relaxed min-h-[4.5rem]">
                {steps[step].desc}
              </p>
            </div>

            {/* Pagination Dots */}
            <div className="flex items-center justify-center gap-2 mt-2" aria-hidden="true">
              {steps.map((_, i) => (
                <div key={i} className={cn("h-2 rounded-full transition-all duration-300", i === step ? "bg-primary-theme w-6" : "bg-border-theme w-2")} />
              ))}
            </div>

            <div className="flex items-center gap-3 w-full mt-2">
              {step > 0 && (
                <button
                  onClick={() => setStep(step - 1)}
                  className="px-4 py-3 font-bold text-sm text-text-muted hover:bg-bg-theme rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-theme"
                  aria-label="Previous step"
                >
                  Back
                </button>
              )}
              <button
                onClick={handleNext}
                className="flex-1 py-3 bg-primary-theme hover:bg-primary-theme/90 text-white rounded-xl font-bold text-sm shadow-lg shadow-primary-theme/20 transition-all flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-theme focus-visible:ring-offset-2"
                aria-label={step === steps.length - 1 ? "Finish tutorial and play now" : "Go to next step"}
              >
                {step === steps.length - 1 ? (
                  <>Play Now <Check className="w-4 h-4" /></>
                ) : (
                  <>Next <ChevronRight className="w-4 h-4" /></>
                )}
              </button>
            </div>

            <button 
              onClick={handleSkip}
              className="absolute top-4 right-4 p-2 text-text-muted hover:text-text-main hover:bg-bg-theme rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-theme"
              aria-label="Skip tutorial"
            >
              <X className="w-5 h-5" />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
