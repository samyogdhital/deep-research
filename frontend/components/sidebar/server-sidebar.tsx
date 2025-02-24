import { Suspense } from 'react'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { RxHamburgerMenu } from "react-icons/rx"
import { IoAddCircleOutline } from "react-icons/io5"
import { SidebarFooter } from './sidebar-footer'
import { ReportsList } from './reports-list'
import { getAllReports } from '@/lib/db'

// Simple skeleton just for reports section
function ReportsSkeleton() {
    return (
        <div className="space-y-2 px-2">
            {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 animate-pulse" />
            ))}
        </div>
    )
}

export type ReportsType = {
    id: string;
    report_title: string;
    report: string;
    timestamp: number;
}[]
export async function ServerSidebar() {
    const cookieStore = await cookies()
    const isExpanded = cookieStore.get('sidebar-expanded')?.value === 'true'

    // Fetch reports server-side
    const reports: ReportsType = await getAllReports()

    return (
        <div className={`fixed left-0 top-0 h-full bg-gray-100 dark:bg-gray-800 w-64 flex flex-col shadow-lg z-40 
            transition-transform duration-300 ${isExpanded ? 'translate-x-0' : '-translate-x-full'}`}
        >
            {/* Static Header */}
            <div className="p-4 flex items-center justify-between">
                <form action="/api/sidebar/toggle" method="POST">
                    <input type="hidden" name="expanded" value={(!isExpanded).toString()} />
                    <button type="submit" className="p-2.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                        <RxHamburgerMenu className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                    </button>
                </form>
                <Link href="/" className="p-2.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                    <IoAddCircleOutline className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                </Link>
            </div>

            {/* Reports Section */}
            <div className="flex-1 px-4 pt-6 border-t dark:border-gray-700">
                <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-6 px-2">Reports</h2>
                <Suspense fallback={<ReportsSkeleton />}>
                    <ReportsList reports={reports} />
                </Suspense>
            </div>

            {/* Static Footer */}
            <SidebarFooter />
        </div>
    )
}
