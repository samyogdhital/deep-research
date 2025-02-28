import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className='container mx-auto px-4 py-8 max-w-4xl'>
      {/* Header with download button */}
      <div className='flex justify-between items-center mb-12'>
        <Skeleton className='h-12 w-3/4 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 animate-shimmer' />
        <Skeleton className='h-10 w-40 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 animate-shimmer' />
      </div>

      {/* Main content */}
      <div className='space-y-10'>
        {/* Introduction section */}
        <div className='space-y-4'>
          <Skeleton className='h-8 w-2/3 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 animate-shimmer' />
          {[...Array(4)].map((_, i) => (
            <Skeleton
              key={i}
              className='h-4 w-full bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 animate-shimmer'
            />
          ))}
        </div>

        {/* Content sections */}
        {[...Array(3)].map((_, i) => (
          <div key={i} className='space-y-4'>
            <Skeleton className='h-7 w-1/2 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 animate-shimmer' />
            <div className='space-y-3'>
              {[...Array(5)].map((_, j) => (
                <Skeleton
                  key={j}
                  className='h-4 w-[98%] bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 animate-shimmer'
                />
              ))}
            </div>
          </div>
        ))}

        {/* Citations section */}
        <div className='mt-16 space-y-6'>
          <Skeleton className='h-7 w-32 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 animate-shimmer' />
          <div className='space-y-4'>
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className='p-4 space-y-3 rounded-lg bg-gray-50 dark:bg-gray-800/50'
              >
                <div className='flex items-center gap-2'>
                  <Skeleton className='h-5 w-8 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 animate-shimmer' />
                  <Skeleton className='h-5 flex-1 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 animate-shimmer' />
                </div>
                <Skeleton className='h-4 w-full bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 animate-shimmer' />
                <Skeleton className='h-4 w-5/6 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 animate-shimmer' />
              </div>
            ))}
          </div>
        </div>

        {/* Research Progress section */}
        <div className='mt-16 space-y-6'>
          <Skeleton className='h-7 w-48 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 animate-shimmer' />
          <div className='space-y-6'>
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className='p-4 space-y-4 rounded-lg bg-gray-50 dark:bg-gray-800/50'
              >
                <Skeleton className='h-6 w-3/4 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 animate-shimmer' />
                <Skeleton className='h-4 w-full bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 animate-shimmer' />
                <div className='grid grid-cols-2 gap-4'>
                  {[...Array(4)].map((_, j) => (
                    <div
                      key={j}
                      className='p-3 rounded bg-white dark:bg-gray-700/50 space-y-2'
                    >
                      <Skeleton className='h-4 w-5/6 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 animate-shimmer' />
                      <Skeleton className='h-3 w-1/2 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 animate-shimmer' />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
