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
      </head>
      <body className="font-body antialiased">{children}</body>
    </html>
  );
}
