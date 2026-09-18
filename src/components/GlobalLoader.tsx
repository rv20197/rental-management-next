'use client';

import { Loader2 } from 'lucide-react';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store/store';

export function GlobalLoader() {
  const isLoading = useSelector((state: RootState) => state.ui.isLoading);

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
        <Loader2 className="h-16 w-16 animate-spin text-[primary]" />
    </div>
  );
}
