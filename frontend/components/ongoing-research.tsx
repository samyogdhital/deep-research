'use client';

import { useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useParams } from 'next/navigation';
import { useResearchStore } from '@/lib/research-store';

export function OngoingResearch() {
    const ongoingResearch = useResearchStore((state) => state.ongoingResearch);
    const params = useParams();

    if (ongoingResearch.length === 0) return null;

    return (
        <div className="space-y-1">
            <h3 className="text-xs font-medium text-gray-400 dark:text-gray-500 px-2 mb-2">
                Ongoing Research ({ongoingResearch.length})
            </h3>

            <div className="space-y-1.5">
                {ongoingResearch.map((research) => (
                    <div
                        key={research.id}
                        className={`px-2 py-1.5 rounded transition-colors
              ${params.slug === research.id
                                ? 'bg-[#007e81] dark:bg-[#007e81]'
                                : 'bg-gray-100 dark:bg-gray-800'}`}
                    >
                        <div className="flex flex-col gap-1">
                            <Skeleton
                                className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700"
                            />
                            <Skeleton
                                className="h-3 w-1/2 bg-gray-200 dark:bg-gray-700"
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
