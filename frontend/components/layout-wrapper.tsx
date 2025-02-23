'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from './sidebar';

// Remove getAllReports import and API call from layout
export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        isExpanded={isSidebarExpanded}
        onExpandChange={setIsSidebarExpanded}
      />
      <main className={`flex-1 transition-all duration-300 ease-in-out ${isSidebarExpanded ? 'ml-64' : 'ml-0'}`}>
        {children}
      </main>
    </div>
  );
}
