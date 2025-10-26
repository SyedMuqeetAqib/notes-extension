"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  CheckCircle,
  AlertCircle,
  Loader2,
  Upload,
  LogIn,
  User,
} from "@/components/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { RefreshCw, LogOut } from "@/components/icons";

type StatusIndicatorProps = {
  isLoggedIn: boolean;
  isSyncing: boolean;
  isFullSyncing: boolean;
  syncError: string | null;
  isOnline: boolean;
  pendingSyncs: number;
  lastSyncTime: number | null;
  lastFullSyncTime: number | null;
  isGoogleSDKInitialized: boolean;
  onSyncClick?: () => void;
  onSignInClick?: () => void;
  onSignOutClick?: () => void;
  className?: string;
  // Tooltip content props
  tooltipContent?: React.ReactNode;
};

export function StatusIndicator({
  isLoggedIn,
  isSyncing,
  isFullSyncing,
  syncError,
  isOnline,
  pendingSyncs,
  lastSyncTime,
  lastFullSyncTime,
  isGoogleSDKInitialized,
  onSyncClick,
  onSignInClick,
  onSignOutClick,
  className,
  tooltipContent,
}: StatusIndicatorProps) {
  // Determine the current status
  const getStatusInfo = () => {
    if (!isLoggedIn) {
      return {
        icon: <LogIn className="w-4 h-4" />,
        text: "Sign in",
        bgColor: "bg-blue-50",
        textColor: "text-blue-700",
        borderColor: "border-blue-200",
        iconColor: "text-blue-600",
      };
    }

    if (!isOnline) {
      return {
        icon: <AlertCircle className="w-4 h-4" />,
        text: "Offline",
        bgColor: "bg-orange-50",
        textColor: "text-orange-700",
        borderColor: "border-orange-200",
        iconColor: "text-orange-600",
      };
    }

    if (isFullSyncing) {
      return {
        icon: <Loader2 className="w-4 h-4 animate-spin" />,
        text: "Syncing...",
        bgColor: "bg-blue-50",
        textColor: "text-blue-700",
        borderColor: "border-blue-200",
        iconColor: "text-blue-600",
      };
    }

    if (isSyncing) {
      return {
        icon: <Upload className="w-4 h-4" />,
        text: "Uploading...",
        bgColor: "bg-blue-50",
        textColor: "text-blue-700",
        borderColor: "border-blue-200",
        iconColor: "text-blue-600",
      };
    }

    if (syncError) {
      return {
        icon: <AlertCircle className="w-4 h-4" />,
        text: "Sync Error",
        bgColor: "bg-red-50",
        textColor: "text-red-700",
        borderColor: "border-red-200",
        iconColor: "text-red-600",
      };
    }

    if (pendingSyncs > 0) {
      return {
        icon: <AlertCircle className="w-4 h-4" />,
        text: "Pending",
        bgColor: "bg-yellow-50",
        textColor: "text-yellow-700",
        borderColor: "border-yellow-200",
        iconColor: "text-yellow-600",
      };
    }

    // Check if we need a sync reminder (24 hours)
    if (lastFullSyncTime) {
      const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
      const timeSinceLastSync = Date.now() - lastFullSyncTime;
      if (timeSinceLastSync > TWENTY_FOUR_HOURS) {
        return {
          icon: <AlertCircle className="w-4 h-4" />,
          text: "Sync Reminder",
          bgColor: "bg-yellow-50",
          textColor: "text-yellow-700",
          borderColor: "border-yellow-200",
          iconColor: "text-yellow-600",
        };
      }
    }

    // Successfully signed in state
    return {
      icon: <User className="w-4 h-4" />,
      text: "Signed In",
      bgColor: "bg-green-50",
      textColor: "text-green-700",
      borderColor: "border-green-200",
      iconColor: "text-green-600",
    };
  };

  const statusInfo = getStatusInfo();

  // Don't render anything until Google SDK is initialized
  if (!isGoogleSDKInitialized) {
    return null;
  }

  // If user is signed in and not in an error/syncing state, show dropdown
  if (
    isLoggedIn &&
    !isFullSyncing &&
    !isSyncing &&
    !syncError &&
    isOnline &&
    pendingSyncs === 0
  ) {
    console.log("🔍 [StatusIndicator] Rendering dropdown with tooltip:", {
      tooltipContent: tooltipContent,
      hasTooltipContent: !!tooltipContent,
    });

    return (
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button
                disabled={isFullSyncing || !isOnline}
                className={cn(
                  "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200",
                  "hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2",
                  "animate-in fade-in slide-in-from-bottom-2 duration-300",
                  statusInfo.bgColor,
                  statusInfo.textColor,
                  statusInfo.borderColor,
                  "border",
                  (isFullSyncing || !isOnline) &&
                    "opacity-50 cursor-not-allowed",
                  className
                )}
              >
                <span className={statusInfo.iconColor}>{statusInfo.icon}</span>
                <span>{statusInfo.text}</span>
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="end">
            {tooltipContent || <div>No tooltip content</div>}
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            onClick={onSyncClick}
            disabled={isFullSyncing || !isOnline}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            <span>Sync Now</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onSignOutClick}>
            <LogOut className="w-4 h-4 mr-2" />
            <span>Sign Out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // For all other states, show regular button
  const handleClick = () => {
    if (!isLoggedIn) {
      onSignInClick?.();
    } else {
      onSyncClick?.();
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={handleClick}
          disabled={isFullSyncing || !isOnline}
          className={cn(
            "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200",
            "hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2",
            "animate-in fade-in slide-in-from-bottom-2 duration-300",
            statusInfo.bgColor,
            statusInfo.textColor,
            statusInfo.borderColor,
            "border",
            (isFullSyncing || !isOnline) && "opacity-50 cursor-not-allowed",
            className
          )}
        >
          <span className={statusInfo.iconColor}>{statusInfo.icon}</span>
          <span>{statusInfo.text}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="end">
        {tooltipContent}
      </TooltipContent>
    </Tooltip>
  );
}
