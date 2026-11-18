import { useMutation } from '@tanstack/react-query';
import { createContext, useCallback, useContext } from 'react';
import type { Post } from '../api/types.ts';
import { likeMutationOptions, type LikeMutationDeps } from './likeMutation.ts';

const LikeContext = createContext<LikeMutationDeps | null>(null);

export const LikeProvider = LikeContext.Provider;

/**
 * Like/unlike for one row. `post` must be the displayed post (pending intent
 * applied), so a second tap flips the intent the user sees, not stale server state.
 */
export function useToggleLike(post: Post): () => void {
  const deps = useContext(LikeContext);
  if (!deps) throw new Error('useToggleLike must be used inside <LikeProvider>');
  const { mutate } = useMutation(likeMutationOptions(deps, post.id));
  const { id, likedByMe } = post;
  return useCallback(() => mutate({ postId: id, liked: !likedByMe }), [mutate, id, likedByMe]);
}
