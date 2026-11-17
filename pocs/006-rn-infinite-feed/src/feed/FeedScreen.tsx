import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { useCallback } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { FeedApi, FeedApiErrorCode, Post } from '../api/types.ts';
import { PostRow } from './PostRow.tsx';
import { useFeed } from './useFeed.ts';

type Props = { api: FeedApi; pageSize?: number };

const keyExtractor = (post: Post) => post.id;
const renderItem: ListRenderItem<Post> = ({ item }) => <PostRow post={item} />;

/**
 * Virtualized feed. Pages load as the user nears the end of the list
 * (onEndReached) and pull to refresh fetches the newest first page.
 */
export function FeedScreen({ api, pageSize = 20 }: Props) {
  const feed = useFeed(api, pageSize);
  const { items, loading, error, hasMore, loadMore, refresh, retry } = feed;

  const footer = useCallback(() => {
    if (items.length === 0) return null;
    if (loading === 'more') return <ActivityIndicator style={styles.footer} />;
    if (error?.kind === 'more') return <RetryBlock code={error.code} onRetry={retry} />;
    if (!hasMore) return <Text style={[styles.footer, styles.muted]}>You're all caught up.</Text>;
    return null;
  }, [items.length, loading, error, hasMore, retry]);

  const empty = useCallback(() => {
    if (loading === 'initial') return <ActivityIndicator size="large" style={styles.empty} />;
    if (error) return <RetryBlock code={error.code} onRetry={retry} />;
    return <Text style={[styles.empty, styles.muted]}>No posts yet.</Text>;
  }, [loading, error, retry]);

  return (
    <View style={styles.container}>
      <Text style={styles.header} accessibilityRole="header">
        Feed · {items.length} posts
      </Text>
      {error?.kind === 'refresh' && (
        <Text style={styles.banner} accessibilityLiveRegion="polite">
          Couldn't refresh. Showing the last loaded posts.
        </Text>
      )}
      <FlashList
        data={items}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshing={loading === 'refresh'}
        onRefresh={refresh}
        ListFooterComponent={footer}
        ListEmptyComponent={empty}
      />
    </View>
  );
}

function RetryBlock({ code, onRetry }: { code: FeedApiErrorCode; onRetry: () => void }) {
  return (
    <View style={styles.footer}>
      <Text style={styles.error}>{code === 'NETWORK' ? 'Could not load posts.' : 'Something went wrong.'}</Text>
      <Pressable accessibilityRole="button" onPress={onRetry} style={styles.button}>
        <Text style={styles.buttonText}>Retry</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 56 },
  header: { fontSize: 20, fontWeight: '600', paddingHorizontal: 16, paddingBottom: 8 },
  banner: { backgroundColor: '#fff4e5', color: '#8a4b00', paddingHorizontal: 16, paddingVertical: 8 },
  footer: { alignItems: 'center', paddingVertical: 20, gap: 8, textAlign: 'center' },
  empty: { marginTop: 64, alignSelf: 'center' },
  muted: { color: '#666' },
  error: { color: '#b00020' },
  button: { backgroundColor: '#1d4ed8', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  buttonText: { color: '#fff', fontWeight: '600' },
});
