/**
 * Collects React Profiler commit timings for the feed list.
 * Pure and framework free so it can be unit tested; ListProfiler feeds it.
 */
export type RenderSample = {
  phase: 'mount' | 'update' | 'nested-update';
  /** Time React spent rendering the subtree for this commit (ms). */
  actualDuration: number;
};

export type RenderSummary = {
  commits: number;
  mounts: number;
  totalMs: number;
  avgMs: number;
  p95Ms: number;
  maxMs: number;
  /** Commits slower than one 60 fps frame (16.7 ms). These are the ones that can drop frames. */
  slowCommits: number;
};

export const FRAME_BUDGET_MS = 1000 / 60;

export class RenderStats {
  private durations: number[] = [];
  private mounts = 0;
  private readonly maxSamples: number;

  constructor(maxSamples = 500) {
    this.maxSamples = maxSamples;
  }

  record(sample: RenderSample): void {
    if (sample.phase === 'mount') this.mounts += 1;
    this.durations.push(sample.actualDuration);
    // Keep a sliding window so a long session does not grow memory without bound.
    if (this.durations.length > this.maxSamples) this.durations.shift();
  }

  get size(): number {
    return this.durations.length;
  }

  summary(): RenderSummary {
    const d = this.durations;
    if (d.length === 0) return { commits: 0, mounts: this.mounts, totalMs: 0, avgMs: 0, p95Ms: 0, maxMs: 0, slowCommits: 0 };
    const sorted = [...d].sort((a, b) => a - b);
    const totalMs = d.reduce((sum, x) => sum + x, 0);
    return {
      commits: d.length,
      mounts: this.mounts,
      totalMs: round(totalMs),
      avgMs: round(totalMs / d.length),
      p95Ms: round(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)]),
      maxMs: round(sorted[sorted.length - 1]),
      slowCommits: d.filter((x) => x > FRAME_BUDGET_MS).length,
    };
  }

  reset(): void {
    this.durations = [];
    this.mounts = 0;
  }
}

export function formatSummary(label: string, s: RenderSummary): string {
  return (
    `[perf] ${label}: ${s.commits} commits (${s.mounts} mounts), ` +
    `avg ${s.avgMs} ms, p95 ${s.p95Ms} ms, max ${s.maxMs} ms, ${s.slowCommits} over ${round(FRAME_BUDGET_MS)} ms`
  );
}

const round = (x: number) => Math.round(x * 10) / 10;
