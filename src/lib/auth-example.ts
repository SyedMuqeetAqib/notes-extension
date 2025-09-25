/**
 * Example: How to use long-term authentication in your Chrome extension
 * This shows the complete flow for persistent sign-in
 */

import { SecureAuthManager } from "./secure-auth-manager";
import {
  initGis,
  requestToken,
  loadGapi,
  setToken,
  signOut,
} from "./google-drive";

export class AuthFlowManager {
  private static clientId: string =
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

  /**
   * Initialize authentication on extension startup
   * This should be called when your extension loads
   */
  static async initializeAuth(): Promise<{
    isSignedIn: boolean;
    needsReauth: boolean;
    userId?: string;
  }> {
    console.log("🚀 Initializing authentication...");

    try {
      // Load Google APIs
      await loadGapi();

      // Check if user has valid stored token
      const storedToken = await SecureAuthManager.getValidToken();

      if (storedToken) {
        console.log("✅ Found valid stored token, restoring session");

        // Restore the session
        setToken(storedToken);

        return {
          isSignedIn: true,
          needsReauth: false,
          userId: storedToken.user_id,
        };
      } else {
        console.log("❌ No valid stored token found");
        return {
          isSignedIn: false,
          needsReauth: true,
        };
      }
    } catch (error) {
      console.error("❌ Failed to initialize auth:", error);
      return {
        isSignedIn: false,
        needsReauth: true,
      };
    }
  }

  /**
   * Handle user sign-in flow
   */
  static async signIn(): Promise<{
    success: boolean;
    userId?: string;
    error?: string;
  }> {
    console.log("🔐 Starting sign-in flow...");

    try {
      // Initialize Google Identity Services
      await initGis(this.clientId, async (tokenResponse) => {
        console.log("🎉 User signed in successfully!");

        // Save token for long-term persistence
        await SecureAuthManager.saveToken(tokenResponse);

        // Set token for current session
        setToken(tokenResponse);

        console.log("✅ Authentication complete - user will stay signed in");
      });

      // Request token (this will show Google's consent screen)
      requestToken();

      return { success: true };
    } catch (error) {
      console.error("❌ Sign-in failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Handle user sign-out
   */
  static async signOut(): Promise<void> {
    console.log("👋 Signing out user...");

    try {
      // Revoke token and clear storage
      await signOut();

      console.log("✅ User signed out successfully");
    } catch (error) {
      console.error("❌ Sign-out failed:", error);
    }
  }

  /**
   * Check authentication status
   */
  static async getAuthStatus(): Promise<{
    isSignedIn: boolean;
    userId?: string;
    tokenExpiry?: Date;
  }> {
    const token = await SecureAuthManager.getValidToken();

    return {
      isSignedIn: token !== null,
      userId: token?.user_id,
      tokenExpiry: token ? new Date(token.expires_at) : undefined,
    };
  }

  /**
   * Example: Auto-restore session on extension startup
   */
  static async autoRestoreSession(): Promise<boolean> {
    console.log("🔄 Attempting to restore previous session...");

    const authStatus = await this.initializeAuth();

    if (authStatus.isSignedIn) {
      console.log("✅ Session restored successfully", {
        userId: authStatus.userId,
      });
      return true;
    } else {
      console.log("❌ No valid session to restore");
      return false;
    }
  }

  /**
   * Example: Handle token expiry gracefully
   */
  static async ensureValidAuth(): Promise<boolean> {
    const isSignedIn = await SecureAuthManager.isSignedIn();

    if (!isSignedIn) {
      console.log("⚠️ Authentication expired, user needs to sign in again");
      return false;
    }

    return true;
  }

  /**
   * Example: Save user preferences that sync across devices
   */
  static async saveUserSettings(settings: {
    theme: "light" | "dark";
    autoSync: boolean;
    syncInterval: number;
  }): Promise<void> {
    await SecureAuthManager.saveUserPreferences(settings);
    console.log("✅ User settings saved and will sync across devices");
  }

  /**
   * Example: Get user preferences
   */
  static async getUserSettings(): Promise<{
    theme: "light" | "dark";
    autoSync: boolean;
    syncInterval: number;
  }> {
    const prefs = await SecureAuthManager.getUserPreferences();
    return {
      theme: prefs.theme || "light",
      autoSync: prefs.autoSync ?? true,
      syncInterval: prefs.syncInterval || 300000, // 5 minutes
    };
  }
}

/**
 * Example usage in your main app component:
 *
 * // On extension startup
 * useEffect(() => {
 *   AuthFlowManager.autoRestoreSession().then(restored => {
 *     if (!restored) {
 *       // Show sign-in button
 *       setShowSignIn(true);
 *     }
 *   });
 * }, []);
 *
 * // Handle sign-in button click
 * const handleSignIn = async () => {
 *   const result = await AuthFlowManager.signIn();
 *   if (result.success) {
 *     setShowSignIn(false);
 *     // User is now signed in and will stay signed in
 *   }
 * };
 *
 * // Check auth status periodically
 * useEffect(() => {
 *   const interval = setInterval(async () => {
 *     const isValid = await AuthFlowManager.ensureValidAuth();
 *     if (!isValid) {
 *       setShowSignIn(true);
 *     }
 *   }, 60000); // Check every minute
 *
 *   return () => clearInterval(interval);
 * }, []);
 */
