'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { Menu, PlusCircle } from 'lucide-react';
import { SidebarFooter } from './sidebar-footer';
import { ReportsList } from './reports-list';
import { OngoingResearchClient } from './ongoing-research-client';
import { ReportsType } from '../layout-wrapper';
import { SidebarHeader } from './sidebar-header';

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
}: {
  reports: ReportsType;
  isExpanded: boolean;
  onToggle: () => void;
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
        {/* Static Header */}
        <SidebarHeader onToggle={onToggle} />

        {/* Reports Section */}
        <div className='flex-1 px-4 pt-6'>
          <h2 className='text-sm font-medium text-gray-500 dark:text-gray-400 mb-6 px-2'>
            Reports
          </h2>

          {/* Add OngoingResearchClient above ReportsList */}
          <OngoingResearchClient />

          <Suspense fallback={<ReportsSkeleton />}>
            <ReportsList reports={reports} />
          </Suspense>
        </div>

        {/* Static Footer */}
        <SidebarFooter />
      </div>
    </>
  );
}
