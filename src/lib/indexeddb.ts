/**
 * IndexedDB wrapper for Tabula Notes
 * Provides CRUD operations for notes, images, and metadata
 */

export interface Note {
  id: string;
  name: string;
  content: string; // JSON string with image hash references
  createdAt: number;
  lastUpdatedAt: number;
  syncedAt?: number;
}

export interface ImageRecord {
  id: string; // SHA-256 hash
  blob: Blob;
  mimeType: string;
  size: number;
  createdAt: number;
  uploadedAt?: number;
  syncStatus: "pending" | "synced" | "error"; // Note: syncStatus is kept for compatibility but images are local-only
}

export interface MetadataRecord {
  key: string;
  value: any;
  updatedAt: number;
}

class IndexedDBManager {
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = "tabula-notes-db";
  private readonly DB_VERSION = 1;
  private readonly STORES = {
    NOTES: "notes",
    IMAGES: "images",
    METADATA: "metadata",
  } as const;

  /**
   * Initialize the IndexedDB database
   */
  async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => {
        console.error("❌ [IndexedDB] Failed to open database:", request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log("✅ [IndexedDB] Database opened successfully");
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        console.log("🔄 [IndexedDB] Upgrading database...");

        // Create notes store
        if (!db.objectStoreNames.contains(this.STORES.NOTES)) {
          const notesStore = db.createObjectStore(this.STORES.NOTES, {
            keyPath: "id",
          });
          notesStore.createIndex("lastUpdatedAt", "lastUpdatedAt", {
            unique: false,
          });
          notesStore.createIndex("syncedAt", "syncedAt", { unique: false });
          console.log("✅ [IndexedDB] Created notes store");
        }

        // Create images store
        if (!db.objectStoreNames.contains(this.STORES.IMAGES)) {
          const imagesStore = db.createObjectStore(this.STORES.IMAGES, {
            keyPath: "id",
          });
          imagesStore.createIndex("syncStatus", "syncStatus", {
            unique: false,
          });
          imagesStore.createIndex("createdAt", "createdAt", { unique: false });
          console.log("✅ [IndexedDB] Created images store");
        }

        // Create metadata store
        if (!db.objectStoreNames.contains(this.STORES.METADATA)) {
          db.createObjectStore(this.STORES.METADATA, { keyPath: "key" });
          console.log("✅ [IndexedDB] Created metadata store");
        }
      };
    });
  }

  /**
   * Ensure database is initialized
   */
  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.initDB();
    }
    if (!this.db) {
      throw new Error("Failed to initialize IndexedDB");
    }
    return this.db;
  }

  // ===== NOTES OPERATIONS =====

  /**
   * Save or update a note
   * Optimized: Reduced console logging in production
   */
  async saveNote(note: Note): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORES.NOTES], "readwrite");
      const store = transaction.objectStore(this.STORES.NOTES);

      const request = store.put(note);

      request.onsuccess = () => {
        if (process.env.NODE_ENV === "development") {
          console.log("✅ [IndexedDB] Note saved:", note.id);
        }
        resolve();
      };

      request.onerror = () => {
        console.error("❌ [IndexedDB] Failed to save note:", request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Batch save multiple notes in a single transaction
   * Optimized: More efficient than individual saves
   */
  async saveNotesBatch(notes: Note[]): Promise<void> {
    if (notes.length === 0) return;

    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORES.NOTES], "readwrite");
      const store = transaction.objectStore(this.STORES.NOTES);

      let completed = 0;
      let hasError = false;

      notes.forEach((note) => {
        const request = store.put(note);
        request.onsuccess = () => {
          completed++;
          if (completed === notes.length && !hasError) {
            if (process.env.NODE_ENV === "development") {
              console.log(`✅ [IndexedDB] Batch saved ${notes.length} notes`);
            }
            resolve();
          }
        };
        request.onerror = () => {
          if (!hasError) {
            hasError = true;
            console.error(
              "❌ [IndexedDB] Failed to batch save note:",
              request.error
            );
            reject(request.error);
          }
        };
      });
    });
  }

  /**
   * Get a single note by ID
   */
  async getNote(id: string): Promise<Note | null> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORES.NOTES], "readonly");
      const store = transaction.objectStore(this.STORES.NOTES);

      const request = store.get(id);

      request.onsuccess = () => {
        const result = request.result;
        console.log(
          "✅ [IndexedDB] Note retrieved:",
          id,
          result ? "found" : "not found"
        );
        resolve(result || null);
      };

      request.onerror = () => {
        console.error("❌ [IndexedDB] Failed to get note:", request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get all notes sorted by lastUpdatedAt (newest first)
   * Optimized: Uses getAll() with index for better performance
   */
  async getAllNotes(): Promise<Note[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORES.NOTES], "readonly");
      const store = transaction.objectStore(this.STORES.NOTES);
      const index = store.index("lastUpdatedAt");

      // Use getAll() with cursor for better performance on large datasets
      const request = index.getAll();

      request.onsuccess = () => {
        const notes = request.result as Note[];
        // Sort in descending order (newest first) - more efficient than cursor
        notes.sort((a, b) => b.lastUpdatedAt - a.lastUpdatedAt);
        console.log("✅ [IndexedDB] Retrieved all notes:", notes.length);
        resolve(notes);
      };

      request.onerror = () => {
        console.error("❌ [IndexedDB] Failed to get all notes:", request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Delete a note by ID
   */
  async deleteNote(id: string): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORES.NOTES], "readwrite");
      const store = transaction.objectStore(this.STORES.NOTES);

      const request = store.delete(id);

      request.onsuccess = () => {
        console.log("✅ [IndexedDB] Note deleted:", id);
        resolve();
      };

      request.onerror = () => {
        console.error("❌ [IndexedDB] Failed to delete note:", request.error);
        reject(request.error);
      };
    });
  }

  // ===== IMAGE OPERATIONS =====

  /**
   * Save an image with metadata
   */
  async saveImage(imageRecord: ImageRecord): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORES.IMAGES], "readwrite");
      const store = transaction.objectStore(this.STORES.IMAGES);

      const request = store.put(imageRecord);

      request.onsuccess = () => {
        console.log("✅ [IndexedDB] Image saved:", imageRecord.id);
        resolve();
      };

      request.onerror = () => {
        console.error("❌ [IndexedDB] Failed to save image:", request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get an image by hash ID
   */
  async getImage(id: string): Promise<ImageRecord | null> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORES.IMAGES], "readonly");
      const store = transaction.objectStore(this.STORES.IMAGES);

      const request = store.get(id);

      request.onsuccess = () => {
        const result = request.result;
        console.log(
          "✅ [IndexedDB] Image retrieved:",
          id,
          result ? "found" : "not found"
        );
        resolve(result || null);
      };

      request.onerror = () => {
        console.error("❌ [IndexedDB] Failed to get image:", request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get multiple images by their IDs
   */
  async getImagesByIds(ids: string[]): Promise<ImageRecord[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORES.IMAGES], "readonly");
      const store = transaction.objectStore(this.STORES.IMAGES);

      const images: ImageRecord[] = [];
      let completed = 0;

      if (ids.length === 0) {
        resolve(images);
        return;
      }

      ids.forEach((id) => {
        const request = store.get(id);
        request.onsuccess = () => {
          if (request.result) {
            images.push(request.result);
          }
          completed++;
          if (completed === ids.length) {
            console.log(
              "✅ [IndexedDB] Retrieved images:",
              images.length,
              "of",
              ids.length
            );
            resolve(images);
          }
        };
        request.onerror = () => {
          console.error(
            "❌ [IndexedDB] Failed to get image:",
            id,
            request.error
          );
          completed++;
          if (completed === ids.length) {
            resolve(images);
          }
        };
      });
    });
  }

  /**
   * Delete an image by hash ID
   */
  async deleteImage(id: string): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORES.IMAGES], "readwrite");
      const store = transaction.objectStore(this.STORES.IMAGES);

      const request = store.delete(id);

      request.onsuccess = () => {
        console.log("✅ [IndexedDB] Image deleted:", id);
        resolve();
      };

      request.onerror = () => {
        console.error("❌ [IndexedDB] Failed to delete image:", request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Update image sync status
   */
  async updateImageSyncStatus(
    id: string,
    syncStatus: ImageRecord["syncStatus"]
  ): Promise<void> {
    const image = await this.getImage(id);
    if (!image) {
      throw new Error(`Image not found: ${id}`);
    }

    const updatedImage = { ...image, syncStatus };
    await this.saveImage(updatedImage);
  }

  /**
   * Get all images with pending sync status
   */
  async getPendingImages(): Promise<ImageRecord[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORES.IMAGES], "readonly");
      const store = transaction.objectStore(this.STORES.IMAGES);
      const index = store.index("syncStatus");

      const request = index.getAll("pending");

      request.onsuccess = () => {
        const images = request.result;
        console.log("✅ [IndexedDB] Retrieved pending images:", images.length);
        resolve(images);
      };

      request.onerror = () => {
        console.error(
          "❌ [IndexedDB] Failed to get pending images:",
          request.error
        );
        reject(request.error);
      };
    });
  }

  /**
   * Get all image IDs (for orphaned image detection)
   */
  async getAllImageIds(): Promise<string[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORES.IMAGES], "readonly");
      const store = transaction.objectStore(this.STORES.IMAGES);

      const request = store.getAllKeys();

      request.onsuccess = () => {
        const ids = request.result as string[];
        console.log("✅ [IndexedDB] Retrieved all image IDs:", ids.length);
        resolve(ids);
      };

      request.onerror = () => {
        console.error("❌ [IndexedDB] Failed to get image IDs:", request.error);
        reject(request.error);
      };
    });
  }

  // ===== METADATA OPERATIONS =====

  /**
   * Set metadata value
   */
  async setMetadata(key: string, value: any): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORES.METADATA], "readwrite");
      const store = transaction.objectStore(this.STORES.METADATA);

      const metadata: MetadataRecord = {
        key,
        value,
        updatedAt: Date.now(),
      };

      const request = store.put(metadata);

      request.onsuccess = () => {
        console.log("✅ [IndexedDB] Metadata set:", key);
        resolve();
      };

      request.onerror = () => {
        console.error("❌ [IndexedDB] Failed to set metadata:", request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get metadata value
   */
  async getMetadata(key: string): Promise<any> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORES.METADATA], "readonly");
      const store = transaction.objectStore(this.STORES.METADATA);

      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result;
        console.log(
          "✅ [IndexedDB] Metadata retrieved:",
          key,
          result ? "found" : "not found"
        );
        resolve(result ? result.value : null);
      };

      request.onerror = () => {
        console.error("❌ [IndexedDB] Failed to get metadata:", request.error);
        reject(request.error);
      };
    });
  }

  // ===== UTILITY METHODS =====

  /**
   * Get storage usage information
   */
  async getStorageInfo(): Promise<{
    notesCount: number;
    imagesCount: number;
    totalImageSize: number;
    metadataCount: number;
  }> {
    const [notes, images, metadata] = await Promise.all([
      this.getAllNotes(),
      this.getAllImageIds().then((ids) => this.getImagesByIds(ids)),
      this.getAllMetadata(),
    ]);

    const totalImageSize = images.reduce((sum, img) => sum + img.size, 0);

    return {
      notesCount: notes.length,
      imagesCount: images.length,
      totalImageSize,
      metadataCount: metadata.length,
    };
  }

  /**
   * Get all metadata records
   */
  private async getAllMetadata(): Promise<MetadataRecord[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORES.METADATA], "readonly");
      const store = transaction.objectStore(this.STORES.METADATA);

      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Clear all data (for testing)
   */
  async clearAll(): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [this.STORES.NOTES, this.STORES.IMAGES, this.STORES.METADATA],
        "readwrite"
      );

      const clearNotes = transaction.objectStore(this.STORES.NOTES).clear();
      const clearImages = transaction.objectStore(this.STORES.IMAGES).clear();
      const clearMetadata = transaction
        .objectStore(this.STORES.METADATA)
        .clear();

      transaction.oncomplete = () => {
        console.log("✅ [IndexedDB] All data cleared");
        resolve();
      };

      transaction.onerror = () => {
        console.error(
          "❌ [IndexedDB] Failed to clear data:",
          transaction.error
        );
        reject(transaction.error);
      };
    });
  }
}

// Export singleton instance
export const IndexedDB = new IndexedDBManager();
