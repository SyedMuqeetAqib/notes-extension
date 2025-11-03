/**
 * Storage Utilities for Tabula Notes
 * Provides a unified interface for localStorage and Chrome storage
 * Automatically detects environment and uses appropriate storage method
 */

export class StorageUtils {
  /**
   * Check if we're running in a Chrome extension environment
   */
  private static isChromeExtension(): boolean {
    return (
      typeof chrome !== "undefined" &&
      chrome.storage &&
      chrome.storage.local &&
      typeof chrome.storage.local.set === "function"
    );
  }

  /**
   * Set a value in storage
   */
  static async setItem(key: string, value: any): Promise<void> {
    try {
      if (this.isChromeExtension()) {
        // Use Chrome storage in extension environment
        await chrome.storage.local.set({ [key]: value });
        console.log(`✅ [Storage] Set ${key} in Chrome storage`);
      } else {
        // Use localStorage in local development
        localStorage.setItem(key, JSON.stringify(value));
        console.log(`✅ [Storage] Set ${key} in localStorage`);
      }
    } catch (error) {
      console.error(`❌ [Storage] Failed to set ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get a value from storage
   */
  static async getItem(key: string): Promise<any> {
    try {
      if (this.isChromeExtension()) {
        // Use Chrome storage in extension environment
        const result = await chrome.storage.local.get(key);
        const value = result[key];
        console.log(
          `✅ [Storage] Got ${key} from Chrome storage:`,
          value ? "found" : "not found"
        );
        return value;
      } else {
        // Use localStorage in local development
        const storedData = localStorage.getItem(key);
        const value = storedData ? JSON.parse(storedData) : null;
        console.log(
          `✅ [Storage] Got ${key} from localStorage:`,
          value ? "found" : "not found"
        );
        return value;
      }
    } catch (error) {
      console.error(`❌ [Storage] Failed to get ${key}:`, error);
      return null;
    }
  }

  /**
   * Remove a value from storage
   */
  static async removeItem(key: string): Promise<void> {
    try {
      if (this.isChromeExtension()) {
        // Use Chrome storage in extension environment
        await chrome.storage.local.remove(key);
        console.log(`✅ [Storage] Removed ${key} from Chrome storage`);
      } else {
        // Use localStorage in local development
        localStorage.removeItem(key);
        console.log(`✅ [Storage] Removed ${key} from localStorage`);
      }
    } catch (error) {
      console.error(`❌ [Storage] Failed to remove ${key}:`, error);
      throw error;
    }
  }

  /**
   * Clear all storage
   */
  static async clear(): Promise<void> {
    try {
      if (this.isChromeExtension()) {
        // Use Chrome storage in extension environment
        await chrome.storage.local.clear();
        console.log(`✅ [Storage] Cleared Chrome storage`);
      } else {
        // Use localStorage in local development
        localStorage.clear();
        console.log(`✅ [Storage] Cleared localStorage`);
      }
    } catch (error) {
      console.error(`❌ [Storage] Failed to clear storage:`, error);
      throw error;
    }
  }

  /**
   * Get storage usage information
   */
  static async getStorageInfo(): Promise<{
    storageType: "chrome" | "localStorage";
    usage?: number;
    keys?: string[];
  }> {
    try {
      if (this.isChromeExtension()) {
        const usage = await chrome.storage.local.getBytesInUse();
        const allData = await chrome.storage.local.get(null);
        const keys = Object.keys(allData);

        return {
          storageType: "chrome",
          usage,
          keys,
        };
      } else {
        // Calculate localStorage usage (approximate)
        let totalSize = 0;
        const keys: string[] = [];
        for (let key in localStorage) {
          if (localStorage.hasOwnProperty(key)) {
            totalSize += localStorage[key].length + key.length;
            keys.push(key);
          }
        }

        return {
          storageType: "localStorage",
          usage: totalSize,
          keys,
        };
      }
    } catch (error) {
      console.error("❌ [Storage] Failed to get storage info:", error);
      return {
        storageType: this.isChromeExtension() ? "chrome" : "localStorage",
      };
    }
  }

  /**
   * Listen for storage changes
   */
  static onStorageChanged(
    callback: (changes: { [key: string]: any }) => void
  ): void {
    if (this.isChromeExtension()) {
      chrome.storage.onChanged.addListener((changes) => {
        const convertedChanges: { [key: string]: any } = {};
        for (const [key, change] of Object.entries(changes)) {
          convertedChanges[key] = change.newValue;
        }
        callback(convertedChanges);
      });
    } else {
      // For localStorage, listen to storage events (cross-tab)
      window.addEventListener("storage", (e) => {
        if (e.key && e.newValue) {
          try {
            const value = JSON.parse(e.newValue);
            callback({ [e.key]: value });
          } catch {
            callback({ [e.key]: e.newValue });
          }
        }
      });
    }
  }

  /**
   * Get the current storage type being used
   */
  static getStorageType(): "chrome" | "localStorage" {
    return this.isChromeExtension() ? "chrome" : "localStorage";
  }
}
