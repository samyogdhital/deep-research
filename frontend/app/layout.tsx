import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from '@/components/theme-provider';

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Deep Research Agent",
  description: "A research assistant to help you do deep research on the internet.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning className="font-inter dark:bg-[#191a1a]">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}


// TODO: we need to add expandable and collapasable sidebar here. This sidebar will fetch all the report id from indexdb. When clicked on each of these index, we get to the /report/[slug] page where we can see the full report of that specific research.

// Since this is layout.tsx, this code will be shared through the whole app in nextjs. We don't have to incldue that sidebar logic on other child routes.