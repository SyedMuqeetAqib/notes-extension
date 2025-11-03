/**
 * Secure Authentication Manager for Chrome Extension and Local Development
 * Provides long-term, secure token storage and management
 * Automatically detects environment and uses appropriate storage method
 */

export interface StoredTokenData {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  expires_at: number; // Calculated expiry timestamp
  refresh_token?: string; // If available
  user_id?: string; // For user identification
}

export class SecureAuthManager {
  private static readonly TOKEN_KEY = "tabula-google-token";
  private static readonly USER_PREFS_KEY = "tabula-user-preferences";
  private static readonly TOKEN_EXPIRY_BUFFER = 5 * 60 * 1000; // 5 minutes buffer

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
   * Save token securely for long-term persistence
   */
  static async saveToken(
    tokenResponse: google.accounts.oauth2.TokenResponse
  ): Promise<void> {
    try {
      const tokenData: StoredTokenData = {
        ...tokenResponse,
        expires_at:
          Date.now() +
          tokenResponse.expires_in * 1000 -
          this.TOKEN_EXPIRY_BUFFER,
        user_id:
          (await this.getUserIdFromToken(tokenResponse.access_token)) ||
          undefined,
      };

      if (this.isChromeExtension()) {
        // Use Chrome storage in extension environment
        await chrome.storage.local.set({
          [this.TOKEN_KEY]: tokenData,
        });
        console.log("✅ Token saved to Chrome storage", {
          expiresAt: new Date(tokenData.expires_at).toISOString(),
          userId: tokenData.user_id,
        });
      } else {
        // Use localStorage in local development
        localStorage.setItem(this.TOKEN_KEY, JSON.stringify(tokenData));
        console.log("✅ Token saved to localStorage", {
          expiresAt: new Date(tokenData.expires_at).toISOString(),
          userId: tokenData.user_id,
        });
      }
    } catch (error) {
      console.error("❌ Failed to save token:", error);
      throw error;
    }
  }

  /**
   * Get valid token from secure storage
   * Returns null if token is expired or doesn't exist
   */
  static async getValidToken(): Promise<StoredTokenData | null> {
    try {
      let token: StoredTokenData | null = null;

      if (this.isChromeExtension()) {
        // Use Chrome storage in extension environment
        const result = await chrome.storage.local.get(this.TOKEN_KEY);
        token = result[this.TOKEN_KEY] as StoredTokenData;
      } else {
        // Use localStorage in local development
        const storedData = localStorage.getItem(this.TOKEN_KEY);
        if (storedData) {
          token = JSON.parse(storedData) as StoredTokenData;
        }
      }

      if (!token) {
        console.log("🔍 No stored token found");
        return null;
      }

      // Check if token is expired
      if (Date.now() > token.expires_at) {
        console.log("⏰ Token expired, clearing from storage", {
          expiredAt: new Date(token.expires_at).toISOString(),
          now: new Date().toISOString(),
        });
        await this.clearToken();
        return null;
      }

      console.log("✅ Valid token found in storage", {
        expiresAt: new Date(token.expires_at).toISOString(),
        userId: token.user_id,
        storageType: this.isChromeExtension()
          ? "Chrome storage"
          : "localStorage",
      });

      return token;
    } catch (error) {
      console.error("❌ Failed to get token:", error);
      return null;
    }
  }

  /**
   * Check if user is currently signed in with valid token
   */
  static async isSignedIn(): Promise<boolean> {
    const token = await this.getValidToken();
    return token !== null;
  }

  /**
   * Get user ID from stored token
   */
  static async getCurrentUserId(): Promise<string | null> {
    const token = await this.getValidToken();
    return token?.user_id || null;
  }

  /**
   * Clear all authentication data
   */
  static async clearToken(): Promise<void> {
    try {
      if (this.isChromeExtension()) {
        // Use Chrome storage in extension environment
        await chrome.storage.local.remove(this.TOKEN_KEY);
        console.log("🗑️ Authentication data cleared from Chrome storage");
      } else {
        // Use localStorage in local development
        localStorage.removeItem(this.TOKEN_KEY);
        console.log("🗑️ Authentication data cleared from localStorage");
      }
    } catch (error) {
      console.error("❌ Failed to clear token:", error);
    }
  }

  /**
   * Get user preferences (can be synced across devices)
   */
  static async getUserPreferences(): Promise<any> {
    try {
      if (this.isChromeExtension()) {
        // Use Chrome sync storage in extension environment
        const result = await chrome.storage.sync.get(this.USER_PREFS_KEY);
        return result[this.USER_PREFS_KEY] || {};
      } else {
        // Use localStorage in local development
        const storedData = localStorage.getItem(this.USER_PREFS_KEY);
        return storedData ? JSON.parse(storedData) : {};
      }
    } catch (error) {
      console.error("❌ Failed to get user preferences:", error);
      return {};
    }
  }

  /**
   * Save user preferences (synced across devices)
   */
  static async saveUserPreferences(preferences: any): Promise<void> {
    try {
      if (this.isChromeExtension()) {
        // Use Chrome sync storage in extension environment
        await chrome.storage.sync.set({
          [this.USER_PREFS_KEY]: preferences,
        });
        console.log("✅ User preferences saved to Chrome sync storage");
      } else {
        // Use localStorage in local development
        localStorage.setItem(this.USER_PREFS_KEY, JSON.stringify(preferences));
        console.log("✅ User preferences saved to localStorage");
      }
    } catch (error) {
      console.error("❌ Failed to save user preferences:", error);
    }
  }

  /**
   * Get storage usage information
   */
  static async getStorageInfo(): Promise<{
    local?: chrome.storage.StorageArea;
    sync?: chrome.storage.StorageArea;
    localUsage?: number;
    syncUsage?: number;
    storageType: "chrome" | "localStorage";
  }> {
    try {
      if (this.isChromeExtension()) {
        const localUsage = await chrome.storage.local.getBytesInUse();
        const syncUsage = await chrome.storage.sync.getBytesInUse();

        return {
          local: chrome.storage.local,
          sync: chrome.storage.sync,
          localUsage,
          syncUsage,
          storageType: "chrome",
        };
      } else {
        // Calculate localStorage usage (approximate)
        let totalSize = 0;
        for (let key in localStorage) {
          if (localStorage.hasOwnProperty(key)) {
            totalSize += localStorage[key].length + key.length;
          }
        }

        return {
          localUsage: totalSize,
          storageType: "localStorage",
        };
      }
    } catch (error) {
      console.error("❌ Failed to get storage info:", error);
      return {
        storageType: this.isChromeExtension() ? "chrome" : "localStorage",
      };
    }
  }

  /**
   * Extract user ID from access token (if possible)
   * This is a simplified approach - in production you might want to call userinfo endpoint
   */
  private static async getUserIdFromToken(
    accessToken: string
  ): Promise<string | null> {
    try {
      // You could call Google's userinfo endpoint here to get user ID
      // For now, we'll use a hash of the token as a simple identifier
      const encoder = new TextEncoder();
      const data = encoder.encode(accessToken);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      return hashHex.substring(0, 16); // Use first 16 characters as user ID
    } catch (error) {
      console.warn("⚠️ Could not generate user ID from token:", error);
      return null;
    }
  }

  /**
   * Listen for storage changes (useful for debugging or cross-tab sync)
   */
  static onStorageChanged(
    callback: (changes: { [key: string]: chrome.storage.StorageChange }) => void
  ): void {
    if (this.isChromeExtension()) {
      chrome.storage.onChanged.addListener(callback);
    } else {
      // For localStorage, we can listen to storage events (cross-tab)
      window.addEventListener("storage", (e) => {
        if (e.key === this.TOKEN_KEY || e.key === this.USER_PREFS_KEY) {
          // Convert localStorage event to Chrome storage format for consistency
          const changes: { [key: string]: chrome.storage.StorageChange } = {};
          if (e.key) {
            changes[e.key] = {
              oldValue: e.oldValue ? JSON.parse(e.oldValue) : undefined,
              newValue: e.newValue ? JSON.parse(e.newValue) : undefined,
            };
          }
          callback(changes);
        }
      });
    }
  }

  /**
   * Remove storage change listener
   */
  static removeStorageListener(
    callback: (changes: { [key: string]: chrome.storage.StorageChange }) => void
  ): void {
    if (this.isChromeExtension()) {
      chrome.storage.onChanged.removeListener(callback);
    } else {
      // For localStorage, remove the storage event listener
      window.removeEventListener("storage", callback as any);
    }
  }
}
