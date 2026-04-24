import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db, logGameEvent } from '../lib/firebase';
import { cn } from '../lib/utils';
import { Timer, Hash, Trophy } from 'lucide-react';

interface ScoreEntry {
  id: string;
  userId: string;
  userName: string;
  userPhoto: string;
  moves: number;
  time: number;
}

interface LeaderboardProps {
  mode: number;
}

export function Leaderboard({ mode: initialMode }: LeaderboardProps) {
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMode, setActiveMode] = useState(initialMode);

  useEffect(() => {
    setActiveMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    setLoading(true);
    const scoresRef = collection(db, 'scores');
    const q = query(
      scoresRef,
      where('mode', '==', activeMode.toString()),
      orderBy('moves', 'asc'),
      orderBy('time', 'asc'), // Sort by time if moves are tied
      limit(20) 
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ScoreEntry[];
      
      // Filter unique users - show ONLY the best score for each person
      const uniqueTopThree: ScoreEntry[] = [];
      const seenUsers = new Set<string>();
      
      for (const score of data) {
        // If it's a guest, treat every submission as unique for the leaderboard
        // Otherwise, use userId to only show the best score per registered user
        const filterId = score.userId === 'guest' ? score.id : score.userId;
        
        if (!seenUsers.has(filterId)) {
          seenUsers.add(filterId);
          uniqueTopThree.push(score);
        }
        if (uniqueTopThree.length >= 3) break;
      }

      setScores(uniqueTopThree);
      setLoading(false);
    }, (err) => {
      console.error("Leaderboard Error:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [activeMode]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <section className="bg-surface border border-border-theme rounded-xl p-5 flex flex-col gap-4 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-500" aria-label="Leaderboard">
      <div className="flex flex-col gap-4 mb-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-2">
            <Trophy className="w-3.5 h-3.5 text-amber-500" /> Hall of Fame
          </h3>
        </div>
        
        <div className="flex bg-bg-theme p-1 rounded-lg">
          {[4, 6].map((m) => (
            <button
              key={m}
              onClick={() => {
                setActiveMode(m);
                logGameEvent('leaderboard_mode_change', { mode: m });
              }}
              aria-pressed={activeMode === m}
              aria-label={`Show ${m === 4 ? 'normal' : 'hard'} leaderboard`}
              className={cn(
                "flex-1 py-1.5 text-[10px] font-bold uppercase transition-all rounded-md border border-transparent",
                activeMode === m 
                  ? m === 4
                    ? "bg-emerald-100 text-emerald-800 border-emerald-200 shadow-sm"
                    : "bg-rose-100 text-rose-900 border-rose-200 shadow-sm"
                  : "text-text-muted hover:text-text-main"
              )}
            >
              {m === 4 ? "Normal" : "Hard"}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3" role="status" aria-live="polite" aria-atomic="true">
        {loading ? (
          <div className="py-8 text-center text-text-muted text-xs font-medium animate-pulse">Syncing with neural net...</div>
        ) : scores.length === 0 ? (
          <div className="py-8 text-center text-text-muted text-xs font-medium italic">No data recorded for this mode yet.</div>
        ) : (
          <ol className="space-y-3" aria-label={`Top players for ${activeMode} by ${activeMode} mode`}>
            {scores.map((score, index) => (
              <li key={score.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-bg-theme transition-colors group">
              <div className="w-6 text-center font-mono font-black text-text-muted text-xs group-hover:text-primary-theme">
                {index + 1}
              </div>
              <div className="w-8 h-8 rounded-full bg-primary-light flex-shrink-0 overflow-hidden border border-border-theme">
                {score.userPhoto ? (
                  <img src={score.userPhoto} alt={score.userName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-primary-theme font-bold text-[10px]">
                    {score.userName.charAt(0)}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-text-main truncate uppercase tracking-tight">{score.userName}</div>
              </div>
              <div className="flex items-center gap-3 text-[10px] font-bold font-mono">
                <div className="flex items-center gap-1 text-text-main">
                  <Hash className="w-2.5 h-2.5 opacity-50" /> {score.moves}
                </div>
                <div className="flex items-center gap-1 text-text-muted">
                  <Timer className="w-2.5 h-2.5 opacity-50" /> {formatTime(score.time)}
                </div>
              </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
