import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Post } from '../api/types.ts';
import { useToggleLike } from '../likes/LikeContext.tsx';
import { formatPostTime, samePostContent, samePostRow } from './rowModel.ts';

type Props = { post: Post };

function PostRowImpl({ post }: Props) {
  return (
    <View style={styles.row}>
      <PostContent post={post} />
      <View style={styles.footer}>
        <LikeButton post={post} />
        <Text style={styles.meta}>{formatPostTime(post.createdAt)}</Text>
      </View>
    </View>
  );
}

/**
 * Author, text and photo. Memoized on content only, so a like tap re-renders
 * the like button but not the text and image above it.
 */
const PostContent = memo(function PostContent({ post }: Props) {
  return (
    <>
      <Text style={styles.author}>{post.author.name}</Text>
      <Text style={styles.text}>{post.text}</Text>
      {post.media && (
        <View
          accessibilityRole="image"
          accessibilityLabel="Photo"
          style={[styles.media, { aspectRatio: post.media.aspectRatio, backgroundColor: post.media.placeholderColor }]}
        />
      )}
    </>
  );
}, (prev, next) => samePostContent(prev.post, next.post));

function LikeButton({ post }: Props) {
  const toggleLike = useToggleLike(post);
  return (
    <Pressable
      onPress={toggleLike}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityState={{ selected: post.likedByMe }}
      accessibilityLabel={`${post.likedByMe ? 'Unlike' : 'Like'}. ${post.likeCount} likes`}
      style={styles.like}
    >
      <Text style={[styles.likeIcon, post.likedByMe && styles.liked]}>{post.likedByMe ? '♥' : '♡'}</Text>
      <Text style={styles.meta}>{post.likeCount}</Text>
    </Pressable>
  );
}

/**
 * Skips the render when nothing drawn changed, including when a refresh or a
 * new page hands back an equal copy of the same post.
 */
export const PostRow = memo(PostRowImpl, (prev, next) => samePostRow(prev.post, next.post));

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  author: { fontWeight: '600', marginBottom: 2 },
  text: { fontSize: 15, lineHeight: 20 },
  media: { width: '100%', borderRadius: 8, marginTop: 8 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  like: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 56 },
  likeIcon: { fontSize: 18, color: '#666' },
  liked: { color: '#e0245e' },
  meta: { color: '#666', fontSize: 12 },
});
