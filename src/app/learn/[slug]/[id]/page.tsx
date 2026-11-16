import { getResourceById } from '@/api/resources'
import { SITE_URL } from '@/config/siteConfig'
import { relayHeaders } from '@/lib/server/relay'
import { resourcePath } from '@/utils/resource-url'
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
  const { id } = await params
  try {
    // Fetched for the visitor (relay headers), so it counts against their limits, not the server's.
    const resource = await getResourceById(id, { headers: await relayHeaders() })
    return {
      title: `${resource.title} | CourseCorrect`,
      description: resource.ai_summary ?? undefined,
      // Always the resource's own slug and UUID, even when the request used a legacy id or a stale slug.
      alternates: { canonical: `${SITE_URL}${resourcePath(resource)}` },
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
