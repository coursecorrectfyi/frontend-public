import type { Metadata } from 'next';
import { SITE_URL } from '@/config/siteConfig';

export const metadata: Metadata = {
  title: 'Terms of Use | CourseCorrect',
  description: 'Read the Terms of Use for CourseCorrect, including our affiliate disclosure, AI content disclaimer, and governing policies.',
  alternates: { canonical: `${SITE_URL}/terms` },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
