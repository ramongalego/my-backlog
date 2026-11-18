import '@testing-library/jest-dom';

// jsdom lacks IntersectionObserver, used for scroll-triggered animations
// (LandingPage).
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
