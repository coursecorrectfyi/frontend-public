'use client'

import AutoAwesomeOutlined from '@mui/icons-material/AutoAwesomeOutlined';
import KeyboardArrowRightRounded from '@mui/icons-material/KeyboardArrowRightRounded';
import { alpha, Box, Button, Container, Stack, Typography } from '@mui/material'
import Link from 'next/link'

export default function Cc2Teaser() {
  return (
    <Box
      sx={{
        py: { xs: 5, md: 6 },
        bgcolor: (theme) =>
          theme.palette.mode === 'dark'
            ? alpha(theme.palette.primary.dark, 0.15)
            : alpha(theme.palette.primary.light, 0.08),
        borderTop: '1px solid',
        borderBottom: '1px solid',
        borderColor: (theme) =>
          theme.palette.mode === 'dark'
            ? alpha(theme.palette.primary.main, 0.2)
            : alpha(theme.palette.primary.main, 0.15),
      }}
    >
      <Container maxWidth="md">
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={{ xs: 3, sm: 6 }}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
        >
          {/* Icon */}
          <AutoAwesomeOutlined
            sx={{
              fontSize: 36,
              color: 'primary.main',
              flexShrink: 0,
              display: { xs: 'none', sm: 'block' },
            }}
          />

          {/* Text */}
          <Box sx={{ flex: 1 }}>
            <Typography
              variant="overline"
              color="primary"
              sx={{ letterSpacing: 1.5, fontWeight: 600 }}
            >
              Coming soon
            </Typography>
            <Typography variant="h6" fontWeight={700} sx={{ mt: 0.5, mb: 1 }}>
              Your personalized learning roadmap.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Tell us where you are in your career. Tell us where you want to go. We'll map
              the skill gaps and build you a step-by-step learning path — grounded in real
              job skill frameworks, not generic advice.
            </Typography>
          </Box>

          {/* CTA */}
          <Stack spacing={0.75} alignItems={{ xs: 'flex-start', sm: 'center' }} sx={{ flexShrink: 0 }}>
            <Button
              component={Link}
              href="/get-learning-path"
              variant="contained"
              endIcon={<KeyboardArrowRightRounded />}
            >
              Join the waitlist
            </Button>
            <Typography variant="caption" color="text.disabled" sx={{ textAlign: 'center' }}>
              Free during early access
            </Typography>
          </Stack>
        </Stack>
      </Container>
    </Box>
  )
}
