'use client';

import { getSubjects, Subject } from '@/api/subjects';
import CustomModal from '@/layouts/CustomModal';
import { trackSearch } from '@/utils/analytics';
import { navigateTo } from '@/utils/navigation';
import { onOpenSearch } from '@/utils/search-events';
import SearchIcon from '@mui/icons-material/Search';
import { Autocomplete, Divider, InputAdornment, Stack, TextField } from '@mui/material';
import { alpha, styled, Theme } from '@mui/material/styles';
import { SxProps } from "@mui/system";
import React, { useEffect, useRef, useState } from 'react';

const SearchButton = styled('button')<{ isHomePage?: boolean }>(({ theme, isHomePage }) => [
  {
    margin: 0,
    paddingLeft: theme.spacing(1),
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    ...(isHomePage ? {} : {
      minHeight: 32,
      minWidth: 32,
      [theme.breakpoints.only('xs')]: {
        backgroundColor: 'transparent',
        width: 32,
        padding: 0,
        justifyContent: 'center',
        '& > *:not(.MuiSvgIcon-root)': {
          display: 'none',
        },
      },
    }),
    backgroundColor: isHomePage ? alpha(theme.palette.grey[50], 0.9) : alpha(theme.palette.grey[50], 0.6),
    position: 'relative',
    fontFamily: theme.typography.fontFamily,
    fontSize: theme.typography.pxToRem(14),
    color: (theme.vars || theme).palette.text.secondary,
    border: `1px solid ${(theme.vars || theme).palette.grey[200]}`,
    borderRadius: (theme.vars || theme).shape.borderRadius,
    cursor: 'pointer',
    transitionProperty: 'all',
    transitionDuration: '150ms',
    boxShadow: `hsl(200, 0%, 100%) 0 1px 0 inset, ${alpha(theme.palette.grey[100], 0.4)} 0 -1px 0 inset, ${alpha(theme.palette.grey[200], 0.5)} 0 1px 2px 0`,
    '&:hover': {
      background: alpha(theme.palette.grey[100], 0.5),
      borderColor: (theme.vars || theme).palette.grey[300],
      boxShadow: 'none',
    },
    '&:focus-visible': {
      outline: `3px solid ${alpha(theme.palette.primary[500], 0.5)}`,
      outlineOffset: '2px',
    },
  },
  theme.applyDarkStyles({
    borderColor: alpha(theme.palette.primary[500], 0.5),
    boxShadow: `0 0 0 1px ${alpha(theme.palette.primary[500], 0.3)}, 0 0 20px ${alpha(theme.palette.primary[500], 0.15)}`,
    '&:hover': {
      background: (theme.vars || theme).palette.primaryDark[700],
      borderColor: (theme.vars || theme).palette.primary[400],
      boxShadow: `0 0 0 1px ${alpha(theme.palette.primary[400], 0.5)}, 0 0 25px ${alpha(theme.palette.primary[500], 0.25)}`,
    },
    ...(isHomePage ? {
      backgroundColor: alpha(theme.palette.primaryDark[800], 0.85),
    } : {
      backgroundColor: alpha(theme.palette.primaryDark[700], 0.4),
    })
  }),
]);

const SearchLabel = styled('span')(({ theme }) => ({
  marginRight: 'auto',
  marginBottom: '1px', // optical alignment
  color: (theme.vars || theme).palette.text.tertiary,
  lineHeight: 1,
}));

const Shortcut = styled('kbd')(({ theme }) => {
  return {
    all: 'unset',
    fontSize: theme.typography.pxToRem(12),
    fontWeight: 'bold',
    lineHeight: '19px',
    marginLeft: theme.spacing(0.5),
    border: `1px solid ${(theme.vars || theme).palette.grey[200]}`,
    backgroundColor: '#FFF',
    padding: theme.spacing(0, 0.5),
    borderRadius: 7,
    ...theme.applyDarkStyles({
      borderColor: (theme.vars || theme).palette.primaryDark[600],
      backgroundColor: (theme.vars || theme).palette.primaryDark[800],
    }),
  };
});

interface AppSearchProps {
  searchLabel?: string
  isHomePage?: boolean
  /**
  * The system prop that allows defining system overrides as well as additional CSS styles.
  */
  sx?: SxProps<Theme>;
}

export default function AppSearch({ searchLabel, isHomePage, sx }: AppSearchProps) {
  // For keyboard shortcut
  const [macOS, setMacOS] = useState<boolean>(false);
  const [isDesktop, setIsDesktop] = useState<boolean>(true);

  // For search bar dropdown population
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // For opening and focusing the custom search modal
  const [open, setOpen] = React.useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const lastSearchedRef = useRef<string | null>(null);

  // For handling input value and the search
  const [searchValue, setSearchValue] = useState<string>('');
  const [inputValue, setInputValue] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Check if device is macOS
      setMacOS(navigator.userAgent.includes('Mac'));

      // Check if device is mobile/tablet
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i.test(userAgent);

      // Set desktop state based only on device type
      setIsDesktop(!isMobile);
    }
  }, []);

  useEffect(() => {
    // Check if we have cached subjects in sessionStorage
    const cachedSubjects = sessionStorage.getItem('subjects');
    const cachedTimestamp = sessionStorage.getItem('subjects_timestamp');

    // Cache duration constants (in milliseconds)
    const ONE_DAY = 24 * 60 * 60 * 1000;
    const ONE_WEEK = 7 * ONE_DAY;

    const isCacheValid = cachedTimestamp && (Date.now() - parseInt(cachedTimestamp)) < ONE_WEEK;

    if (cachedSubjects && isCacheValid) {
      setSubjects(JSON.parse(cachedSubjects));
      setLoading(false);
    } else {
      getSubjects()
        .then(data => {
          setSubjects(data);
          sessionStorage.setItem('subjects', JSON.stringify(data));
          sessionStorage.setItem('subjects_timestamp', Date.now().toString());
        })
        .catch(error => console.error("Failed to fetch subjects:", error))
        .finally(() => setLoading(false));
    }
  }, []);

  const setOpenWithFocus = (open: boolean) => {
    if (open) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
    return open;
  }

  const handleOpen = () => {
    setOpen(setOpenWithFocus(true))
  };

  const handleClose = () => setOpen(false);

  const handleSearch = (searchTerm: string) => {
    const trimmed = searchTerm.trim();
    if (!trimmed || lastSearchedRef.current === trimmed) return;
    lastSearchedRef.current = trimmed;
    trackSearch(trimmed);
    const encodedTerm = trimmed
      .split(/\s+/)
      .map(term => encodeURIComponent(term))
      .join('+');
    navigateTo(`/search?q=${encodedTerm}`);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    handleSearch(searchValue || inputValue);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        setOpen(prev => setOpenWithFocus(!prev));
      } else if (event.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const unsubscribe = onOpenSearch(() => setOpen(setOpenWithFocus(true)));

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      unsubscribe();
    };
  }, []);

  return <>
    <SearchButton
      isHomePage={isHomePage}
      sx={sx}
      onClick={handleOpen}
      aria-labelledby="app-search-label"
    >
      <SearchIcon color="primary" sx={{ fontSize: '1.125rem' }} />
      <SearchLabel id="app-search-label">
        {searchLabel || 'Search...'}
      </SearchLabel>
      {isDesktop && <Shortcut aria-hidden="true">
        {/* eslint-disable-next-line material-ui/no-hardcoded-labels */}
        {macOS ? '⌘' : 'Ctrl+'}K
      </Shortcut>}
    </SearchButton>

    {open && (
      <CustomModal
        open={open}
        onClose={handleClose}
      >
        <Stack
          divider={<Divider />}
          sx={{ width: '100$' }}
        >
          <form onSubmit={handleSubmit}>
            <Autocomplete
              freeSolo
              id="search-autocomplete"
              disableClearable
              options={subjects.map(subject => subject.name)}
              loading={loading}
              value={searchValue}
              inputValue={inputValue}
              onInputChange={(_event, newInputValue) => {
                setInputValue(newInputValue);
              }}
              onChange={(event, newValue) => {
                setSearchValue(newValue);
                // Perform search immediately when an item is selected from dropdown
                if (newValue) {
                  handleSearch(newValue);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.defaultPrevented) {
                  // This handles the case when user types something and presses Enter
                  // without selecting from dropdown
                  event.preventDefault();
                  handleSearch(inputValue);
                }
              }}
              renderInput={(params) => (
                <TextField
                  inputRef={searchInputRef}
                  {...params}
                  sx={{
                    borderRadius: 0,
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': {
                        border: 'none', // Remove the fieldset border
                      },
                    },
                  }}
                  placeholder="Enter a topic to begin"
                  slotProps={{
                    input: {
                      ...params.InputProps,
                      type: 'search',
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon sx={{ color: theme => theme.palette.text.disabled }} />
                        </InputAdornment>
                      ),
                    },
                  }} />
              )}
            />
          </form>
          {/* <Typography id="modal-modal-description" sx={{ margin: 2 }}>
              Duis mollis, est non commodo luctus, nisi erat porttitor ligula.
            </Typography> */}
        </Stack>
      </CustomModal>
    )}
  </>
}