'use client'

import { useResourceDetail } from '@/hooks/use-resource-detail'
import type { AIInsights } from '@/types/resource'
import {
  ArrowOutwardTwoTone,
  SmartToyOutlined,
  WorkOutlined,
  StarOutlined,
} from '@mui/icons-material'
import SaveCourseButton from '../course/SaveCourseButton'
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Rating,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import { trackEnrollClick } from '@/utils/analytics'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import slugify from 'slugify'
import { RESOURCE_TYPE_META, LEVEL_LABELS, formatDuration } from './resource-meta'

// ── Helpers ───────────────────────────────────────────────────────────────────

const PROVIDER_LABELS: Record<string, string> = {
  coursera: 'Coursera',
  edx: 'edX',
  udemy: 'Udemy',
  datacamp: 'DataCamp',
  pluralsight: 'Pluralsight',
  skillshare: 'Skillshare',
}

const ISO_TO_LANGUAGE: Record<string, string> = {
  en: 'English', es: 'Spanish', pt: 'Portuguese', tr: 'Turkish',
  fr: 'French', ar: 'Arabic', ja: 'Japanese', zh: 'Chinese',
  de: 'German', ko: 'Korean', it: 'Italian', ru: 'Russian',
  hi: 'Hindi', id: 'Indonesian', pl: 'Polish', uk: 'Ukrainian',
  he: 'Hebrew',
}


// ── Sub-sections ──────────────────────────────────────────────────────────────

function CareerInsightsSection({ insights }: { insights: NonNullable<AIInsights['careerInsights']> }) {
  return (
    <Box>
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1.5 }}>
        <WorkOutlined fontSize="small" color="primary" />
        <Typography variant="subtitle1" fontWeight="bold">Where this takes you</Typography>
        <Chip label="O*NET / BLS" size="small" variant="outlined" sx={{ ml: 1 }} />
      </Stack>

      {insights.job_roles?.length > 0 && (
        <Stack spacing={1.5} sx={{ mb: 2 }}>
          {insights.job_roles.map((role, i) => (
            <Box
              key={i}
              sx={{
                p: 1.5,
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Typography variant="body2" fontWeight="bold">{role.title}</Typography>
                {role.salary_range && (
                  <Typography variant="body2" color="success.main" fontWeight="medium">
                    {role.salary_range}
                  </Typography>
                )}
              </Stack>
              {role.description && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {role.description}
                </Typography>
              )}
            </Box>
          ))}
        </Stack>
      )}

      {insights.complementary_skills?.length > 0 && (
        <Box sx={{ mb: 1.5 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Pair with these skills
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {insights.complementary_skills.map((skill, i) => (
              <Chip key={i} label={skill} size="small" variant="outlined" />
            ))}
          </Box>
        </Box>
      )}

      {insights.growth_potential && (
        <Typography variant="body2" color="text.secondary">
          {insights.growth_potential}
        </Typography>
      )}

      <Typography variant="caption" color="text.disabled" sx={{ mt: 1.5, display: 'block' }}>
        Career data is AI-generated and sourced from O*NET / BLS. For informational purposes only.
      </Typography>
    </Box>
  )
}

function ReviewInsightsSection({ insights }: { insights: NonNullable<AIInsights['reviewInsights']> }) {
  const sentimentColor = {
    positive: 'success.main',
    mixed: 'warning.main',
    negative: 'error.main',
  }[insights.sentiment] ?? 'text.secondary'

  return (
    <Box>
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1.5 }}>
        <StarOutlined fontSize="small" color="primary" />
        <Typography variant="subtitle1" fontWeight="bold">What learners say</Typography>
        <Chip label="AI-synthesised" size="small" variant="outlined" sx={{ ml: 1 }} />
      </Stack>

      <Typography variant="body2" color={sentimentColor} fontWeight="medium" sx={{ mb: 1.5 }}>
        {insights.sentiment.charAt(0).toUpperCase() + insights.sentiment.slice(1)} overall
      </Typography>

      <Box sx={{ display: 'flex', gap: 1.5, flexDirection: { xs: 'column', sm: 'row' }, mb: 2 }}>
        {insights.pros?.length > 0 && (
          <Box
            sx={{
              flex: 1, p: 1.5, borderRadius: 1,
              bgcolor: 'rgba(76, 175, 80, 0.06)',
              border: '1px solid rgba(76, 175, 80, 0.2)',
            }}
          >
            <Typography variant="body2" fontWeight="bold" color="success.main" gutterBottom>Pros</Typography>
            <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
              {insights.pros.map((p, i) => (
                <li key={i}><Typography variant="body2">{p}</Typography></li>
              ))}
            </ul>
          </Box>
        )}

        {insights.cons?.length > 0 && (
          <Box
            sx={{
              flex: 1, p: 1.5, borderRadius: 1,
              bgcolor: 'rgba(211, 47, 47, 0.06)',
              border: '1px solid rgba(211, 47, 47, 0.2)',
            }}
          >
            <Typography variant="body2" fontWeight="bold" color="error.main" gutterBottom>Cons</Typography>
            <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
              {insights.cons.map((c, i) => (
                <li key={i}><Typography variant="body2">{c}</Typography></li>
              ))}
            </ul>
          </Box>
        )}
      </Box>

      {insights.representative_quotes?.length > 0 && (
        <Stack spacing={1}>
          {insights.representative_quotes.map((quote, i) => (
            <Box
              key={i}
              sx={{
                p: 1.5,
                borderLeft: '3px solid',
                borderColor: 'primary.main',
                borderRadius: '0 4px 4px 0',
                bgcolor: 'background.paper',
                fontStyle: 'italic',
              }}
            >
              <Typography variant="body2">"{quote}"</Typography>
            </Box>
          ))}
        </Stack>
      )}

      <Typography variant="caption" color="text.disabled" sx={{ mt: 1.5, display: 'block' }}>
        Review insights are AI-generated summaries of learner reviews.
      </Typography>
    </Box>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      <Skeleton variant="text" width="70%" height={36} />
      <Skeleton variant="text" width="40%" />
      <Stack direction="row" spacing={1}>
        {[1, 2, 3, 4].map(i => <Skeleton key={i} variant="rounded" width={80} height={24} />)}
      </Stack>
      <Skeleton variant="rounded" height={100} />
      <Skeleton variant="text" width="30%" />
      <Stack direction="row" spacing={1}>
        {[1, 2, 3, 4].map(i => <Skeleton key={i} variant="rounded" width={90} height={28} />)}
      </Stack>
    </Stack>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface ResourceDetailPanelProps {
  /** UUID or legacy mongo ID — the backend accepts both */
  resourceId: string
  /** The slug segment from the URL — used to detect and fix mismatches */
  urlSlug: string
}

export default function ResourceDetailPanel({ resourceId, urlSlug }: ResourceDetailPanelProps) {
  const router = useRouter()
  const { data: resource, isLoading, error } = useResourceDetail(resourceId)

  // Redirect to canonical URL when:
  //   • resourceId was a legacy mongo ID (resource.id !== resourceId), or
  //   • the slug in the URL doesn't match the resource title (e.g. /learn/anything/uuid)
  useEffect(() => {
    if (!resource) return
    const expectedSlug = slugify(resource.title, { lower: true, strict: true })
    if (resource.id !== resourceId || urlSlug !== expectedSlug) {
      router.replace(`/learn/${expectedSlug}/${resource.id}`)
    }
  }, [resource, resourceId, urlSlug, router])

  if (isLoading) {
    return (
      <Paper sx={{ width: '100%', height: '100%', overflow: 'auto' }}>
        <DetailSkeleton />
      </Paper>
    )
  }

  if (error || !resource) {
    return (
      <Paper sx={{ p: 2, width: '100%' }}>
        <Alert severity="error">
          {error instanceof Error ? error.message : 'Resource not found.'}
        </Alert>
      </Paper>
    )
  }

  const duration = formatDuration(resource.duration_hours)
  const providerLabel = PROVIDER_LABELS[resource.provider] ?? resource.provider
  const typeMeta = RESOURCE_TYPE_META[resource.resource_type] ?? { label: resource.resource_type, tooltip: '' }
  const levelLabel = resource.level ? (LEVEL_LABELS[resource.level] ?? resource.level) : null
  const languageLabel = resource.language ? (ISO_TO_LANGUAGE[resource.language] ?? resource.language) : null

  return (
    <Paper
      sx={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ── Fixed header ── */}
      <Box sx={{ p: 2, flexShrink: 0, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h5" component="h1" gutterBottom>
          {resource.title}
        </Typography>

        {resource.institution && (
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {resource.institution} · {providerLabel}
          </Typography>
        )}

        {/* Rating */}
        {resource.rating != null && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
            <Rating value={resource.rating} readOnly precision={0.5} size="small" />
            <Typography variant="body2" color="text.secondary">
              {resource.rating.toFixed(1)}
              {resource.num_ratings != null && ` (${resource.num_ratings.toLocaleString()})`}
            </Typography>
          </Stack>
        )}

        {/* Metadata chips */}
        <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mb: 2 }}>
          <Tooltip title={typeMeta.tooltip} arrow>
            <Chip label={typeMeta.label} size="small" color="primary" variant="outlined" sx={{ cursor: 'help' }} />
          </Tooltip>
          {levelLabel && <Chip label={levelLabel} size="small" variant="outlined" />}
          {resource.is_self_paced && <Chip label="Self-paced" size="small" variant="outlined" />}
          {resource.is_free && <Chip label="Free" size="small" color="success" variant="outlined" />}
          {resource.has_certificate && <Chip label="Certificate" size="small" variant="outlined" />}
          {duration && <Chip label={duration} size="small" variant="outlined" />}
          {languageLabel && <Chip label={languageLabel} size="small" variant="outlined" />}
        </Stack>

        {/* Enroll CTA + shortlist */}
        <Stack direction="row" spacing={1} alignItems="center">
          <Button
            variant="contained"
            endIcon={<ArrowOutwardTwoTone />}
            href={resource.url}
            target="_blank"
            rel="noopener noreferrer"
            size="small"
            onClick={() => trackEnrollClick(resource.id, resource.title, resource.url, 'course_detail')}
          >
            Enroll on {providerLabel}
          </Button>
          <SaveCourseButton courseId={resource.id} courseName={resource.title} />
        </Stack>
        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.75 }}>
          You'll be taken to {providerLabel}'s website. CourseCorrect may earn a commission — at no cost to you.
        </Typography>
      </Box>

      {/* ── Scrollable body ── */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        <Stack spacing={3} divider={<Divider />}>

          {/* AI Summary */}
          {resource.ai_summary && (
            <Box>
              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1 }}>
                <SmartToyOutlined fontSize="small" color="disabled" />
                <Typography variant="subtitle1" fontWeight="bold">What you'll learn</Typography>
              </Stack>
              <Typography variant="body2" sx={{ lineHeight: 1.7 }}>
                {resource.ai_summary}
              </Typography>
              <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: 'block' }}>
                AI-generated summary
              </Typography>
            </Box>
          )}

          {/* Skills */}
          {resource.skills && resource.skills.length > 0 && (
            <Box>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Skills you'll gain</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {resource.skills.slice(0, 12).map((skill, i) => (
                  <Chip key={i} label={skill} size="small" />
                ))}
              </Box>
            </Box>
          )}

          {/* Career insights */}
          {resource.ai_insights?.careerInsights && (
            <CareerInsightsSection insights={resource.ai_insights.careerInsights} />
          )}

          {/* Review insights */}
          {resource.ai_insights?.reviewInsights && (
            <ReviewInsightsSection insights={resource.ai_insights.reviewInsights} />
          )}

        </Stack>
      </Box>
    </Paper>
  )
}
