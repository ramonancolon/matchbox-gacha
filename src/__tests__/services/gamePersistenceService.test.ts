import { describe, it, expect, beforeEach } from 'vitest';
import { gamePersistenceService } from '../../services/gamePersistenceService';

describe('gamePersistenceService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ─── getBestScore ────────────────────────────────────────────────────────────

  describe('getBestScore', () => {
    it('returns null when no score is stored for the mode', () => {
      expect(gamePersistenceService.getBestScore(4)).toBeNull();
    });

    it('returns the stored best score', () => {
      localStorage.setItem('bestScore_4', JSON.stringify({ moves: 10, time: 30 }));
      expect(gamePersistenceService.getBestScore(4)).toEqual({ moves: 10, time: 30 });
    });

    it('returns null for corrupted JSON in localStorage', () => {
      localStorage.setItem('bestScore_4', 'not-valid-json{{');
      expect(gamePersistenceService.getBestScore(4)).toBeNull();
    });

    it('returns null for a mode that has no stored score', () => {
      localStorage.setItem('bestScore_4', JSON.stringify({ moves: 5, time: 20 }));
      expect(gamePersistenceService.getBestScore(6)).toBeNull();
    });
  });

  // ─── setBestScore ────────────────────────────────────────────────────────────

  describe('setBestScore', () => {
    it('writes a best score to localStorage', () => {
      gamePersistenceService.setBestScore(4, { moves: 10, time: 30 });
      expect(localStorage.getItem('bestScore_4')).toBe(JSON.stringify({ moves: 10, time: 30 }));
    });

    it('overwrites an existing best score', () => {
      gamePersistenceService.setBestScore(4, { moves: 15, time: 40 });
      gamePersistenceService.setBestScore(4, { moves: 8, time: 25 });
      expect(gamePersistenceService.getBestScore(4)).toEqual({ moves: 8, time: 25 });
    });

    it('stores scores for different modes independently', () => {
      gamePersistenceService.setBestScore(4, { moves: 10, time: 30 });
      gamePersistenceService.setBestScore(6, { moves: 20, time: 60 });
      expect(gamePersistenceService.getBestScore(4)).toEqual({ moves: 10, time: 30 });
      expect(gamePersistenceService.getBestScore(6)).toEqual({ moves: 20, time: 60 });
    });

    it('uses the correct localStorage key pattern bestScore_{mode}', () => {
      gamePersistenceService.setBestScore(6, { moves: 20, time: 60 });
      expect(localStorage.getItem('bestScore_6')).not.toBeNull();
      expect(localStorage.getItem('bestScore_4')).toBeNull();
    });
  });

  // ─── getBestScores ───────────────────────────────────────────────────────────

  describe('getBestScores', () => {
    it('returns scores for all requested modes', () => {
      gamePersistenceService.setBestScore(4, { moves: 10, time: 30 });
      gamePersistenceService.setBestScore(6, { moves: 20, time: 60 });
      const result = gamePersistenceService.getBestScores([4, 6]);
      expect(result[4]).toEqual({ moves: 10, time: 30 });
      expect(result[6]).toEqual({ moves: 20, time: 60 });
    });

    it('returns null for modes with no stored scores', () => {
      const result = gamePersistenceService.getBestScores([4, 6]);
      expect(result[4]).toBeNull();
      expect(result[6]).toBeNull();
    });

    it('returns partial results when only some modes have scores', () => {
      gamePersistenceService.setBestScore(4, { moves: 5, time: 15 });
      const result = gamePersistenceService.getBestScores([4, 6]);
      expect(result[4]).toEqual({ moves: 5, time: 15 });
      expect(result[6]).toBeNull();
    });

    it('returns an empty record for an empty modes array', () => {
      const result = gamePersistenceService.getBestScores([]);
      expect(result).toEqual({});
    });
  });

  // ─── setBestScores ───────────────────────────────────────────────────────────

  describe('setBestScores', () => {
    it('stores scores for multiple modes at once', () => {
      gamePersistenceService.setBestScores({
        4: { moves: 10, time: 30 },
        6: { moves: 20, time: 60 },
      });
      expect(gamePersistenceService.getBestScore(4)).toEqual({ moves: 10, time: 30 });
      expect(gamePersistenceService.getBestScore(6)).toEqual({ moves: 20, time: 60 });
    });

    it('skips null entries without throwing', () => {
      gamePersistenceService.setBestScores({ 4: null, 6: { moves: 20, time: 60 } });
      expect(gamePersistenceService.getBestScore(4)).toBeNull();
      expect(gamePersistenceService.getBestScore(6)).toEqual({ moves: 20, time: 60 });
    });

    it('does not throw when given an empty record', () => {
      expect(() => gamePersistenceService.setBestScores({})).not.toThrow();
    });
  });

  // ─── getTutorialSeen / setTutorialSeen ───────────────────────────────────────

  describe('tutorial seen flag', () => {
    it('returns false when tutorial has never been seen', () => {
      expect(gamePersistenceService.getTutorialSeen()).toBe(false);
    });

    it('returns true after marking tutorial as seen', () => {
      gamePersistenceService.setTutorialSeen(true);
      expect(gamePersistenceService.getTutorialSeen()).toBe(true);
    });

    it('returns false after marking tutorial as not seen', () => {
      localStorage.setItem('matchbox_tutorial_seen', 'true');
      gamePersistenceService.setTutorialSeen(false);
      expect(gamePersistenceService.getTutorialSeen()).toBe(false);
    });

    it('persists the seen flag to the correct localStorage key', () => {
      gamePersistenceService.setTutorialSeen(true);
      expect(localStorage.getItem('matchbox_tutorial_seen')).toBe('true');
    });

    it('returns false when localStorage value is an unexpected string', () => {
      localStorage.setItem('matchbox_tutorial_seen', 'yes');
      expect(gamePersistenceService.getTutorialSeen()).toBe(false);
    });
  });
});
