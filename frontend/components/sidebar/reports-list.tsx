'use client'

import { useState, useEffect } from 'react' // Add useEffect and useRef
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

    const categorizeReports = (reports: Report[]): CategoryReports => {
        const now = Date.now()
        const dayInMs = 86400000 // 24 hours

        const categories = reports.reduce((acc: CategoryReports, report) => {
            const diff = now - report.timestamp
            if (diff < dayInMs) {
                acc.today.push(report)
            } else if (diff < dayInMs * 7) {
                acc.week.push(report)
            } else if (diff < dayInMs * 30) {
                acc.month.push(report)
            }
            return acc
        }, { today: [], week: [], month: [] })

        // Sort each category by newest first
        return {
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

    const categorizedReports = categorizeReports(reports)

    return (
        <div className="space-y-6">
            {Object.entries(categorizedReports).map(([category, items]) =>
                items.length > 0 && (
                    <section key={category} className="space-y-1">
                        <h3 className="text-xs font-medium text-gray-400 dark:text-gray-500 px-2 mb-2">
                            {category === 'today' ? 'Today' :
                                category === 'week' ? 'Previous 7 Days' :
                                    'Previous 30 Days'}
                        </h3>
                        <div className="space-y-1">
                            {items.map(report => (
                                <Link
                                    key={report.id}
                                    href={`/report/${report.id}`}
                                    className={`block px-2 py-1.5 rounded transition-colors relative
                                        ${params.slug === report.id
                                            ? 'bg-[#007e81] text-white dark:bg-[#007e81] font-medium'
                                            : 'text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700'
                                        }`}
                                    onClick={(e) => {
                                        if (editing.id === report.id || e.target.closest('[data-dropdown]')) {
                                            e.preventDefault()
                                        }
                                    }}
                                >
                                    <div className="flex items-center justify-between group min-h-[24px]">
                                        {editing.id === report.id ? (
                                            <input
                                                type="text"
                                                value={editing.value}
                                                onChange={(e) => setEditing(prev => ({ ...prev, value: e.target.value }))}
                                                onKeyDown={(e) => handleKeyDown(e, report)}
                                                className="w-full bg-transparent border-none outline-none text-sm leading-6 py-0"
                                                autoFocus
                                            />
                                        ) : (
                                            <>
                                                <span className="truncate text-sm leading-6 py-0">
                                                    {report.report_title || 'Untitled Research'}
                                                </span>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <button
                                                            data-dropdown
                                                            onClick={(e) => e.preventDefault()}
                                                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 rounded transition-colors"
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
                                            </>
                                        )}
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </section>
                )
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
