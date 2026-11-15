'use client';

import type { LearningResource, ResourceFilters } from '@/types/resource';
import { flattenPages } from '@/hooks/use-search-resources';
import { trackSearchResultsLoaded, trackSearchError } from '@/utils/analytics';
import CloseOutlined from '@mui/icons-material/CloseOutlined';
import TuneOutlined from '@mui/icons-material/TuneOutlined';
import {
  Alert, Box, Button, Checkbox, CircularProgress, Divider,
  Drawer, FormControlLabel, FormGroup, IconButton, MenuItem,
  Select, Skeleton, Stack, Typography,
} from '@mui/material';
import * as React from 'react';
import type { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query';
import type { ResourceSearchResponse } from '@/types/resource';
import { FilterGroup } from '../filters/FilterGroup';
import { SearchableFilterGroup } from '../filters/SearchableFilterGroup';
import ResourceCard from './ResourceCard';

// ── Filter options ────────────────────────────────────────────────────────────

const LEVEL_OPTIONS = ['Beginner', 'Intermediate', 'Advanced', 'All Levels'];
const PROVIDER_OPTIONS = ['Coursera', 'edX', 'Udemy', 'DataCamp', 'Pluralsight'/* , 'Skillshare' */];
// Ordered by course count in DB (≥10 courses only; long tail omitted — not useful as filters)
const LANGUAGE_OPTIONS = [
  'English', 'Spanish', 'Portuguese', 'Turkish', 'French', 'Arabic',
  'Japanese', 'Chinese', 'German', 'Korean', 'Italian', 'Russian',
  'Hindi', 'Indonesian', 'Polish', 'Ukrainian', 'Hebrew',
];
const RESOURCE_TYPE_OPTIONS = [
  { label: 'Course', value: 'course' },
  { label: 'Program', value: 'program' },
  { label: 'Degree', value: 'degree' },
  { label: 'Project', value: 'project' },
  { label: 'Certification', value: 'certification' },
  { label: 'Code Along', value: 'code_along' },
];
const SORT_OPTIONS = [
  { label: 'Relevance', value: 'relevance' },
  { label: 'Rating', value: 'rating' },
  { label: 'Most Reviewed', value: 'most_reviewed' },
  { label: 'Duration (short→long)', value: 'duration_asc' },
  { label: 'Duration (long→short)', value: 'duration_desc' },
  { label: 'Newest', value: 'newest' },
] as const;

// ── Internal filter state (display values → API values translated in parent) ──

interface LocalFilterState {
  levels: string[];
  providers: string[];
  languages: string[];
  resource_types: string[];
  is_free: boolean;
  has_certificate: boolean;
}

const DEFAULT_FILTERS: LocalFilterState = {
  levels: [],
  providers: [],
  languages: ['English'],
  resource_types: [],
  is_free: false,
  has_certificate: false,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const LANGUAGE_TO_ISO: Record<string, string> = {
  English: 'en', Spanish: 'es', Portuguese: 'pt', Turkish: 'tr',
  French: 'fr', Arabic: 'ar', Japanese: 'ja', Chinese: 'zh',
  German: 'de', Korean: 'ko', Italian: 'it', Russian: 'ru',
  Hindi: 'hi', Indonesian: 'id', Polish: 'pl', Ukrainian: 'uk',
  Hebrew: 'he',
};

function toApiFilters(local: LocalFilterState, sort: string): ResourceFilters {
  return {
    levels: local.levels.map(l => l.toLowerCase().replace(' ', '_')) as ResourceFilters['levels'],
    providers: local.providers.map(p => p.toLowerCase()) as string[],
    languages: local.languages.map(l => LANGUAGE_TO_ISO[l] ?? l),
    resource_types: local.resource_types as ResourceFilters['resource_types'],
    ...(local.is_free ? { is_free: true } : {}),
    ...(local.has_certificate ? { has_certificate: true } : {}),
    sort: sort as ResourceFilters['sort'],
  };
}

function countApplied(f: LocalFilterState): number {
  return (
    f.levels.length + f.providers.length + f.resource_types.length +
    (f.is_free ? 1 : 0) + (f.has_certificate ? 1 : 0) +
    // english preselected is not shown as an active filter
    f.languages.filter(l => l !== 'English').length
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ResourceListProps {
  query: string;
  titleSecondary?: string;
  onFiltersChange: (filters: ResourceFilters) => void;
  queryResult: UseInfiniteQueryResult<InfiniteData<ResourceSearchResponse>, Error>;
  clickSource?: string;
  enrollSource?: string;
  /** Pass true only from the search page — fires search_results_loaded / search_error events */
  trackSearchOutcome?: boolean;
}

export default function ResourceList({
  query,
  titleSecondary = 'Results for',
  onFiltersChange,
  queryResult,
  clickSource = 'search_results',
  enrollSource = 'search_results',
  trackSearchOutcome = false,
}: ResourceListProps) {
  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, error } = queryResult;
  const resources: LearningResource[] = flattenPages(data ?? undefined);

  // Track search_results_loaded / search_error once per distinct query.
  // Placed here (not in SearchContent) so it fires in the same render cycle as
  // the results — no dependency on filtersReady or parent state timing.
  const trackedQueryRef = React.useRef<string | null>(null);
  const firstPage = data?.pages[0];
  React.useEffect(() => {
    if (!trackSearchOutcome || queryResult.isPlaceholderData) return;
    if (trackedQueryRef.current === query) return;
    if (firstPage) {
      trackedQueryRef.current = query;
      trackSearchResultsLoaded(query, firstPage.data.length, firstPage.vector_search);
    } else if (error) {
      trackedQueryRef.current = query;
      trackSearchError(query, (error as Error).message ?? 'unknown');
    }
  }, [trackSearchOutcome, query, queryResult.isPlaceholderData, firstPage, error]);

  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [sort, setSort] = React.useState<string>('relevance');

  // Draft filters (inside drawer, not yet applied)
  const [draft, setDraft] = React.useState<LocalFilterState>(DEFAULT_FILTERS);
  // Applied filters (what's been sent to the API)
  const [applied, setApplied] = React.useState<LocalFilterState>(DEFAULT_FILTERS);

  // Notify parent on mount with defaults
  React.useEffect(() => {
    onFiltersChange(toApiFilters(applied, sort));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const appliedCount = countApplied(applied);
  const hasChanged = JSON.stringify(draft) !== JSON.stringify(applied);

  function toggle<K extends 'levels' | 'providers' | 'languages' | 'resource_types'>(
    key: K, value: string
  ) {
    setDraft(prev => ({
      ...prev,
      [key]: prev[key].includes(value)
        ? prev[key].filter(v => v !== value)
        : [...prev[key], value],
    }));
  }

  function handleApply() {
    setApplied(draft);
    onFiltersChange(toApiFilters(draft, sort));
    setDrawerOpen(false);
  }

  function handleClear() {
    setDraft(DEFAULT_FILTERS);
  }

  function handleSortChange(newSort: string) {
    setSort(newSort);
    onFiltersChange(toApiFilters(applied, newSort));
  }

  // ── Skeletons ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Box display="flex" flexDirection="column" p={2} gap={2}>
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} variant="rounded" width="100%" height={160} />
        ))}
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error">Something went wrong. Try refreshing, or search again.</Alert>
      </Box>
    );
  }

  // ── Toolbar ─────────────────────────────────────────────────────────────────
  const toolbar = (
    <Box sx={{
      display: 'flex', alignItems: 'center', flexWrap: 'wrap',
      gap: 1.5, px: 2, py: 1.5,
    }}>
      <Box sx={{ flexGrow: 1 }}>
        <Typography variant="h6" color="text.secondary" sx={{ fontSize: '1.1rem' }}>
          {titleSecondary}&nbsp;
          <Typography component="span" variant="h6" color="text.primary" sx={{ fontSize: '1.1rem' }}>
            {query || 'all courses'}
          </Typography>
        </Typography>
      </Box>

      {/* Sort */}
      <Select
        size="small"
        value={sort}
        onChange={e => handleSortChange(e.target.value)}
        sx={{ minWidth: 180 }}
      >
        {SORT_OPTIONS.map(o => (
          <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
        ))}
      </Select>

      {/* Filter button */}
      <Button
        variant="outlined"
        startIcon={<TuneOutlined />}
        onClick={() => { setDraft(applied); setDrawerOpen(true); }}
      >
        Filters
        {appliedCount > 0 && (
          <Box component="span" sx={{
            ml: 0.5,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'primary.main', color: 'primary.contrastText',
            borderRadius: '50%', width: 20, height: 20, fontSize: '0.75rem',
          }}>
            {appliedCount}
          </Box>
        )}
      </Button>
    </Box>
  );

  // ── Empty state ─────────────────────────────────────────────────────────────
  const emptyState = (
    <Box p={3} textAlign="center">
      <Typography variant="h6" gutterBottom>No results found</Typography>
      <Typography variant="body2" color="text.secondary">
        Try a broader search term or adjust your filters. You can also ask Cora on the left for suggestions.
      </Typography>
    </Box>
  );


  // ── Filters drawer ──────────────────────────────────────────────────────────
  const filtersDrawer = (
    <Drawer
      anchor="right"
      open={drawerOpen}
      onClose={() => setDrawerOpen(false)}
      PaperProps={{ sx: { width: { xs: '100%', sm: 400 } } }}
    >
      <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Filters</Typography>
          <Stack direction="row" spacing={1}>
            {countApplied(draft) > 0 && (
              <Button size="small" onClick={handleClear}>Clear All</Button>
            )}
            <IconButton onClick={() => setDrawerOpen(false)}><CloseOutlined /></IconButton>
          </Stack>
        </Stack>

        <Box sx={{ flex: 1, overflow: 'auto' }}>
          <FilterGroup
            title="Level"
            options={LEVEL_OPTIONS}
            selected={draft.levels}
            onToggle={v => toggle('levels', v)}
          />
          <Divider sx={{ my: 2 }} />

          <FilterGroup
            title="Resource Type"
            options={RESOURCE_TYPE_OPTIONS.map(o => o.label)}
            selected={RESOURCE_TYPE_OPTIONS.filter(o => draft.resource_types.includes(o.value)).map(o => o.label)}
            onToggle={label => {
              const opt = RESOURCE_TYPE_OPTIONS.find(o => o.label === label);
              if (opt) toggle('resource_types', opt.value);
            }}
          />
          <Divider sx={{ my: 2 }} />

          <SearchableFilterGroup
            title="Provider"
            options={PROVIDER_OPTIONS}
            selected={draft.providers}
            onToggle={v => toggle('providers', v)}
            searchPlaceholder="Search providers..."
          />
          <Divider sx={{ my: 2 }} />

          <SearchableFilterGroup
            title="Language"
            options={LANGUAGE_OPTIONS}
            selected={draft.languages}
            onToggle={v => toggle('languages', v)}
            searchPlaceholder="Search languages..."
          />
          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle1" fontWeight="bold" mb={1}>Price</Typography>
          <FormGroup>
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={draft.is_free}
                  onChange={e => setDraft(prev => ({ ...prev, is_free: e.target.checked }))}
                />
              }
              label="Free only"
            />
          </FormGroup>

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle1" fontWeight="bold" mb={1}>Features</Typography>
          <FormGroup>
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={draft.has_certificate}
                  onChange={e => setDraft(prev => ({ ...prev, has_certificate: e.target.checked }))}
                />
              }
              label="Includes certificate"
            />
          </FormGroup>
        </Box>

        <Box sx={{ pt: 2, borderTop: 1, borderColor: 'divider' }}>
          <Button
            variant="contained"
            fullWidth
            onClick={handleApply}
            disabled={!hasChanged}
          >
            {appliedCount === 0 ? 'Apply' : 'Update'}
          </Button>
        </Box>
      </Box>
    </Drawer>
  );

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {toolbar}

      <Typography variant="caption" color="text.disabled" sx={{ px: 2, pb: 0.5, display: 'block' }}>
        Course summaries are AI-generated.
      </Typography>

      {resources.length === 0 ? emptyState : (
        <Box sx={{ flex: 1, overflow: 'auto', px: 2, pb: 2 }}>
          <Stack spacing={1.5}>
            {resources.map((r, index) => (
              <ResourceCard key={r.id} resource={r} position={index + 1} clickSource={clickSource} enrollSource={enrollSource} />
            ))}
          </Stack>

          {/* Load more */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
            {isFetchingNextPage ? (
              <CircularProgress size={28} />
            ) : hasNextPage ? (
              <Button variant="outlined" onClick={() => fetchNextPage()}>
                Load more
              </Button>
            ) : resources.length > 0 ? (
              <Typography variant="caption" color="text.disabled">
                You've reached the end of the results.
              </Typography>
            ) : null}
          </Box>
        </Box>
      )}

      {filtersDrawer}
    </Box>
  );
}
