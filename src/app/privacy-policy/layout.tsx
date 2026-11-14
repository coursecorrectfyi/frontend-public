import type { Metadata } from 'next';
import { SITE_URL } from '@/config/siteConfig';

export const metadata: Metadata = {
  title: 'Privacy Policy | CourseCorrect',
  description: 'Learn how CourseCorrect collects, uses, and protects your personal information.',
  alternates: { canonical: `${SITE_URL}/privacy-policy` },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
