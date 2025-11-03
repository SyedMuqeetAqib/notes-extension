/**
 * Test Image Flow for Tabula Notes
 * Tests the local image flow: paste → IndexedDB → display
 * Note: Images are stored locally only (no cloud sync)
 */

import { IndexedDB } from "./indexeddb";
import { ImageStorage } from "./image-storage";

export class ImageFlowTester {
  /**
   * Test the local image flow (storage and display only)
   */
  static async testCompleteFlow(): Promise<{
    success: boolean;
    results: {
      storage: boolean;
      display: boolean;
    };
    errors: string[];
  }> {
    const results = {
      storage: false,
      display: false,
    };
    const errors: string[] = [];

    try {
      console.log("🧪 [ImageFlowTester] Starting local image flow test...");

      // Step 1: Test image storage
      console.log("📝 [ImageFlowTester] Step 1: Testing image storage...");
      try {
        // Create a test image blob
        const testImageBlob = await this.createTestImageBlob();
        const hash = await ImageStorage.storeImageBlob(testImageBlob);

        if (hash) {
          results.storage = true;
          console.log("✅ [ImageFlowTester] Image storage test passed");
        } else {
          errors.push("Image storage failed - no hash returned");
        }
      } catch (error) {
        errors.push(`Image storage failed: ${error}`);
        console.error("❌ [ImageFlowTester] Image storage test failed:", error);
      }

      // Step 2: Test image display
      console.log("🖼️ [ImageFlowTester] Step 2: Testing image display...");
      try {
        const allImageIds = await IndexedDB.getAllImageIds();
        if (allImageIds.length > 0) {
          const testImage = await IndexedDB.getImage(allImageIds[0]);
          if (testImage) {
            const imageUrl = await ImageStorage.getImageUrl(testImage.id);

            if (imageUrl && imageUrl.startsWith("blob:")) {
              results.display = true;
              console.log("✅ [ImageFlowTester] Image display test passed");
            } else {
              errors.push("Image display failed - invalid URL format");
            }
          } else {
            errors.push("Image display failed - could not retrieve image");
          }
        } else {
          errors.push("Image display failed - no images available");
        }
      } catch (error) {
        errors.push(`Image display failed: ${error}`);
        console.error("❌ [ImageFlowTester] Image display test failed:", error);
      }

      const success = results.storage && results.display;

      console.log("🏁 [ImageFlowTester] Test completed:", {
        success,
        results,
        errors: errors.length,
      });

      return { success, results, errors };
    } catch (error) {
      console.error("❌ [ImageFlowTester] Test failed with error:", error);
      errors.push(`Test failed: ${error}`);
      return { success: false, results, errors };
    }
  }

  /**
   * Create a test image blob for testing
   */
  private static async createTestImageBlob(): Promise<File> {
    // Create a simple test image using canvas
    const canvas = document.createElement("canvas");
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext("2d");

    if (ctx) {
      // Draw a simple test pattern
      ctx.fillStyle = "#ff0000";
      ctx.fillRect(0, 0, 50, 50);
      ctx.fillStyle = "#00ff00";
      ctx.fillRect(50, 0, 50, 50);
      ctx.fillStyle = "#0000ff";
      ctx.fillRect(0, 50, 50, 50);
      ctx.fillStyle = "#ffff00";
      ctx.fillRect(50, 50, 50, 50);

      // Add text
      ctx.fillStyle = "#000000";
      ctx.font = "12px Arial";
      ctx.fillText("TEST", 40, 60);
    }

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], "test-image.png", {
            type: "image/png",
          });
          resolve(file);
        } else {
          // Fallback: create a minimal test file
          const testData = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]); // PNG header
          const blob = new Blob([testData], { type: "image/png" });
          const file = new File([blob], "test-image.png", {
            type: "image/png",
          });
          resolve(file);
        }
      }, "image/png");
    });
  }

  /**
   * Test IndexedDB operations
   */
  static async testIndexedDB(): Promise<boolean> {
    try {
      console.log("🧪 [ImageFlowTester] Testing IndexedDB operations...");

      // Test database initialization
      await IndexedDB.initDB();
      console.log("✅ [ImageFlowTester] IndexedDB initialized");

      // Test note operations
      const testNote = {
        id: "test-note-" + Date.now(),
        name: "Test Note",
        content: JSON.stringify([
          {
            id: "1",
            type: "paragraph",
            props: {},
            content: [{ type: "text", text: "Test content", styles: {} }],
            children: [],
          },
        ]),
        createdAt: Date.now(),
        lastUpdatedAt: Date.now(),
      };

      await IndexedDB.saveNote(testNote);
      const retrievedNote = await IndexedDB.getNote(testNote.id);

      if (retrievedNote && retrievedNote.id === testNote.id) {
        console.log("✅ [ImageFlowTester] Note operations work");
      } else {
        console.error("❌ [ImageFlowTester] Note operations failed");
        return false;
      }

      // Test image operations
      const testImageBlob = await this.createTestImageBlob();
      const hash = await ImageStorage.storeImageBlob(testImageBlob);
      const retrievedImage = await IndexedDB.getImage(hash);

      if (retrievedImage && retrievedImage.id === hash) {
        console.log("✅ [ImageFlowTester] Image operations work");
      } else {
        console.error("❌ [ImageFlowTester] Image operations failed");
        return false;
      }

      // Cleanup
      await IndexedDB.deleteNote(testNote.id);
      await IndexedDB.deleteImage(hash);

      console.log("✅ [ImageFlowTester] IndexedDB test completed successfully");
      return true;
    } catch (error) {
      console.error("❌ [ImageFlowTester] IndexedDB test failed:", error);
      return false;
    }
  }

  /**
   * Test image storage utilities
   */
  static async testImageStorage(): Promise<boolean> {
    try {
      console.log("🧪 [ImageFlowTester] Testing image storage utilities...");

      // Test image storage
      const testImageBlob = await this.createTestImageBlob();
      const hash = await ImageStorage.storeImageBlob(testImageBlob);

      if (!hash) {
        console.error("❌ [ImageFlowTester] Image storage failed - no hash");
        return false;
      }

      // Test image retrieval
      const imageUrl = await ImageStorage.getImageUrl(hash);

      if (!imageUrl || !imageUrl.startsWith("blob:")) {
        console.error(
          "❌ [ImageFlowTester] Image retrieval failed - invalid URL"
        );
        return false;
      }

      // Test image reference extraction
      const testContent = JSON.stringify([
        {
          id: "1",
          type: "image",
          props: { url: `indexeddb://${hash}` },
          content: [],
          children: [],
        },
      ]);

      const extractedRefs = ImageStorage.extractImageRefs(testContent);

      if (extractedRefs.length !== 1 || extractedRefs[0] !== hash) {
        console.error("❌ [ImageFlowTester] Image reference extraction failed");
        return false;
      }

      // Test URL replacement
      const replacedContent = await ImageStorage.replaceRefsWithUrls(
        testContent
      );
      const parsedContent = JSON.parse(replacedContent);

      if (parsedContent[0].props.url !== imageUrl) {
        console.error("❌ [ImageFlowTester] URL replacement failed");
        return false;
      }

      // Cleanup
      await IndexedDB.deleteImage(hash);

      console.log(
        "✅ [ImageFlowTester] Image storage utilities test completed successfully"
      );
      return true;
    } catch (error) {
      console.error(
        "❌ [ImageFlowTester] Image storage utilities test failed:",
        error
      );
      return false;
    }
  }
}

// Export for use in development/testing
export const ImageFlowTesterInstance = new ImageFlowTester();
