'use client';

import TwoToneHeading from "@/components/DualToneHeading";
import EarlyAccessModal from "@/components/early-access/EarlyAccessModal";
import MainLayout from "@/layouts/MainLayout";
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import KeyboardArrowRightRounded from "@mui/icons-material/KeyboardArrowRightRounded";
import { alpha, Box, Button, Container, Typography } from "@mui/material";
import { styled } from '@mui/material/styles';
import { trackEvent } from "@/utils/analytics";
import { useState } from "react";

// Styled component for the value proposition cards
const ValueCard = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'flex-start',
  gap: theme.spacing(2),
  padding: theme.spacing(2.5),
  borderRadius: theme.shape.borderRadius * 2,
  backgroundColor: alpha(theme.palette.primary.main, 0.04),
  border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
  transition: 'all 0.2s ease-in-out',
  '&:hover': {
    backgroundColor: alpha(theme.palette.primary.main, 0.08),
    transform: 'translateX(4px)',
  },
  ...theme.applyStyles('dark', {
    backgroundColor: alpha(theme.palette.primary.main, 0.08),
    border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`,
    '&:hover': {
      backgroundColor: alpha(theme.palette.primary.main, 0.12),
    },
  }),
}));

// What this helps you figure out
const valuePropositions = [
  "Where you stand today, in practical terms",
  "What skills are actually worth investing in next",
  "How your learning connects to the kind of work or life you want",
  "When taking a course makes sense and when it doesn't",
];

export default function LearningPathPage() {
  const [modalOpen, setModalOpen] = useState(false);

  const handleCTAClick = () => {
    trackEvent('learning_path_cta_click', { source: 'get-learning-path' });
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
  };

  return (
    <MainLayout>
      <Container
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          py: { xs: 6, md: 10 },
          minHeight: 'calc(100vh - 200px)',
        }}
      >
        {/* Hero Section */}
        <Box sx={{ textAlign: 'center', mb: { xs: 4, md: 6 }, maxWidth: 800 }}>
          <TwoToneHeading
            primary="Learning shouldn't feel"
            secondary="overwhelming"
            variant="primary"
            inline={false}
          />

          <Typography
            variant="body1"
            sx={(theme) => ({
              fontSize: { xs: '1rem', sm: '1.15rem', md: '1.25rem' },
              lineHeight: 1.7,
              color: theme.palette.text.secondary,
              maxWidth: '720px',
              mx: 'auto',
              mt: 3,
              ...theme.applyStyles('dark', {
                color: theme.palette.grey[400],
              }),
            })}
          >
            We're building a personalized learning path that takes your goals and current stage into account
            and shows you what to focus on next, in what order, and why it matters.
          </Typography>

          {/* Primary CTA */}
          <Box sx={{ mt: 5 }}>
            <Button
              onClick={handleCTAClick}
              variant="contained"
              size="large"
              endIcon={<KeyboardArrowRightRounded />}
              sx={{
                py: 1.5,
                px: 4,
                fontSize: '1.1rem',
                fontWeight: 600,
                textTransform: 'none',
                borderRadius: 2,
              }}
            >
              Get My Personalized Learning Path
            </Button>
          </Box>
        </Box>

        {/* Value Proposition Section */}
        <Box sx={{
          width: '100%',
          maxWidth: 700,
          mt: { xs: 2, md: 4 },
        }}>
          <TwoToneHeading
            primary="What this is meant to"
            secondary="help you figure out">
          </TwoToneHeading>

          <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}>
            {valuePropositions.map((item, index) => (
              <ValueCard key={index}>
                <CheckCircleOutlineIcon
                  sx={(theme) => ({
                    color: theme.palette.primary.main,
                    fontSize: '1.5rem',
                    mt: 0.25,
                    flexShrink: 0,
                  })}
                />
                <Typography
                  sx={(theme) => ({
                    fontSize: { xs: '0.95rem', sm: '1.05rem' },
                    color: theme.palette.text.primary,
                    fontWeight: 500,
                    ...theme.applyStyles('dark', {
                      color: theme.palette.grey[200],
                    }),
                  })}
                >
                  {item}
                </Typography>
              </ValueCard>
            ))}
          </Box>
        </Box>

        {/* Description Text */}
        <Box sx={{
          maxWidth: 650,
          mt: { xs: 4, md: 6 },
          textAlign: 'center',
        }}>
          <Typography
            variant="body1"
            sx={(theme) => ({
              fontSize: { xs: '0.95rem', sm: '1rem', md: '1.1rem' },
              lineHeight: 1.8,
              color: theme.palette.text.secondary,
              ...theme.applyStyles('dark', {
                color: theme.palette.grey[400],
              }),
            })}
          >
            Built using real job skill frameworks and course data from leading learning platforms
            — for people who want to grow, switch paths, start something new, or simply figure out what's next.
          </Typography>
        </Box>

        {/* Bottom CTA Section */}
        <Box sx={{
          mt: { xs: 4, md: 6 },
          mb: { xs: 4, md: 8 },
          textAlign: 'center',
        }}>
          <Button
            onClick={handleCTAClick}
            variant="contained"
            size="large"
            endIcon={<KeyboardArrowRightRounded />}
            sx={{
              py: 1.5,
              px: 4,
              fontSize: '1.1rem',
              fontWeight: 600,
              textTransform: 'none',
              borderRadius: 2,
            }}
          >
            Get My Personalized Learning Path
          </Button>

          {/* Microcopy */}
          <Typography
            variant="body2"
            sx={(theme) => ({
              mt: 2,
              fontSize: '0.875rem',
              color: theme.palette.text.secondary,
              ...theme.applyStyles('dark', {
                color: theme.palette.grey[500],
              }),
            })}
          >
            Clarity for your next step • Free during early access
          </Typography>
        </Box>
      </Container>

      {/* Early Access Modal */}
      <EarlyAccessModal
        open={modalOpen}
        onClose={handleModalClose}
      />
    </MainLayout>
  );
}

