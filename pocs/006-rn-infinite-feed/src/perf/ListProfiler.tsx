import { Profiler, useRef, type ProfilerOnRenderCallback, type ReactNode } from 'react';
import { formatSummary, RenderStats } from './renderStats.ts';

type Props = {
  id: string;
  children: ReactNode;
  /** Log a summary every N commits. */
  every?: number;
  /** Defaults to __DEV__, so release builds pay nothing. */
  enabled?: boolean;
};

/**
 * Wraps a subtree in React's Profiler and logs commit timings to the Metro
 * console. Complements the Perf Monitor overlay: the overlay shows whether
 * frames drop (UI and JS FPS), this shows how much JS render work caused it.
 */
export function ListProfiler({ id, children, every = 50, enabled = __DEV__ }: Props) {
  const stats = useRef<RenderStats | null>(null);
  const commits = useRef(0);
  if (!enabled) return <>{children}</>;
  stats.current ??= new RenderStats();

  const onRender: ProfilerOnRenderCallback = (_id, phase, actualDuration) => {
    const s = stats.current!;
    s.record({ phase, actualDuration });
    commits.current += 1;
    if (commits.current % every === 0) console.log(formatSummary(id, s.summary()));
  };

  return (
    <Profiler id={id} onRender={onRender}>
      {children}
    </Profiler>
  );
}
