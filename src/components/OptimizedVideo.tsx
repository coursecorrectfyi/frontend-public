import React from 'react';
import { Box } from '@mui/material';

interface OptimizedVideoProps {
  src: string;
  alt: string;
  maxWidth?: number | string;
  sx?: any;
}

export default function OptimizedVideo({ 
  src, 
  alt, 
  maxWidth = 400, 
  sx = {} 
}: OptimizedVideoProps) {
  return (
    <Box
      component="video"
      autoPlay
      muted
      loop
      playsInline
      sx={{
        width: '100%',
        maxWidth,
        height: 'auto',
        borderRadius: 1,
        boxShadow: (theme) => theme.palette.mode === 'dark'
          ? '0 4px 12px rgba(0,0,0,0.3)'
          : '0 4px 12px rgba(0,0,0,0.1)',
        ...sx
      }}
    >
      <source src={src} type="video/mp4" />
      Your browser does not support the video tag.
    </Box>
  );
} 