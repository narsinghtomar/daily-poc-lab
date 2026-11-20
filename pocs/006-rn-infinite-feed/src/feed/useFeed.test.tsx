import { describe, expect, test } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { makeSeedPosts } from '../data/seed.ts';
import { createControlledFeedApi } from '../test/controlledFeedApi.ts';
import { useFeed } from './useFeed.ts';

const PAGE = 5;

async function setup(count = 12, options?: { honorAbort?: boolean }) {
  const ctl = createControlledFeedApi(makeSeedPosts(count), options);
  const hook = await renderHook(() => useFeed(ctl.api, PAGE));
  return { ...ctl, hook, state: () => hook.result.current };
}

async function answerNext(ctl: Awaited<ReturnType<typeof setup>>, outcome: 'ok' | 'fail' | 'invalid' = 'ok') {
  const call = ctl.nextPage();
  if (!call) throw new Error('No pending page request');
  await act(() => (outcome === 'ok' ? call.resolve() : call.reject(outcome === 'invalid' ? 'INVALID_CURSOR' : 'NETWORK')));
}

describe('useFeed pagination', () => {
  test('loads the first page on mount, then appends pages by cursor until the end', async () => {
    const ctl = await setup(12);
    expect(ctl.state().loading).toBe('initial');
    expect(ctl.pages[0].params.cursor).toBeNull();

    await answerNext(ctl);
    expect(ctl.state().items).toHaveLength(5);
    expect(ctl.state().hasMore).toBe(true);

    await act(() => ctl.state().loadMore());
    expect(ctl.pages[1].params.cursor).toBe(ctl.state().nextCursor);
    await answerNext(ctl);
    await act(() => ctl.state().loadMore());
    await answerNext(ctl);

    const ids = ctl.state().items.map((p) => p.id);
    expect(ids).toHaveLength(12);
    expect(new Set(ids).size).toBe(12);
    expect(ctl.state().hasMore).toBe(false);

    // Past the end, scrolling does not hit the server again.
    await act(() => ctl.state().loadMore());
    expect(ctl.pages).toHaveLength(3);
  });

  test('ignores repeated onEndReached calls while a page is in flight', async () => {
    const ctl = await setup();
    await answerNext(ctl);

    await act(() => {
      ctl.state().loadMore();
      ctl.state().loadMore();
      ctl.state().loadMore();
    });
    expect(ctl.pages).toHaveLength(2);
  });

  test('refresh aborts a pending page, and the late page never lands on the fresh list', async () => {
    const ctl = await setup();
    await answerNext(ctl);
    await act(() => ctl.state().loadMore());
    const stalePage = ctl.pages[1];

    await act(() => ctl.state().refresh());
    await waitFor(() => expect(stalePage.settled).toBe(true));
    expect(ctl.state().loading).toBe('refresh');
    expect(ctl.pages[2].params.cursor).toBeNull();

    await answerNext(ctl);
    expect(ctl.state().items).toHaveLength(PAGE);
    expect(ctl.state().loading).toBeNull();
    expect(ctl.state().error).toBeNull();
  });

  test('a page that still answers after a refresh started is dropped as stale', async () => {
    const ctl = await setup(12, { honorAbort: false });
    await answerNext(ctl);
    await act(() => ctl.state().loadMore());
    await act(() => ctl.state().refresh());
    const [, stalePage, refreshPage] = ctl.pages;

    await act(() => stalePage.resolve());
    expect(ctl.state().items).toHaveLength(PAGE);
    expect(ctl.state().loading).toBe('refresh');

    await act(() => refreshPage.resolve());
    expect(ctl.state().items.map((p) => p.id)).toEqual(makeSeedPosts(12).slice(0, PAGE).map((p) => p.id));
    expect(ctl.state().loading).toBeNull();
  });

  test('a failed page stops auto paging until retry, which reuses the same cursor', async () => {
    const ctl = await setup();
    await answerNext(ctl);
    await act(() => ctl.state().loadMore());
    const failedCursor = ctl.pages[1].params.cursor;
    await answerNext(ctl, 'fail');

    expect(ctl.state().error).toEqual({ kind: 'more', code: 'NETWORK' });
    expect(ctl.state().items).toHaveLength(PAGE);

    await act(() => ctl.state().loadMore());
    expect(ctl.pages).toHaveLength(2);

    await act(() => ctl.state().retry());
    expect(ctl.pages).toHaveLength(3);
    expect(ctl.pages[2].params.cursor).toBe(failedCursor);
    await answerNext(ctl);
    expect(ctl.state().items).toHaveLength(PAGE * 2);
    expect(ctl.state().error).toBeNull();
  });

  test('an INVALID_CURSOR on a page resets the feed to the top', async () => {
    const ctl = await setup();
    await answerNext(ctl);
    await act(() => ctl.state().loadMore());
    await answerNext(ctl, 'invalid');

    await waitFor(() => expect(ctl.pages).toHaveLength(3));
    expect(ctl.pages[2].params.cursor).toBeNull();
    expect(ctl.state().loading).toBe('refresh');
    await answerNext(ctl);
    expect(ctl.state().items).toHaveLength(PAGE);
    expect(ctl.state().hasMore).toBe(true);
  });

  test('a failed refresh keeps the posts already on screen', async () => {
    const ctl = await setup();
    await answerNext(ctl);
    const before = ctl.state().items;

    await act(() => ctl.state().refresh());
    await answerNext(ctl, 'fail');
    expect(ctl.state().items).toBe(before);
    expect(ctl.state().error).toEqual({ kind: 'refresh', code: 'NETWORK' });
  });

  test('unmounting aborts the request in flight', async () => {
    const ctl = await setup();
    const first = ctl.pages[0];
    await ctl.hook.unmount();
    await waitFor(() => expect(first.settled).toBe(true));
  });
});
