import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from '@/components/ui/sheet';
import type { SerpQuery } from '@deep-research/db/schema';
import { CheckCircleIcon, XCircleIcon } from 'lucide-react';
import { LuLoaderCircle } from 'react-icons/lu';
import { TbAnalyzeFilled } from 'react-icons/tb';
import { HiCheck } from 'react-icons/hi';
import { MdOutlineClose } from 'react-icons/md';

interface QuerySheetProps {
  query: SerpQuery;
  onOpenChange?: (open: boolean) => void;
}

export function QuerySheet({ query, onOpenChange }: QuerySheetProps) {
  return (
    <Sheet defaultOpen onOpenChange={onOpenChange}>
      <SheetContent
        className='!w-[min(800px,100vw-40px)] h-full overflow-y-auto overflow-x-hidden'
        onMouseDown={(e) => e.stopPropagation()}
        style={{ userSelect: 'text', cursor: 'auto' }}
      >
        <SheetHeader>
          <SheetTitle className='text-xl font-bold break-words'>
            <span className='font-bold'>Query:</span> {query.query}
          </SheetTitle>
          <SheetDescription className='text-sm text-gray-500 dark:text-gray-400 mt-2 break-words'>
            <span className='font-bold'>Objective:</span> {query.objective}
          </SheetDescription>
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
                <div className='flex flex-col sm:flex-row sm:items-start gap-2'>
                  <div
                    className='space-y-1 min-w-0 flex-1'
                    style={{ maxWidth: 'calc(100% - 120px)' }}
                  >
                    <h4 className='font-medium text-gray-900 dark:text-gray-100 break-words hyphens-auto mb-4'>
                      {website.title || website.url}
                    </h4>
                    <p className='text-sm text-gray-500 dark:text-gray-400 break-all'>
                      <a
                        href={website.url}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='hover:text-blue-500 dark:hover:text-blue-400 hover:underline'
                      >
                        {website.url}
                      </a>
                    </p>
                  </div>
                  <div className='flex-shrink-0 self-start w-[100px]'>
                    {website.status === 'scraping' && (
                      <div className='flex items-center text-yellow-500 dark:text-yellow-400 whitespace-nowrap'>
                        <LuLoaderCircle className='w-5 h-5 mr-1 flex-shrink-0 animate-spin' />
                        <span className='text-sm'>Scraping</span>
                      </div>
                    )}
                    {website.status === 'analyzing' && (
                      <div className='flex items-center text-blue-500 dark:text-blue-400 whitespace-nowrap'>
                        <TbAnalyzeFilled className='w-5 h-5 mr-1 flex-shrink-0 animate-spin' />
                        <span className='text-sm'>Analyzing</span>
                      </div>
                    )}
                    {website.status === 'analyzed' && (
                      <div className='flex items-center whitespace-nowrap'>
                        {website.is_objective_met ? (
                          <div className='flex items-center text-green-500 dark:text-green-400'>
                            <HiCheck className='w-5 h-5 mr-1 flex-shrink-0' />
                            <span className='text-sm'>Analyzed</span>
                          </div>
                        ) : (
                          <div className='flex items-center text-orange-500 dark:text-orange-400'>
                            <MdOutlineClose className='w-5 h-5 mr-1 flex-shrink-0' />
                            <span className='text-sm'>Not Relevant</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Extracted Information */}
                {website.status === 'analyzed' &&
                  website.core_content.length > 0 && (
                    <>
                      <span className='text-sm text-gray-500 dark:text-gray-400'>
                        Relevance Score: {website.relevance_score}/10
                      </span>
                      <div className='mt-4 space-y-2'>
                        <h5 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                          Extracted Information
                        </h5>
                        <div className='bg-gray-50 dark:bg-gray-800 rounded-md p-3'>
                          <ul className='list-disc ml-4 space-y-2 text-sm text-gray-600 dark:text-gray-300'>
                            {website.core_content.map((info, i) => (
                              <li key={i} className='pl-1 break-words'>
                                {info}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </>
                  )}
              </div>
            ))}
          </div>

          {/* Failed Websites */}
          {query.failedWebsites && query.failedWebsites.length > 0 && (
            <div className='mt-8'>
              <div className='flex items-center gap-2 mb-3'>
                <XCircleIcon className='w-5 h-5 text-red-500 flex-shrink-0' />
                <h3 className='text-sm font-medium text-gray-500 dark:text-gray-400'>
                  Failed Websites
                </h3>
              </div>
              <ul className='space-y-2 text-sm text-gray-500 dark:text-gray-400 ml-6'>
                {query.failedWebsites.map((failedWebsite, index) => (
                  <li key={index} className='list-disc break-all'>
                    <a
                      href={failedWebsite.website}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='hover:text-blue-500 dark:hover:text-blue-400 hover:underline'
                    >
                      {failedWebsite.website}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
