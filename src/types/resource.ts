// ── Core types for the CC 1.5 Postgres-backed API ────────────────────────────
//
// These replace the legacy Course/CourseDetails types from types/course.ts.
// LearningResource covers all resource types: course, program, degree,
// project, certification, code_along.

export type ResourceType =
  | 'course'
  | 'program'
  | 'degree'
  | 'project'
  | 'certification'
  | 'code_along'

export type ResourceLevel = 'beginner' | 'intermediate' | 'advanced' | 'all_levels'

export type Provider = 'coursera' | 'udemy' | 'edx' | 'pluralsight' | 'datacamp'

// ── AI Insights ───────────────────────────────────────────────────────────────

export interface ReviewInsights {
  sentiment: 'positive' | 'mixed' | 'negative'
  pros: string[]
  cons: string[]
  representative_quotes: string[]
}

export interface CareerInsights {
  job_roles: Array<{
    title: string
    salary_range: string
    description: string
  }>
  complementary_skills: string[]
  growth_potential: string
}

export interface AIInsights {
  reviewInsights?: ReviewInsights
  careerInsights?: CareerInsights
}

// ── Search result (list view) ─────────────────────────────────────────────────
// Returned by GET /api/v1/resources/search

export interface LearningResource {
  id: string
  provider: string
  resource_type: ResourceType
  provider_type: string | null
  title: string
  ai_summary: string | null
  institution: string | null
  language: string | null
  level: ResourceLevel | null
  duration_hours: number | null
  rating: number | null
  num_ratings: number | null
  is_free: boolean | null
  has_certificate: boolean | null
  is_self_paced: boolean | null
  skills: string[] | null
  career_paths: string[] | null
  /** affiliate_url if available, otherwise source_url — resolved server-side */
  url: string
}

// ── Detail view ───────────────────────────────────────────────────────────────
// Returned by GET /api/v1/resources/:id

export interface LearningResourceDetail extends LearningResource {
  external_id: string
  legacy_mongo_id: string | null
  ai_insights: AIInsights | null
  ai_insights_updated_at: string | null
  last_normalized_at: string | null
}

// ── Search filters ────────────────────────────────────────────────────────────

export interface ResourceFilters {
  levels?: ResourceLevel[]
  providers?: string[]
  languages?: string[]
  resource_types?: ResourceType[]
  is_free?: boolean
  has_certificate?: boolean
  sort?: 'relevance' | 'rating' | 'most_reviewed' | 'duration_asc' | 'duration_desc' | 'newest'
}

// ── API response shapes ───────────────────────────────────────────────────────

export interface ResourceSearchResponse {
  data: LearningResource[]
  next_cursor: string | null
  vector_search: boolean
}
