import type { Metadata } from 'next';
import { SITE_URL } from '@/config/siteConfig';

export const metadata: Metadata = {
  title: 'Get a Personalized Learning Path | CourseCorrect',
  description: 'Not sure where to start? Tell us your goals and we\'ll map out a step-by-step learning path tailored to you.',
  alternates: { canonical: `${SITE_URL}/get-learning-path` },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
