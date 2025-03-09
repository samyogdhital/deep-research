import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className='min-h-screen bg-white dark:bg-bg_color'>
      <div className='container mx-auto px-4 py-8 max-w-4xl'>
        {/* Title and Creation Time */}
        <div className='space-y-2 mb-8'>
          <Skeleton className='h-10 w-3/4 bg-gray-100 dark:bg-gray-800/50 animate-shimmer' />
          <Skeleton className='h-4 w-48 bg-gray-100 dark:bg-gray-800/50 animate-shimmer' />
        </div>

        {/* Technical Report Title */}
        <div className='mb-8'>
          <Skeleton className='h-8 w-2/3 bg-gray-100 dark:bg-gray-800/50 animate-shimmer' />
        </div>

        {/* Introduction Section */}
        <div className='space-y-4 mb-12'>
          <Skeleton className='h-6 w-64 bg-gray-100 dark:bg-gray-800/50 animate-shimmer' />
          {[...Array(3)].map((_, i) => (
            <Skeleton
              key={i}
              className='h-4 w-full bg-gray-100 dark:bg-gray-800/50 animate-shimmer'
            />
          ))}
        </div>

        {/* Technical Sections */}
        {[...Array(7)].map((_, i) => (
          <div key={i} className='space-y-4 mb-12'>
            <Skeleton className='h-6 w-2/3 bg-gray-100 dark:bg-gray-800/50 animate-shimmer' />
            <div className='space-y-3'>
              {[...Array(4)].map((_, j) => (
                <Skeleton
                  key={j}
                  className='h-4 w-[98%] bg-gray-100 dark:bg-gray-800/50 animate-shimmer'
                />
              ))}
            </div>
          </div>
        ))}

        {/* Economic Viability Section */}
        <div className='space-y-4 mb-12'>
          <Skeleton className='h-6 w-3/4 bg-gray-100 dark:bg-gray-800/50 animate-shimmer' />
          {[...Array(2)].map((_, i) => (
            <Skeleton
              key={i}
              className='h-4 w-full bg-gray-100 dark:bg-gray-800/50 animate-shimmer'
            />
          ))}
        </div>

        {/* Environmental Impact Section */}
        <div className='space-y-4 mb-12'>
          <Skeleton className='h-6 w-1/2 bg-gray-100 dark:bg-gray-800/50 animate-shimmer' />
          {[...Array(2)].map((_, i) => (
            <Skeleton
              key={i}
              className='h-4 w-full bg-gray-100 dark:bg-gray-800/50 animate-shimmer'
            />
          ))}
        </div>

        {/* Regulatory Challenges Section */}
        <div className='space-y-4 mb-12'>
          <Skeleton className='h-6 w-2/3 bg-gray-100 dark:bg-gray-800/50 animate-shimmer' />
          <Skeleton className='h-4 w-full bg-gray-100 dark:bg-gray-800/50 animate-shimmer' />
        </div>

        {/* Conclusion Section */}
        <div className='space-y-4 mb-12'>
          <Skeleton className='h-6 w-40 bg-gray-100 dark:bg-gray-800/50 animate-shimmer' />
          {[...Array(3)].map((_, i) => (
            <Skeleton
              key={i}
              className='h-4 w-full bg-gray-100 dark:bg-gray-800/50 animate-shimmer'
            />
          ))}
        </div>

        {/* Sources Section */}
        <div className='mt-16'>
          <Skeleton className='h-10 w-32 bg-gray-100 dark:bg-gray-800/50 animate-shimmer' />
        </div>
      </div>
    </div>
  );
}
