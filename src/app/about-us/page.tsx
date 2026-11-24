'use client';

import AppSearch from "@/components/AppSearch";
import { CCLogo } from "@/components/CCLogo";
import { TESTIMONIALS, TestimonialCard } from "@/components/home/Testimonials";
import { TEAM_MEMBERS } from "@/config/content/team";
import TwoToneHeading from "@/components/DualToneHeading";
import YouTubeChannelCarousel from "@/components/YouTubeChannelCarousel";
import MainLayout from "@/layouts/MainLayout";
import { COURSE_PROVIDERS } from "@/utils/courseProviders";
import { Box, Card, CardActionArea, CardContent, CardMedia, Container, Divider, Grid2, SxProps, Theme, Typography, useColorScheme } from "@mui/material";
import { styled } from '@mui/material/styles';
import Script from 'next/script';
import { ReactNode } from 'react';

// Types for reusable components
type SectionContainerProps = {
  children: ReactNode;
  sx?: SxProps<Theme>;
};

// Custom component for feature titles
const FeatureHeading = ({ children, ...props }: React.PropsWithChildren<any>) => (
  <Typography
    variant="h6"
    sx={(theme) => ({
      fontSize: { xs: '1.1rem', sm: '1.25rem' },
      fontWeight: 600,
      mb: 1,
      color: theme.palette.text.primary,
      ...theme.applyStyles('dark', {
        color: theme.palette.text.primary,
      })
    })}
    {...props}
  >
    {children}
  </Typography>
);

// Reusable section container component
const SectionContainer = ({ children, sx = {} }: SectionContainerProps) => (
  <Box sx={{
    width: '100%',
    mb: 8,
    ...sx
  }}>
    {children}
  </Box>
);

const storyBlocks = [
  {
    image: "/images/friends_at_home.jpg",
    text: "We’re a bunch of friends living in the land of weekday hustle and weekend adventures. One day, the corporate Gods commanded: upskill or bust!"
  },
  {
    image: "/images/girl_with_lens.png",
    text: "After hundreds of platforms, thousands of courses, countless open tabs for course comparison, and four precious weekends down the drain, we were exhausted."
  },
  {
    image: "/images/light_bulb_man.png",
    text: "Then we had a light bulb moment. No, it was not that we found the course, but a revelation - surely if we were grappling with this chaos, so were countless others!"
  },
  {
    image: "/images/light/logo.svg",
    text: "Enter CourseCorrect to rescue learners like you from the clutches of course confusion making your search for the perfect course simple and enjoyable!"
  }
]


const StyledCard = styled(Card)(({ theme }) => ({
  transition: 'transform 0.3s, box-shadow 0.3s',
  '&:hover': {
    transform: 'scale(1.05)', // Slightly increase size
    boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.2)', // Add shadow
  },
  paddingBottom: theme.spacing(4),
  borderRadius: theme.shape.borderRadius,
  outline: '6px solid',
  outlineColor: 'hsla(220, 25%, 80%, 0.2)',
  border: '1px solid',
  borderColor: theme.palette.grey[200],
  boxShadow: '0 0 12px 8px hsla(220, 25%, 80%, 0.2)',
  ...theme.applyStyles('dark', {
    boxShadow: '0 0 24px 12px hsla(210, 100%, 25%, 0.2)',
    outlineColor: 'hsla(220, 20%, 42%, 0.1)',
    borderColor: theme.palette.grey[700],
  }),
}))

const StyledCardMedia = styled(CardMedia, {
  shouldForwardProp: (prop) => prop !== 'image',
})(({ theme, image }) => ({
  width: '50%',
  maxWidth: 300,
  height: 175,
  objectFit: 'contain',
  display: 'block',
  margin: '15px auto',
  backgroundSize: 'contain',
  backgroundImage: `url(${image})`,
  ...theme.applyStyles('dark', {
    backgroundImage: `url(${image?.replace('/light/', '/dark/')})`,
  })
}))

// Define the reasons to choose CourseCorrect
const whyChooseReasons = [
  {
    icon: "🚀",
    title: "Smart recommendations",
    description: "No more confusion."
  },
  {
    icon: "🔍",
    title: "In-depth reviews",
    description: "Know what's worth your time."
  },
  {
    icon: "⏳",
    title: "Less searching",
    description: "More learning. Simple."
  }
];


const HomePageAppSearchButton = <AppSearch
  isHomePage
  searchLabel="Find your perfect course in seconds..."
  sx={{
    height: 50,
    width: 'auto',
    minWidth: 280,
    fontSize: '1.1rem'
  }}
/>

export default function AboutUs() {
  const { mode } = useColorScheme();

  return (
    <MainLayout>
      <Script
        src="https://widgets.sociablekit.com/youtube-channel-videos/widget.js"
        strategy="lazyOnload"
        defer
      />
      <Container
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          py: 8,
        }}
      >
        {/* Hero Section with Headline and Subheadline */}
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <TwoToneHeading
            primary="Too many courses, too little time?"
            secondary="We've got you."
            variant="primary"
            inline={false}
          />

          <Typography
            variant="body1"
            sx={(theme) => ({
              fontSize: { xs: '0.95rem', sm: '1.1rem', md: '1.2rem' },
              fontWeight: 600,
              color: theme.palette.text.secondary,
              maxWidth: '800px',
              mx: 'auto',
              mt: 4,
              ...theme.applyStyles('dark', {
                color: theme.palette.text.secondary,
              }),
            })}
          >
            With AI on your side, skip the guesswork and confidently choose the right course—fast.
          </Typography>

          <Box sx={{
            display: 'flex',
            justifyContent: 'center',
            mt: 4
          }}>
            {HomePageAppSearchButton}
          </Box>
        </Box>

        <Divider />

        {/* Why Choose CourseCorrect Section */}
        <SectionContainer>
          <Box sx={{ mb: 8 }}>
            <TwoToneHeading
              primary="Why choose"
              secondary="CourseCorrect?"
            />
          </Box>

          <Box sx={{
            maxWidth: '1200px',
            mx: 'auto',
            px: { xs: 2, md: 0 },
            mt: 4
          }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 3 }}>
              {whyChooseReasons.map((reason, index) => (
                <Box key={`reason-${index}`} sx={(theme) => ({
                  bgcolor: theme.palette.mode === 'dark' ? 'rgba(30, 40, 50, 0.8)' : 'background.paper',
                  borderRadius: 2,
                  p: 3,
                  height: '100%',
                  boxShadow: theme.palette.mode === 'dark' ? '0 8px 16px rgba(0, 0, 0, 0.3)' : 3,
                  display: 'flex',
                  flexDirection: 'column',
                  mb: { xs: 2, md: 0 },
                })}>
                  <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                    <Typography sx={{ fontSize: '1.8rem' }}>
                      {reason.icon}
                    </Typography>
                  </Box>
                  <FeatureHeading sx={{ textAlign: 'center', mb: 1, fontWeight: 700 }}>
                    {reason.title}
                  </FeatureHeading>
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'text.secondary',
                      textAlign: 'center',
                      fontSize: { xs: '0.875rem', sm: '0.875rem' }
                    }}
                  >
                    {reason.description}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </SectionContainer>

        {/* Learn from the Best Section */}
        <SectionContainer sx={{ mb: 6 }}>
          <TwoToneHeading
            primary="Learn from"
            secondary="the Best"
          />

          <Box sx={{
            maxWidth: '1200px',
            mx: 'auto',
            px: { xs: 2, md: 6 },
            mt: 10, // Increased spacing to match other sections
          }}>
            <Box sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 4,
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              maxWidth: '1200px',
              mx: 'auto'
            }}>
              {COURSE_PROVIDERS.map((provider, index) => (
                <Box key={`logo-${index}`} sx={{
                  width: { xs: '100px', md: '120px' },
                  height: { xs: '60px', md: '80px' },
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Box
                    component="img"
                    src={mode === 'dark' ? provider.darkImage : provider.lightImage}
                    alt={`${provider.name} logo`}
                    sx={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain',
                      filter: theme => theme.palette.mode === 'dark' ? 'brightness(0.8) grayscale(0.2)' : 'grayscale(0.3)',
                      opacity: 0.8,
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        filter: 'none',
                        opacity: 1
                      }
                    }}
                  />
                </Box>
              ))}
            </Box>
          </Box>
        </SectionContainer>

        {/* Our Story Section */}
        <SectionContainer>
          <TwoToneHeading
            primary="Our"
            secondary="Story"
          />

          <Grid2 container spacing={2} pt={4} justifyContent='center' alignItems='center' gap={4}>
            {storyBlocks.map((block, index) => (
              <Grid2 key={`story` + index}>
                <StyledCard sx={{
                  maxWidth: 345,
                }}>
                  <StyledCardMedia image={block.image} />
                  <CardContent sx={{ height: 100, textAlign: 'center' }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {block.text}
                    </Typography>
                  </CardContent>
                </StyledCard>
              </Grid2>
            ))}
          </Grid2>
        </SectionContainer>

        {/* Meet The Team Section */}
        <SectionContainer>
          <TwoToneHeading primary="Meet The" secondary="Team" paddingTop={6} />


          <Grid2 container spacing={2} pt={4} justifyContent='center' alignItems='center' gap={4}>
            {TEAM_MEMBERS.map((teamMate, index) => (
              <Grid2 key={`story` + index}>
                <CardActionArea {...(teamMate.profileLink ? { href: teamMate.profileLink, target: '_blank', rel: 'noopener noreferrer' } : {})}>
                  <StyledCard sx={{
                    maxWidth: 345,
                  }}>
                    <CardMedia
                      component="img" title={teamMate.name}
                      sx={{
                        width: '50%', maxWidth: 300, height: 175,
                        objectFit: 'contain', display: 'block',
                        marginTop: '35px', marginBottom: '15px', marginX: 'auto'
                      }}
                      image={teamMate.image}
                    />

                    <CardContent sx={{
                      height: 200,
                      textAlign: 'center'
                    }}>
                      <Typography gutterBottom variant="h5" height={32}>
                        {teamMate.name}
                      </Typography>

                      <Typography gutterBottom sx={{ color: 'text.secondary' }}>
                        {teamMate.designation}
                      </Typography>

                      <Typography gutterBottom variant="body2" height={62}>
                        {teamMate.description}
                      </Typography>

                      <Typography gutterBottom variant="body2" sx={{ color: 'text.secondary' }}>
                        {teamMate.experience}
                      </Typography>
                    </CardContent>
                  </StyledCard>
                </CardActionArea>
              </Grid2>
            ))}
          </Grid2>
        </SectionContainer>

        {/* YouTube Section */}
        <SectionContainer sx={{
          textAlign: 'center'
        }}>
          <TwoToneHeading
            primary="Follow us on"
            secondary="YouTube"
          />

          <Typography
            variant="body1"
            sx={(theme) => ({
              fontSize: { xs: '0.95rem', sm: '1.1rem', md: '1.2rem' },
              fontWeight: 400,
              mb: { xs: 3, md: 4 },
              maxWidth: '800px',
              mx: 'auto',
              color: theme.palette.text.secondary,
              ...theme.applyStyles('dark', {
                color: theme.palette.text.secondary,
              }),
            })}
          >
            For smart, no-BS career and life advice!
          </Typography>

          <Box sx={{
            display: 'flex',
            justifyContent: 'center',
            width: '100%',
            px: { xs: 0, sm: 2 },
          }}>
            <Box sx={(theme) => ({
              width: '100%',
              maxWidth: '1200px',
              borderRadius: { xs: 1, sm: 2 },
              overflow: 'hidden',
              boxShadow: { xs: 2, md: 4 },
              transition: 'transform 0.3s, box-shadow 0.3s',
              '&:hover': {
                transform: { xs: 'none', md: 'scale(1.02)' },
                boxShadow: { xs: 2, md: '0 12px 24px rgba(0, 0, 0, 0.2)' },
              },
              ...theme.applyStyles('dark', {
                backgroundColor: 'rgba(13, 17, 23, 0.7)',
              }),
            })}>
              <YouTubeChannelCarousel title="CourseCorrect on YouTube" />
            </Box>
          </Box>
        </SectionContainer>

        {/* Testimonials Section */}
        <SectionContainer sx={{
          textAlign: 'center'
        }}>
          <TwoToneHeading
            primary="Real Learners,"
            secondary="Real Wins"
          />

          <Typography
            variant="body1"
            sx={(theme) => ({
              fontSize: { xs: '0.95rem', sm: '1.1rem', md: '1.2rem' },
              fontWeight: 400,
              mb: { xs: 3, md: 4 },
              maxWidth: '800px',
              mx: 'auto',
              color: theme.palette.text.secondary,
              ...theme.applyStyles('dark', {
                color: theme.palette.text.secondary,
              }),
            })}
          >
            See what our customers say about our product
          </Typography>

          <Grid2 container spacing={2} pt={4} justifyContent='center' alignItems='stretch' gap={2}>
            {TESTIMONIALS.map((testimonial, index) => (
              <Grid2 key={`testimonial-${index}`}>
                <TestimonialCard {...testimonial} />
              </Grid2>
            ))}
          </Grid2>
        </SectionContainer>

      </Container>
    </MainLayout>
  );
}
