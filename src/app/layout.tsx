import GoogleTagManager from "@/components/analytics/GoogleTagManager";
import BrandingThemeProvider from "@/theme/BrandingThemeProvider";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";
import type { Metadata } from "next";
import { Providers } from "./providers";
import PageViewTracker from "@/components/analytics/PageViewTracker";

export const metadata: Metadata = {
  title: "CourseCorrect — Find the Right Course, Not Just Any Course",
  description: "Compare courses, programs, and certifications from Coursera, edX, DataCamp, Udemy, and Pluralsight. AI-powered recommendations to help you choose with confidence.",
  metadataBase: new URL('https://coursecorrect.fyi'),
  alternates: { canonical: 'https://coursecorrect.fyi' },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://coursecorrect.fyi',
    siteName: 'coursecorrect.fyi',
    title: "CourseCorrect — Find the Right Course, Not Just Any Course",
    description: "Compare courses, programs, and certifications from Coursera, edX, DataCamp, Udemy, and Pluralsight. AI-powered recommendations to help you choose with confidence.",
    images: [
      {
        url: '/images/og-image-light.jpg',
        width: 1200,
        height: 630,
        alt: 'CourseCorrect - Find your perfect course with our trusted AI',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: "CourseCorrect — Find the Right Course, Not Just Any Course",
    description: "Compare courses, programs, and certifications from Coursera, edX, DataCamp, Udemy, and Pluralsight. AI-powered recommendations to help you choose with confidence.",
    images: ['/images/og-image-light.jpg'],
    creator: '@coursecorrect',
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/images/apple-icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <BrandingThemeProvider>
      <html lang="en" suppressHydrationWarning>
        <head>
          <meta name="viewport" content="initial-scale=1, width=device-width" />
          <GoogleTagManager />
        </head>
        <body>
          <Providers>
            <InitColorSchemeScript defaultMode="dark" attribute="data-mui-color-scheme" />
            <AppRouterCacheProvider>
              <PageViewTracker />
              {children}
            </AppRouterCacheProvider>
          </Providers>
        </body>
      </html>
    </BrandingThemeProvider>
  );
}
