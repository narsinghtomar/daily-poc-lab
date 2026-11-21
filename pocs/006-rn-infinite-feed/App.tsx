import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { feedApi, startNewPostTicker } from './src/api/client.ts';
import { FeedScreen } from './src/feed/FeedScreen.tsx';
import { resolveListImpl } from './src/feed/listImpl.ts';

// Build-time switch for the FlatList vs FlashList comparison:
//   EXPO_PUBLIC_FEED_LIST=flat yarn start
const listImpl = resolveListImpl(process.env.EXPO_PUBLIC_FEED_LIST);

export default function App() {
  // New posts keep arriving at the top so pull to refresh has something to show.
  useEffect(() => startNewPostTicker(feedApi, 10_000), []);
  // One client per app instance; created lazily so a re-render never replaces it.
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <FeedScreen api={feedApi} pageSize={20} listImpl={listImpl} />
      <StatusBar style="auto" />
    </QueryClientProvider>
  );
}
