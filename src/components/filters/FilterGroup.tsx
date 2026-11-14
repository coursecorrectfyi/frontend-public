'use client';

import { Box, Checkbox, FormControlLabel, FormGroup, Typography } from '@mui/material';
import * as React from 'react';

export interface FilterGroupProps {
  title: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}

export const FilterGroup: React.FC<FilterGroupProps> = ({
  title,
  options,
  selected,
  onToggle
}) => {
  return (
    <Box>
      <Typography variant="subtitle1" fontWeight="bold" mb={1}>
        {title}
      </Typography>
      <FormGroup>
        {options.map((option) => (
          <FormControlLabel
            key={option}
            control={
              <Checkbox
                checked={selected.includes(option)}
                onChange={() => onToggle(option)}
                size="small"
              />
            }
            label={option}
          />
        ))}
      </FormGroup>
    </Box>
  );
};