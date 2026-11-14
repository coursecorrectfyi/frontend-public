import React from 'react';
import { Box, Icon, Typography } from '@mui/material';
import LocalLibraryTwoTone from '@mui/icons-material/LocalLibraryTwoTone';
import { toTitleCase } from '@/utils/utils';

interface CourseAttributeDisplayProps {
  icon: React.ReactNode;
  value: string;
}

const CourseAttributeDisplay: React.FC<CourseAttributeDisplayProps> = ({ icon, value }: CourseAttributeDisplayProps) => {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      <Box sx={{ minWidth: 32, display: 'flex', alignItems: 'center' }}>
        {icon}
      </Box>
      <Typography variant="body2" color="text.secondary">
        {value ? toTitleCase(value) : '(n/a)'}
      </Typography>
    </Box>
  );
};

export default CourseAttributeDisplay;