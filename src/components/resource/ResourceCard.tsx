'use client';

import type { LearningResource } from '@/types/resource';
import { trackSearchResultClick, trackEnrollClick } from '@/utils/analytics';
import { ArrowOutwardTwoTone } from '@mui/icons-material';
import {
  Box, Button, Card, Chip, Rating, styled, Tooltip, Typography,
} from '@mui/material';
import SaveCourseButton from '../course/SaveCourseButton';
import slugify from 'slugify';
import { RESOURCE_TYPE_META, LEVEL_LABELS, formatDuration } from './resource-meta';

interface ResourceCardProps {
  resource: LearningResource;
  position?: number;
  enrollSource?: string;
  clickSource?: string;
}

const StyledCard = styled(Card)(({ theme }) => ({
  transition: 'transform 0.3s, box-shadow 0.3s',
  '&:hover': { transform: 'scale(1.005)' },
  padding: theme.spacing(2),
  borderRadius: theme.shape.borderRadius,
  border: '1px solid',
  borderColor: theme.palette.grey[200],
  ...theme.applyStyles('dark', {
    borderColor: theme.palette.grey[800],
  }),
}));

export function ResourceCard({ resource, position, enrollSource = 'search_results', clickSource = 'search_results' }: ResourceCardProps) {
  const {
    id, title, provider, institution, resource_type, level,
    ai_summary, skills, rating, num_ratings, duration_hours,
    is_free, is_self_paced, has_certificate, url,
  } = resource;

  const detailUrl = `/learn/${slugify(title, { lower: true, strict: true })}/${id}`;
  const topSkills = skills?.slice(0, 4) ?? [];
  const duration = formatDuration(duration_hours);

  return (
    <StyledCard>
      {/* Header row: badges + provider */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.75 }}>
        {resource_type && (
          <Tooltip title={RESOURCE_TYPE_META[resource_type]?.tooltip ?? ''} arrow>
            <Chip
              label={RESOURCE_TYPE_META[resource_type]?.label ?? resource_type}
              size="small"
              color="primary"
              variant="outlined"
              sx={{ fontWeight: 600, fontSize: '0.7rem', cursor: 'help' }}
            />
          </Tooltip>
        )}
        {level && (
          <Chip
            label={LEVEL_LABELS[level] ?? level}
            size="small"
            variant="outlined"
            sx={{ fontSize: '0.7rem' }}
          />
        )}
        {is_self_paced && (
          <Chip label="Self-paced" size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
        )}
        {is_free && (
          <Chip label="Free" size="small" color="success" variant="outlined" sx={{ fontSize: '0.7rem' }} />
        )}
        <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto', textTransform: 'capitalize' }}>
          {provider}
        </Typography>
      </Box>

      {/* Title + institution */}
      <Typography
        component="a"
        href={detailUrl}
        variant="subtitle1"
        color="primary.main"
        sx={{ fontWeight: 600, textDecoration: 'none', '&:hover': { textDecoration: 'underline' }, display: 'block' }}
        onClick={() => trackSearchResultClick(id, title, position ?? 0, clickSource)}
      >
        {title}
      </Typography>
      {institution && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
          {institution}
        </Typography>
      )}

      {/* AI summary */}
      {ai_summary && (
        <Typography
          variant="body2"
          color="text.primary"
          sx={{
            my: 1,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {ai_summary}
        </Typography>
      )}

      {/* Skill chips */}
      {topSkills.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
          {topSkills.map(skill => (
            <Chip key={skill} label={skill} size="small" sx={{ fontSize: '0.7rem' }} />
          ))}
        </Box>
      )}

      {/* Metadata + actions row */}
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, mt: 'auto' }}>
        {rating != null && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Rating size="small" precision={0.5} value={rating} readOnly />
            {num_ratings != null && (
              <Typography variant="caption" color="text.secondary">
                ({num_ratings.toLocaleString()})
              </Typography>
            )}
          </Box>
        )}
        {duration && (
          <Typography variant="caption" color="text.secondary">{duration}</Typography>
        )}
        {has_certificate && (
          <Typography variant="caption" color="text.secondary">Certificate</Typography>
        )}

        <Box sx={{ ml: 'auto', display: 'flex', gap: 1, alignItems: 'center' }}>
          <SaveCourseButton courseId={id} courseName={title} />
          <Tooltip title="You'll be redirected to the provider's site. CourseCorrect may earn a commission.">
            <Button
              variant="outlined"
              size="small"
              endIcon={<ArrowOutwardTwoTone />}
              onClick={() => {
                trackEnrollClick(id, title, url, enrollSource);
                window.open(url, '_blank', 'noopener,noreferrer');
              }}
            >
              Enroll
            </Button>
          </Tooltip>
        </Box>
      </Box>
    </StyledCard>
  );
}

export default ResourceCard;
