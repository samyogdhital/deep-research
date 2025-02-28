import { cookies } from 'next/headers';
import { getAllReports } from '@/lib/db';
import ContentWrapper from './content-wrapper';
import { ResearchData } from '@deep-research/db/schema';

interface Props {
  children: React.ReactNode;
}

export async function LayoutWrapper({ children }: Props) {
  // Get cookies.
  const cookieStore = await cookies();
  const isExpanded = cookieStore.get('sidebar-expanded')?.value === 'true';

  // Fetch reports server-side
  const reports: ResearchData[] = await getAllReports(); // Server-side call
  return (
    <div className='flex min-h-screen'>
      <ContentWrapper {...{ reports, isExpanded }}>{children}</ContentWrapper>
    </div>
  );
}
