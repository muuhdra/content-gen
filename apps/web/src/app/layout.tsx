import type { Metadata } from 'next';
import '../styles/globals.css';
import { TooltipProvider } from '@/components/ui/tooltip';

export const metadata: Metadata = {
  title: 'COSYL Video Engine | AI Factory',
  description: 'Your personal AI video factory orchestration',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased dark" suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-background text-foreground font-mono">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
