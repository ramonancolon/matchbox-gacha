export interface CardData {
  id: string;
  iconName: string;
  isFlipped: boolean;
  isMatched: boolean;
}

export type GameStatus = 'idle' | 'playing' | 'won';

export interface GameSettings {
  gridSize: number; // e.g., 4 for 4x4
  theme: 'emojis' | 'icons' | 'fruits';
}

export interface BestScore {
  moves: number;
  time: number;
}

export interface GameState {
  cards: CardData[];
  flippedIndices: number[];
  moves: number;
  matches: number;
  status: GameStatus;
  startTime: number | null;
  endTime: number | null;
  bestScore: number | null;
}
