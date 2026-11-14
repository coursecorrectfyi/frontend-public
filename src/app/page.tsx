'use client';

import AppSearch from "@/components/AppSearch";
import AiInsightsCallout from "@/components/home/AiInsightsCallout";
import Cc2Teaser from "@/components/home/Cc2Teaser";
import ChatGptCallout from "@/components/home/ChatGptCallout";
import HomeFaq from "@/components/home/HomeFaq";
import Testimonials from "@/components/home/Testimonials";
import OptimizedVideo from "@/components/OptimizedVideo";
import GradientText from "@/components/typography/GradientText";
import MainLayout from "@/layouts/MainLayout";
import { trackEvent } from "@/utils/analytics";
import { COURSE_PROVIDERS } from "@/utils/courseProviders";
import KeyboardArrowRightRounded from "@mui/icons-material/KeyboardArrowRightRounded";
import { alpha, Box, Button, Container, Divider, Grid2, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import Link from "next/link";

const StyledOverlayBox = styled(Box)(({ theme }) => ({
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: "100vw",
  backgroundColor: alpha(theme.palette.primaryDark[800], 0.90),
  zIndex: -1,
  ...theme.applyDarkStyles({
    backgroundColor: alpha(theme.palette.primaryDark[800], 0.90),
  })
}))

const SubtleDivider = styled(Box)(({ theme }) => ({
  width: '100%',
  maxWidth: 500,
  height: 1,
  marginLeft: 'auto',
  marginRight: 'auto',
  marginTop: theme.spacing(6),
  marginBottom: theme.spacing(6),
  background: `linear-gradient(90deg, transparent 0%, ${alpha(theme.palette.common.white, 0.25)} 50%, transparent 100%)`,
}))

const HomePageAppSearchButton = <AppSearch
  isHomePage
  searchLabel="Find your perfect course in 2 minutes"
  sx={{
    height: 50,
    width: 'auto',
    minWidth: 280,
    fontSize: '0.9rem'
  }}
/>

export default function Home() {

  return (
    <MainLayout isHomePage>
      <Container maxWidth="lg">
        {/* Video Background */}
        <Box
          component="video"
          autoPlay
          muted
          loop
          playsInline
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100%",
            objectFit: "cover",
            zIndex: -2,
          }}
        >
          <source src="/bg-video.mp4" type="video/mp4" />
        </Box>

        {/* Overlay: TODO considering using a Backdrop component if it works. */}
        <StyledOverlayBox />

        {/* Content Container */}
        <Container
          maxWidth={false}
          disableGutters
          sx={{
            height: `calc(100vh - 65px)`,
            display: "flex",
            alignItems: "center",
            px: { xs: 2, sm: 4, md: 6 },
          }}
        >
          <Grid2
            container
            spacing={2}
            sx={{
              mx: "auto",
              height: "auto",
              maxWidth: "xl",
              alignItems: "center",
              justifyContent: "center",
              gap: { xs: 2, md: 5 }, // Controls vertical gap between elements
            }}
          >
            {/* Text Content Container */}
            <Box sx={{
              justifyItems: 'center',
              textAlign: 'center',
              maxWidth: 700,
              width: '100%',
              mx: 'auto'
            }} >
              <Typography
                variant="h2"
                sx={{
                  mb: 2, color: 'common.white',
                  fontSize: { xs: '1.8rem', sm: '2.2rem', md: '2.8rem' },
                  fontWeight: 700,
                  lineHeight: 1.2,
                }}
              >
                Find the right course.{' '}
                <GradientText>Not just any course.</GradientText>
              </Typography>
              <Typography
                variant="h3"
                sx={{
                  mb: 4, color: 'common.white',
                  fontSize: { xs: '1rem', sm: '1.2rem', md: '1.4rem' },
                  fontWeight: 400,
                  opacity: 0.85,
                }}
              >
                Courses, programs, and certifications from Coursera, edX, DataCamp, Udemy, and Pluralsight, compared and ranked for you.
              </Typography>

              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                {HomePageAppSearchButton}
              </Box>

              <Box sx={{
                mt: 3,
                display: 'inline-flex',
                alignItems: 'center',
                gap: { xs: 1.5, sm: 2 },
                flexWrap: 'wrap',
                justifyContent: 'center',
                border: '1px solid',
                borderColor: 'rgba(255,255,255,0.25)',
                borderRadius: '12px',
                px: { xs: 2, sm: 3 },
                py: 1.5,
                bgcolor: 'rgba(255,255,255,0.07)',
                backdropFilter: 'blur(4px)',
              }}>
                <Typography
                  variant="body1"
                  sx={{ color: 'common.white', fontWeight: 500 }}
                >
                  Not sure where to start?
                </Typography>
                <Button
                  href="/get-learning-path"
                  component={Link}
                  variant="outlined"
                  size="small"
                  endIcon={<KeyboardArrowRightRounded />}
                  onClick={() => trackEvent('learning_path_cta_click', { source: 'homepage' })}
                  sx={{
                    color: 'common.white',
                    borderColor: 'rgba(255,255,255,0.6)',
                    textTransform: 'none',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    '&:hover': {
                      borderColor: 'common.white',
                      bgcolor: 'rgba(255,255,255,0.12)',
                    }
                  }}
                >
                  Get a personalized learning path
                </Button>
              </Box>

              <SubtleDivider />

              {/* Partner Logos Section */}
              <Typography
                variant="overline"
                sx={{ color: 'common.white', opacity: 0.6, letterSpacing: 1.5, display: 'block', mb: 2 }}
              >
                From the platforms you trust
              </Typography>
              <Box sx={{
                mb: 1,
                display: 'flex',
                flexWrap: 'wrap',
                gap: { xs: 3, md: 5 },
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {COURSE_PROVIDERS.map((provider, index) => (
                  <Box
                    key={`logo-${index}`}
                    component="img"
                    src={provider.white}
                    alt={`${provider.name} logo`}
                    sx={{
                      height: provider.whiteHeight ?? { xs: '22px', md: '28px' },
                      width: 'auto',
                      filter: 'brightness(0.85) contrast(0.75)',
                      opacity: 0.85,
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        filter: 'brightness(1) contrast(1)',
                        opacity: 1,
                      }
                    }}
                  />
                ))}
              </Box>
            </Box>
          </Grid2>
        </Container>
      </Container>

      {/* How It Works Section */}
      <Box sx={{
        py: { xs: 4, md: 6 },
        backgroundColor: (theme) => theme.palette.mode === 'dark'
          ? theme.palette.grey[900]
          : theme.palette.grey[50]
      }}>
        <Container maxWidth="lg">
          {/* Section Header */}
          <Box sx={{ textAlign: 'center', mb: { xs: 6, md: 10 } }}>
            <Typography
              variant="h2"
              sx={{
                fontSize: { xs: '2rem', md: '2.5rem' },
                fontWeight: 600,
                mb: 2,
                color: (theme) => theme.palette.mode === 'dark'
                  ? theme.palette.common.white
                  : theme.palette.text.primary
              }}
            >
              Find the right course.{' '}
              <GradientText>Not just a course.</GradientText>
            </Typography>
          </Box>

          {/* Feature Blocks */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 4, md: 6 } }}>

            {/* Block 1: Search & Get Results */}
            <Grid2 container spacing={{ xs: 4, md: 8 }} alignItems="center">
              <Grid2 size={{ xs: 12, md: 6 }}>
                <Box sx={{ pr: { md: 4 } }}>
                  <Typography
                    variant="h4"
                    sx={{
                      fontSize: { xs: '1.5rem', md: '1.8rem' },
                      fontWeight: 600,
                      mb: 3,
                      color: (theme) => theme.palette.mode === 'dark'
                        ? theme.palette.common.white
                        : theme.palette.text.primary
                    }}
                  >
                    Search any topic, get the good stuff
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{
                      fontSize: { xs: '1rem', md: '1.1rem' },
                      lineHeight: 1.6,
                      color: (theme) => theme.palette.mode === 'dark'
                        ? theme.palette.grey[300]
                        : theme.palette.text.secondary
                    }}
                  >
                    Type what you want to learn. We pull the best options from Coursera, edX, DataCamp, Udemy, and Pluralsight -- ranked by relevance, not by who paid us.
                  </Typography>
                </Box>
              </Grid2>
              <Grid2 size={{ xs: 12, md: 6 }}>
                <Box sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: 2,
                  backgroundColor: (theme) => theme.palette.mode === 'dark'
                    ? alpha(theme.palette.common.white, 0.05)
                    : alpha(theme.palette.common.black, 0.03),
                  borderRadius: 2,
                  border: (theme) => `2px dashed ${theme.palette.mode === 'dark'
                    ? theme.palette.grey[700]
                    : theme.palette.grey[300]}`,
                  width: 'fit-content',
                  mx: 'auto'
                }}>
                  <OptimizedVideo
                    src="/search-a-topic.mp4"
                    alt="Animated video showing user typing 'marketing' into the search bar and Cora showing top 20 course cards"
                    maxWidth={400}
                  />
                </Box>
              </Grid2>
            </Grid2>

            <Divider />

            {/* Block 2: Filters & Quick Views */}
            <Grid2 container spacing={{ xs: 4, md: 8 }} alignItems="center">
              <Grid2 size={{ xs: 12, md: 6 }} sx={{ order: { xs: 2, md: 1 } }}>
                <Box sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: 2,
                  backgroundColor: (theme) => theme.palette.mode === 'dark'
                    ? alpha(theme.palette.common.white, 0.05)
                    : alpha(theme.palette.common.black, 0.03),
                  borderRadius: 2,
                  border: (theme) => `2px dashed ${theme.palette.mode === 'dark'
                    ? theme.palette.grey[700]
                    : theme.palette.grey[300]}`,
                  width: 'fit-content',
                  mx: 'auto'
                }}>
                  <OptimizedVideo
                    src="/real-outcomes.mp4"
                    alt="User clicks on filters and picks Beginner and then clicks on Quick View showing salary range and potential job roles"
                    maxWidth={400}
                  />
                </Box>
              </Grid2>
              <Grid2 size={{ xs: 12, md: 6 }} sx={{ order: { xs: 1, md: 2 } }}>
                <Box sx={{ pl: { md: 4 } }}>
                  <Typography
                    variant="h4"
                    sx={{
                      fontSize: { xs: '1.5rem', md: '1.8rem' },
                      fontWeight: 600,
                      mb: 3,
                      color: (theme) => theme.palette.mode === 'dark'
                        ? theme.palette.common.white
                        : theme.palette.text.primary
                    }}
                  >
                    Get verified data, not AI guesswork
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{
                      fontSize: { xs: '1rem', md: '1.1rem' },
                      lineHeight: 1.6,
                      color: (theme) => theme.palette.mode === 'dark'
                        ? theme.palette.grey[300]
                        : theme.palette.text.secondary
                    }}
                  >
                    We pull details directly from each provider -- not from an AI that may have last seen the page in 2023. Every listing gets a normalized summary, skill breakdown, and salary data grounded in BLS labor market statistics.
                  </Typography>
                </Box>
              </Grid2>
            </Grid2>

            <Divider />

            {/* Block 3: Cora's Recommendations */}
            <Grid2 container spacing={{ xs: 4, md: 8 }} alignItems="center">
              <Grid2 size={{ xs: 12, md: 6 }}>
                <Box sx={{ pr: { md: 4 } }}>
                  <Typography
                    variant="h4"
                    sx={{
                      fontSize: { xs: '1.5rem', md: '1.8rem' },
                      fontWeight: 600,
                      mb: 3,
                      color: (theme) => theme.palette.mode === 'dark'
                        ? theme.palette.common.white
                        : theme.palette.text.primary
                    }}
                  >
                    Still unsure? Ask Cora.
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{
                      fontSize: { xs: '1rem', md: '1.1rem' },
                      lineHeight: 1.6,
                      color: (theme) => theme.palette.mode === 'dark'
                        ? theme.palette.grey[300]
                        : theme.palette.text.secondary,
                      mb: 2
                    }}
                  >
                    Cora is our AI assistant. She has access to our entire catalogue -- not just what's on screen -- and can help you find the right fit for your goals in under 2 minutes.
                  </Typography>
                </Box>
              </Grid2>
              <Grid2 size={{ xs: 12, md: 6 }}>
                <Box sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: 2,
                  backgroundColor: (theme) => theme.palette.mode === 'dark'
                    ? alpha(theme.palette.common.white, 0.05)
                    : alpha(theme.palette.common.black, 0.03),
                  borderRadius: 2,
                  border: (theme) => `2px dashed ${theme.palette.mode === 'dark'
                    ? theme.palette.grey[700]
                    : theme.palette.grey[300]}`,
                  width: 'fit-content',
                  mx: 'auto'
                }}>
                  <OptimizedVideo
                    src="/overthinking-it.mp4"
                    alt="User clicks Help me choose, Cora's chat pops up, asks questions, user responds, final recommendation appears with glowing course card"
                    maxWidth={400}
                  />
                </Box>
              </Grid2>
            </Grid2>

          </Box>
        </Container>
      </Box>

      <Divider />

      <AiInsightsCallout />

      <Divider />

      <ChatGptCallout />

      <Cc2Teaser />

      <Divider />

      <Testimonials />

      <Divider />

      <HomeFaq />
    </MainLayout>
  );
}
