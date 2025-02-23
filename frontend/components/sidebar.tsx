'use client';

import { useState, useEffect } from 'react';
import { getAllReports, updateReportTitle, deleteReport, clearAllReports } from '@/lib/db';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { RxHamburgerMenu } from "react-icons/rx";
import { IoAddCircleOutline } from "react-icons/io5";
import { BsThreeDots } from "react-icons/bs";
import { FiEdit2, FiTrash2, FiCheck, FiX } from "react-icons/fi";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OngoingResearch } from './ongoing-research';
import { useResearchStore } from '@/lib/research-store';

interface ResearchReport {
    id: string;
    report_title: string;
    timestamp: number;
}

interface CategoryReports {
    today: ResearchReport[];
    week: ResearchReport[];
    month: ResearchReport[];
}

interface SidebarProps {
    isExpanded: boolean;
    onExpandChange: (expanded: boolean) => void;
}

interface EditingState {
    id: string | null;
    value: string;
    originalValue: string;
}

export function Sidebar({ isExpanded, onExpandChange }: SidebarProps) {
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const reports = useResearchStore((state) => state.reports);
    const refreshReports = useResearchStore((state) => state.refreshReports);
    const params = useParams();
    const pathname = usePathname();
    const { theme, setTheme } = useTheme();
    const [editing, setEditing] = useState<EditingState>({ id: null, value: '', originalValue: '' });
    const [deletePrompt, setDeletePrompt] = useState<string | null>(null);
    const [showClearAllDialog, setShowClearAllDialog] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (isExpanded) {
            refreshReports();
        }
    }, [isExpanded, refreshReports]);

    const getThemeDisplay = (currentTheme: string | undefined) => {
        switch (currentTheme?.toLowerCase()) {
            case 'light': return 'Light';
            case 'dark': return 'Dark';
            default: return 'System';
        }
    };

    const categorizeReports = (reports: ResearchReport[]): CategoryReports => {
        const now = Date.now();
        const dayInMs = 86400000; // 24 hours in milliseconds

        // First categorize the reports
        const categories = reports.reduce((acc: CategoryReports, report) => {
            const diff = now - report.timestamp;

            if (diff < dayInMs) {
                acc.today.push(report);
            } else if (diff < dayInMs * 7) {
                acc.week.push(report);
            } else if (diff < dayInMs * 30) {
                acc.month.push(report);
            }
            return acc;
        }, { today: [], week: [], month: [] });

        // Then sort each category by timestamp in descending order (newest first)
        return {
            today: categories.today.sort((a, b) => b.timestamp - a.timestamp),
            week: categories.week.sort((a, b) => b.timestamp - a.timestamp),
            month: categories.month.sort((a, b) => b.timestamp - a.timestamp)
        };
    };

    const handleRename = (report: ResearchReport) => {
        setEditing({
            id: report.id,
            value: report.report_title,
            originalValue: report.report_title
        });
    };

    const handleSaveRename = async () => {
        if (editing.id && editing.value.trim()) {
            try {
                await updateReportTitle(editing.id, editing.value);
                // Refresh reports list
                refreshReports();
            } catch (err) {
                console.error('Failed to rename report:', err);
            }
        }
        setEditing({ id: null, value: '', originalValue: '' });
    };

    const handleCancelRename = () => {
        setEditing({ id: null, value: '', originalValue: '' });
    };

    const handleDelete = async (confirmed: boolean) => {
        if (confirmed && deletePrompt) {
            try {
                await deleteReport(deletePrompt);
                // Refresh reports list
                refreshReports();
                // Navigate to homepage after successful delete
                router.push('/');
            } catch (err) {
                console.error('Failed to delete report:', err);
            }
        }
        setDeletePrompt(null);
    };

    const handleClearAll = async (confirmed: boolean) => {
        if (confirmed) {
            try {
                await clearAllReports();
                refreshReports();
                router.push('/');
            } catch (err) {
                console.error('Failed to clear reports:', err);
            }
        }
        setShowClearAllDialog(false);
    };

    const renderReportTitle = (report: ResearchReport) => {
        if (editing.id === report.id) {
            return (
                <div className="flex items-center justify-between gap-2">
                    <input
                        type="text"
                        value={editing.value}
                        onChange={(e) => setEditing(prev => ({ ...prev, value: e.target.value }))}
                        className="flex-1 bg-transparent border-none outline-none text-xs"
                        autoFocus
                    />
                    <div className="flex items-center gap-1">
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                handleSaveRename();
                            }}
                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded transition-colors"
                        >
                            <FiCheck className="w-3 h-3" />
                        </button>
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                handleCancelRename();
                            }}
                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded transition-colors"
                        >
                            <FiX className="w-3 h-3" />
                        </button>
                    </div>
                </div>
            );
        }

        return (
            <div className="flex items-center justify-between group">
                <div className="truncate text-xs">
                    {report.report_title || 'Untitled Research'}
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 rounded transition-colors">
                            <BsThreeDots className="w-3 h-3" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        className="min-w-[8rem] border bg-white dark:bg-[#191a1a] border-gray-200 dark:border-gray-700 shadow-lg"
                        align="end"
                    >
                        <DropdownMenuItem
                            className="cursor-pointer text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 gap-2"
                            onClick={(e) => {
                                e.preventDefault();
                                handleRename(report);
                            }}
                        >
                            <FiEdit2 className="w-4 h-4" />
                            Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            className="cursor-pointer text-red-600 dark:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-800 gap-2"
                            onClick={(e) => {
                                e.preventDefault();
                                setDeletePrompt(report.id);
                            }}
                        >
                            <FiTrash2 className="w-4 h-4" />
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        );
    };

    // Prevent hydration issues
    if (!mounted) return null;

    return (
        <>
            {/* Fixed buttons that show when sidebar is collapsed */}
            <div className="fixed top-4 left-4 flex items-center gap-3 z-30">
                <button
                    onClick={() => onExpandChange(true)}
                    className="p-2.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    aria-label="Toggle Sidebar"
                >
                    <RxHamburgerMenu className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                </button>
                <button
                    onClick={() => router.push('/')}
                    className="p-2.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    aria-label="New Research"
                >
                    <IoAddCircleOutline className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                </button>
            </div>

            {/* Sidebar */}
            <div
                className={`fixed left-0 top-0 h-full bg-gray-100 dark:bg-gray-800 transition-transform duration-300 w-64 flex flex-col shadow-lg z-40
          ${isExpanded ? 'translate-x-0' : '-translate-x-full'}`}
            >
                {/* Top buttons inside sidebar with right-aligned new research button */}
                <div className="p-4 flex items-center justify-between">
                    <button
                        onClick={() => onExpandChange(false)}
                        className="p-2.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        aria-label="Collapse Sidebar"
                    >
                        <RxHamburgerMenu className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                    </button>
                    <button
                        onClick={() => router.push('/')}
                        className="p-2.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        aria-label="New Research"
                    >
                        <IoAddCircleOutline className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                    </button>
                </div>

                {/* Reports list with categories */}
                <div className="flex-1 px-4 pt-6 border-t dark:border-gray-700">
                    <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-6 px-2">
                        Reports
                    </h2>

                    <OngoingResearch />

                    {/* Categorized reports */}
                    <div className="space-y-8"> {/* Increased space between categories */}
                        {categorizeReports(reports).today.length > 0 && (
                            <div className="space-y-1">
                                <h3 className="text-xs font-medium text-gray-400 dark:text-gray-500 px-2 mb-3">
                                    Today
                                </h3>
                                <div className="space-y-2 mb-2"> {/* Added gap between items and bottom margin */}
                                    {categorizeReports(reports).today.map((report) => (
                                        <Link
                                            key={report.id}
                                            href={`/report/${report.id}`}
                                            className={`block px-2 py-1.5 rounded transition-colors
                      ${params.slug === report.id
                                                    ? 'bg-[#007e81] text-white dark:bg-[#007e81] font-medium'
                                                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                                            onClick={(e) => {
                                                if (editing.id === report.id) {
                                                    e.preventDefault();
                                                }
                                            }}
                                        >
                                            {renderReportTitle(report)}
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Previous 7 Days with same spacing */}
                        {categorizeReports(reports).week.length > 0 && (
                            <div className="space-y-1">
                                <h3 className="text-xs font-medium text-gray-400 dark:text-gray-500 px-2 mb-3">
                                    Previous 7 Days
                                </h3>
                                <div className="space-y-2 mb-2">
                                    {categorizeReports(reports).week.map((report) => (
                                        <Link
                                            key={report.id}
                                            href={`/report/${report.id}`}
                                            className={`block px-2 py-1.5 rounded transition-colors
                      ${params.slug === report.id
                                                    ? 'bg-[#007e81] text-white dark:bg-[#007e81] font-medium'
                                                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                                            onClick={(e) => {
                                                if (editing.id === report.id) {
                                                    e.preventDefault();
                                                }
                                            }}
                                        >
                                            {renderReportTitle(report)}
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Previous 30 Days with same spacing */}
                        {categorizeReports(reports).month.length > 0 && (
                            <div className="space-y-1">
                                <h3 className="text-xs font-medium text-gray-400 dark:text-gray-500 px-2 mb-3">
                                    Previous 30 Days
                                </h3>
                                <div className="space-y-2 mb-2">
                                    {categorizeReports(reports).month.map((report) => (
                                        <Link
                                            key={report.id}
                                            href={`/report/${report.id}`}
                                            className={`block px-2 py-1.5 rounded transition-colors
                      ${params.slug === report.id
                                                    ? 'bg-[#007e81] text-white dark:bg-[#007e81] font-medium'
                                                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                                            onClick={(e) => {
                                                if (editing.id === report.id) {
                                                    e.preventDefault();
                                                }
                                            }}
                                        >
                                            {renderReportTitle(report)}
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Clear All button */}
                <div className="p-4 border-t dark:border-gray-700">
                    <Button
                        variant="ghost"
                        className="w-full justify-start px-2 gap-2 font-normal text-red-600 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10"
                        onClick={() => setShowClearAllDialog(true)}
                    >
                        <FiTrash2 className="h-4 w-4" />
                        Clear All Reports
                    </Button>
                </div>

                {/* Theme toggle */}
                <div className="p-4 border-t dark:border-gray-700">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                className="w-full justify-start px-2 gap-2 font-normal"
                            >
                                {theme === 'dark' ? (
                                    <Moon className="h-4 w-4" />
                                ) : (
                                    <Sun className="h-4 w-4" />
                                )}
                                <span>{mounted ? getThemeDisplay(theme) : 'System'} Theme</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            className="min-w-[8rem] border bg-white dark:border-gray-700 dark:bg-[#191a1a] shadow-lg"
                            align="start"
                            side="top"
                        >
                            <DropdownMenuItem
                                className="cursor-pointer dark:focus:bg-gray-800"
                                onClick={() => setTheme("light")}
                            >
                                Light
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                className="cursor-pointer dark:focus:bg-gray-800"
                                onClick={() => setTheme("dark")}
                            >
                                Dark
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                className="cursor-pointer dark:focus:bg-gray-800"
                                onClick={() => setTheme("system")}
                            >
                                System
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Delete Confirmation Dialog */}
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
                            No
                        </Button>
                        <Button
                            onClick={() => handleDelete(true)}
                            className="bg-red-500 hover:bg-red-600 text-white dark:bg-red-600 dark:hover:bg-red-700"
                        >
                            Yes
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Clear All Confirmation Dialog */}
            <Dialog open={showClearAllDialog} onOpenChange={() => setShowClearAllDialog(false)}>
                <DialogContent className="bg-gray-100 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700">
                    <DialogHeader>
                        <DialogTitle className="text-gray-900 dark:text-gray-100">
                            Clear All Reports
                        </DialogTitle>
                        <DialogDescription className="text-gray-600 dark:text-gray-400">
                            Are you sure you want to delete all research reports? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end gap-2 mt-4">
                        <Button
                            variant="outline"
                            onClick={() => handleClearAll(false)}
                            className="hover:bg-gray-200 dark:hover:bg-gray-700"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={() => handleClearAll(true)}
                            className="bg-red-500 hover:bg-red-600 text-white dark:bg-red-600 dark:hover:bg-red-700"
                        >
                            Yes, Clear All
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
