import { useCourseCache } from '@/hooks/use-course-cache';
import { Course, CourseDetails, JobRole } from '@/types/course';
import { ArrowOutwardTwoTone, InfoOutlined, LanguageTwoTone, LocalLibraryTwoTone, MonetizationOnTwoTone, SchoolTwoTone, SignalCellularAltTwoTone, TimerTwoTone, WorkTwoTone } from '@mui/icons-material';
import { Box, Button, Dialog, DialogContent, DialogTitle, Divider, IconButton, Rating, Stack, Typography } from '@mui/material';
import Grid2 from '@mui/material/Grid2';
import { useEffect, useState } from 'react';
import { trackEnrollClick } from '@/utils/analytics';

interface CourseDetailsDialogProps {
  course: Course | CourseDetails;
  open: boolean;
  onClose: () => void;
}

const CourseDetailsDialog = ({ course, open, onClose }: CourseDetailsDialogProps) => {
  const { getCourse } = useCourseCache();
  const [aiInsights, setAIInsights] = useState<any>(null);

  useEffect(() => {
    const getCachedCourse = async () => {
      try {
        const cachedCourse: any = (await getCourse(course._id));

        if (cachedCourse && cachedCourse.aiInsights) {
          setAIInsights(cachedCourse.aiInsights);
        } else {
          setAIInsights(null);
        }
      } catch (error: any) {
        console.error("error fetching cached course:", error);
        setAIInsights(null);
      }
    }
    getCachedCourse();
  }, []);

  // Helper function to determine if the course is of type Course or CourseDetails
  const isCourseType = (course: Course | CourseDetails): course is Course => {
    return 'courseDescription' in course;
  };

  // Get course properties based on the type
  const getCourseName = () => {
    if (isCourseType(course)) {
      return course.properties.course_name;
    } else {
      return course.properties.course_name;
    }
  };

  const getCourseRating = () => {
    if (isCourseType(course)) {
      return course.properties.course_avg_rating;
    } else {
      return course.properties.course_avg_rating;
    }
  };

  const getCourseNumRatings = () => {
    if (isCourseType(course)) {
      return course.properties.course_num_rating;
    } else {
      return course.properties.course_num_rating;
    }
  };

  const getCourseLevel = () => {
    if (isCourseType(course)) {
      return course.properties.course_level || 'Not specified';
    } else {
      return course.properties.course_level || 'Not specified';
    }
  };

  const getCourseInstitution = () => {
    if (isCourseType(course)) {
      return course.properties.course_institution || 'Not specified';
    } else {
      return 'Not specified';
    }
  };

  const getCourseProvider = () => {
    if (isCourseType(course)) {
      return course.properties.course_provider || 'Not specified';
    } else {
      return course.properties.course_provider || 'Not specified';
    }
  };

  const getCourseLanguage = () => {
    if (isCourseType(course)) {
      return course.properties.course_language || 'Not specified';
    } else {
      return course.properties.course_language || 'Not specified';
    }
  };

  const getCourseCost = () => {
    if (isCourseType(course)) {
      return course.properties.course_is_free ? 'Free' : 'Paid';
    } else {
      return course.properties.course_is_free ? 'Free' : 'Paid';
    }
  };

  const getCourseDuration = () => {
    if (isCourseType(course)) {
      return course.duration || 'Not specified';
    } else {
      return course.duration || 'Not specified';
    }
  };

  const getCourseSubjects = () => {
    if (isCourseType(course)) {
      return course.subjects || [];
    } else {
      return [];
    }
  };

  const getCourseDescription = () => {
    if (isCourseType(course)) {
      return course.courseDescription || 'No description available.';
    } else {
      return 'No description available.';
    }
  };

  const getCourseUrl = () => {
    if (isCourseType(course)) {
      return course.courseUrl;
    } else {
      return course.courseUrl;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="course-details-dialog-title"
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle id="course-details-dialog-title" sx={{ display: 'flex', alignItems: 'center' }}>
        <InfoOutlined sx={{ mr: 1 }} />
        <Typography variant="h6" component="div">
          Course Details
        </Typography>
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
          }}
        >
          ×
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="h6" color="primary">
            {getCourseName()}
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Rating size='small' precision={0.5} value={getCourseRating()} readOnly />
            <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
              {getCourseNumRatings()} reviews
            </Typography>
          </Box>

          <Divider />

          {aiInsights ? (
            <>
              <Box sx={{ mb: 2 }}>
                <Typography variant="h6" color="primary" gutterBottom>
                  AI Course Insights
                </Typography>

                {/* Keywords */}
                {aiInsights.keywords && aiInsights.keywords.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle1" fontWeight="bold">Key Topics</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                      {aiInsights.keywords.map((keyword: string, index: number) => (
                        <Typography
                          key={index}
                          variant="body2"
                          sx={{
                            bgcolor: 'rgba(103, 58, 183, 0.08)',
                            color: 'primary.main',
                            px: 1,
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
                {aiInsights.careerInsights && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Career Insights</Typography>

                    {/* Complementary Skills */}
                    {aiInsights.careerInsights.complementarySkills && aiInsights.careerInsights.complementarySkills.length > 0 && (
                      <Box sx={{ mb: 1.5 }}>
                        <Typography variant="subtitle2" color="text.secondary">Complementary Skills</Typography>
                        <Typography variant="body2">
                          {aiInsights.careerInsights.complementarySkills.join(', ')}
                        </Typography>
                      </Box>
                    )}

                    {/* Growth Potential */}
                    {aiInsights.careerInsights.growthPotential && aiInsights.careerInsights.growthPotential.length > 0 && (
                      <Box sx={{ mb: 1.5 }}>
                        <Typography variant="subtitle2" color="text.secondary">Growth Potential</Typography>
                        <Typography variant="body2">
                          {aiInsights.careerInsights.growthPotential.join(', ')}
                        </Typography>
                      </Box>
                    )}

                    {/* Job Roles */}
                    {aiInsights.careerInsights.jobRoles && aiInsights.careerInsights.jobRoles.length > 0 && (
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>Potential Job Roles</Typography>
                        {aiInsights.careerInsights.jobRoles.map((role: JobRole, index: number) => (
                          <Box key={index} sx={{ mb: 1, p: 1, bgcolor: 'background.paper', borderRadius: 1, boxShadow: 1 }}>
                            <Typography variant="body2" fontWeight="bold">{role.title}</Typography>
                            <Typography variant="body2">{role.description}</Typography>
                            {role.salaryRange && (
                              <Typography variant="body2" color="success.main">
                                Salary Range: {role.salaryRange}
                              </Typography>
                            )}
                            {role.experienceRequirements && role.experienceRequirements.length > 0 && (
                              <Box sx={{ mt: 0.5 }}>
                                <Typography variant="body2" color="text.secondary">Requirements:</Typography>
                                <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
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
                )}

                {/* Review Insights */}
                {aiInsights.reviewInsights && (
                  <Box>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>What People Think</Typography>

                    {/* Overall Sentiment */}
                    {aiInsights.reviewInsights.overallSentiment && (
                      <Box sx={{ mb: 1.5 }}>
                        <Typography variant="subtitle2" color="text.secondary">Overall Sentiment</Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {aiInsights.reviewInsights.overallSentiment}
                        </Typography>
                      </Box>
                    )}

                    {/* Pros & Cons */}
                    <Grid2 container spacing={2} component="div" sx={{ mb: 1.5 }}>
                      {/* Pros */}
                      {aiInsights.reviewInsights.pros && aiInsights.reviewInsights.pros.length > 0 && (
                        <Grid2 sx={{ gridColumn: { xs: 'span 12', sm: 'span 6' } }} component="div">
                          <Box sx={{
                            p: 1.5,
                            bgcolor: 'rgba(76, 175, 80, 0.08)',
                            borderRadius: 1,
                            border: '1px solid',
                            borderColor: 'rgba(76, 175, 80, 0.2)'
                          }}>
                            <Typography variant="subtitle2" fontWeight="bold" color="success.main">Pros</Typography>
                            <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
                              {aiInsights.reviewInsights.pros.map((pro: string, index: number) => (
                                <li key={index}>
                                  <Typography variant="body2">{pro}</Typography>
                                </li>
                              ))}
                            </ul>
                          </Box>
                        </Grid2>
                      )}

                      {/* Cons */}
                      {aiInsights.reviewInsights.cons && aiInsights.reviewInsights.cons.length > 0 && (
                        <Grid2 sx={{ gridColumn: { xs: 'span 12', sm: 'span 6' } }} component="div">
                          <Box sx={{
                            p: 1.5,
                            bgcolor: 'rgba(211, 47, 47, 0.08)',
                            borderRadius: 1,
                            border: '1px solid',
                            borderColor: 'rgba(211, 47, 47, 0.2)'
                          }}>
                            <Typography variant="subtitle2" fontWeight="bold" color="error.main">Cons</Typography>
                            <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
                              {aiInsights.reviewInsights.cons.map((con: string, index: number) => (
                                <li key={index}>
                                  <Typography variant="body2">{con}</Typography>
                                </li>
                              ))}
                            </ul>
                          </Box>
                        </Grid2>
                      )}
                    </Grid2>

                    {/* Representative Quotes */}
                    {aiInsights.reviewInsights.representativeQuotes && aiInsights.reviewInsights.representativeQuotes.length > 0 && (
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>What Students Say</Typography>
                        {aiInsights.reviewInsights.representativeQuotes.map((quote: string, index: number) => (
                          <Box
                            key={index}
                            sx={{
                              p: 1.5,
                              mb: 1,
                              bgcolor: 'background.paper',
                              borderLeft: '4px solid',
                              borderColor: 'primary.main',
                              borderRadius: '0 4px 4px 0',
                              fontStyle: 'italic'
                            }}
                          >
                            <Typography variant="body2">"{quote}"</Typography>
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Box>
                )}
              </Box>
            </>
          ) : (
            <>
              <Grid2 container spacing={2}>
                {/* Skill Level */}
                <Grid2 size={{ xs: 12, sm: 6 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <SignalCellularAltTwoTone color="primary" />
                    <Stack>
                      <Typography variant="caption" color="text.secondary">Skill Level</Typography>
                      <Typography variant="body2">{getCourseLevel()}</Typography>
                    </Stack>
                  </Stack>
                </Grid2>

                {/* Institution */}
                <Grid2 size={{ xs: 12, sm: 6 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <SchoolTwoTone color="primary" />
                    <Stack>
                      <Typography variant="caption" color="text.secondary">Institution</Typography>
                      <Typography variant="body2">{getCourseInstitution()}</Typography>
                    </Stack>
                  </Stack>
                </Grid2>

                {/* Provider */}
                <Grid2 size={{ xs: 12, sm: 6 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <LocalLibraryTwoTone color="primary" />
                    <Stack>
                      <Typography variant="caption" color="text.secondary">Provider</Typography>
                      <Typography variant="body2">{getCourseProvider()}</Typography>
                    </Stack>
                  </Stack>
                </Grid2>

                {/* Language */}
                <Grid2 size={{ xs: 12, sm: 6 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <LanguageTwoTone color="primary" />
                    <Stack>
                      <Typography variant="caption" color="text.secondary">Language</Typography>
                      <Typography variant="body2">{getCourseLanguage()}</Typography>
                    </Stack>
                  </Stack>
                </Grid2>

                {/* Cost */}
                <Grid2 size={{ xs: 12, sm: 6 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <MonetizationOnTwoTone color="primary" />
                    <Stack>
                      <Typography variant="caption" color="text.secondary">Cost</Typography>
                      <Typography variant="body2">{getCourseCost()}</Typography>
                    </Stack>
                  </Stack>
                </Grid2>

                {/* Duration */}
                <Grid2 size={{ xs: 12, sm: 6 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <TimerTwoTone color="primary" />
                    <Stack>
                      <Typography variant="caption" color="text.secondary">Time Commitment</Typography>
                      <Typography variant="body2">{getCourseDuration()}</Typography>
                    </Stack>
                  </Stack>
                </Grid2>

                {/* Job Roles (if available in subjects) */}
                {getCourseSubjects().length > 0 && (
                  <Grid2 size={{ xs: 12 }}>
                    <Stack direction="row" spacing={1} alignItems="flex-start">
                      <WorkTwoTone color="primary" />
                      <Stack>
                        <Typography variant="caption" color="text.secondary">Related Fields</Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {getCourseSubjects().map((subject, index) => (
                            <Typography key={index} variant="body2" component="span">
                              {subject}{index < getCourseSubjects().length - 1 ? ', ' : ''}
                            </Typography>
                          ))}
                        </Box>
                      </Stack>
                    </Stack>
                  </Grid2>
                )}
              </Grid2>

              <Divider />

              {/* Description */}
              <Typography variant="body2">
                {getCourseDescription()}
              </Typography>

              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                <Button
                  variant="contained"
                  color="primary"
                  endIcon={<ArrowOutwardTwoTone />}
                  onClick={(e) => {
                    e.preventDefault();
                    trackEnrollClick(
                      isCourseType(course) ? course._id : course.metadata._id,
                      getCourseName(),
                      getCourseUrl(),
                      'course_dialog'
                    );
                    window.open(getCourseUrl(), '_blank', 'noopener,noreferrer');
                  }}
                >
                  Enroll
                </Button>
              </Box>
            </>
          )}
        </Stack>
      </DialogContent>
    </Dialog>
  );
};

export default CourseDetailsDialog;
