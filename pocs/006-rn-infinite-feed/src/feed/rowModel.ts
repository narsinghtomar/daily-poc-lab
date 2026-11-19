import type { Post } from '../api/types.ts';

/**
 * FlashList recycles row views only between items of the same type. Giving
 * photo posts their own type means a text row is never recycled into a photo
 * row (or back), which would force a full re-layout of the cell.
 */
export type PostItemType = 'text' | 'media';

export function getPostItemType(post: Post): PostItemType {
  return post.media ? 'media' : 'text';
}

/**
 * `memo` comparator for a feed row: true when nothing the row draws has changed.
 *
 * Reference equality is not enough. A refresh returns fresh copies of posts
 * the list already shows, so every row would re-render even though nothing on
 * screen moved. Comparing the drawn fields skips those renders.
 * Keep this in sync with what PostRow renders.
 */
export function samePostContent(a: Post, b: Post): boolean {
  if (a === b) return true;
  return (
    a.id === b.id &&
    a.text === b.text &&
    a.createdAt === b.createdAt &&
    a.author.id === b.author.id &&
    a.author.name === b.author.name &&
    sameMedia(a.media, b.media)
  );
}

/** Content plus the like fields: everything a whole row draws. */
export function samePostRow(a: Post, b: Post): boolean {
  return samePostContent(a, b) && a.likedByMe === b.likedByMe && a.likeCount === b.likeCount;
}

function sameMedia(a: Post['media'], b: Post['media']): boolean {
  if (a === b || (!a && !b)) return true;
  if (!a || !b) return false;
  return a.aspectRatio === b.aspectRatio && a.placeholderColor === b.placeholderColor;
}

// Building a formatter is far more expensive than using one, and
// toLocaleString builds a new one on every call. Share one across all rows.
const timeFormat = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatPostTime(iso: string, format: Intl.DateTimeFormat = timeFormat): string {
  return format.format(new Date(iso));
}
