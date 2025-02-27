import Link from 'next/link';
import { Menu, PlusCircle } from 'lucide-react';

export function SidebarHeader({ onToggle }: { onToggle: () => void }) {
  return (
    <div className='p-4 flex items-center justify-between border-b dark:border-gray-700'>
      <button
        onClick={onToggle}
        className='p-2 rounded-lg hover:bg-gray-200/80 dark:hover:bg-gray-700/80 transition-all duration-200
          flex items-center gap-2 text-gray-700 dark:text-gray-300'
      >
        <Menu className='w-6 h-6' strokeWidth={2} />
      </button>
      <Link
        href='/'
        className='p-2 rounded-lg hover:bg-gray-200/80 dark:hover:bg-gray-700/80 transition-all duration-200
          flex items-center gap-2 text-[#007e81] dark:text-[#00a4a8]'
      >
        <PlusCircle className='w-6 h-6' strokeWidth={2} />
      </Link>
    </div>
  );
}
