import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from '@/components/theme-provider';
import { LayoutWrapper } from '@/components/layout-wrapper';
import { getSidebarState } from '@/lib/server-actions'

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Deep Research Agent",
  description: "A research assistant to help you do deep research on the internet.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isExpanded = await getSidebarState();

  return (
    <html lang="en" className={`${inter.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning className="font-inter dark:bg-[#191a1a]">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <LayoutWrapper initialExpanded={isExpanded}>
            {children}
          </LayoutWrapper>
        </ThemeProvider>
      </body>
    </html>
  );
}