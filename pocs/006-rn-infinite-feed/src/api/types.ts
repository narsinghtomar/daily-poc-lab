export type Author = {
  id: string;
  name: string;
};

export type Post = {
  id: string;
  author: Author;
  text: string;
  /** ISO 8601 UTC timestamp. Same format for every post, so it sorts lexicographically. */
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
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

export interface FeedApi {
  fetchFeedPage(params?: FetchFeedParams): Promise<FeedPage>;
}

export type FeedApiErrorCode = 'INVALID_CURSOR' | 'NETWORK' | 'ABORTED';

export class FeedApiError extends Error {
  readonly code: FeedApiErrorCode;

  constructor(code: FeedApiErrorCode, message: string) {
    super(message);
    this.name = 'FeedApiError';
    this.code = code;
  }
}
