import { cookies } from 'next/headers';
import { getAllReports, getRunningResearches } from '@/lib/db';
import ContentWrapper from './content-wrapper';
import { ResearchData } from '@deep-research/db/schema';

interface Props {
  children: React.ReactNode;
}

export async function LayoutWrapper({ children }: Props) {
  // Get cookies.
  const cookieStore = await cookies();
  const isExpanded = cookieStore.get('sidebar-expanded')?.value === 'true';
  const theme = cookieStore.get('theme')?.value || 'system';

  // Fetch reports server-side
  const reports: ResearchData[] = await getAllReports(); // Server-side call
  const runningResearches: string[] = await getRunningResearches();
  return (
    <div className='flex min-h-screen'>
      <ContentWrapper {...{ reports, runningResearches, theme, isExpanded }}>
        {children}
      </ContentWrapper>
    </div>
  );
}
