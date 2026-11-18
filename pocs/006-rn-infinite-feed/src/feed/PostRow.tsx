import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Post } from '../api/types.ts';
import { useToggleLike } from '../likes/LikeContext.tsx';

type Props = { post: Post };

function PostRowImpl({ post }: Props) {
  const toggleLike = useToggleLike(post);
  return (
    <View style={styles.row}>
      <Text style={styles.author}>{post.author.name}</Text>
      <Text style={styles.text}>{post.text}</Text>
      <View style={styles.footer}>
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
        <Text style={styles.meta}>{formatTime(post.createdAt)}</Text>
      </View>
    </View>
  );
}

/** Rows only depend on their post, so skip re-rendering them when other pages arrive. */
export const PostRow = memo(PostRowImpl);

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  author: { fontWeight: '600', marginBottom: 2 },
  text: { fontSize: 15, lineHeight: 20 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  like: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 56 },
  likeIcon: { fontSize: 18, color: '#666' },
  liked: { color: '#e0245e' },
  meta: { color: '#666', fontSize: 12 },
});
