'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { Provider } from 'react-redux';
import { makeStore, type AppStore } from '@/store/store';
import { ThemeProvider } from './ThemeProvider';

export function Providers({ children }: { children: ReactNode }) {
  const storeRef = useRef<AppStore | undefined>(undefined);
  if (!storeRef.current) storeRef.current = makeStore();

  useEffect(() => {
    const preventWheelChange = (event: WheelEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input[type="number"]:focus')) {
        target.blur();
        event.preventDefault();
      }
    };

    window.addEventListener('wheel', preventWheelChange, { passive: false });
    return () => window.removeEventListener('wheel', preventWheelChange);
  }, []);

  return (
    <Provider store={storeRef.current}>
      <ThemeProvider defaultTheme="light" storageKey="theme">
        {children}
      </ThemeProvider>
    </Provider>
  );
}
