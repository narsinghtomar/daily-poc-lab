import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { notifyManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { Post } from '../api/types.ts';
import { makeSeedPosts } from '../data/seed.ts';
import { createControlledFeedApi } from '../test/controlledFeedApi.ts';
import { FeedScreen } from './FeedScreen.tsx';

const PAGE = 3;

/** Text posts with like counts 10, 20, 30..., so every like button label is unique. */
function testPosts(count: number): Post[] {
  return makeSeedPosts(count).map((p, i) => ({ ...p, media: null, likedByMe: false, likeCount: (i + 1) * 10 }));
}

async function renderFeed(count = 5) {
  const posts = testPosts(count);
  const ctl = createControlledFeedApi(posts);
  // gcTime Infinity: no garbage-collection timers left running after a test, so Jest can exit.
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: 0, gcTime: Infinity } } });
  await render(
    <QueryClientProvider client={queryClient}>
      <FeedScreen api={ctl.api} pageSize={PAGE} />
    </QueryClientProvider>,
  );
  const answer = async (outcome: 'ok' | 'fail' = 'ok') => {
    const call = ctl.nextPage();
    if (!call) throw new Error('No pending page request');
    await act(() => (outcome === 'ok' ? call.resolve() : call.reject()));
  };
  return { ...ctl, posts, answer, queryClient };
}

const likeButton = (likes: number) => screen.getByRole('button', { name: new RegExp(`^(Like|Unlike)\\. ${likes} likes$`) });

describe('FeedScreen pagination', () => {
  test('shows a spinner, then the first page; a failed first load offers retry', async () => {
    const ctl = await renderFeed();
    expect(screen.getByText('Feed · 0 posts')).toBeOnTheScreen();

    await ctl.answer('fail');
    expect(screen.getByText('Could not load posts.')).toBeOnTheScreen();

    await act(() => fireEvent.press(screen.getByRole('button', { name: 'Retry' })));
    await ctl.answer();
    expect(screen.getByText('Feed · 3 posts')).toBeOnTheScreen();
    expect(screen.getAllByRole('button', { name: /^Like\. / })).toHaveLength(3);
  });

  test('loads the next page on end reached and shows the end marker', async () => {
    const ctl = await renderFeed(5);
    await ctl.answer();

    await act(() => fireEvent(screen.getByTestId('feed-list'), 'endReached'));
    expect(ctl.pages).toHaveLength(2);
    await ctl.answer();

    expect(screen.getByText('Feed · 5 posts')).toBeOnTheScreen();
    expect(screen.getByText("You're all caught up.")).toBeOnTheScreen();
  });

  test('a failed page shows an inline retry that resumes from the same cursor', async () => {
    const ctl = await renderFeed(5);
    await ctl.answer();
    await act(() => fireEvent(screen.getByTestId('feed-list'), 'endReached'));
    const cursor = ctl.pages[1].params.cursor;
    await ctl.answer('fail');

    expect(screen.getByText('Feed · 3 posts')).toBeOnTheScreen();
    await act(() => fireEvent.press(screen.getByRole('button', { name: 'Retry' })));
    expect(ctl.pages[2].params.cursor).toBe(cursor);
    await ctl.answer();
    expect(screen.getByText('Feed · 5 posts')).toBeOnTheScreen();
  });
});

describe('FeedScreen optimistic likes', () => {
  // TanStack Query batches its UI updates on a setTimeout(0), which act() does not
  // wait for. Running the batch on a microtask makes each update land inside act().
  beforeEach(() => notifyManager.setScheduler(queueMicrotask));
  afterEach(() => {
    notifyManager.setScheduler((cb) => setTimeout(cb, 0));
    jest.useRealTimers();
  });

  test('a like shows at once and stays after the server confirms it', async () => {
    const ctl = await renderFeed();
    await ctl.answer();

    await act(() => fireEvent.press(likeButton(10)));
    expect(likeButton(11)).toHaveAccessibleName('Unlike. 11 likes');
    expect(ctl.likes[0].params).toEqual({ postId: ctl.posts[0].id, liked: true });

    await act(() => ctl.nextLike()!.resolve());
    expect(likeButton(11)).toHaveAccessibleName('Unlike. 11 likes');
    expect(screen.queryByText(/Couldn't save your like/)).not.toBeOnTheScreen();
  });

  test('a failed like rolls back to server truth and shows a short notice', async () => {
    const ctl = await renderFeed();
    await ctl.answer();

    await act(() => fireEvent.press(likeButton(10)));
    expect(likeButton(11)).toHaveAccessibleName('Unlike. 11 likes');

    // Fake timers from here on, to skip the 3 s notice timeout.
    jest.useFakeTimers();

    await act(() => ctl.nextLike()!.reject());
    expect(likeButton(10)).toHaveAccessibleName('Like. 10 likes');
    expect(screen.getByText("Couldn't save your like. It has been undone.")).toBeOnTheScreen();

    await act(() => jest.advanceTimersByTime(3000));
    expect(screen.queryByText(/Couldn't save your like/)).not.toBeOnTheScreen();
  });

  test('like then unlike: first saved, second failed, the row lands on the saved like', async () => {
    const ctl = await renderFeed();
    await ctl.answer();

    await act(() => fireEvent.press(likeButton(10)));
    await act(() => fireEvent.press(likeButton(11)));
    expect(likeButton(10)).toHaveAccessibleName('Like. 10 likes');
    // Same post, same scope: the unlike waits until the like is answered.
    expect(ctl.likes).toHaveLength(1);

    await act(() => ctl.likes[0].resolve());
    expect(ctl.likes).toHaveLength(2);
    await act(() => ctl.likes[1].reject());

    expect(likeButton(11)).toHaveAccessibleName('Unlike. 11 likes');
  });

  test('a refresh while a like is pending keeps the optimistic value', async () => {
    const ctl = await renderFeed();
    await ctl.answer();
    await act(() => fireEvent.press(likeButton(10)));

    await act(() => fireEvent(screen.getByTestId('feed-list'), 'refresh'));
    await ctl.answer();
    expect(likeButton(11)).toHaveAccessibleName('Unlike. 11 likes');

    await act(() => ctl.nextLike()!.reject());
    expect(likeButton(10)).toHaveAccessibleName('Like. 10 likes');
  });
});
