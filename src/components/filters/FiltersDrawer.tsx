'use client';

import { CloseOutlined } from '@mui/icons-material';
import { Box, Button, Divider, Drawer, IconButton, Stack, Typography } from '@mui/material';
import * as React from 'react';
import { FilterGroup } from './FilterGroup';
import { SearchableFilterGroup } from './SearchableFilterGroup';

export interface FiltersDrawerProps {
  open: boolean;
  onClose: () => void;
  filterOptions: {
    levels: string[];
    languages: string[];
    providers: string[];
  };
  selectedFilters: {
    levels: string[];
    languages: string[];
    providers: string[];
  };
  onFilterToggle: {
    levels: (value: string) => void;
    languages: (value: string) => void;
    providers: (value: string) => void;
  };
  onApplyFilters: () => void;
  onClearFilters: () => void;
  hasSelectionChanged: boolean;
  selectedCount: number;
  appliedCount: number;
}

export const FiltersDrawer: React.FC<FiltersDrawerProps> = ({
  open,
  onClose,
  filterOptions,
  selectedFilters,
  onFilterToggle,
  onApplyFilters,
  onClearFilters,
  hasSelectionChanged,
  selectedCount,
  appliedCount,
}) => {
  return (
    <Drawer
      anchor='right'
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: { width: { xs: '100%', sm: 400 } }
      }}
    >
      <Box sx={{
        p: 2,
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Filters</Typography>
          <Stack direction="row" spacing={1}>
            {selectedCount > 0 && (
              <Button
                size="small"
                onClick={onClearFilters}
              >
                Clear All
              </Button>
            )}
            <IconButton onClick={onClose}>
              <CloseOutlined />
            </IconButton>
          </Stack>
        </Stack>

        <Box sx={{ flex: 1, overflow: 'auto' }}>
          <FilterGroup
            title="Level"
            options={filterOptions.levels}
            selected={selectedFilters.levels}
            onToggle={onFilterToggle.levels}
          />

          <Divider sx={{ my: 2 }} />

          <SearchableFilterGroup
            title="Language"
            options={filterOptions.languages}
            selected={selectedFilters.languages}
            onToggle={onFilterToggle.languages}
            searchPlaceholder="Search languages..."
          />

          <Divider sx={{ my: 2 }} />

          <SearchableFilterGroup
            title="Provider"
            options={filterOptions.providers}
            selected={selectedFilters.providers}
            onToggle={onFilterToggle.providers}
            searchPlaceholder="Search providers..."
          />
        </Box>

        <Box sx={{
          pt: 2,
          borderTop: 1,
          borderColor: 'divider',
          backgroundColor: 'background.paper',
        }}>
          <Button
            variant="contained"
            fullWidth
            onClick={onApplyFilters}
            disabled={!hasSelectionChanged}
          >
            {appliedCount === 0 ? 'Apply' : 'Update'}
          </Button>
        </Box>
      </Box>
    </Drawer>
  );
};