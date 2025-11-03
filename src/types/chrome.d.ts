/**
 * Chrome Extension Type Declarations
 * Provides type definitions for Chrome extension APIs
 */

declare namespace chrome {
  namespace storage {
    interface StorageArea {
      get(
        keys?: string | string[] | { [key: string]: any } | null
      ): Promise<{ [key: string]: any }>;
      set(items: { [key: string]: any }): Promise<void>;
      remove(keys: string | string[]): Promise<void>;
      clear(): Promise<void>;
      getBytesInUse(keys?: string | string[] | null): Promise<number>;
    }

    interface StorageChange {
      oldValue?: any;
      newValue?: any;
    }

    const local: StorageArea;
    const sync: StorageArea;

    namespace onChanged {
      function addListener(
        callback: (changes: { [key: string]: StorageChange }) => void
      ): void;
      function removeListener(
        callback: (changes: { [key: string]: StorageChange }) => void
      ): void;
    }
  }
}

// Global chrome object
declare const chrome: {
  storage: typeof chrome.storage;
};
