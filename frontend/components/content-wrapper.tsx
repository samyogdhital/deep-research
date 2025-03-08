'use client';
import { ClientSidebar } from './sidebar/client-sidebar';
import React from 'react';
import { ResearchData } from '@deep-research/db/schema';

export default function ContentWrapper({
  reports,
  runningResearches,
  theme,
  isExpanded: initialExpanded,
  children,
}: {
  reports: ResearchData[];
  runningResearches: string[];
  theme: string;
  isExpanded: boolean;
  children: React.ReactNode;
}) {
  const [isExpanded, setIsExpanded] = React.useState(initialExpanded);

  const handleToggle = React.useCallback(() => {
    const newValue = !isExpanded;
    setIsExpanded(newValue);
    // Set cookie for persistence
    document.cookie = `sidebar-expanded=${newValue}; path=/; max-age=31536000; SameSite=Lax`;
  }, [isExpanded]);

  return (
    <>
      <ClientSidebar
        reports={reports}
        runningResearches={runningResearches}
        isExpanded={isExpanded}
        theme={theme}
        onToggle={handleToggle}
      />
      <main
        className={`flex-1 transition-all duration-300 ease-in-out ${
          isExpanded ? 'ml-64' : 'ml-0'
        }`}
      >
        {children}
      </main>
    </>
  );
}
