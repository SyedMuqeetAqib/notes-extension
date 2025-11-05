"use client"

import * as React from "react"
import * as ToastPrimitives from "@radix-ui/react-toast"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const ToastProvider = ToastPrimitives.Provider

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]",
      className
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-xl border-[1.5px] p-6 pr-8 shadow-2xl transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full",
  {
    variants: {
      variant: {
        default: "text-foreground",
        destructive: "destructive group text-destructive-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
    VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => {
  return (
    <ToastPrimitives.Root
      ref={ref}
      className={cn(
        toastVariants({ variant }),
        variant === "destructive"
          ? "bg-[rgba(248,220,220,0.95)] dark:bg-[rgba(60,30,30,0.95)] border-[rgba(220,140,140,0.6)] dark:border-[rgba(120,60,60,0.6)] text-[rgba(180,80,80,0.95)] dark:text-red-300"
          : "bg-[rgba(242,242,233,0.98)] dark:bg-[rgba(36,36,36,0.98)] border-[rgba(224,224,208,0.5)] dark:border-[rgba(58,58,58,0.7)] text-[rgba(60,60,50,0.9)] dark:text-gray-200",
        className
      )}
      {...props}
    />
  );
});
Toast.displayName = ToastPrimitives.Root.displayName

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
      className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-md border-[1.5px] bg-transparent px-3 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
      "border-[rgba(208,208,192,0.4)] dark:border-[rgba(58,58,58,0.5)] text-[rgba(100,100,90,0.9)] dark:text-gray-300",
      "hover:bg-[rgba(240,240,224,0.6)] dark:hover:bg-[rgba(51,51,51,0.6)] hover:border-[rgba(192,192,176,0.5)] dark:hover:border-[rgba(70,70,70,0.6)]",
      "group-[.destructive]:hover:bg-[rgba(220,140,140,0.3)] dark:group-[.destructive]:hover:bg-[rgba(80,40,40,0.4)] group-[.destructive]:hover:border-[rgba(200,100,100,0.5)] dark:group-[.destructive]:hover:border-[rgba(100,50,50,0.6)]",
      className
    )}
    {...props}
  />
))
ToastAction.displayName = ToastPrimitives.Action.displayName

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
      className={cn(
      "absolute right-2 top-2 rounded-md p-1 opacity-0 transition-opacity hover:bg-opacity-20 focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100",
      "text-[rgba(100,100,90,0.7)] dark:text-gray-400",
      "hover:text-[rgba(80,80,70,0.9)] dark:hover:text-gray-300 hover:bg-[rgba(224,224,208,0.3)] dark:hover:bg-[rgba(51,51,51,0.4)]",
      "group-[.destructive]:hover:text-[rgba(180,80,80,0.9)] dark:group-[.destructive]:hover:text-red-300 group-[.destructive]:hover:bg-[rgba(240,200,200,0.3)] dark:group-[.destructive]:hover:bg-[rgba(80,40,40,0.4)]",
      className
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
))
ToastClose.displayName = ToastPrimitives.Close.displayName

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn("text-sm font-semibold", className)}
    style={{ color: "inherit" }}
    {...props}
  />
))
ToastTitle.displayName = ToastPrimitives.Title.displayName

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn("text-sm", className)}
    style={{ 
      color: "inherit",
      opacity: 0.85,
    }}
    {...props}
  />
))
ToastDescription.displayName = ToastPrimitives.Description.displayName

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>

type ToastActionElement = React.ReactElement<typeof ToastAction>

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
}
