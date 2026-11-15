import { getResourceById } from '@/api/resources'
import { SITE_URL } from '@/config/siteConfig'
import MainLayout from '@/layouts/MainLayout'
import SplitViewLayout from '@/layouts/SplitViewLayout'
import ResourceChat from '@/components/resource/ResourceChat'
import ResourceDetailPanel from '@/components/resource/ResourceDetailPanel'
import type { Metadata } from 'next'

// TODO F6.7: Replace ResourceChat with the new Cora panel once M8 (RAG chat) is complete

interface LearnPageProps {
  params: Promise<{
    slug: string
    id: string
  }>
}

export async function generateMetadata({ params }: LearnPageProps): Promise<Metadata> {
  const { slug, id } = await params
  try {
    const resource = await getResourceById(id)
    return {
      title: `${resource.title} | CourseCorrect`,
      description: resource.ai_summary ?? undefined,
      alternates: { canonical: `${SITE_URL}/learn/${slug}/${id}` },
    }
  } catch {
    return { title: 'CourseCorrect' }
  }
}

export default async function LearnPage(props: LearnPageProps) {
  const { slug, id } = await props.params

  return (
    <MainLayout>
      <SplitViewLayout
        leftContent={<ResourceChat resourceId={id} />}
        rightContent={<ResourceDetailPanel resourceId={id} urlSlug={slug} />}
      />
    </MainLayout>
  )
}
