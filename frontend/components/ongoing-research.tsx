'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { useResearchStore } from '@/lib/research-store';

export function OngoingResearch() {
    const ongoingResearch = useResearchStore((state) => state.ongoingResearch);

    if (ongoingResearch.length === 0) return null;

    return (
        <div className="space-y-1 mb-8"> {/* Increased bottom margin */}
            <h3 className="text-xs font-medium text-gray-400 dark:text-gray-500 px-2 mb-3">
                Ongoing Research ({ongoingResearch.length})
            </h3>

            <div className="space-y-2 mb-2"> {/* Added bottom margin and increased gap between items */}
                {ongoingResearch.map((research) => (
                    <div
                        key={research.id}
                        className="px-2 py-1.5 rounded bg-gray-100 dark:bg-gray-800"
                    >
                        <Skeleton
                            className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700"
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}
