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
        <div className="relative flex min-w-0 flex-1 flex-col bg-background/70 backdrop-blur-[2px]">
          <div
            className="bento-blob hidden md:block"
            style={{
              width: '350px',
              height: '275px',
              right: '-90px',
              top: '420px',
              background: '#dce5d7',
            }}
          />
          <div
            className="bento-blob hidden md:block"
            style={{
              width: '270px',
              height: '330px',
              left: '-115px',
              bottom: '95px',
              background: '#e8e0d5',
              animationDelay: '-6s',
            }}
          />
          <div className="relative z-10 flex flex-1 flex-col">
            <TopBar userEmail={userEmail} />
            <main className="flex-1 px-(--spacing-page-x) py-(--spacing-page-y)">
              {children}
            </main>
          </div>
        </div>
      </div>
    </CaptureHotkeyProvider>
  );
}
