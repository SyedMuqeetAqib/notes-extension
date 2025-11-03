/**
 * Error Handling and Quota Management for Tabula Notes
 * Provides centralized error handling, retry logic, and quota management
 */

export interface ErrorInfo {
  code: string;
  message: string;
  severity: "low" | "medium" | "high" | "critical";
  retryable: boolean;
  userMessage: string;
  technicalDetails?: string;
}

export interface QuotaInfo {
  used: number;
  limit: number;
  percentage: number;
  warningThreshold: number;
  criticalThreshold: number;
}

export class ErrorHandler {
  private static errorCounts: Map<string, number> = new Map();
  private static lastErrorTime: Map<string, number> = new Map();
  private static readonly MAX_ERRORS_PER_HOUR = 10;
  private static readonly RETRY_DELAYS = [1000, 2000, 5000, 10000, 30000]; // Exponential backoff

  /**
   * Categorize and handle errors with appropriate responses
   */
  static categorizeError(error: any): ErrorInfo {
    const errorString = error?.toString() || "Unknown error";
    const errorMessage = error?.message || errorString;

    // Google Drive API errors
    if (
      errorMessage.includes("quotaExceeded") ||
      errorMessage.includes("userRateLimitExceeded")
    ) {
      return {
        code: "QUOTA_EXCEEDED",
        message: errorMessage,
        severity: "high",
        retryable: true,
        userMessage: "Google Drive quota exceeded. Please try again later.",
        technicalDetails: "Rate limit or storage quota exceeded",
      };
    }

    if (errorMessage.includes("insufficientFilePermissions")) {
      return {
        code: "PERMISSION_DENIED",
        message: errorMessage,
        severity: "high",
        retryable: false,
        userMessage:
          "Permission denied. Please check your Google Drive access.",
        technicalDetails: "Insufficient permissions to access Google Drive",
      };
    }

    if (
      errorMessage.includes("invalid_grant") ||
      errorMessage.includes("unauthorized")
    ) {
      return {
        code: "AUTH_ERROR",
        message: errorMessage,
        severity: "critical",
        retryable: false,
        userMessage: "Authentication failed. Please sign in again.",
        technicalDetails: "OAuth token expired or invalid",
      };
    }

    if (errorMessage.includes("network") || errorMessage.includes("fetch")) {
      return {
        code: "NETWORK_ERROR",
        message: errorMessage,
        severity: "medium",
        retryable: true,
        userMessage: "Network error. Please check your connection.",
        technicalDetails: "Network connectivity issue",
      };
    }

    if (
      errorMessage.includes("IndexedDB") ||
      errorMessage.includes("storage")
    ) {
      return {
        code: "STORAGE_ERROR",
        message: errorMessage,
        severity: "high",
        retryable: true,
        userMessage: "Storage error. Please try again.",
        technicalDetails: "IndexedDB or storage operation failed",
      };
    }

    if (errorMessage.includes("image") || errorMessage.includes("blob")) {
      return {
        code: "IMAGE_ERROR",
        message: errorMessage,
        severity: "medium",
        retryable: true,
        userMessage: "Image processing error. Please try again.",
        technicalDetails: "Image upload, download, or processing failed",
      };
    }

    // Default error
    return {
      code: "UNKNOWN_ERROR",
      message: errorMessage,
      severity: "medium",
      retryable: true,
      userMessage: "An unexpected error occurred. Please try again.",
      technicalDetails: errorString,
    };
  }

  /**
   * Check if an error should be retried based on rate limiting
   */
  static shouldRetry(errorInfo: ErrorInfo, retryCount: number): boolean {
    if (!errorInfo.retryable || retryCount >= this.RETRY_DELAYS.length) {
      return false;
    }

    const errorKey = `${errorInfo.code}_${Date.now() - (Date.now() % 3600000)}`; // Hourly key
    const errorCount = this.errorCounts.get(errorKey) || 0;

    if (errorCount >= this.MAX_ERRORS_PER_HOUR) {
      console.warn(
        `⚠️ [ErrorHandler] Too many errors for ${errorInfo.code}, not retrying`
      );
      return false;
    }

    return true;
  }

  /**
   * Get retry delay for exponential backoff
   */
  static getRetryDelay(retryCount: number): number {
    return this.RETRY_DELAYS[
      Math.min(retryCount, this.RETRY_DELAYS.length - 1)
    ];
  }

  /**
   * Record an error for rate limiting
   */
  static recordError(errorInfo: ErrorInfo): void {
    const errorKey = `${errorInfo.code}_${Date.now() - (Date.now() % 3600000)}`; // Hourly key
    const currentCount = this.errorCounts.get(errorKey) || 0;
    this.errorCounts.set(errorKey, currentCount + 1);
    this.lastErrorTime.set(errorInfo.code, Date.now());
  }

  /**
   * Execute a function with retry logic
   */
  static async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation();

        // Reset error count on success
        if (attempt > 0) {
          console.log(
            `✅ [ErrorHandler] ${operationName} succeeded on attempt ${
              attempt + 1
            }`
          );
        }

        return result;
      } catch (error) {
        lastError = error;
        const errorInfo = this.categorizeError(error);

        console.error(
          `❌ [ErrorHandler] ${operationName} failed (attempt ${attempt + 1}/${
            maxRetries + 1
          }):`,
          {
            error: errorInfo,
            attempt: attempt + 1,
            maxRetries: maxRetries + 1,
          }
        );

        this.recordError(errorInfo);

        if (attempt < maxRetries && this.shouldRetry(errorInfo, attempt)) {
          const delay = this.getRetryDelay(attempt);
          console.log(
            `⏳ [ErrorHandler] Retrying ${operationName} in ${delay}ms...`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          break;
        }
      }
    }

    throw lastError;
  }

  /**
   * Handle errors with user-friendly messages
   */
  static handleError(error: any, context: string): ErrorInfo {
    const errorInfo = this.categorizeError(error);

    console.error(`❌ [ErrorHandler] Error in ${context}:`, {
      error: errorInfo,
      context,
      timestamp: new Date().toISOString(),
    });

    return errorInfo;
  }

  /**
   * Clear error counts (useful for testing or manual reset)
   */
  static clearErrorCounts(): void {
    this.errorCounts.clear();
    this.lastErrorTime.clear();
    console.log("🧹 [ErrorHandler] Error counts cleared");
  }

  /**
   * Get error statistics
   */
  static getErrorStats(): { [code: string]: number } {
    const stats: { [code: string]: number } = {};
    for (const [key, count] of this.errorCounts.entries()) {
      const code = key.split("_")[0];
      stats[code] = (stats[code] || 0) + count;
    }
    return stats;
  }
}

export class QuotaManager {
  private static readonly STORAGE_QUOTA_WARNING = 0.8; // 80%
  private static readonly STORAGE_QUOTA_CRITICAL = 0.95; // 95%
  private static readonly DRIVE_QUOTA_WARNING = 0.9; // 90%
  private static readonly DRIVE_QUOTA_CRITICAL = 0.98; // 98%

  /**
   * Check IndexedDB storage quota
   */
  static async checkStorageQuota(): Promise<QuotaInfo | null> {
    try {
      if ("storage" in navigator && "estimate" in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const used = estimate.usage || 0;
        const limit = estimate.quota || 0;
        const percentage = limit > 0 ? used / limit : 0;

        return {
          used,
          limit,
          percentage,
          warningThreshold: this.STORAGE_QUOTA_WARNING,
          criticalThreshold: this.STORAGE_QUOTA_CRITICAL,
        };
      }
      return null;
    } catch (error) {
      console.error("❌ [QuotaManager] Failed to check storage quota:", error);
      return null;
    }
  }

  /**
   * Check if storage quota is approaching limits
   */
  static async checkStorageQuotaStatus(): Promise<{
    status: "ok" | "warning" | "critical";
    message: string;
    quota: QuotaInfo | null;
  }> {
    const quota = await this.checkStorageQuota();

    if (!quota) {
      return {
        status: "ok",
        message: "Storage quota check not available",
        quota: null,
      };
    }

    if (quota.percentage >= quota.criticalThreshold) {
      return {
        status: "critical",
        message: `Storage quota critical: ${Math.round(
          quota.percentage * 100
        )}% used`,
        quota,
      };
    }

    if (quota.percentage >= quota.warningThreshold) {
      return {
        status: "warning",
        message: `Storage quota warning: ${Math.round(
          quota.percentage * 100
        )}% used`,
        quota,
      };
    }

    return {
      status: "ok",
      message: `Storage quota OK: ${Math.round(quota.percentage * 100)}% used`,
      quota,
    };
  }

  /**
   * Clean up old data to free up space
   */
  static async cleanupOldData(): Promise<{
    cleaned: boolean;
    freedSpace: number;
    message: string;
  }> {
    try {
      console.log("🧹 [QuotaManager] Starting cleanup of old data...");

      // This would be implemented based on your specific cleanup needs
      // For now, return a placeholder
      return {
        cleaned: true,
        freedSpace: 0,
        message: "Cleanup completed (placeholder)",
      };
    } catch (error) {
      console.error("❌ [QuotaManager] Cleanup failed:", error);
      return {
        cleaned: false,
        freedSpace: 0,
        message: "Cleanup failed",
      };
    }
  }

  /**
   * Get storage usage statistics
   */
  static async getStorageStats(): Promise<{
    totalUsed: number;
    totalLimit: number;
    percentage: number;
    breakdown: {
      notes: number;
      images: number;
      metadata: number;
    };
  }> {
    try {
      const quota = await this.checkStorageQuota();

      // This would be implemented to get actual breakdown
      // For now, return placeholder data
      return {
        totalUsed: quota?.used || 0,
        totalLimit: quota?.limit || 0,
        percentage: quota?.percentage || 0,
        breakdown: {
          notes: 0,
          images: 0,
          metadata: 0,
        },
      };
    } catch (error) {
      console.error("❌ [QuotaManager] Failed to get storage stats:", error);
      return {
        totalUsed: 0,
        totalLimit: 0,
        percentage: 0,
        breakdown: {
          notes: 0,
          images: 0,
          metadata: 0,
        },
      };
    }
  }
}

/**
 * Utility function to wrap operations with error handling
 */
export function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: string,
  maxRetries: number = 3
): Promise<T> {
  return ErrorHandler.withRetry(operation, context, maxRetries);
}

/**
 * Utility function to handle errors and show user-friendly messages
 */
export function handleErrorWithToast(
  error: any,
  context: string,
  toast: (options: any) => void
): ErrorInfo {
  const errorInfo = ErrorHandler.handleError(error, context);

  toast({
    title: errorInfo.userMessage,
    description: errorInfo.technicalDetails,
    variant: errorInfo.severity === "critical" ? "destructive" : "default",
    duration: errorInfo.severity === "critical" ? 10000 : 5000,
  });

  return errorInfo;
}
