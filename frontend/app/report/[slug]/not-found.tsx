import Link from 'next/link';

export default function NotFound() {
    return (
        <div className="container mx-auto px-4 py-16 text-center">
            <h2 className="text-3xl font-bold mb-4">Report Not Found</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-8">
                The research report you're looking for doesn't exist or has been removed.
            </p>
            <Link
                href="/"
                className="text-[#007e81] hover:text-[#00676a] dark:text-[#007e81] dark:hover:text-[#00676a]"
            >
                Return to Home
            </Link>
        </div>
    );
}
