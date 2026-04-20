import { BestScore } from '../types';

export interface GamePersistenceService {
  getBestScore(mode: number): BestScore | null;
  setBestScore(mode: number, score: BestScore): void;
  getBestScores(modes: number[]): Record<number, BestScore | null>;
  setBestScores(scores: Record<number, BestScore | null>): void;
  getTutorialSeen(): boolean;
  setTutorialSeen(seen: boolean): void;
}

const BEST_SCORE_PREFIX = 'bestScore_';
const TUTORIAL_SEEN_KEY = 'matchbox_tutorial_seen';

const safeParse = <T>(value: string | null): T | null => {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

class LocalStorageGamePersistenceService implements GamePersistenceService {
  getBestScore(mode: number): BestScore | null {
    return safeParse<BestScore>(localStorage.getItem(`${BEST_SCORE_PREFIX}${mode}`));
  }

  setBestScore(mode: number, score: BestScore): void {
    localStorage.setItem(`${BEST_SCORE_PREFIX}${mode}`, JSON.stringify(score));
  }

  getBestScores(modes: number[]): Record<number, BestScore | null> {
    return modes.reduce<Record<number, BestScore | null>>((acc, mode) => {
      acc[mode] = this.getBestScore(mode);
      return acc;
    }, {});
  }

  setBestScores(scores: Record<number, BestScore | null>): void {
    Object.entries(scores).forEach(([mode, score]) => {
      if (!score) return;
      this.setBestScore(Number(mode), score);
    });
  }

  getTutorialSeen(): boolean {
    return localStorage.getItem(TUTORIAL_SEEN_KEY) === 'true';
  }

  setTutorialSeen(seen: boolean): void {
    localStorage.setItem(TUTORIAL_SEEN_KEY, seen ? 'true' : 'false');
  }
}

export const gamePersistenceService: GamePersistenceService = new LocalStorageGamePersistenceService();
