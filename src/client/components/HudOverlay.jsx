import { useHardwareStats } from '../hooks/useHardwareStats.js';

function formatMemory(bytes) {
  if (!bytes) {
    return '0 GB';
  }

  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export function HudOverlay() {
  const { stats, connectionState, error } = useHardwareStats();

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-start justify-between p-4 text-slate-100">
      <section className="max-w-sm rounded-2xl border border-white/10 bg-slate-950/75 p-4 shadow-2xl shadow-black/30 backdrop-blur-md">
        <div className="mb-3 flex items-center justify-between gap-4">
          <h1 className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300">
            Ghost Dash
          </h1>
          <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-slate-300">
            {connectionState}
          </span>
        </div>

        <div className="space-y-3 text-sm">
          <div className="rounded-xl bg-white/5 p-3">
            <div className="mb-1 flex items-center justify-between text-slate-300">
              <span>CPU Load</span>
              <span>{stats.cpu.loadPercent.toFixed(1)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-cyan-400 transition-all duration-500"
                style={{ width: `${Math.min(stats.cpu.loadPercent, 100)}%` }}
              />
            </div>
          </div>

          <div className="rounded-xl bg-white/5 p-3">
            <div className="mb-1 flex items-center justify-between text-slate-300">
              <span>RAM Usage</span>
              <span>{stats.memory.usedPercent.toFixed(1)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                style={{ width: `${Math.min(stats.memory.usedPercent, 100)}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
              <span>{formatMemory(stats.memory.usedBytes)} used</span>
              <span>{formatMemory(stats.memory.totalBytes)} total</span>
            </div>
          </div>

          {error ? (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {error.message}
            </p>
          ) : null}
        </div>
      </section>

      <aside className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-300 backdrop-blur-md">
        Live system telemetry
      </aside>
    </div>
  );
}