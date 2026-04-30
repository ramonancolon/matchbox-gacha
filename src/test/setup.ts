import '@testing-library/jest-dom';
import { afterEach, beforeEach } from 'vitest';

// Node 22+ exposes a built-in (experimental) `localStorage` global that
// shadows the jsdom/happy-dom Storage implementation in vitest's fork pool.
// That built-in stub does not implement `clear`, `getItem`, etc., so any
// test that touches localStorage breaks. Install a real in-memory Storage
// shim before each test to keep the API behaviour stable across Node
// versions.

class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

function installStorage() {
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    configurable: true,
    writable: true,
  });
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'localStorage', {
      value: storage,
      configurable: true,
      writable: true,
    });
  }
}

beforeEach(() => {
  installStorage();
});

afterEach(() => {
  installStorage();
});

installStorage();
