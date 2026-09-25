'use client';

import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from '@/lib/i18n/navigation';

export const CAPTURE_FOCUS_EVENT = 'nasaq:focus-capture';

export function requestCaptureFocus() {
  window.dispatchEvent(new Event(CAPTURE_FOCUS_EVENT));
}

const CaptureHotkeyContext = createContext(false);

export function useCaptureHotkeyEnabled() {
  return useContext(CaptureHotkeyContext);
}

export function CaptureHotkeyProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (
        !(event.metaKey || event.ctrlKey) ||
        event.key.toLowerCase() !== 'k'
      ) {
        return;
      }
      event.preventDefault();
      if (pathname === '/inbox') {
        requestCaptureFocus();
        return;
      }
      router.push('/inbox?focus=1');
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pathname, router]);

  return (
    <CaptureHotkeyContext.Provider value={true}>
      {children}
    </CaptureHotkeyContext.Provider>
  );
}
