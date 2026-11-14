'use client';

import { Search } from '@mui/icons-material';
import { Box, Checkbox, FormControlLabel, FormGroup, InputAdornment, TextField, Typography } from '@mui/material';
import * as React from 'react';
import { FilterGroupProps } from './FilterGroup';

interface SearchableFilterGroupProps extends FilterGroupProps {
  searchPlaceholder?: string;
}

export const SearchableFilterGroup: React.FC<SearchableFilterGroupProps> = ({
  searchPlaceholder = 'Search...',
  ...filterGroupProps
}) => {
  const [searchQuery, setSearchQuery] = React.useState('');

  const filteredOptions = filterGroupProps.options.filter(option =>
    option.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Box>
      <Typography variant="subtitle1" fontWeight="bold" mb={1}>
        {filterGroupProps.title}
      </Typography>

      <TextField
        size="small"
        fullWidth
        placeholder={searchPlaceholder}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Search sx={{ color: 'text.secondary' }} />
              </InputAdornment>
            ),
          },
        }}
        sx={{ mb: 1 }}
      />

      <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
        <FormGroup>
          {filteredOptions.map((option) => (
            <FormControlLabel
              key={option}
              control={
                <Checkbox
                  checked={filterGroupProps.selected.includes(option)}
                  onChange={() => filterGroupProps.onToggle(option)}
                  size="small"
                />
              }
              label={option}
            />
          ))}
        </FormGroup>
      </Box>
    </Box>
  );
};