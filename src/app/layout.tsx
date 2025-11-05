import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TabulaNote",
  description: "A new tab for your thoughts.",
  icons: {
    icon: "/icons/icon128.png",
    shortcut: "/icons/icon128.png",
    apple: "/icons/icon128.png",
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
