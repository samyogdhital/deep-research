'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { BsThreeDots } from "react-icons/bs"
import { FiEdit2, FiTrash2 } from "react-icons/fi"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { updateReportTitle } from '@/lib/db'
import { deleteReportAction } from '@/lib/server-actions/reports'

interface Report {
    id: string;
    report_title: string;
    timestamp: number;
    isVisited?: boolean;
}

interface CategoryReports {
    today: Report[];
    week: Report[];
    month: Report[];
}

export function ReportsList({ reports }: { reports: Report[] }) {
    const router = useRouter()
    const params = useParams()
    const [editing, setEditing] = useState<{ id: string | null; value: string; originalValue: string }>({
        id: null,
        value: '',
        originalValue: ''
    })
    const [deletePrompt, setDeletePrompt] = useState<string | null>(null)

    const categorizeReports = (reports: Report[]): CategoryReports & { unread: Report[] } => {
        const now = Date.now()
        const dayInMs = 86400000 // 24 hours
        const weekInMs = dayInMs * 7
        const monthInMs = dayInMs * 30

        // First separate unread reports
        const unreadReports = reports.filter(r => !r.isVisited)
        const unreadIds = new Set(unreadReports.map(r => r.id))

        // Then categorize remaining (read) reports
        // Only process reports that aren't unread
        const readReports = reports.filter(r => r.isVisited && !unreadIds.has(r.id))

        const categories = readReports.reduce((acc: CategoryReports & { unread: Report[] }, report) => {
            const diff = now - report.timestamp

            if (diff < dayInMs) {
                acc.today.push(report)
            } else if (diff < weekInMs) {
                acc.week.push(report)
            } else if (diff < monthInMs) {
                acc.month.push(report)
            }

            return acc
        }, { today: [], week: [], month: [], unread: unreadReports })

        // Sort each category by newest first
        return {
            unread: categories.unread.sort((a, b) => b.timestamp - a.timestamp),
            today: categories.today.sort((a, b) => b.timestamp - a.timestamp),
            week: categories.week.sort((a, b) => b.timestamp - a.timestamp),
            month: categories.month.sort((a, b) => b.timestamp - a.timestamp)
        }
    }

    const handleRename = (report: Report) => {
        setEditing({
            id: report.id,
            value: report.report_title,
            originalValue: report.report_title
        })
    }

    const handleDelete = async (confirmed: boolean) => {
        if (confirmed && deletePrompt) {
            try {
                await deleteReportAction(deletePrompt)
                router.push("/")
                router.refresh()
            } catch (err) {
                console.error('Failed to delete report:', err)
            }
            setDeletePrompt(null)
        } else {
            setDeletePrompt(null)
        }
    }

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

    const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>, report: Report) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (editing.value.trim()) {
                try {
                    await updateReportTitle(report.id, editing.value);
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

    const renderReportItem = (report: Report) => (
        <Link
            key={report.id}
            href={`/report/${report.id}`}
            className={`group block px-2 py-1.5 rounded transition-colors relative
                ${params.slug === report.id
                    ? 'bg-[#007e81] text-white dark:bg-[#007e81] font-medium'
                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
            onClick={(e) => {
                if (editing.id === report.id) {
                    e.preventDefault()
                }
            }}
        >
            <div className="flex items-center min-h-[24px] relative">
                {editing.id === report.id ? (
                    <input
                        type="text"
                        value={editing.value}
                        onChange={(e) => setEditing(prev => ({ ...prev, value: e.target.value }))}
                        onKeyDown={(e) => handleKeyDown(e, report)}
                        className="w-full bg-transparent border-none outline-none text-sm leading-6"
                        autoFocus
                    />
                ) : (
                    <div className="w-full relative">
                        {/* Title with gradient fade */}
                        <div className="w-full pr-7"> {/* Space for menu button */}
                            <div className="truncate text-sm leading-6">
                                {report.report_title || 'Untitled Research'}
                            </div>
                            {/* Gradient fade effect - matches parent background */}
                            <div
                                className="absolute right-0 top-0 h-full w-16 pointer-events-none"
                                style={{
                                    background: params.slug === report.id
                                        ? 'linear-gradient(to left, #007e81 30%, transparent)'
                                        : 'linear-gradient(to left, var(--tw-gradient-from) 30%, transparent)'
                                }}
                            />
                        </div>

                        {/* Menu button that stays visible during dropdown */}
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 z-10">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button
                                        onClick={(e) => e.preventDefault()}
                                        className={`
                                            opacity-0 group-hover:opacity-100
                                            p-1 rounded transition-all duration-200
                                            ${params.slug === report.id
                                                ? 'hover:bg-[#006669] text-white'
                                                : 'hover:bg-gray-300/50 dark:hover:bg-gray-600/50 text-gray-700 dark:text-gray-300'
                                            }
                                            ${editing.id === report.id ? 'hidden' : ''}
                                        `}
                                    >
                                        <BsThreeDots className="w-3 h-3" />
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    className="min-w-[8rem] p-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg"
                                    align="end"
                                    side="right"
                                    onClick={(e) => e.preventDefault()}
                                >
                                    <DropdownMenuItem
                                        className="flex items-center px-2 py-1.5 text-sm cursor-pointer text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-sm gap-2"
                                        onClick={() => handleRename(report)}
                                    >
                                        <FiEdit2 className="w-4 h-4" />
                                        Rename
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        className="flex items-center px-2 py-1.5 text-sm cursor-pointer text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-sm gap-2"
                                        onClick={() => setDeletePrompt(report.id)}
                                    >
                                        <FiTrash2 className="w-4 h-4" />
                                        Delete
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                )}
            </div>
        </Link>
    )

    const categorizedReports = categorizeReports(reports)

    return (
        <div className="space-y-6">
            {/* Unread Section */}
            {categorizedReports.unread.length > 0 && (
                <section className="space-y-1">
                    <h3 className="text-xs font-medium px-2 mb-2 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#1d9bf0] dark:bg-[#1a8cd8]" />
                        <span className="text-[#1d9bf0] dark:text-[#1a8cd8]">Unread</span>
                    </h3>
                    <div className="space-y-1">
                        {categorizedReports.unread.map(report => renderReportItem(report))}
                    </div>
                </section>
            )}

            {/* Today Section */}
            {categorizedReports.today.length > 0 && (
                <section className="space-y-1">
                    <h3 className="text-xs font-medium text-gray-400 dark:text-gray-500 px-2 mb-2">Today</h3>
                    <div className="space-y-1">
                        {categorizedReports.today.map(report => renderReportItem(report))}
                    </div>
                </section>
            )}

            {/* Previous 7 Days Section */}
            {categorizedReports.week.length > 0 && (
                <section className="space-y-1">
                    <h3 className="text-xs font-medium text-gray-400 dark:text-gray-500 px-2 mb-2">Previous 7 Days</h3>
                    <div className="space-y-1">
                        {categorizedReports.week.map(report => renderReportItem(report))}
                    </div>
                </section>
            )}

            {/* Previous 30 Days Section */}
            {categorizedReports.month.length > 0 && (
                <section className="space-y-1">
                    <h3 className="text-xs font-medium text-gray-400 dark:text-gray-500 px-2 mb-2">Previous 30 Days</h3>
                    <div className="space-y-1">
                        {categorizedReports.month.map(report => renderReportItem(report))}
                    </div>
                </section>
            )}

            <Dialog open={!!deletePrompt} onOpenChange={() => setDeletePrompt(null)}>
                <DialogContent className="bg-gray-100 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700">
                    <DialogHeader>
                        <DialogTitle className="text-gray-900 dark:text-gray-100">
                            Delete Report
                        </DialogTitle>
                        <DialogDescription className="text-gray-600 dark:text-gray-400">
                            Are you sure you want to delete this report? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end gap-2 mt-4">
                        <Button
                            variant="outline"
                            onClick={() => handleDelete(false)}
                            className="hover:bg-gray-200 dark:hover:bg-gray-700"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={() => handleDelete(true)}
                            className="bg-red-500 hover:bg-red-600 text-white dark:bg-red-600 dark:hover:bg-red-700"
                        >
                            Delete
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
