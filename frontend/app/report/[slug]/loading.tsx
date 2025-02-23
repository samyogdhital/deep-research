import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl animate-in fade-in-50">
      {/* Title and action section */}
      <div className="flex items-center justify-between mb-8">
        <div className="space-y-4 flex-1">
          <Skeleton className="h-12 w-3/4 bg-gray-200 dark:bg-gray-700" />
          <Skeleton className="h-4 w-1/2 bg-gray-200 dark:bg-gray-700" />
        </div>
        <Skeleton className="h-10 w-36 bg-gray-200 dark:bg-gray-700" />
      </div>

      {/* Content sections */}
      <div className="space-y-6">
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton 
              key={i} 
              className="h-4 w-full bg-gray-200 dark:bg-gray-700" 
            />
          ))}
        </div>

        {/* Section with heading and content */}
        {[...Array(3)].map((_, i) => (
          <div key={i} className="space-y-4 mt-8">
            <Skeleton className="h-8 w-[240px] bg-gray-200 dark:bg-gray-700" />
            <div className="space-y-3 ml-4">
              {[...Array(4)].map((_, j) => (
                <Skeleton 
                  key={j} 
                  className="h-4 w-[97%] bg-gray-200 dark:bg-gray-700" 
                />
              ))}
            </div>
          </div>
        ))}

        {/* Sources section */}
        <div className="mt-12">
          <Skeleton className="h-8 w-[180px] mb-6 bg-gray-200 dark:bg-gray-700" />
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-12 w-12 rounded-full bg-gray-200 dark:bg-gray-700" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-full bg-gray-200 dark:bg-gray-700" />
                  <Skeleton className="h-4 w-[80%] bg-gray-200 dark:bg-gray-700" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}