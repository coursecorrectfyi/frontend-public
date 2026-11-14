'use client'

import GradientText from '@/components/typography/GradientText'
import {
  AutoAwesomeOutlined,
  TrendingUpOutlined,
  WorkOutlined,
  StarOutlined,
} from '@mui/icons-material'
import {
  alpha,
  Box,
  Chip,
  Container,
  Divider,
  Link,
  Stack,
  Typography,
} from '@mui/material'

// ── Mock resource card ────────────────────────────────────────────────────────
//
// Shows a realistic example of the data CourseCorrect surfaces — salary range,
// skills, review sentiment. Static illustration only (not a real course).

function MockResourceCard() {
  return (
    <Box
      sx={{
        borderRadius: 2,
        border: '1px solid',
        borderColor: (theme) =>
          theme.palette.mode === 'dark'
            ? alpha(theme.palette.common.white, 0.12)
            : theme.palette.grey[200],
        bgcolor: (theme) =>
          theme.palette.mode === 'dark'
            ? alpha(theme.palette.common.white, 0.04)
            : theme.palette.common.white,
        p: 2.5,
        maxWidth: 380,
        width: '100%',
        boxShadow: (theme) =>
          theme.palette.mode === 'dark'
            ? `0 0 0 1px ${alpha(theme.palette.common.white, 0.06)}`
            : '0 2px 12px rgba(0,0,0,0.08)',
      }}
    >
      {/* Title row */}
      <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mb: 1.5 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 1,
            flexShrink: 0,
            bgcolor: (theme) =>
              theme.palette.mode === 'dark'
                ? alpha(theme.palette.primary.main, 0.2)
                : alpha(theme.palette.primary.main, 0.1),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AutoAwesomeOutlined fontSize="small" color="primary" />
        </Box>
        <Box>
          <Typography variant="subtitle2" fontWeight={600} lineHeight={1.3}>
            Machine Learning Specialization
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Coursera · Stanford University · Intermediate
          </Typography>
        </Box>
      </Stack>

      <Divider sx={{ my: 1.5 }} />

      {/* Rating row */}
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1.5 }}>
        <StarOutlined sx={{ fontSize: 16, color: 'warning.main' }} />
        <Typography variant="body2" fontWeight={600}>4.9</Typography>
        <Typography variant="caption" color="text.secondary">(15,234 ratings)</Typography>
        <Box sx={{ flex: 1 }} />
        <Chip label="Free audit" size="small" color="success" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
      </Stack>

      {/* Skills */}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
        Skills you'll gain
      </Typography>
      <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mb: 1.5 }}>
        {['Supervised Learning', 'Neural Networks', 'Python', 'TensorFlow', 'Model Tuning'].map((s) => (
          <Chip key={s} label={s} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
        ))}
      </Stack>

      <Divider sx={{ my: 1.5 }} />

      {/* Career outcomes */}
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.75 }}>
        <WorkOutlined sx={{ fontSize: 15, color: 'primary.main' }} />
        <Typography variant="caption" fontWeight={600} color="primary">
          Where this takes you
        </Typography>
        <Chip label="O*NET / BLS" size="small" variant="outlined" sx={{ height: 16, fontSize: '0.65rem', ml: 'auto' }} />
      </Stack>
      {[
        { title: 'ML Engineer', salary: '$115K–$185K/yr' },
        { title: 'Data Scientist', salary: '$95K–$155K/yr' },
      ].map((role) => (
        <Stack key={role.title} direction="row" justifyContent="space-between" sx={{ py: 0.4 }}>
          <Typography variant="caption">{role.title}</Typography>
          <Typography variant="caption" color="success.main" fontWeight={600}>
            {role.salary}
          </Typography>
        </Stack>
      ))}

      <Divider sx={{ my: 1.5 }} />

      {/* Review sentiment */}
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.75 }}>
        <TrendingUpOutlined sx={{ fontSize: 15, color: 'success.main' }} />
        <Typography variant="caption" fontWeight={600}>Learner sentiment: Positive</Typography>
      </Stack>
      <Typography variant="caption" color="text.secondary">
        Pros: world-class instruction, practical assignments, clear pacing
      </Typography>
    </Box>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AiInsightsCallout() {
  return (
    <Box
      sx={{
        py: { xs: 8, md: 12 },
        bgcolor: (theme) =>
          theme.palette.mode === 'dark'
            ? theme.palette.grey[900]
            : theme.palette.grey[50],
      }}
    >
      <Container maxWidth="lg">
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={{ xs: 6, md: 10 }}
          alignItems="center"
        >
          {/* Left: copy */}
          <Box sx={{ flex: 1 }}>
            <Typography
              variant="h2"
              sx={{
                fontSize: { xs: '1.8rem', md: '2.4rem' },
                fontWeight: 700,
                mb: 3,
                lineHeight: 1.2,
              }}
            >
              <GradientText>We show you what</GradientText>
              <br />
              most platforms don't.
            </Typography>

            <Typography
              variant="body1"
              sx={{
                fontSize: { xs: '1rem', md: '1.1rem' },
                lineHeight: 1.75,
                color: 'text.secondary',
                mb: 3,
              }}
            >
              Most course sites show you star ratings and marketing blurbs. We go further.
              Every course on CourseCorrect has AI-generated insights: a plain-English summary,
              the skills you'll actually gain, the job roles it prepares you for, and salary
              ranges grounded in U.S. labor market data.
            </Typography>

            <Typography
              variant="body1"
              sx={{
                fontSize: { xs: '1rem', md: '1.1rem' },
                lineHeight: 1.75,
                color: 'text.secondary',
                mb: 4,
              }}
            >
              No fluff. No guesswork. Just what you need to make a confident decision.
            </Typography>

            <Typography
              variant="caption"
              color="text.disabled"
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
            >
              <AutoAwesomeOutlined sx={{ fontSize: 14 }} />
              Career data sourced from{' '}
              <Link href="https://www.onetonline.org" target="_blank" rel="noopener" color="inherit" underline="always">
                O*NET
              </Link>
              {' '}and the{' '}
              <Link href="https://www.bls.gov/ooh/" target="_blank" rel="noopener" color="inherit" underline="always">
                Bureau of Labor Statistics
              </Link>.
            </Typography>
          </Box>

          {/* Right: mock resource card */}
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              justifyContent: { xs: 'center', md: 'flex-end' },
              width: '100%',
            }}
          >
            <MockResourceCard />
          </Box>
        </Stack>
      </Container>
    </Box>
  )
}
