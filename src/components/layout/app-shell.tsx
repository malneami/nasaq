import type { ReactNode } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/top-bar';
import { CaptureHotkeyProvider } from '@/components/inbox/capture-hotkey';

export function AppShell({
  children,
  userEmail,
}: {
  children: ReactNode;
  userEmail?: string;
}) {
  return (
    <CaptureHotkeyProvider>
      <div className="nasaq-path-surface flex min-h-svh">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col bg-background/80 backdrop-blur-[2px]">
          <TopBar userEmail={userEmail} />
          <main className="flex-1 px-(--spacing-page-x) py-(--spacing-page-y)">
            {children}
          </main>
        </div>
      </div>
    </CaptureHotkeyProvider>
  );
}
