'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { Menu, PlusCircle } from 'lucide-react';
import { SidebarFooter } from './sidebar-footer';
import { ReportsList } from './reports-list';
import { OngoingResearchClient } from './ongoing-research-client';
import { SidebarHeader } from './sidebar-header';
import { ResearchData } from '@deep-research/db/schema';

// Simple skeleton just for reports section
function ReportsSkeleton() {
  return (
    <div className='space-y-2 px-2'>
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className='h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 animate-pulse'
        />
      ))}
    </div>
  );
}

export function ClientSidebar({
  reports,
  isExpanded,
  onToggle,
  runningResearches = [],
  theme,
}: {
  reports: ResearchData[];
  isExpanded: boolean;
  onToggle: () => void;
  runningResearches: string[];
  theme: string;
}) {
  return (
    <>
      {/* Floating buttons when sidebar is collapsed */}
      {!isExpanded && (
        <div className='fixed left-4 top-4 z-50 flex gap-3'>
          <button
            onClick={onToggle}
            className='p-2.5 bg-white dark:bg-gray-800 rounded-lg 
              hover:bg-gray-50 dark:hover:bg-gray-700 
              transition-all duration-200 shadow-lg hover:shadow-xl
              text-gray-700 dark:text-gray-300'
          >
            <Menu className='w-6 h-6' strokeWidth={2} />
          </button>
          <Link
            href='/'
            className='p-2.5 bg-white dark:bg-gray-800 rounded-lg 
              hover:bg-gray-50 dark:hover:bg-gray-700 
              transition-all duration-200 shadow-lg hover:shadow-xl
              text-[#007e81] dark:text-[#00a4a8]'
          >
            <PlusCircle className='w-6 h-6' strokeWidth={2} />
          </Link>
        </div>
      )}

      <div
        className={`fixed left-0 top-0 h-full bg-gray-100 dark:bg-gray-800 w-64 flex flex-col shadow-lg z-40 
            transition-all duration-300 ease-in-out ${
              isExpanded ? 'translate-x-0' : '-translate-x-full'
            }`}
      >
        {/* Top Section with Fixed Buttons */}
        <div className='flex-shrink-0 border-b dark:border-gray-700'>
          {/* Menu and New Research Buttons */}
          <div className='p-4 flex items-center justify-between gap-3'>
            <button
              onClick={onToggle}
              className='p-2.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors
                text-gray-700 dark:text-gray-300'
            >
              <Menu className='w-6 h-6' strokeWidth={2} />
            </button>
            <Link
              href='/'
              className='p-2.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors
                text-[#007e81] dark:text-[#00a4a8]'
            >
              <PlusCircle className='w-6 h-6' strokeWidth={2} />
            </Link>
          </div>
        </div>

        {/* Reports Section with Scrollable Area */}
        <div className='flex flex-col min-h-0 flex-1'>
          {/* Reports Header */}
          <div className='flex-shrink-0 p-4'>
            <h2 className='text-sm font-medium text-gray-500 dark:text-gray-400'>
              Reports
            </h2>
          </div>

          {/* Scrollable Reports List */}
          <div className='flex-1 overflow-y-auto'>
            {/* Add OngoingResearchClient above ReportsList */}
            <div className='px-4'>
              <OngoingResearchClient />
            </div>

            <div className='px-4'>
              <Suspense fallback={<ReportsSkeleton />}>
                <ReportsList
                  reports={reports}
                  runningResearches={runningResearches}
                />
              </Suspense>
            </div>
          </div>

          {/* Static Footer with Fixed Buttons */}
          <div className='flex-shrink-0 border-t dark:border-gray-700'>
            <SidebarFooter theme={theme} />
          </div>
        </div>
      </div>
    </>
  );
}
