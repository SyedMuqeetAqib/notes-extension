import type {Metadata} from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TabulaNote',
  description: 'A new tab for your thoughts.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/icons/icon16.png" sizes="16x16" />
        <link rel="icon" href="/icons/icon48.png" sizes="48x48" />
        <link rel="icon" href="/icons/icon128.png" sizes="128x128" />
        <script async defer src="https://apis.google.com/js/api.js"></script>
      </head>
      <body className="font-body antialiased">{children}</body>
    </html>
  );
}
