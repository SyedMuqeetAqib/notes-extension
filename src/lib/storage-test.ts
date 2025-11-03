/**
 * Storage Test Utilities
 * Test functions to verify localStorage vs Chrome storage functionality
 */

import { SecureAuthManager } from "./secure-auth-manager";
import { StorageUtils } from "./storage-utils";

export class StorageTest {
  /**
   * Test the storage system and log results
   */
  static async runStorageTest(): Promise<void> {
    console.log("🧪 [Storage Test] Starting storage system test...");

    // Test 1: Check storage type detection
    const storageType = StorageUtils.getStorageType();
    console.log(`📊 [Storage Test] Detected storage type: ${storageType}`);

    // Test 2: Test basic storage operations
    const testKey = "tabula-test-key";
    const testValue = {
      message: "Hello from Tabula Notes!",
      timestamp: Date.now(),
    };

    try {
      // Set a test value
      await StorageUtils.setItem(testKey, testValue);
      console.log("✅ [Storage Test] Set test value successfully");

      // Get the test value
      const retrievedValue = await StorageUtils.getItem(testKey);
      console.log("✅ [Storage Test] Retrieved test value:", retrievedValue);

      // Verify the value matches
      if (JSON.stringify(retrievedValue) === JSON.stringify(testValue)) {
        console.log("✅ [Storage Test] Value verification passed");
      } else {
        console.log("❌ [Storage Test] Value verification failed");
      }

      // Clean up
      await StorageUtils.removeItem(testKey);
      console.log("✅ [Storage Test] Cleanup completed");
    } catch (error) {
      console.error("❌ [Storage Test] Storage operations failed:", error);
    }

    // Test 3: Test SecureAuthManager
    try {
      const isSignedIn = await SecureAuthManager.isSignedIn();
      console.log(`📊 [Storage Test] User signed in: ${isSignedIn}`);

      const storageInfo = await SecureAuthManager.getStorageInfo();
      console.log("📊 [Storage Test] Auth storage info:", storageInfo);
    } catch (error) {
      console.error("❌ [Storage Test] Auth manager test failed:", error);
    }

    // Test 4: Get detailed storage info
    try {
      const storageInfo = await StorageUtils.getStorageInfo();
      console.log("📊 [Storage Test] Detailed storage info:", storageInfo);
    } catch (error) {
      console.error("❌ [Storage Test] Storage info test failed:", error);
    }

    console.log("🏁 [Storage Test] Storage system test completed");
  }

  /**
   * Test notes storage specifically
   */
  static async testNotesStorage(): Promise<void> {
    console.log("📝 [Notes Test] Testing notes storage...");

    const testNotes = [
      {
        id: "test-note-1",
        name: "Test Note 1",
        content: JSON.stringify([
          {
            id: "1",
            type: "paragraph",
            props: {},
            content: [
              {
                type: "text",
                text: "This is a test note for storage testing.",
                styles: {},
              },
            ],
            children: [],
          },
        ]),
        createdAt: Date.now(),
        lastUpdatedAt: Date.now(),
      },
      {
        id: "test-note-2",
        name: "Test Note 2",
        content: JSON.stringify([
          {
            id: "1",
            type: "paragraph",
            props: {},
            content: [
              {
                type: "text",
                text: "Another test note for storage testing.",
                styles: {},
              },
            ],
            children: [],
          },
        ]),
        createdAt: Date.now(),
        lastUpdatedAt: Date.now(),
      },
    ];

    try {
      // Store test notes
      await StorageUtils.setItem("tabula-notes", testNotes);
      console.log("✅ [Notes Test] Test notes stored successfully");

      // Retrieve test notes
      const retrievedNotes = await StorageUtils.getItem("tabula-notes");
      console.log(
        "✅ [Notes Test] Test notes retrieved:",
        retrievedNotes?.length || 0,
        "notes"
      );

      // Verify notes match
      if (JSON.stringify(retrievedNotes) === JSON.stringify(testNotes)) {
        console.log("✅ [Notes Test] Notes verification passed");
      } else {
        console.log("❌ [Notes Test] Notes verification failed");
      }

      // Clean up
      await StorageUtils.removeItem("tabula-notes");
      console.log("✅ [Notes Test] Notes cleanup completed");
    } catch (error) {
      console.error("❌ [Notes Test] Notes storage test failed:", error);
    }

    console.log("🏁 [Notes Test] Notes storage test completed");
  }

  /**
   * Run all storage tests
   */
  static async runAllTests(): Promise<void> {
    console.log("🚀 [Storage Test] Running all storage tests...");

    await this.runStorageTest();
    await this.testNotesStorage();

    console.log("🎉 [Storage Test] All tests completed!");
  }
}
