'use client'

import CCLogo from '@/components/CCLogo'
import GradientText from '@/components/typography/GradientText'
import { TESTIMONIALS } from '@/config/content/testimonials'
import { Box, Card, CardContent, Container, Grid2, Typography } from '@mui/material'

// The data lives in src/config/content/testimonials.ts; re-exported for existing imports.
export { TESTIMONIALS }

// ── Card ──────────────────────────────────────────────────────────────────────

interface TestimonialCardProps {
  quote: string
  content: string
  name: string
  title: string
  image: string
}

export function TestimonialCard({ quote, content, name, title, image }: TestimonialCardProps) {
  return (
    <Card
      sx={(theme) => ({
        maxWidth: 345,
        width: '100%',
        height: '100%',
        backgroundColor: theme.palette.background.paper,
        borderRadius: '8px',
        border: `1px solid ${theme.palette.divider}`,
        boxShadow: theme.shadows[2],
        transition: 'transform 0.3s, box-shadow 0.3s',
        '&:hover': {
          transform: 'translateY(-5px)',
          boxShadow: theme.shadows[4],
        },
        ...theme.applyStyles('dark', {
          backgroundColor: 'rgba(13, 17, 23, 0.7)',
          border: '1px solid rgba(48, 54, 61, 0.6)',
          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
        }),
      })}
    >
      <CardContent
        sx={{
          textAlign: 'left',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          p: { xs: 2, sm: 3 },
        }}
      >
        {/* Quote headline */}
        <Typography
          variant="subtitle1"
          fontWeight={700}
          sx={{ mb: 3, height: '40px', display: 'flex', alignItems: 'center' }}
        >
          {quote}
        </Typography>

        {/* Body */}
        <Typography
          variant="body2"
          sx={(theme) => ({
            color: theme.palette.text.secondary,
            mb: 3,
            flex: 1,
            fontSize: { xs: '0.85rem', sm: '0.875rem' },
            display: '-webkit-box',
            overflow: 'hidden',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: { xs: 6, sm: 8 },
            ...theme.applyStyles('dark', { color: 'rgba(255, 255, 255, 0.7)' }),
          })}
        >
          {content}
        </Typography>

        {/* Attribution */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mt: 'auto',
            flexWrap: { xs: 'wrap', sm: 'nowrap' },
            gap: { xs: 1, sm: 0 },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', width: { xs: '100%', sm: 'auto' } }}>
            <Box
              component="img"
              src={image}
              sx={{
                width: { xs: 32, sm: 40 },
                height: { xs: 32, sm: 40 },
                borderRadius: '50%',
                mr: 1.5,
                flexShrink: 0,
              }}
            />
            <Box>
              <Typography
                variant="body2"
                sx={(theme) => ({
                  fontWeight: 600,
                  color: theme.palette.text.primary,
                  fontSize: { xs: '0.8rem', sm: '0.875rem' },
                  ...theme.applyStyles('dark', { color: 'white' }),
                })}
              >
                {name}
              </Typography>
              <Typography
                variant="body2"
                sx={(theme) => ({
                  color: theme.palette.text.secondary,
                  fontSize: { xs: '0.75rem', sm: '0.8rem' },
                  ...theme.applyStyles('dark', { color: 'rgba(255, 255, 255, 0.7)' }),
                })}
              >
                {title}
              </Typography>
            </Box>
          </Box>
          <CCLogo
            sx={{
              height: { xs: 20, sm: 25 },
              opacity: 0.8,
              mt: { xs: 1, sm: 0 },
              ml: { xs: 'auto', sm: 0 },
              display: { xs: 'none', sm: 'block' },
            }}
          />
        </Box>
      </CardContent>
    </Card>
  )
}

// ── Section ───────────────────────────────────────────────────────────────────

export default function Testimonials() {
  return (
    <Box sx={{ py: { xs: 8, md: 12 } }}>
      <Container maxWidth="lg">
        <Typography
          variant="h2"
          sx={{
            fontSize: { xs: '1.8rem', md: '2.4rem' },
            fontWeight: 700,
            mb: { xs: 6, md: 8 },
            textAlign: 'center',
          }}
        >
          <GradientText>Real learners.</GradientText> Real decisions made.
        </Typography>

        <Grid2 container spacing={2} justifyContent="center" alignItems="stretch">
          {TESTIMONIALS.map((t, index) => (
            <Grid2 key={index} size={{ xs: 12, sm: 6, md: 4 }}>
              <TestimonialCard {...t} />
            </Grid2>
          ))}
        </Grid2>
      </Container>
    </Box>
  )
}
