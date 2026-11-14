export const RESOURCE_TYPE_META: Record<string, { label: string; tooltip: string }> = {
  course:        { label: 'Course',        tooltip: 'A structured video course with lessons and quizzes.' },
  program:       { label: 'Program',       tooltip: 'A curated series of courses that together cover a topic in depth, often ending in a certificate.' },
  degree:        { label: 'Degree',        tooltip: "An accredited academic degree (e.g. Bachelor's or Master's) delivered online." },
  project:       { label: 'Project',       tooltip: 'A short, hands-on guided project — typically 1–2 hours of applied practice.' },
  certification: { label: 'Certification', tooltip: 'A professional certification prep course designed to help you pass an industry exam.' },
  code_along:    { label: 'Code Along',    tooltip: 'An interactive coding tutorial where you build something step-by-step in your browser.' },
}

export const LEVEL_LABELS: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  all_levels: 'All Levels',
}

export function formatDuration(hours: number | null): string | null {
  if (hours == null) return null
  if (hours < 1) return `${Math.round(hours * 60)} min`
  if (hours < 2) return '1 hour'
  if (hours < 100) return `${Math.round(hours)} hours`
  const weeks = Math.round(hours / 10)
  if (weeks < 52) return `~${weeks} week${weeks === 1 ? '' : 's'}`
  const years = hours / 10 / 52
  return `~${years < 1.5 ? '1 year' : `${Math.round(years)} years`}`
}
