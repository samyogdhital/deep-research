import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header section with title and download button */}
      <div className="mb-12 flex justify-between items-start">
        <div className="space-y-4 flex-1">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <Skeleton className="h-10 w-36" /> {/* Download button */}
      </div>

      {/* Content sections */}
      <div className="space-y-10">
        {/* Introduction section */}
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-[95%]" />
          <Skeleton className="h-4 w-[90%]" />
        </div>

        {/* Main content sections - repeat pattern */}
        {[1, 2, 3].map((section) => (
          <div key={section} className="space-y-4">
            <Skeleton className="h-6 w-1/3 mb-2" /> {/* Section title */}
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-[92%]" />
              <Skeleton className="h-4 w-[95%]" />
            </div>
          </div>
        ))}

        {/* Sources section */}
        <div className="space-y-4 mt-8">
          <Skeleton className="h-6 w-32" /> {/* Sources title */}
          <div className="space-y-3">
            {[1, 2, 3, 4].map((source) => (
              <div key={source} className="flex items-center space-x-4">
                <Skeleton className="h-4 w-4" /> {/* Bullet point */}
                <Skeleton className="h-4 flex-1" /> {/* Source link */}
              </div>
            ))}
          </div>
        </div>

        {/* References section */}
        <div className="space-y-4 mt-8">
          <Skeleton className="h-6 w-40" /> {/* References title */}
          <div className="space-y-3">
            {[1, 2, 3].map((ref) => (
              <div key={ref} className="flex items-start space-x-3">
                <Skeleton className="h-4 w-6" /> {/* Reference number */}
                <Skeleton className="h-4 flex-1" /> {/* Reference content */}
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}