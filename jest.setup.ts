import '@testing-library/jest-dom';

// jsdom doesn't implement IntersectionObserver. Components that use it for
// scroll-triggered animations (e.g., LandingPage) need a no-op polyfill so
// tests can render without crashing.
class IntersectionObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds = [];
}

if (typeof globalThis.IntersectionObserver === 'undefined') {
  globalThis.IntersectionObserver =
    IntersectionObserverMock as unknown as typeof globalThis.IntersectionObserver;
}

// jsdom also lacks ResizeObserver, used by some UI libraries (e.g. react-day-picker).
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof globalThis.ResizeObserver;
}
