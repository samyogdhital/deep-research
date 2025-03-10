import { RealtimeView } from '@/components/RealtimeView';
import { Suspense } from 'react';
import { getReport } from '@/lib/apis';
import NotFound from './not-found';
import Loading from './loading';

export default async function RealtimePage(
  // Don't remove this comment this is new change from nextjs 15.
  // params` should be awaited before using its properties. Learn more: https://nextjs.org/docs/messages/sync-dynamic-apis
  props: {
    params: Promise<{ slug: string }>;
  }
) {
  const params = await props.params;
  const { slug } = params;

  // Fetch initial data server-side
  const initialData = await getReport(slug);

  if (!initialData) {
    return <NotFound />;
  }

  return (
    <main className='fixed inset-0 w-full h-full bg-[#0B1120]'>
      <Suspense>
        <RealtimeView initialData={initialData} browser_report_id={slug} />
      </Suspense>
    </main>
  );
}
