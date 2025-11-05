import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TabulaNote",
  description: "A new tab for your thoughts.",
  icons: {
    icon: "/icons/icon48.png",
    shortcut: "/icons/icon48.png",
    apple: "/icons/icon48.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script src="/theme-init.js" />
      </head>
      <body className="font-body antialiased">{children}</body>
    </html>
  );
}
