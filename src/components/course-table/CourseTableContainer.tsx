'use client';

import { Course } from '@/types/course';
import { TuneOutlined } from '@mui/icons-material';
import { Alert, Box, Button, Skeleton, Table, TableBody, TableCell, TableContainer, TablePagination, TableRow, Toolbar, Typography } from '@mui/material';
import Head from 'next/head';
import * as React from 'react';
import { FiltersDrawer } from '../filters/FiltersDrawer';
import CourseTableCard from './CourseTableCard';
import { FilterOptions, FilterState, defaultFilterState } from '@/utils/filterUtils';

interface CourseTableContainerProps {
  courses: Course[];
  titlePrimary?: string;
  titleSecondary?: string;
  showFilters?: boolean;
  onFiltersChange?: (filters: FilterState) => void;
  filterOptions?: FilterOptions;
  title?: string | null;
  description?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  isLoading?: boolean;
  error?: string | null;
}

export default function CourseTableContainer({
  courses, titlePrimary, titleSecondary,
  showFilters = false,
  onFiltersChange,
  filterOptions = {
    levels: [],
    languages: [],
    providers: [],
  },
  title, description, metaTitle, metaDescription,
  isLoading = false,
  error = null,
}: CourseTableContainerProps) {
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);

  // Filters
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  // Filter states - initialize with default filter state (English preselected)
  const [selectedFilters, setSelectedFilters] = React.useState<FilterState>({
    ...defaultFilterState
  });

  const [appliedFilters, setAppliedFilters] = React.useState<FilterState>({
    ...defaultFilterState
  });

  // Apply default filters on initial load
  React.useEffect(() => {
    if (onFiltersChange) {
      onFiltersChange(appliedFilters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasSelectionChanged = JSON.stringify(selectedFilters) !== JSON.stringify(appliedFilters);

  // Handle applying filters
  const handleApplyFilters = () => {
    setAppliedFilters(selectedFilters);
    if (onFiltersChange) {
      onFiltersChange(selectedFilters); // Call the callback for updating the results.
    }
    setDrawerOpen(false);
    setPage(0);
  };

  // Handle clearing all filters
  const handleClearFilters = () => {
    setSelectedFilters({
      levels: [],
      languages: [],
      providers: [],
    });
  };

  const getAppliedCount = () => {
    return Object.values(appliedFilters).reduce(
      (count, array) => count + array.length,
      0
    );
  };

  const handleFilterToggle = (
    value: string,
    filterType: 'levels' | 'languages' | 'providers'
  ) => {
    setSelectedFilters(prev => ({
      ...prev,
      [filterType]: prev[filterType].includes(value)
        ? prev[filterType].filter(item => item !== value)
        : [...prev[filterType], value]
    }));
  };

  const getSelectedCount = () => {
    return Object.values(selectedFilters).reduce(
      (count, array) => count + array.length,
      0
    );
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(+event.target.value);
    setPage(0);
  };

  const visibleCourses = React.useMemo(
    () =>
      [...courses]
        .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [courses, page, rowsPerPage],
  );

  const renderContent = () => {
    if (isLoading) {
      return (
        <Box display="flex" flexDirection='column' p={3} gap={2}>
          <Skeleton variant="rounded" width='100%' height={80} />
          <Skeleton variant="rounded" width='100%' height={80} />
          <Skeleton variant="rounded" width='100%' height={80} />
          <Skeleton variant="rounded" width='100%' height={80} />
          <Skeleton variant="rounded" width='100%' height={80} />
        </Box>
      );
    }

    if (error) {
      return (
        <Box p={3}>
          <Alert severity="error">{error}</Alert>
        </Box>
      );
    }

    // Show empty state message only if we're not loading and have no courses
    if (!isLoading && (!courses || courses.length === 0)) {
      return (
        <Box p={3}>
          <Alert severity="info">No saved items found.</Alert>
        </Box>
      );
    }

    return (
      <>
        <TableContainer sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}
        >
          <Table aria-label="courses list" size='small'>
            <TableBody>
              {visibleCourses.map((course) => (
                <TableRow
                  key={course._id}
                  role="checkbox"
                  tabIndex={-1}
                >
                  <TableCell>
                    <CourseTableCard
                      course={course}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[5, 10, 15]}
          component="div"
          count={courses.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </>
    );
  };

  const filtersDrawer = (<FiltersDrawer
    open={drawerOpen}
    onClose={() => setDrawerOpen(false)}
    filterOptions={filterOptions}
    selectedFilters={selectedFilters}
    onFilterToggle={{
      levels: (value) => handleFilterToggle(value, 'levels'),
      languages: (value) => handleFilterToggle(value, 'languages'),
      providers: (value) => handleFilterToggle(value, 'providers'),
    }}
    onApplyFilters={handleApplyFilters}
    onClearFilters={handleClearFilters}
    hasSelectionChanged={hasSelectionChanged}
    selectedCount={getSelectedCount()}
    appliedCount={getAppliedCount()}
  />);

  const toolbar = (<Toolbar
    component='div'
    sx={{ mt: 1 }}
  >
    <Box sx={{
      display: 'flex',
      flexDirection: { xs: 'column', md: 'row' },
      justifyContent: 'space-between',
      width: '100%',
      alignItems: { xs: 'flex-start', md: 'center' },
      gap: 1
    }}>
      <Box sx={{ flexGrow: 1 }}>
        <Typography variant="h4" color="text.secondary" sx={{ fontSize: '1.5rem' }}>
          {titleSecondary}&nbsp;
          <Typography
            variant="h4"
            component="span"
            color="text.primary"
            sx={{ fontSize: '1.5rem' }}
          >{titlePrimary || 'all courses'}</Typography>
        </Typography>
      </Box>
      <Box>
        {showFilters && (
          <Button
            variant='outlined'
            startIcon={<TuneOutlined />}
            onClick={() => setDrawerOpen(true)}
            sx={{ position: 'relative' }}
          >
            Filters {getAppliedCount() > 0 &&
              <Box component="span" sx={{
                ml: 0.5,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'primary.main',
                color: 'primary.contrastText',
                borderRadius: '50%',
                width: 20,
                height: 20,
                fontSize: '0.75rem',
              }}>
                {getAppliedCount()}
              </Box>
            }
          </Button>
        )}
      </Box>
    </Box>
  </Toolbar>);

  if (title) {
    return (
      <>
        <Head>
          <title>{metaTitle}</title>
          <meta name="description" content={metaDescription || ''} />
          <meta property="og:title" content={metaTitle || ''} />
          <meta property="og:description" content={metaDescription || ''} />
        </Head>

        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Box textAlign="left" py={2} px={2} color="text.primary">
            <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
              {title}
            </Typography>
            <Typography variant="subtitle1" color="text.primary">
              {description}
            </Typography>
          </Box>
          {toolbar}

          {renderContent()}

          {showFilters && filtersDrawer}
        </Box>
      </>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {toolbar}

      {renderContent()}

      {showFilters && filtersDrawer}
    </Box>
  );
}
