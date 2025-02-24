'use client'

import { useEffect } from 'react'
import { useResearchStore } from '@/lib/research-store'

export function OngoingResearchServer({ research }: { research: any[] }) {
    const setOngoingResearch = useResearchStore(state => state.setOngoingResearch)

    useEffect(() => {
        setOngoingResearch(research)
    }, [research, setOngoingResearch])

    if (!research.length) return null

    return (
        <div className="mb-8">
            <h3 className="text-xs font-medium text-gray-400 px-2 mb-3">
                Ongoing Research ({research.length})
            </h3>
            <div className="space-y-2">
                {research.map(item => (
                    <div key={item.id} className="px-2 py-1.5 bg-gray-100 dark:bg-gray-800 rounded">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 animate-pulse" />
                    </div>
                ))}
            </div>
        </div>
    )
}
