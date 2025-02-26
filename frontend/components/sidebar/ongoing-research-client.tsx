'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  useResearchStore,
  OngoingResearch,
  socket,
} from '@/lib/research-store';

export function OngoingResearchClient() {
  const router = useRouter();
  const { ongoingResearch } = useResearchStore();

  // Set up WebSocket listener for research completion
  useEffect(() => {
    function handleResearchComplete() {
      router.refresh();
    }

    socket.on('research-completed', handleResearchComplete);

    return () => {
      socket.off('research-completed', handleResearchComplete);
    };
  }, [router]);

  if (!ongoingResearch.length) return null;

  return (
    <div className='space-y-2 mb-6'>
      <h3 className='px-2 mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase'>
        Ongoing Research ({ongoingResearch.length})
      </h3>
      {ongoingResearch.map((research: OngoingResearch) => (
        <div
          key={research.id}
          className='px-2 py-1.5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse'
        >
          <div className='h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4' />
        </div>
      ))}
    </div>
  );
}
