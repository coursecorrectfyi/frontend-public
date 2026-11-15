'use client'

import GradientText from '@/components/typography/GradientText'
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined';
import CancelOutlined from '@mui/icons-material/CancelOutlined';
import {
  Box,
  Container,
  Grid2,
  Link,
  Paper,
  Stack,
  Typography,
} from '@mui/material'

const CC_ADVANTAGES = [
  'Course data scraped directly from providers every month',
  'Career outcome data grounded in real BLS wage statistics',
  'Ask Cora to compare specific courses side by side',
  'Filter and browse courses across Coursera, edX, DataCamp, Udemy, Pluralsight and more — in one place',
]

const CHATGPT_LIMITATIONS = [
  'Training data may be months or years out of date',
  'Cannot verify what a course actually covers today',
  'Salary estimates are inferred, not sourced from labor market data',
  'No structured way to filter or compare across providers',
]

export default function ChatGptCallout() {
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
        {/* Heading */}
        <Box sx={{ textAlign: 'center', mb: { xs: 6, md: 8 } }}>
          <Typography
            variant="h2"
            sx={{
              fontSize: { xs: '1.6rem', md: '2.2rem' },
              fontWeight: 700,
              lineHeight: 1.3,
              mb: 2,
            }}
          >
            ChatGPT can name courses.{' '}
            <GradientText>We can tell you which one is worth your time.</GradientText>
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ fontSize: { xs: '1rem', md: '1.1rem' }, maxWidth: 600, mx: 'auto' }}
          >
            AI assistants are great at surfacing course names. But they can't show you
            fresh data straight from the source, or back up salary claims with real labor
            market numbers.
          </Typography>
        </Box>

        {/* Comparison cards */}
        <Grid2 container spacing={3}>
          {/* CourseCorrect column */}
          <Grid2 size={{ xs: 12, md: 6 }}>
            <Paper
              variant="outlined"
              sx={{
                p: 3,
                height: '100%',
                borderColor: 'primary.main',
                borderWidth: 2,
              }}
            >
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2.5 }}>
                <GradientText>CourseCorrect</GradientText>
              </Typography>
              <Stack spacing={1.5}>
                {CC_ADVANTAGES.map((item) => (
                  <Stack key={item} direction="row" spacing={1.5} alignItems="flex-start">
                    <CheckCircleOutlined
                      sx={{ fontSize: 20, color: 'success.main', flexShrink: 0, mt: 0.1 }}
                    />
                    <Typography variant="body2" color="text.primary">{item}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Paper>
          </Grid2>

          {/* ChatGPT column */}
          <Grid2 size={{ xs: 12, md: 6 }}>
            <Paper
              variant="outlined"
              sx={{ p: 3, height: '100%' }}
            >
              <Typography variant="subtitle1" fontWeight={700} color="text.secondary" sx={{ mb: 2.5 }}>
                ChatGPT / Copilot
              </Typography>
              <Stack spacing={1.5}>
                {CHATGPT_LIMITATIONS.map((item) => (
                  <Stack key={item} direction="row" spacing={1.5} alignItems="flex-start">
                    <CancelOutlined
                      sx={{ fontSize: 20, color: 'text.disabled', flexShrink: 0, mt: 0.1 }}
                    />
                    <Typography variant="body2" color="text.secondary">{item}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Paper>
          </Grid2>
        </Grid2>

        <Typography
          variant="caption"
          color="text.disabled"
          sx={{ display: 'block', textAlign: 'center', mt: 3 }}
        >
          Career data sourced from{' '}
          <Link href="https://www.onetonline.org" target="_blank" rel="noopener" color="inherit" underline="always">
            O*NET
          </Link>
          {' '}and the{' '}
          <Link href="https://www.bls.gov/ooh/" target="_blank" rel="noopener" color="inherit" underline="always">
            Bureau of Labor Statistics
          </Link>.
        </Typography>
      </Container>
    </Box>
  )
}
