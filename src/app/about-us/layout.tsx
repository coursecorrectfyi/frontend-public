import type { Metadata } from 'next';
import { SITE_URL } from '@/config/siteConfig';

export const metadata: Metadata = {
  title: 'About Us | CourseCorrect',
  description: 'Learn about the team behind CourseCorrect and our mission to make finding the right course simple for every learner.',
  alternates: { canonical: `${SITE_URL}/about-us` },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
