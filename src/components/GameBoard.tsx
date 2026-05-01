import { CardData } from '../types';
import { cn } from '../lib/utils';
import { Card } from './Card';

interface GameBoardProps {
  cards: CardData[];
  gridSize: number;
  flippedCount: number;
  hintIndex: number | null;
  onCardClick: (index: number) => void;
}

export function GameBoard({ cards, gridSize, flippedCount, hintIndex, onCardClick }: GameBoardProps) {
  return (
    <div
      role="group"
      aria-label={`Memory board ${gridSize} by ${gridSize}`}
      style={{
        gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`
      }}
      className={cn(
        "bg-surface rounded-[24px] border border-border-theme shadow-lg shadow-black/5 p-4 sm:p-10 grid gap-2 sm:gap-4 place-items-center justify-center auto-rows-fr w-full max-w-[800px] lg:max-w-none xl:max-w-[800px]",
        gridSize === 4 ? "grid-cols-4" : "grid-cols-4 sm:grid-cols-6"
      )}
    >
      {cards.map((card, index) => (
        <Card
          key={card.id}
          card={card}
          onClick={() => onCardClick(index)}
          disabled={flippedCount === 2 || card.isMatched || card.isFlipped}
          isActive={hintIndex === index}
        />
      ))}
    </div>
  );
}
