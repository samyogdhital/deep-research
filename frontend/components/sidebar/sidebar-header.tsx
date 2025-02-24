import Link from 'next/link'
import { RxHamburgerMenu } from "react-icons/rx"
import { IoAddCircleOutline } from "react-icons/io5"

export function SidebarHeader({ isExpanded }: { isExpanded: boolean }) {
    return (
        <div className="p-4 flex items-center justify-between">
            {/* Form to handle toggle server action */}
            <form action="/api/sidebar/toggle" method="POST">
                <input type="hidden" name="expanded" value={(!isExpanded).toString()} />
                <button
                    type="submit"
                    className="p-2.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                    <RxHamburgerMenu className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                </button>
            </form>

            <Link
                href="/"
                className="p-2.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
                <IoAddCircleOutline className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            </Link>
        </div>
    )
}
