'use client';

import { Loader2 } from 'lucide-react';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store/store';

export function GlobalLoader() {
  const isLoading = useSelector((state: RootState) => state.ui.isLoading);

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
      <div className="rounded-xl bg-white p-4 shadow-lg dark:bg-neutral-900">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    </div>
  );
}
