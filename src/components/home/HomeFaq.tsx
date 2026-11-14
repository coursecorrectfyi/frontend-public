'use client'

import GradientText from '@/components/typography/GradientText'
import { ExpandMore } from '@mui/icons-material'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Container,
  Link,
  Typography,
} from '@mui/material'

interface FaqItem {
  question: string
  answer: React.ReactNode
}

const FAQS: FaqItem[] = [
  {
    question: 'Is CourseCorrect free?',
    answer: 'Yes. CourseCorrect is free to use. We earn an affiliate commission if you enroll in a course through our links — at no extra cost to you.',
  },
  {
    question: 'Where does your course data come from?',
    answer: 'We collect course pages directly from each provider every month. Our AI then normalizes the data — so you get accurate, up-to-date information instead of stale aggregator data.',
  },
  {
    question: "Can't I just ask ChatGPT or Copilot?",
    answer: (
      <>
        You can — but AI assistants work from training data that may be months or years out of date.
        We scrape course pages directly from providers every month, so the course details you see are current.
        You can also ask Cora to compare specific courses side by side, and every recommendation is backed
        by career outcome data grounded in real wage statistics from the{' '}
        <Link href="https://www.bls.gov/ooh/" target="_blank" rel="noopener" underline="hover">
          Bureau of Labor Statistics
        </Link>
        {' '}— not AI inference.
      </>
    ),
  },
  {
    question: 'What is Cora?',
    answer: 'Cora is our AI assistant. She can answer questions about specific courses, compare options, and recommend courses based on your goals. She has access to our full catalogue, not just the courses on screen.',
  },
]

export default function HomeFaq() {
  return (
    <Box sx={{ py: { xs: 8, md: 12 } }}>
      <Container maxWidth="md">
        <Typography
          variant="h2"
          sx={{
            fontSize: { xs: '1.8rem', md: '2.4rem' },
            fontWeight: 700,
            mb: 6,
            textAlign: 'center',
          }}
        >
          <GradientText>Common Questions</GradientText>
        </Typography>

        {FAQS.map((faq, index) => (
          <Accordion key={index}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography color="text.primary">{faq.question}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography color="text.secondary" component="div">{faq.answer}</Typography>
            </AccordionDetails>
          </Accordion>
        ))}

        <Typography
          variant="body2"
          color="text.disabled"
          sx={{ mt: 4, textAlign: 'center' }}
        >
          More questions?{' '}
          <Link href="/contact-us" underline="hover" color="text.secondary">
            Visit our full FAQ →
          </Link>
        </Typography>
      </Container>
    </Box>
  )
}
