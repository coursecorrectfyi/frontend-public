'use client';

import SaveCourseButton from '@/components/course/SaveCourseButton';
import UnsafeMarkdown from '@/components/UnsafeMarkdown';
import { useCourseDetails } from '@/hooks/use-course-details';
import { Course, JobRole } from '@/types/course';
import { ArrowOutwardTwoTone, InfoOutlined, LanguageTwoTone, LocalLibraryTwoTone, MonetizationOnTwoTone, SchoolTwoTone, SignalCellularAltTwoTone, SmartToyOutlined, TimerTwoTone, WorkTwoTone } from '@mui/icons-material';
import { Alert, Box, Button, Divider, Grid2, Link, Paper, Rating, Skeleton, Stack, Tab, Tabs, Typography } from '@mui/material';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import slugify from 'slugify';
import { trackEnrollClick } from '@/utils/analytics';

interface CourseDetailsContainerProps {
  courseId: string
}

export default function CourseDetailsContainer({ courseId }: CourseDetailsContainerProps) {
  const router = useRouter();
  const [value, setValue] = useState(0);
  const { data, isLoading, error } = useCourseDetails(courseId);
  const course = data?.data;

  // Helper function to determine if the course is of type Course (not CourseDetails)
  const isCourseType = (course: any): course is Course => {
    return course && 'courseDescription' in course;
  };

  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  useEffect(() => {
    if (course?.properties?.course_name) {
      const courseSlug = slugify(course.properties.course_name, { lower: true });
      const currentPath = window.location.pathname;
      const targetPath = `/course/${courseSlug}/${courseId}`;

      // Only update if the current path is different
      if (currentPath !== targetPath) {
        router.replace(targetPath);
      }
    }
  }, [course?.properties?.course_name, courseId, router]);

  const getTabIndex = (index: number) => {
    if (course.aiInsights && course.aiInsights.careerInsights) {
      if (course.aiInsights.reviewInsights) {
        return index + 2;
      } else {
        return index + 1;
      }
    } else {
      return index;
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <>
          <Stack direction='column' spacing={1} p={3} sx={{ flexShrink: 0 }}>
            <Stack spacing={2} direction={{ xs: 'column', sm: 'row' }}>
              <Skeleton variant="rectangular" width={210} height={150} />

              <Stack direction='column'>
                <Stack direction='column'>
                  <Typography variant="h4" component="h1">
                    <Skeleton variant='text' />
                  </Typography>

                  <Stack direction='row'>
                    <Skeleton variant='text' width={165} />
                  </Stack>

                  <Grid2 sx={{ pt: 2 }} container spacing={1} component="div">
                    <Skeleton variant='text' width={100} />
                    <Skeleton variant='text' width={100} />
                    <Skeleton variant='text' width={100} />
                    <Skeleton variant='text' width={100} />
                  </Grid2>
                </Stack>
              </Stack>
            </Stack>
          </Stack>
        </>
      );
    }

    if (error) {
      return (
        <Box p={3}>
          <Alert severity="error">{error instanceof Error ? error.message : null}</Alert>
        </Box>
      );
    }

    if (!isLoading && (!course || Object.keys(course).length === 0)) {
      return (
        <Box p={3}>
          <Alert severity="error">Nothing to show! :/.</Alert>
        </Box>
      );
    }

    return (
      <Stack direction='column' spacing={0} sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Fixed header section with image, title, rating and buttons */}
        <Box sx={{
          p: 2,
          flexShrink: 0,
          borderBottom: 1,
          borderColor: 'divider'
        }}>
          {/* Top container with image and title/rating */}
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
            {/* Course Image - smaller size */}
            <Box
              sx={{
                position: 'relative',
                width: { xs: '100%', sm: 120 },
                height: { xs: 120, sm: 120 },
                flexShrink: 0,
                borderRadius: 1,
                overflow: 'hidden'
              }}
            >
              <Image
                src={course.cc_imageUrl}
                alt={course.properties.course_name}
                fill
                style={{ objectFit: 'cover' }}
              />
            </Box>

            {/* Course title, rating and buttons - all top aligned */}
            <Box sx={{ flex: 1 }}>
              <Stack spacing={2}>
                <Box>
                  <Link
                    href={course.courseUrl}
                    target="_blank" rel="noopener"
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <Typography variant="h5" component="h1">
                      {course.properties.course_name}
                    </Typography>
                  </Link>

                  <Stack direction='row' spacing={1} alignItems="center" sx={{ mt: 1 }}>
                    <Rating value={course.properties.course_avg_rating} readOnly precision={0.5} size='small' />
                    <Typography variant="body2" color="text.secondary">
                      ({course.properties.course_num_rating} ratings)
                    </Typography>
                  </Stack>
                </Box>

                <Stack direction="row" spacing={2}>
                  <SaveCourseButton courseId={course._id} courseName={course.properties.course_name} />
                  <Button
                    variant='outlined'
                    aria-label='Enroll'
                    size="small"
                    endIcon={<ArrowOutwardTwoTone />}
                    onClick={(e) => {
                      e.preventDefault();
                      trackEnrollClick(course._id, course.properties.course_name, course.courseUrl, 'course_details');
                      window.open(course.courseUrl, '_blank', 'noopener,noreferrer');
                    }}
                  >
                    Enroll
                  </Button>
                </Stack>
              </Stack>
            </Box>
          </Box>
        </Box>

        {/* Scrollable content area */}
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {/* Course attributes section - fixed at the top of scrollable area */}
          <Box sx={{ p: 2 }}>
            {/* Course attributes section */}
            <Box sx={{ width: '100%', mb: 3 }}>
              <Grid2 container spacing={2} component="div">
                {/* Column 1 - Skill Level and Language (smaller width) */}
                <Grid2 sx={{ gridColumn: { xs: 'span 12', sm: 'span 3' } }} component="div">
                  {/* Skill Level */}
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                    <SignalCellularAltTwoTone color="primary" />
                    <Stack>
                      <Typography variant="caption" color="text.secondary">Skill Level</Typography>
                      <Typography variant="body2">{course.properties.course_level ? course.properties.course_level.charAt(0).toUpperCase() + course.properties.course_level.slice(1) : 'Not specified'}</Typography>
                    </Stack>
                  </Stack>

                  {/* Language */}
                  <Stack direction="row" spacing={1} alignItems="center">
                    <LanguageTwoTone color="primary" />
                    <Stack>
                      <Typography variant="caption" color="text.secondary">Language</Typography>
                      <Typography variant="body2">{course.properties.course_language || 'Not specified'}</Typography>
                    </Stack>
                  </Stack>
                </Grid2>

                {/* Column 2 - Provider and Cost (smaller width) */}
                <Grid2 sx={{ gridColumn: { xs: 'span 12', sm: 'span 3' } }} component="div">
                  {/* Provider */}
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                    <LocalLibraryTwoTone color="primary" />
                    <Stack>
                      <Typography variant="caption" color="text.secondary">Provider</Typography>
                      <Typography variant="body2">{course.properties.course_provider || 'Not specified'}</Typography>
                    </Stack>
                  </Stack>

                  {/* Cost */}
                  <Stack direction="row" spacing={1} alignItems="center">
                    <MonetizationOnTwoTone color="primary" />
                    <Stack>
                      <Typography variant="caption" color="text.secondary">Cost</Typography>
                      <Typography variant="body2">{course.properties.course_is_free ? 'Free' : 'Paid'}</Typography>
                    </Stack>
                  </Stack>
                </Grid2>

                {/* Column 3 - Institution and Duration (larger width) */}
                <Grid2 sx={{ gridColumn: { xs: 'span 12', sm: 'span 6' } }} component="div">
                  {/* Institution */}
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                    <SchoolTwoTone color="primary" />
                    <Stack>
                      <Typography variant="caption" color="text.secondary">Institution</Typography>
                      <Typography variant="body2">{course.properties.course_institution || 'Not specified'}</Typography>
                    </Stack>
                  </Stack>

                  {/* Duration */}
                  <Stack direction="row" spacing={1} alignItems="center">
                    <TimerTwoTone color="primary" />
                    <Stack>
                      <Typography variant="caption" color="text.secondary">Time Commitment</Typography>
                      <Typography variant="body2">{course.duration || 'Not specified'}</Typography>
                    </Stack>
                  </Stack>
                </Grid2>
              </Grid2>
            </Box>

            {/* Divider before description */}
            <Divider sx={{ my: 2 }} />

            <Box sx={{ mb: 3 }}>
              <Grid2 container spacing={2} component="div">
                {/* Certificate - if available */}
                {course.properties.course_certificate && (
                  <Grid2 sx={{ gridColumn: { xs: 'span 12', sm: 'auto' } }} component="div">
                    <Stack direction="row" spacing={1} alignItems="center">
                      <SchoolTwoTone color="primary" />
                      <Stack>
                        <Typography variant="caption" color="text.secondary">Certificate</Typography>
                        <Typography variant="body2">Certificate Provided</Typography>
                      </Stack>
                    </Stack>
                  </Grid2>
                )}

                {/* Course Description - from the example data you provided */}
                <Grid2 sx={{ gridColumn: 'span 12' }} component="div">
                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    <InfoOutlined color="primary" />
                    <Stack>
                      <Typography variant="caption" color="text.secondary">Description</Typography>
                      <Typography variant="body2">
                        {isCourseType(course) ? course.courseDescription : 'No description available.'}
                      </Typography>
                    </Stack>
                  </Stack>
                </Grid2>

                {/* Job Roles/Subjects (if available) */}
                {isCourseType(course) && course.subjects && course.subjects.length > 0 && (
                  <Grid2 sx={{ gridColumn: 'span 12' }} component="div">
                    <Stack direction="row" spacing={1} alignItems="flex-start">
                      <WorkTwoTone color="primary" />
                      <Stack>
                        <Typography variant="caption" color="text.secondary">Related Fields</Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {course.subjects.map((subject: string, index: number) => (
                            <Typography key={index} variant="body2" component="span">
                              {subject}{index < course.subjects.length - 1 ? ', ' : ''}
                            </Typography>
                          ))}
                        </Box>
                      </Stack>
                    </Stack>
                  </Grid2>
                )}
              </Grid2>
            </Box>

            {/* Divider before tabs */}
            <Divider sx={{ mt: 2 }} />
          </Box>

          {/* Tabs section */}
          <Box sx={{ px: 2 }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={value} onChange={handleChange} aria-label="course details" variant="scrollable" scrollButtons="auto">
                {/* Career Insights tab - only shown if career insights exist */}
                {course.aiInsights && course.aiInsights.careerInsights && (
                  <Tab label="Career Insights" id='course-career-tab' aria-controls='course-career' />
                )}
                {/* Student Feedback tab - only shown if review insights exist */}
                {course.aiInsights && course.aiInsights.reviewInsights && (
                  <Tab label="What People Think" id='course-feedback-tab' aria-controls='course-feedback' />
                )}
                <Tab label="Overview" id='course-overview-tab' aria-controls='course-overview' />
                <Tab label="Curriculum" id='course-curriculum-tab' aria-controls='course-curriculum' />
              </Tabs>
            </Box>

            {/* Tab content */}
            {/* Career Insights tab content */}
            {course.aiInsights && course.aiInsights.careerInsights && value === 0 && (
              <Box sx={{ py: 2 }}>
                {/* AI Generated indicator */}
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <SmartToyOutlined fontSize="small" color="disabled" sx={{ mr: 0.5 }} />
                  <Typography variant="caption" color="text.disabled">
                    AI-generated insights based on course content and industry data
                  </Typography>
                </Box>

                {/* Keywords - included in Career Insights tab */}
                {course.aiInsights.keywords && course.aiInsights.keywords.length > 0 && (
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" color="primary" gutterBottom>Key Topics</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8, mt: 1 }}>
                      {course.aiInsights.keywords.map((keyword: string, index: number) => (
                        <Typography
                          key={index}
                          variant="body2"
                          sx={{
                            bgcolor: 'rgba(103, 58, 183, 0.08)',
                            color: 'primary.main',
                            px: 1.5,
                            py: 0.5,
                            borderRadius: 1,
                            fontWeight: 'normal',
                            border: '1px solid',
                            borderColor: 'rgba(103, 58, 183, 0.2)'
                          }}
                        >
                          {keyword}
                        </Typography>
                      ))}
                    </Box>
                  </Box>
                )}

                {/* Career Insights */}
                <Box>
                  <Typography variant="h6" color="primary" gutterBottom>Career Opportunities</Typography>

                  {/* Complementary Skills */}
                  {course.aiInsights.careerInsights.complementarySkills && course.aiInsights.careerInsights.complementarySkills.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle1" fontWeight="bold">Complementary Skills</Typography>
                      <Typography variant="body1">
                        {course.aiInsights.careerInsights.complementarySkills.join(', ')}
                      </Typography>
                    </Box>
                  )}

                  {/* Growth Potential */}
                  {course.aiInsights.careerInsights.growthPotential && course.aiInsights.careerInsights.growthPotential.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle1" fontWeight="bold">Growth Potential</Typography>
                      <Typography variant="body1">
                        {course.aiInsights.careerInsights.growthPotential.join(', ')}
                      </Typography>
                    </Box>
                  )}

                  {/* Job Roles */}
                  {course.aiInsights.careerInsights.jobRoles && course.aiInsights.careerInsights.jobRoles.length > 0 && (
                    <Box sx={{ mt: 3 }}>
                      <Typography variant="h6" color="primary" gutterBottom>Potential Job Roles</Typography>
                      {course.aiInsights.careerInsights.jobRoles.map((role: JobRole, index: number) => (
                        <Box key={index} sx={{ mb: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1, boxShadow: 1 }}>
                          <Typography variant="subtitle1" fontWeight="bold" color="primary">{role.title}</Typography>
                          <Typography variant="body1" sx={{ mt: 1 }}>{role.description}</Typography>
                          {role.salaryRange && (
                            <Typography variant="body1" color="success.main" sx={{ mt: 1, fontWeight: 'medium' }}>
                              Salary Range: {role.salaryRange}
                            </Typography>
                          )}
                          {role.experienceRequirements && role.experienceRequirements.length > 0 && (
                            <Box sx={{ mt: 1.5 }}>
                              <Typography variant="subtitle2" color="text.secondary">Requirements:</Typography>
                              <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
                                {role.experienceRequirements.map((req, reqIndex) => (
                                  <li key={reqIndex}>
                                    <Typography variant="body2">{req}</Typography>
                                  </li>
                                ))}
                              </ul>
                            </Box>
                          )}
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>
              </Box>
            )}

            {/* Student Feedback tab content */}
            {course.aiInsights && course.aiInsights.reviewInsights && value === (course.aiInsights && course.aiInsights.careerInsights ? 1 : 0) && (
              <Box sx={{ py: 2 }}>
                {/* AI Generated indicator */}
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <SmartToyOutlined fontSize="small" color="disabled" sx={{ mr: 0.5 }} />
                  <Typography variant="caption" color="text.disabled">
                    AI-generated summary based on student reviews
                  </Typography>
                </Box>

                {/* Overall Sentiment */}
                {course.aiInsights.reviewInsights.overallSentiment && (
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" color="primary" gutterBottom>Overall Sentiment</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 'medium', fontSize: '1.1rem' }}>
                      {course.aiInsights.reviewInsights.overallSentiment}
                    </Typography>
                  </Box>
                )}

                {/* Pros & Cons */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" color="primary" gutterBottom>Pros & Cons</Typography>
                  <Grid2 container spacing={2} component="div">
                    {/* Pros */}
                    {course.aiInsights.reviewInsights.pros && course.aiInsights.reviewInsights.pros.length > 0 && (
                      <Grid2 sx={{ gridColumn: { xs: 'span 12', sm: 'span 6' } }} component="div">
                        <Box sx={{
                          p: 2,
                          bgcolor: 'rgba(76, 175, 80, 0.08)',
                          borderRadius: 1,
                          border: '1px solid',
                          borderColor: 'rgba(76, 175, 80, 0.2)'
                        }}>
                          <Typography variant="subtitle1" fontWeight="bold" color="success.main">Pros</Typography>
                          <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
                            {course.aiInsights.reviewInsights.pros.map((pro: string, index: number) => (
                              <li key={index}>
                                <Typography variant="body1">{pro}</Typography>
                              </li>
                            ))}
                          </ul>
                        </Box>
                      </Grid2>
                    )}

                    {/* Cons */}
                    {course.aiInsights.reviewInsights.cons && course.aiInsights.reviewInsights.cons.length > 0 && (
                      <Grid2 sx={{ gridColumn: { xs: 'span 12', sm: 'span 6' } }} component="div">
                        <Box sx={{
                          p: 2,
                          bgcolor: 'rgba(211, 47, 47, 0.08)',
                          borderRadius: 1,
                          border: '1px solid',
                          borderColor: 'rgba(211, 47, 47, 0.2)'
                        }}>
                          <Typography variant="subtitle1" fontWeight="bold" color="error.main">Cons</Typography>
                          <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
                            {course.aiInsights.reviewInsights.cons.map((con: string, index: number) => (
                              <li key={index}>
                                <Typography variant="body1">{con}</Typography>
                              </li>
                            ))}
                          </ul>
                        </Box>
                      </Grid2>
                    )}
                  </Grid2>
                </Box>

                {/* Representative Quotes */}
                {course.aiInsights.reviewInsights.representativeQuotes && course.aiInsights.reviewInsights.representativeQuotes.length > 0 && (
                  <Box>
                    <Typography variant="h6" color="primary" gutterBottom>What Students Say</Typography>
                    {course.aiInsights.reviewInsights.representativeQuotes.map((quote: string, index: number) => (
                      <Box
                        key={index}
                        sx={{
                          p: 2,
                          mb: 2,
                          bgcolor: 'background.paper',
                          borderLeft: '4px solid',
                          borderColor: 'primary.main',
                          borderRadius: '0 4px 4px 0',
                          fontStyle: 'italic'
                        }}
                      >
                        <Typography variant="body1">"{quote}"</Typography>
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            )}

            {/* Overview tab content - adjust index based on whether AI Insights tabs exist */}
            {value === getTabIndex(0) && (
              <Box sx={{ py: 2 }}>
                <UnsafeMarkdown content={course.courseDetails.course_details.Overview} />
              </Box>
            )}

            {/* Curriculum tab content - adjust index based on whether AI Insights tabs exist */}
            {value === getTabIndex(1) && (
              <Box sx={{ py: 2 }}>
                {course.courseDetails.course_details.Syllabus ? (
                  <UnsafeMarkdown content={course.courseDetails.course_details.Syllabus} />
                ) : (
                  <Typography variant="body1">
                    {'(n/a)'}
                  </Typography>
                )}
              </Box>
            )}
          </Box>
        </Box>
      </Stack>
    );
  };

  return (
    <Paper
      sx={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {renderContent()}
    </Paper>
  );
};