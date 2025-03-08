'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { BsThreeDots } from 'react-icons/bs';
import { FiEdit2, FiTrash2 } from 'react-icons/fi';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { updateReportTitle } from '@/lib/db';
import { deleteReportAction } from '@/lib/server-actions/reports';
import { useResearchStore } from '@/lib/research-store';
import type { ResearchData } from '@deep-research/db/schema';
import { DBSchema } from '@deep-research/db';

const truncate = (str: string | undefined | null): string => {
  if (!str) return 'Untitled Research';
  return str.length > 24 ? str.slice(0, 26) + '...' : str;
};

// Use the exact type from DBSchema
type Report = DBSchema['researches'][number];
type UIReport = Required<Report['report']> & { report_id: string };

interface CategoryReports {
  today: UIReport[];
  week: UIReport[];
  month: UIReport[];
  failed: UIReport[];
}

export function ReportsList({
  reports: initialReports,
  runningResearches,
}: {
  reports: ResearchData[];
  runningResearches: string[];
}) {
  const router = useRouter();
  const params = useParams();
  const [editing, setEditing] = useState<{
    id: string | null;
    value: string;
    originalValue: string;
  }>({
    id: null,
    value: '',
    originalValue: '',
  });
  const [report_ID, setReport_ID] = useState<string | null>(null);

  // Transform ResearchData to UIReport format
  const transformReports = (data: ResearchData[]): UIReport[] => {
    return data
      .filter(
        (r): r is ResearchData & { report: NonNullable<Report['report']> } =>
          !!r.report
      )
      .map((r) => ({
        report_id: r.report_id,
        title: r.report.title,
        status: r.report.status,
        sections: r.report.sections,
        citedUrls: r.report.citedUrls,
        isVisited: r.report.isVisited,
        timestamp: r.report.timestamp,
      }));
  };

  const categorizeReports = (
    reports: UIReport[]
  ): CategoryReports & { unread: UIReport[] } => {
    const now = Date.now();
    const dayInMs = 86400000; // 24 hours
    const weekInMs = dayInMs * 7;
    const monthInMs = dayInMs * 30;

    // First separate unread and failed reports
    const unreadReports = reports.filter((r) => !r.isVisited);
    const failedReports = reports.filter((r) => r.status === 'failed');
    const readReports = reports.filter(
      (r) => r.isVisited && r.status !== 'failed'
    );

    // Sort function
    const sortByTimestamp = (a: UIReport, b: UIReport) =>
      b.timestamp - a.timestamp;

    // Categorize read reports
    const today: UIReport[] = [];
    const week: UIReport[] = [];
    const month: UIReport[] = [];

    readReports.forEach((report) => {
      const diff = now - report.timestamp;
      if (diff < dayInMs) today.push(report);
      else if (diff < weekInMs) week.push(report);
      else if (diff < monthInMs) month.push(report);
    });

    return {
      unread: unreadReports.sort(sortByTimestamp),
      failed: failedReports.sort(sortByTimestamp),
      today: today.sort(sortByTimestamp),
      week: week.sort(sortByTimestamp),
      month: month.sort(sortByTimestamp),
    };
  };

  const handleRename = (report: UIReport) => {
    setEditing({
      id: report.report_id,
      value: report.title,
      originalValue: report.title,
    });
  };

  const handleDelete = async (confirmed: boolean) => {
    if (confirmed && report_ID) {
      try {
        await deleteReportAction(report_ID);
        router.push('/');
        router.refresh();
      } catch (err) {
        console.error('Failed to delete report:', err);
      }
      setReport_ID(null);
    } else {
      setReport_ID(null);
    }
  };

  // Add useEffect for click outside and escape key
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (editing.id && !(e.target as HTMLElement).closest('input')) {
        setEditing({ id: null, value: '', originalValue: '' });
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && editing.id) {
        setEditing({ id: null, value: '', originalValue: '' });
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [editing.id]);

  const handleKeyDown = async (
    e: React.KeyboardEvent<HTMLInputElement>,
    report: UIReport
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (editing.value.trim()) {
        try {
          await updateReportTitle(report.report_id, editing.value);
          router.refresh();
        } catch (err) {
          console.error('Failed to rename report:', err);
        }
      }
      setEditing({ id: null, value: '', originalValue: '' });
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setEditing({ id: null, value: '', originalValue: '' });
    }
  };

  const renderReportItem = (report: UIReport) => (
    <Link
      title={report.title}
      key={report.report_id}
      href={
        report.title
          ? `/report/${report.report_id}`
          : `/realtime/${report.report_id}`
      }
      className={`group block px-2 py-1.5 rounded transition-colors relative
                ${
                  params.slug === report.report_id
                    ? 'bg-[#007e81] text-white dark:bg-[#007e81] font-medium'
                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
      onClick={(e) => {
        if (editing.id === report.report_id) {
          e.preventDefault();
        }
      }}
    >
      <div className='flex items-center min-h-[24px] relative'>
        {editing.id === report.report_id ? (
          <input
            type='text'
            value={editing.value}
            onChange={(e) =>
              setEditing((prev) => ({ ...prev, value: e.target.value }))
            }
            onKeyDown={(e) => handleKeyDown(e, report)}
            className='w-full bg-transparent border-none outline-none text-sm leading-6'
            autoFocus
          />
        ) : (
          <div className='w-full relative'>
            {/* Text container that stays within Link width */}
            <div className='w-full relative'>
              <span className='block text-sm leading-6 whitespace-nowrap overflow-hidden'>
                {truncate(report.title) || 'Untitled Research'}
              </span>

              {/* Menu button - no permanent ellipsis */}
              <div className='absolute right-0 top-1/2 -translate-y-1/2 z-10'>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      onClick={(e) => e.preventDefault()}
                      className={`
                                                opacity-0 group-hover:opacity-100
                                                p-1.5 rounded-sm transition-all duration-200
                                                ${
                                                  params.slug ===
                                                  report.report_id
                                                    ? 'bg-[#006669] text-white'
                                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                                }
                                            `}
                    >
                      <BsThreeDots className='w-3 h-3' />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className='min-w-[8rem] p-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg'
                    align='end'
                    side='right'
                    onClick={(e) => e.preventDefault()}
                  >
                    <DropdownMenuItem
                      className='flex items-center px-2 py-1.5 text-sm cursor-pointer text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-sm gap-2'
                      onClick={() => handleRename(report)}
                    >
                      <FiEdit2 className='w-4 h-4' />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className='flex items-center px-2 py-1.5 text-sm cursor-pointer text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-sm gap-2'
                      onClick={() => setReport_ID(report.report_id)}
                    >
                      <FiTrash2 className='w-4 h-4' />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        )}
      </div>
    </Link>
  );

  // Get reports from store but use initialReports as fallback
  const storeReports = useResearchStore((state) => state.reports);

  // Transform the reports to match our UI format
  const reports = storeReports.length
    ? transformReports(storeReports)
    : transformReports(initialReports);

  // Sync to store after render
  useEffect(() => {
    useResearchStore.getState().setReports(initialReports);
  }, [initialReports]);

  // Use reports instead of storeReports
  const categorizedReports = categorizeReports(reports);

  return (
    <div className='space-y-6'>
      {/* Unread Section */}
      {categorizedReports.unread.length > 0 && (
        <section className='space-y-1'>
          <h3 className='text-xs font-medium px-2 mb-2 flex items-center gap-1.5'>
            <span className='w-1.5 h-1.5 rounded-full bg-[#1d9bf0] dark:bg-[#1a8cd8]' />
            <span className='text-[#1d9bf0] dark:text-[#1a8cd8]'>Unread</span>
          </h3>
          <div className='space-y-1'>
            {categorizedReports.unread.map((report) =>
              renderReportItem(report)
            )}
          </div>
        </section>
      )}

      {/* Failed Section */}
      {categorizedReports.failed.length > 0 && (
        <section className='space-y-1'>
          <h3 className='text-xs font-medium px-2 mb-2 flex items-center gap-1.5'>
            <span className='w-1.5 h-1.5 rounded-full bg-red-300 dark:bg-red-800' />
            <span className='text-red-400 dark:text-red-500'>Failed</span>
          </h3>
          <div className='space-y-1'>
            {categorizedReports.failed.map((report) =>
              renderReportItem(report)
            )}
          </div>
        </section>
      )}

      {/* Today Section */}
      {categorizedReports.today.length > 0 && (
        <section className='space-y-1'>
          <h3 className='text-xs font-medium text-gray-400 dark:text-gray-500 px-2 mb-2'>
            Today
          </h3>
          <div className='space-y-1'>
            {categorizedReports.today.map((report) => renderReportItem(report))}
          </div>
        </section>
      )}

      {/* Previous 7 Days Section */}
      {categorizedReports.week.length > 0 && (
        <section className='space-y-1'>
          <h3 className='text-xs font-medium text-gray-400 dark:text-gray-500 px-2 mb-2'>
            Previous 7 Days
          </h3>
          <div className='space-y-1'>
            {categorizedReports.week.map((report) => renderReportItem(report))}
          </div>
        </section>
      )}

      {/* Previous 30 Days Section */}
      {categorizedReports.month.length > 0 && (
        <section className='space-y-1'>
          <h3 className='text-xs font-medium text-gray-400 dark:text-gray-500 px-2 mb-2'>
            Previous 30 Days
          </h3>
          <div className='space-y-1'>
            {categorizedReports.month.map((report) => renderReportItem(report))}
          </div>
        </section>
      )}

      <Dialog open={!!report_ID} onOpenChange={() => setReport_ID(null)}>
        <DialogContent className='bg-gray-100 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700'>
          <DialogHeader>
            <DialogTitle className='text-gray-900 dark:text-gray-100 mb-5'>
              Delete Report
            </DialogTitle>
            <DialogDescription className='text-gray-600 dark:text-gray-400'>
              Are you sure you want to delete this report? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <div className='flex justify-end gap-2 mt-4'>
            <Button
              variant='outline'
              onClick={() => handleDelete(false)}
              className='hover:bg-gray-200 dark:hover:bg-gray-700'
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleDelete(true)}
              className='bg-red-500 hover:bg-red-600 text-white dark:bg-red-600 dark:hover:bg-red-700'
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
