'use client';

import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useRouter } from 'next/navigation';

export function OngoingResearchClient() {
  const [activeResearchIds, setActiveResearchIds] = useState<string[]>([]);
  const router = useRouter();

  useEffect(() => {
    const socket = io(`${process.env.NEXT_PUBLIC_API_BASE_URL}`, {
      withCredentials: true,
      transports: ['websocket'],
    });

    socket.on('active_researches', (researchIds: string[]) => {
      setActiveResearchIds(researchIds);
    });

    // Listen for report completion and refresh sidebar
    socket.on('report_writing_successfull', () => {
      // Refresh the sidebar to show new report
      router.refresh();
    });

    return () => {
      socket.disconnect();
    };
  }, [router]);

  if (activeResearchIds.length === 0) return null;

  return (
    <div className='space-y-2 mb-6'>
      <h3 className='px-2 mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400'>
        Ongoing Research ({activeResearchIds.length})
      </h3>

      {activeResearchIds.map((researchId) => (
        <div
          key={researchId}
          onClick={() => router.push(`/realtime/${researchId}`)}
          className='px-2 py-1.5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors'
        >
          <div className='h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4' />
        </div>
      ))}
    </div>
  );
}
