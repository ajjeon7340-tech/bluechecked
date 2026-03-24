import '@testing-library/jest-dom';
import { vi, beforeEach, afterEach } from 'vitest';

// ------------------------------------------------------------------
// localStorage mock — backed by an in-memory Map so tests are isolated
// ------------------------------------------------------------------
const localStorageStore: Record<string, string> = {};

const localStorageMock = {
  getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { localStorageStore[key] = value; }),
  removeItem: vi.fn((key: string) => { delete localStorageStore[key]; }),
  clear: vi.fn(() => { Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]); }),
  get length() { return Object.keys(localStorageStore).length; },
  key: vi.fn((index: number) => Object.keys(localStorageStore)[index] ?? null),
};

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// ------------------------------------------------------------------
// window.location mock
// ------------------------------------------------------------------
Object.defineProperty(window, 'location', {
  value: {
    pathname: '/',
    search: '',
    href: 'http://localhost:5173/',
    origin: 'http://localhost:5173',
    hostname: 'localhost',
    reload: vi.fn(),
    assign: vi.fn(),
    replace: vi.fn(),
  },
  writable: true,
});

// ------------------------------------------------------------------
// window.history mock
// ------------------------------------------------------------------
Object.defineProperty(window, 'history', {
  value: {
    pushState: vi.fn(),
    replaceState: vi.fn(),
    back: vi.fn(),
    state: null,
  },
  writable: true,
});

// ------------------------------------------------------------------
// ResizeObserver mock (used by Recharts)
// ------------------------------------------------------------------
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// ------------------------------------------------------------------
// Reset mocks & localStorage between tests
// ------------------------------------------------------------------
beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});
