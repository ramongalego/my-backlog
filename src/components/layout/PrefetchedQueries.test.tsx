import { act, type ComponentType } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import {
  HydrationBoundary,
  QueryClient,
  QueryClientProvider,
  useQuery,
  type DehydratedState,
} from '@tanstack/react-query';
import { PrefetchedQueries } from '@/components/layout/PrefetchedQueries';

// A page with a streamed list: the server sends it while the list is still
// loading, and the list's data follows in the same response.
function Games() {
  const { data, isPending } = useQuery({
    queryKey: ['games'],
    queryFn: () => new Promise<string[]>(() => {}),
    staleTime: Infinity,
  });
  return <p>{isPending ? 'Loading your games' : `${data?.length} games`}</p>;
}

function Page({
  Boundary,
  state,
}: {
  Boundary: ComponentType<{ state: DehydratedState }>;
  state: DehydratedState;
}) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <Boundary state={state} />
      <Games />
    </QueryClientProvider>
  );
}

const streamed = (promise: PromiseLike<string[]>): DehydratedState => ({
  mutations: [],
  queries: [
    {
      queryKey: ['games'],
      queryHash: JSON.stringify(['games']),
      dehydratedAt: Date.now(),
      promise: promise as Promise<string[]>,
      state: {
        data: undefined,
        dataUpdateCount: 0,
        dataUpdatedAt: 0,
        error: null,
        errorUpdateCount: 0,
        errorUpdatedAt: 0,
        fetchFailureCount: 0,
        fetchFailureReason: null,
        fetchMeta: null,
        isInvalidated: false,
        status: 'pending',
        fetchStatus: 'fetching',
      },
    },
  ],
});

// On the server the list hasn't loaded when the page is rendered.
const stillLoading = new Promise<string[]>(() => {});
// In the browser it has already arrived when the scripts run. React hands a
// streamed promise over as a thenable that answers at once when it has its
// value, which is what lets the cache start with the data in place.
const alreadyArrived = (): PromiseLike<string[]> => {
  const value = ['Hades', 'Celeste', 'Tunic'];
  return {
    status: 'fulfilled',
    value,
    then: (onFulfilled: (value: string[]) => unknown) => Promise.resolve(onFulfilled(value)),
  } as unknown as PromiseLike<string[]>;
};

/** Renders the page as the server does, then hydrates it as the browser does. */
async function load(Boundary: ComponentType<{ state: DehydratedState }>) {
  const container = document.createElement('div');
  container.innerHTML = renderToString(<Page Boundary={Boundary} state={streamed(stillLoading)} />);
  const serverText = container.textContent;

  const mismatches: unknown[] = [];
  await act(async () => {
    hydrateRoot(container, <Page Boundary={Boundary} state={streamed(alreadyArrived())} />, {
      onRecoverableError: (error) => mismatches.push(error),
    });
  });
  const firstRender = container.textContent;
  // The cache tells the page about new data a moment later, not at once.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  return { serverText, mismatches, firstRender, text: container.textContent };
}

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

it('hydrates a streamed list without a mismatch, then shows it', async () => {
  const { serverText, mismatches, firstRender, text } = await load(PrefetchedQueries);

  expect(serverText).toBe('Loading your games');
  // The browser's first render is what the server sent...
  expect(firstRender).toBe('Loading your games');
  expect(mismatches).toEqual([]);
  // ...and the list follows straight after.
  expect(text).toBe('3 games');
});

it('is needed: a plain HydrationBoundary fails to hydrate the same page', async () => {
  const { serverText, mismatches, text } = await load(HydrationBoundary);

  expect(serverText).toBe('Loading your games');
  // React gives up on the server's HTML and renders the page again.
  expect(mismatches.length).toBeGreaterThan(0);
  expect(text).toBe('3 games');
});

it('passes on queries that were ready on the server as they are', async () => {
  const ready: DehydratedState = {
    mutations: [],
    queries: [
      {
        ...streamed(stillLoading).queries[0],
        promise: undefined,
        state: {
          ...streamed(stillLoading).queries[0].state,
          data: ['Hades'],
          dataUpdatedAt: Date.now(),
          status: 'success',
          fetchStatus: 'idle',
        },
      },
    ],
  };
  const container = document.createElement('div');
  container.innerHTML = renderToString(<Page Boundary={PrefetchedQueries} state={ready} />);
  expect(container.textContent).toBe('1 games');

  const mismatches: unknown[] = [];
  await act(async () => {
    hydrateRoot(container, <Page Boundary={PrefetchedQueries} state={ready} />, {
      onRecoverableError: (error) => mismatches.push(error),
    });
  });

  expect(mismatches).toEqual([]);
  expect(container.textContent).toBe('1 games');
});
