import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Post } from '../api/types.ts';

type Props = { post: Post };

function PostRowImpl({ post }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.author}>{post.author.name}</Text>
      <Text style={styles.text}>{post.text}</Text>
      <Text style={styles.meta}>
        {post.likeCount} likes{post.likedByMe ? ' · liked' : ''} · {formatTime(post.createdAt)}
      </Text>
    </View>
  );
}

/** Rows only depend on their post, so skip re-rendering them when other pages arrive. */
export const PostRow = memo(PostRowImpl);

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
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
  meta: { color: '#666', fontSize: 12, marginTop: 4 },
});
