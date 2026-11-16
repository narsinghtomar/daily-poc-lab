import type { Post } from '../api/types.ts';

const AUTHORS = [
  { id: 'u-1', name: 'Asha Rao' },
  { id: 'u-2', name: 'Ben Carter' },
  { id: 'u-3', name: 'Chen Wei' },
  { id: 'u-4', name: 'Diego Alvarez' },
  { id: 'u-5', name: 'Elif Kaya' },
  { id: 'u-6', name: 'Farah Nasser' },
];

const SNIPPETS = [
  'Shipped the new onboarding flow today.',
  'Anyone else seeing slow builds after the upgrade?',
  'Coffee, then code review. In that order.',
  'Pairing session on the payments retry logic went well.',
  'Finally deleted 2,000 lines of dead code.',
  'Reminder: write the migration before the feature flag.',
  'Profiling showed the list re-rendering on every keystroke.',
  'Weekend hike photos coming soon.',
];

/** Small seeded PRNG so the dataset is identical on every run and in tests. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BASE_TIME = Date.UTC(2026, 10, 1, 12, 0, 0);

export function makeSeedPosts(count = 120, seed = 42): Post[] {
  const rand = mulberry32(seed);
  const posts: Post[] = [];
  for (let i = 0; i < count; i++) {
    // Every 10th post shares its timestamp with the previous one to exercise the id tie-breaker.
    const minutesAgo = i % 10 === 9 ? i - 1 : i;
    posts.push({
      id: `p-${String(i + 1).padStart(4, '0')}`,
      author: AUTHORS[Math.floor(rand() * AUTHORS.length)],
      text: SNIPPETS[Math.floor(rand() * SNIPPETS.length)],
      createdAt: new Date(BASE_TIME - minutesAgo * 60_000).toISOString(),
      likeCount: Math.floor(rand() * 500),
      likedByMe: rand() < 0.2,
    });
  }
  return posts;
}
