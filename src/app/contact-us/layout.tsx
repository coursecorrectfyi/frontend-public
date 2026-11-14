import type { Metadata } from 'next';
import { SITE_URL } from '@/config/siteConfig';

export const metadata: Metadata = {
  title: 'Contact Us | CourseCorrect',
  description: 'Get in touch with the CourseCorrect team. We\'d love to hear from you.',
  alternates: { canonical: `${SITE_URL}/contact-us` },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
