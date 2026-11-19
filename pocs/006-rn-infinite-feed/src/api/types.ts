export type Author = {
  id: string;
  name: string;
};

/** Image attachment. Only the box size is needed before the image loads, so rows never jump. */
export type PostMedia = {
  /** width / height */
  aspectRatio: number;
  /** Placeholder colour shown while the image loads. */
  placeholderColor: string;
};

export type Post = {
  id: string;
  author: Author;
  text: string;
  /** ISO 8601 UTC timestamp. Same format for every post, so it sorts lexicographically. */
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
  /** Optional attachment. Rows with media render a different layout (see getPostItemType). */
  media?: PostMedia | null;
};

export type FeedPage = {
  items: Post[];
  /** Opaque token for the next page, or null when the feed is exhausted. */
  nextCursor: string | null;
};

export type FetchFeedParams = {
  cursor?: string | null;
  limit?: number;
  signal?: AbortSignal;
};

/** Server truth for one post's like, returned by every like/unlike call. */
export type LikeState = {
  postId: string;
  likedByMe: boolean;
  likeCount: number;
};

export type SetLikeParams = {
  postId: string;
  /** Desired end state, not a toggle, so retries and duplicates are harmless (PUT/DELETE /posts/:id/like). */
  liked: boolean;
  signal?: AbortSignal;
};

export interface FeedApi {
  fetchFeedPage(params?: FetchFeedParams): Promise<FeedPage>;
  setLike(params: SetLikeParams): Promise<LikeState>;
}

export type FeedApiErrorCode = 'INVALID_CURSOR' | 'NOT_FOUND' | 'NETWORK' | 'ABORTED';

export class FeedApiError extends Error {
  readonly code: FeedApiErrorCode;

  constructor(code: FeedApiErrorCode, message: string) {
    super(message);
    this.name = 'FeedApiError';
    this.code = code;
  }
}
