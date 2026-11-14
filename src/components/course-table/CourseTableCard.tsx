import CourseDetailsDialog from '@/components/course/CourseDetailsDialog';
import CourseAttributeDisplay from '@/components/course/CourseProviderDisplay';
import { Course } from '@/types/course';
import { ArrowOutwardTwoTone, LocalLibraryTwoTone, SignalCellularAltTwoTone, ZoomIn } from '@mui/icons-material';
import { Box, Button, Card, CardActionArea, CardActions, CardMedia, IconButton, Rating, styled, Tooltip, Typography } from '@mui/material';
import { useState } from 'react';
import SaveCourseButton from '../course/SaveCourseButton';
import { trackSearchResultClick, trackEnrollClick } from '@/utils/analytics';

interface CourseTableCardProps {
  course: Course
}

const StyledCard = styled(Card)(({ theme }) => ({
  transition: 'transform 0.3s, box-shadow 0.3s',
  '&:hover': {
    transform: 'scale(1.01)', // Slightly increase size
  },
  padding: theme.spacing(2),
  borderRadius: theme.shape.borderRadius,
  outlineColor: 'hsla(220, 25%, 80%, 0.2)',
  border: '1px solid',
  borderColor: theme.palette.grey[200],
  ...theme.applyStyles('dark', {
    outlineColor: 'hsla(220, 20%, 42%, 0.1)',
    borderColor: theme.palette.grey[800],
  }),
}))

export const CourseTableCard = ({ course }: CourseTableCardProps) => {
  const [detailsOpen, setDetailsOpen] = useState(false);

  return (
    <>
      <StyledCard
        sx={{
          display: 'flex', flexDirection: { xs: 'column', sm: 'row' },
          maxHeight: { xs: 'auto', sm: 170 },
          gap: (theme) => theme.spacing(1.2)
        }}
      >
        <CardActionArea
          href={'/course/anything/' + course._id}
          onClick={() => trackSearchResultClick(course._id, course.properties.course_name, 0)}
          sx={{
            flex: 3,
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <CardMedia
            component="img"
            sx={{
              alignSelf: 'center',
              objectFit: 'contain',
              maxWidth: { xs: '100%', sm: 'auto' },
              maxHeight: { xs: 'auto', sm: '100%' },
              height: 'auto'
            }}
            image={course.cc_imageUrl}
            alt={course.properties.course_name}
          />
        </CardActionArea>

        <Box
          sx={{
            flex: 6,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}
        >
          <CardActionArea 
            href={'/course/anything/' + course._id}
            onClick={() => trackSearchResultClick(course._id, course.properties.course_name, 0)}
          >
            <Typography component="div" variant="h6" color='primary.main'>
              {course.properties.course_name}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', marginTop: 1 }}>
              <Rating size='small' precision={0.5} value={course.properties.course_avg_rating} readOnly />
              <Typography variant="body2" color="text.secondary" sx={{ marginLeft: 1 }}>
                {course.properties.course_num_rating} reviews
              </Typography>
            </Box>
          </CardActionArea>
          <CardActions sx={{ px: 0 }}>
            <Tooltip title="Quick View">
              <IconButton
                onClick={() => setDetailsOpen(true)}
                aria-label="course details"
                sx={(theme) => ({
                  px: 0.5,
                  color: theme.palette.primary.main,
                  ...theme.applyStyles('dark', { color: theme.palette.primary[200] }),
                })}
              >
                <ZoomIn />
              </IconButton>
            </Tooltip>
            <SaveCourseButton courseId={course._id} courseName={course.properties.course_name} />
            <Button
              variant='outlined'
              aria-label='Enroll'
              endIcon={<ArrowOutwardTwoTone />}
              onClick={(e) => {
                e.preventDefault();
                trackEnrollClick(course._id, course.properties.course_name, course.courseUrl, 'search_results');
                window.open(course.courseUrl, '_blank', 'noopener,noreferrer');
              }}
            >
              Enroll
            </Button>
          </CardActions>
        </Box>

        <Box sx={{
          width: 116, display: 'flex', flexDirection: 'column', gap: 1,
          justifyContent: 'center'
        }}>
          <CourseAttributeDisplay icon={<SignalCellularAltTwoTone />} value={course.properties.course_level} />
          <CourseAttributeDisplay icon={<LocalLibraryTwoTone />} value={course.properties.course_provider} />
        </Box>
      </StyledCard>

      {/* Course Details Dialog */}
      {detailsOpen && (
        <CourseDetailsDialog
          course={course}
          open={detailsOpen}
          onClose={() => setDetailsOpen(false)}
        />
      )}
    </>
  );
};

export default CourseTableCard;
