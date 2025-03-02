import { SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { SerpQuery } from '@deep-research/db/schema';
import { CircleIcon, CheckCircleIcon, XCircleIcon } from 'lucide-react';

interface QuerySheetProps {
  query: SerpQuery;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuerySheet({ query, isOpen, onOpenChange }: QuerySheetProps) {
  return (
    <SheetContent className='w-[600px] sm:w-[800px] overflow-y-auto'>
      <SheetHeader>
        <SheetTitle className='text-xl font-bold'>{query.query}</SheetTitle>
        <p className='text-sm text-gray-500 dark:text-gray-400 mt-2'>
          {query.objective}
        </p>
      </SheetHeader>

      <div className='mt-8'>
        <h3 className='text-lg font-semibold mb-4'>Websites</h3>
        <div className='space-y-4'>
          {query.successful_scraped_websites.map((website, index) => (
            <div
              key={`${website.url}-${index}`}
              className='border dark:border-gray-800 rounded-lg p-4 space-y-3'
            >
              {/* Website Header */}
              <div className='flex items-start justify-between'>
                <div className='space-y-1'>
                  <h4 className='font-medium text-gray-900 dark:text-gray-100'>
                    {website.title || website.url}
                  </h4>
                  <p className='text-sm text-gray-500 dark:text-gray-400'>
                    {website.url}
                  </p>
                </div>
                <div className='flex items-center gap-2'>
                  {website.status === 'scraping' && (
                    <div className='flex items-center text-yellow-500 dark:text-yellow-400'>
                      <CircleIcon className='w-4 h-4 mr-1 animate-pulse' />
                      <span className='text-sm'>Scraping</span>
                    </div>
                  )}
                  {website.status === 'analyzing' && (
                    <div className='flex items-center text-blue-500 dark:text-blue-400'>
                      <CircleIcon className='w-4 h-4 mr-1 animate-pulse' />
                      <span className='text-sm'>Analyzing</span>
                    </div>
                  )}
                  {website.status === 'analyzed' && (
                    <div className='flex items-center text-green-500 dark:text-green-400'>
                      <CheckCircleIcon className='w-4 h-4 mr-1' />
                      <span className='text-sm'>Analyzed</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Extracted Information */}
              {website.status === 'analyzed' &&
                website.extracted_from_website_analyzer_agent.length > 0 && (
                  <div className='mt-4 space-y-2'>
                    <h5 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                      Extracted Information
                    </h5>
                    <div className='bg-gray-50 dark:bg-gray-800 rounded-md p-3'>
                      <ul className='list-disc list-inside space-y-2 text-sm text-gray-600 dark:text-gray-300'>
                        {website.extracted_from_website_analyzer_agent.map(
                          (info, i) => (
                            <li key={i}>{info}</li>
                          )
                        )}
                      </ul>
                    </div>
                  </div>
                )}
            </div>
          ))}
        </div>

        {/* Failed Websites */}
        {query.failedWebsites && query.failedWebsites.length > 0 && (
          <div className='mt-8'>
            <h3 className='text-sm font-medium text-gray-500 dark:text-gray-400 mb-2'>
              Failed Websites
            </h3>
            <ul className='list-disc list-inside space-y-1 text-sm text-gray-500 dark:text-gray-400'>
              {query.failedWebsites.map((url, index) => (
                <li key={index} className='flex items-center gap-2'>
                  <XCircleIcon className='w-4 h-4 text-red-500' />
                  {url}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </SheetContent>
  );
}
