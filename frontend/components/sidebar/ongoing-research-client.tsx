'use client'

import { useEffect } from 'react'
import { useResearchStore } from '@/lib/research-store'

export function OngoingResearchClient() {
    const ongoingResearch = useResearchStore(state => state.ongoingResearch)

    if (!ongoingResearch.length) return null

    return (
        <div className="mb-8">
            <h3 className="text-xs font-medium text-gray-400 dark:text-gray-500 px-2 mb-3">
                Ongoing Research ({ongoingResearch.length})
            </h3>
            <div className="space-y-2">
                {ongoingResearch.map(item => (
                    <div
                        key={item.id}
                        className="px-2 py-1.5 bg-gray-100 dark:bg-gray-800 rounded min-h-[24px]"
                    >
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 animate-pulse" />
                    </div>
                ))}
            </div>
        </div>
    )
}
