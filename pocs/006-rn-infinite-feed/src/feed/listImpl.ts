/**
 * Which virtualized list renders the feed. FlashList is the default; FlatList
 * is kept behind a switch so both can be measured on the same device with the
 * same data, rows and profiler.
 */
export type ListImpl = 'flash' | 'flat';

export const DEFAULT_LIST_IMPL: ListImpl = 'flash';

/**
 * Reads the list choice from a build-time value such as
 * EXPO_PUBLIC_FEED_LIST. Unknown or empty values fall back to FlashList, so a
 * typo can never ship the slower list by accident.
 */
export function resolveListImpl(value: string | undefined | null): ListImpl {
  const v = value?.trim().toLowerCase();
  if (v === 'flat' || v === 'flatlist') return 'flat';
  return DEFAULT_LIST_IMPL;
}

/**
 * FlatList settings used for the comparison. Defaults (windowSize 21,
 * maxToRenderPerBatch 10) keep about 10 screens of rows mounted; these are the
 * usual tuning for a feed, so the comparison is against a fair FlatList and
 * not a straw man.
 */
export const FLAT_LIST_TUNING = {
  initialNumToRender: 8,
  maxToRenderPerBatch: 8,
  windowSize: 7,
  updateCellsBatchingPeriod: 50,
  removeClippedSubviews: true,
} as const;
