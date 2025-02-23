'use client'

import { useState, useEffect } from 'react'
import { Sidebar } from './sidebar'
import { RxHamburgerMenu } from "react-icons/rx"
import { IoAddCircleOutline } from "react-icons/io5"
import { setSidebarState } from '@/lib/server-actions'

interface Props {
  children: React.ReactNode
  initialExpanded: boolean
}

export function LayoutWrapper({ children, initialExpanded }: Props) {
  const [mounted, setMounted] = useState(false)
  const [isExpanded, setIsExpanded] = useState(initialExpanded)

  // Add handler for state changes
  const handleExpandChange = async (expanded: boolean) => {
    setIsExpanded(expanded)
    await setSidebarState(expanded) // Update cookie
  }

  useEffect(() => {
    setMounted(true)
  }, [])

  // Show skeleton while client is mounting
  const SidebarSkeleton = () => (
    <div className="fixed left-0 top-0 h-full bg-gray-100 dark:bg-gray-800 w-64 flex flex-col shadow-lg z-40">
      {/* Static controls - no shimmer */}
      <div className="p-4 flex items-center justify-between">
        <div className="p-2.5 rounded-lg bg-gray-100 dark:bg-gray-800">
          <RxHamburgerMenu className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </div>
        <div className="p-2.5 rounded-lg bg-gray-100 dark:bg-gray-800">
          <IoAddCircleOutline className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </div>
      </div>

      {/* Reports section with shimmer */}
      <div className="flex-1 px-4 pt-6 border-t dark:border-gray-700">
        <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-6 px-2">
          Reports
        </h2>
        <div className="space-y-8">
          {/* Today's reports skeleton */}
          <div className="space-y-1">
            <h3 className="text-xs font-medium text-gray-400 dark:text-gray-500 px-2 mb-3">Today</h3>
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="px-2 py-1.5">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Static bottom controls - no shimmer */}
      <div className="p-4 border-t dark:border-gray-700">
        <div className="w-full h-10 bg-gray-100 dark:bg-gray-800" />
      </div>
      <div className="p-4 border-t dark:border-gray-700">
        <div className="w-full h-10 bg-gray-100 dark:bg-gray-800" />
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen">
      {/* Show skeleton only if expanded and not mounted */}
      {!mounted && isExpanded ? <SidebarSkeleton /> : null}

      {/* Show actual sidebar once mounted */}
      {mounted && (
        <Sidebar
          isExpanded={isExpanded}
          onExpandChange={handleExpandChange} // Use new handler
        />
      )}

      <main className={`flex-1 transition-all duration-300 ease-in-out ${isExpanded ? 'ml-64' : 'ml-0'}`}>
        {children}
      </main>
    </div>
  )
}
