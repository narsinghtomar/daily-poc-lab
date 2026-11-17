import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { feedApi, startNewPostTicker } from './src/api/client.ts';
import { FeedScreen } from './src/feed/FeedScreen.tsx';

export default function App() {
  // New posts keep arriving at the top so pull to refresh has something to show.
  useEffect(() => startNewPostTicker(feedApi, 10_000), []);

  return (
    <>
      <FeedScreen api={feedApi} pageSize={20} />
      <StatusBar style="auto" />
    </>
  );
}
