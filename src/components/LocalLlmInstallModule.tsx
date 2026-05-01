import { isInstalledWebApp } from '../lib/installedWebApp';
import type { LocalLlmInstallStatus } from '../services/localLlmService';

interface LocalLlmInstallModuleProps {
  status: LocalLlmInstallStatus;
}

/**
 * Inline card shown under Hall of Fame while the WebLLM engine downloads
 * weights (installed PWA only). Non-blocking — cloud hints still work.
 */
export function LocalLlmInstallModule({ status }: LocalLlmInstallModuleProps) {
  if (!isInstalledWebApp()) return null;

  const visible = status.active || (status.progress > 0 && status.progress < 1);
  if (!visible) return null;

  const pct = Math.round(Math.max(0, Math.min(1, status.progress)) * 100);

  return (
    <section
      className="bg-surface border border-border-theme rounded-xl p-4 shadow-sm"
      aria-label="Local AI model download progress"
      aria-busy={status.active}
    >
      <h3 className="text-xs font-bold text-primary-theme uppercase tracking-wider mb-2">
        Local AI (offline hints)
      </h3>
      <p className="text-[11px] font-medium text-text-muted leading-relaxed mb-3">
        Installing model for faster hints in this installed app. You can keep playing — cloud hints still work.
      </p>
      <div className="w-full h-2 rounded-full bg-bg-theme overflow-hidden mb-2" aria-hidden="true">
        <div
          className="h-full bg-primary-theme transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[11px] text-text-muted font-medium" role="status" aria-live="polite">
        {status.text || 'Preparing download...'}
      </p>
      <p className="text-[10px] text-text-muted mt-1.5">{pct}%</p>
    </section>
  );
}
