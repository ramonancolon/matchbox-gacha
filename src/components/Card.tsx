import { motion } from 'motion/react';
import * as Icons from 'lucide-react';
import { CardData } from '../types';
import { cn } from '../lib/utils';

interface CardProps {
  card: CardData;
  onClick: () => void;
  disabled: boolean;
  isActive?: boolean;
  key?: string | number;
}

export function Card({ card, onClick, disabled, isActive }: CardProps) {
  const iconKey = card.iconName as keyof typeof Icons;
  const IconComponent = iconKey in Icons ? Icons[iconKey] : null;

  return (
    <button 
      className="relative w-full aspect-square perspective-1000 cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-theme rounded-xl"
      onClick={() => !disabled && !card.isFlipped && onClick()}
      disabled={disabled || card.isFlipped}
      aria-label={card.isFlipped ? (card.isMatched ? `Matched ${card.iconName}` : `Showing ${card.iconName}`) : "Card face down"}
      aria-pressed={card.isFlipped}
    >
      <motion.div
        className="w-full h-full relative"
        initial={false}
        animate={{ rotateY: card.isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, type: 'spring', stiffness: 260, damping: 18 }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Front Face (Icon side) */}
        <div
          className={cn(
            "absolute inset-0 w-full h-full flex items-center justify-center rounded-xl backface-hidden border-2 text-primary-theme",
            card.isMatched 
              ? "bg-[rgba(16,185,129,0.1)] border-success-theme text-success-theme" 
              : "bg-surface border-primary-theme shadow-lg shadow-black/5"
          )}
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          {IconComponent ? (
            <IconComponent className="w-8 h-8 md:w-12 md:h-12" />
          ) : (
            <span className="text-3xl md:text-4xl select-none">{card.iconName}</span>
          )}
        </div>

        {/* Back Face (Pattern side) */}
        <div
          className={cn(
            "absolute inset-0 w-full h-full flex items-center justify-center bg-[#F1F5F9] border-2 border-dashed border-border-theme rounded-xl backface-hidden transition-all duration-300",
            isActive && "border-primary-theme bg-primary-light ring-4 ring-primary-theme/30 scale-105"
          )}
          style={{ backfaceVisibility: 'hidden' }}
        >
          <div className={cn(
            "text-border-theme font-black text-2xl opacity-50 select-none",
            isActive && "text-primary-theme opacity-100 animate-pulse"
          )}>?</div>
        </div>
      </motion.div>
    </button>
  );
}
