import type { MutationOptions } from '@tanstack/react-query';
import type { FeedApi, LikeState, Post } from '../api/types.ts';

/** Prefix shared by every like mutation, used to find the pending ones. */
export const LIKE_MUTATION_KEY = ['post-like'] as const;

export type LikeVars = { postId: string; liked: boolean };

export type LikeMutationDeps = {
  api: Pick<FeedApi, 'setLike'>;
  /** Called with server truth before the mutation stops being pending, so the row never flickers. */
  onConfirmed: (like: LikeState) => void;
  onFailed: (vars: LikeVars, error: unknown) => void;
};

/**
 * Options for liking or unliking one post.
 *
 * The optimistic value is not written into the list. It is derived from the
 * pending mutations' variables (see `applyPendingLikes`), so rollback is free:
 * when a call fails it stops being pending and the row falls back to the last
 * server-confirmed state. There is no snapshot to restore, which is what makes
 * rapid like/unlike taps safe.
 *
 * `scope` runs calls for the same post one after another, so the server sees
 * them in tap order and the last confirmed response is the real final state.
 * Different posts still run in parallel.
 */
export function likeMutationOptions(
  deps: LikeMutationDeps,
  postId: string,
): MutationOptions<LikeState, Error, LikeVars> {
  return {
    mutationKey: [...LIKE_MUTATION_KEY, postId],
    scope: { id: `post-like:${postId}` },
    mutationFn: (vars) => deps.api.setLike(vars),
    // Off so a failure is visible; the call is idempotent, so a NETWORK retry would also be safe.
    retry: 0,
    onSuccess: (like) => deps.onConfirmed(like),
    onError: (error, vars) => deps.onFailed(vars, error),
  };
}

/**
 * Overlays pending like intents on the server-confirmed list.
 * The latest pending intent per post wins (mutations are listed oldest first).
 * Rows without a pending change keep their identity so memoized rows skip rendering.
 */
export function applyPendingLikes(items: Post[], pending: readonly (LikeVars | undefined)[]): Post[] {
  if (pending.length === 0) return items;
  const intent = new Map<string, boolean>();
  for (const vars of pending) if (vars) intent.set(vars.postId, vars.liked);

  let changed = false;
  const out = items.map((post) => {
    const liked = intent.get(post.id);
    if (liked === undefined || liked === post.likedByMe) return post;
    changed = true;
    return { ...post, likedByMe: liked, likeCount: Math.max(0, post.likeCount + (liked ? 1 : -1)) };
  });
  return changed ? out : items;
}
