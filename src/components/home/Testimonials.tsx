'use client'

import CCLogo from '@/components/CCLogo'
import GradientText from '@/components/typography/GradientText'
import { Box, Card, CardContent, Container, Grid2, Typography } from '@mui/material'

// ── Data ──────────────────────────────────────────────────────────────────────
//
// Single source of truth for testimonials used on both the homepage and About Us.
// To add a testimonial, append an entry here.

export const TESTIMONIALS = [
  {
    quote: 'Saved me so much time.',
    content: "I used to waste hours trying to figure out what course was right for me. There are literally thousands to choose from! CourseCorrect made it easy. The AI shortlisted what I needed and I got started. I'm in the middle of the course and so far, I think it was a great choice.",
    name: 'Reviewer A.',
    title: 'Marketing Analyst',
    image: '/images/avatar-placeholder.svg',
  },
  {
    quote: 'Made the process so much easier.',
    content: "I didn't know where to start when I wanted to learn something new. Plus I always thought certificates are just good to have. CourseCorrect helped me pick a course that works well with my busy schedule and the certificate I gained is what helped me land my promotion.",
    name: 'Reviewer B.',
    title: 'Aspiring Data Analyst',
    image: '/images/avatar-placeholder.svg',
  },
  {
    quote: "Made my life easier, that's all I'll say.",
    content: "I needed a course, didn't know which one. CourseCorrect picked one for me. I took it. It was good. 10/10 would use again.",
    name: 'Reviewer C.',
    title: 'IT Specialist',
    image: '/images/avatar-placeholder.svg',
  },
  {
    quote: "I didn't know where to start. Now I do.",
    content: "There are too many courses out there, and I kept putting off upskilling because I was never sure about taking a course, like — how do you even know if it's worth your time and money? CourseCorrect pointed me in the right direction with extensive reviews and helped me shortlist stuff, and I actually finished a course for once.",
    name: 'Reviewer D.',
    title: 'Project Manager',
    image: '/images/avatar-placeholder.svg',
  },
  {
    quote: "Finally felt confident hitting 'Enroll.'",
    content: "I've always been a bit skeptical of online courses — so many overpromise and underdeliver. CourseCorrect didn't just dump options on me, it actually explained why a course would suit my goals. I felt like I had a smart friend guiding me.",
    name: 'Reviewer E.',
    title: 'UX Designer',
    image: '/images/avatar-placeholder.svg',
  },
  {
    quote: 'Took me from indecisive to done.',
    content: "I used to open five tabs, read reviews, get overwhelmed, and close everything. CourseCorrect gave me one recommendation that made sense. Took the course. No regrets.",
    name: 'Reviewer F.',
    title: 'Career Switcher (Finance → Product Management)',
    image: '/images/avatar-placeholder.svg',
  },
]

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
