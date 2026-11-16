import { getSubjectBySlug } from '@/api/subjects';
import { SITE_URL } from '@/config/siteConfig';
import { relayHeaders } from '@/lib/server/relay';
import MainLayout from '@/layouts/MainLayout';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import SubjectDetailsContainer from './SubjectDetailsContainer';

interface SubjectPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: SubjectPageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    // Fetched for the visitor (relay headers), so it counts against their limits, not the server's.
    const { topic } = await getSubjectBySlug(slug, { headers: await relayHeaders() });
    return {
      title: `${topic.name} Courses | CourseCorrect`,
      description: topic.meta_description ?? topic.description ?? undefined,
      alternates: { canonical: `${SITE_URL}/subjects/${slug}` },
    };
  } catch {
    return { title: 'CourseCorrect' };
  }
}

export default async function SubjectPage({ params }: SubjectPageProps) {
  const { slug } = await params;

  return (
    <MainLayout>
      <Suspense fallback={<div>Loading...</div>}>
        <SubjectDetailsContainer slug={slug} />
      </Suspense>
    </MainLayout>
  );
}
