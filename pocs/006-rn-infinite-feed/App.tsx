import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { feedApi } from './src/api/client.ts';
import type { Post } from './src/api/types.ts';

type Status = 'idle' | 'loading' | 'error';

/**
 * Day 1 harness: proves the cursor API end to end with a manual "Load more".
 * The virtualized FlashList feed replaces this screen next.
 */
export default function App() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const inFlight = useRef<AbortController | null>(null);

  const loadNext = useCallback(async () => {
    if (inFlight.current || done) return;
    const controller = new AbortController();
    inFlight.current = controller;
    setStatus('loading');
    try {
      const page = await feedApi.fetchFeedPage({ cursor, limit: 10, signal: controller.signal });
      setPosts((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
      setDone(page.nextCursor === null);
      setStatus('idle');
    } catch {
      if (!controller.signal.aborted) setStatus('error');
    } finally {
      inFlight.current = null;
    }
  }, [cursor, done]);

  useEffect(() => {
    loadNext();
    return () => inFlight.current?.abort();
    // Load the first page once on mount; later pages are user driven.
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Feed · {posts.length} posts</Text>
      <ScrollView contentContainerStyle={styles.list}>
        {posts.map((p) => (
          <View key={p.id} style={styles.row}>
            <Text style={styles.author}>{p.author.name}</Text>
            <Text>{p.text}</Text>
            <Text style={styles.meta}>
              {p.likeCount} likes{p.likedByMe ? ' · liked' : ''} · {p.id}
            </Text>
          </View>
        ))}
        <View style={styles.footer}>
          {status === 'loading' && <ActivityIndicator />}
          {status === 'error' && <Text style={styles.error}>Could not load. Try again.</Text>}
          {status !== 'loading' && !done && (
            <Pressable accessibilityRole="button" onPress={loadNext} style={styles.button}>
              <Text style={styles.buttonText}>{status === 'error' ? 'Retry' : 'Load more'}</Text>
            </Pressable>
          )}
          {done && <Text style={styles.meta}>You're all caught up.</Text>}
        </View>
      </ScrollView>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 56 },
  header: { fontSize: 20, fontWeight: '600', paddingHorizontal: 16, paddingBottom: 8 },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  row: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ddd' },
  author: { fontWeight: '600', marginBottom: 2 },
  meta: { color: '#666', fontSize: 12, marginTop: 4 },
  footer: { alignItems: 'center', paddingVertical: 16, gap: 8 },
  error: { color: '#b00020' },
  button: { backgroundColor: '#1d4ed8', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  buttonText: { color: '#fff', fontWeight: '600' },
});
