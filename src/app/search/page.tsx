import { SITE_URL } from '@/config/siteConfig';
import MainLayout from '@/layouts/MainLayout';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import SearchContent from './SearchContent';

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
}

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const { q } = await searchParams;
  if (q) {
    return {
      title: `Results for "${q}" · CourseCorrect`,
      description: `Browse courses, programs, and certifications matching "${q}" — compared and AI-ranked on CourseCorrect.`,
      alternates: { canonical: `${SITE_URL}/search?q=${encodeURIComponent(q)}` },
    };
  }
  return {
    title: 'Search Courses | CourseCorrect',
    description: 'Search and compare courses, programs, and certifications from Coursera, edX, DataCamp, Udemy, and Pluralsight.',
    alternates: { canonical: `${SITE_URL}/search` },
  };
}

export default function Search() {
  return (
    <MainLayout>
      <Suspense fallback={<div>Loading...</div>}>
        <SearchContent />
      </Suspense>
    </MainLayout>
  );
}
