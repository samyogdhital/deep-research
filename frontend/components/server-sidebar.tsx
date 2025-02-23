import { getSidebarState } from '@/lib/server-actions'
import { RxHamburgerMenu } from "react-icons/rx"
import { IoAddCircleOutline } from "react-icons/io5"

export async function ServerSidebar() {
    const { isExpanded } = await getSidebarState()

    // Don't render anything if sidebar is not expanded
    if (!isExpanded) return null;

    return (
        <div className="fixed left-0 top-0 h-full bg-gray-100 dark:bg-gray-800 w-64 flex flex-col shadow-lg z-40 pointer-events-none">
            {/* Added pointer-events-none to prevent interaction with skeleton UI */}
            <div className="p-4 flex items-center justify-between">
                <div className="p-2.5 rounded-lg bg-gray-200 dark:bg-gray-700">
                    <RxHamburgerMenu className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </div>
                <div className="p-2.5 rounded-lg bg-gray-200 dark:bg-gray-700">
                    <IoAddCircleOutline className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </div>
            </div>
            <div className="flex-1 px-4 border-t dark:border-gray-700">
                <div className="animate-pulse space-y-3 mt-6">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                </div>
            </div>
        </div>
    )
}
