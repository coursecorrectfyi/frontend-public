import { useFirebaseSignIn } from '@/hooks/use-firebase-sign-in';
import { useSavedCourses } from '@/hooks/use-saved-courses';
import BookmarkAddTwoTone from '@mui/icons-material/BookmarkAddTwoTone';
import BookmarkRemove from '@mui/icons-material/BookmarkRemove';
import { Alert, IconButton, Portal, Snackbar, Tooltip } from '@mui/material';
import { useMemo, useState } from 'react';
import { trackSaveCourse } from '@/utils/analytics';
import SignInErrorSnackbar from '../auth/SignInErrorSnackbar';

interface SaveCourseButtonProps {
  courseId: string;
  courseName: string; // Add courseName prop
  sx?: Record<string, any>;
}

export const SaveCourseButton = ({ courseId, courseName, sx }: SaveCourseButtonProps) => {
  const [error, setError] = useState<string | null>(null);
  const { signInWithFirebase, error: signInError, clearError: clearSignInError } = useFirebaseSignIn();

  const {
    savedItems,
    isAuthenticated,
    saveCourse,
    removeCourse,
    isMutating,
    canAddMoreCourses
  } = useSavedCourses({
    onError: (error) => {
      setError(error.message);
    },
  });

  const isSaved = useMemo(
    () => savedItems.some(r => r.id === courseId),
    [savedItems, courseId]
  );

  const handleSaveToggle = () => {
    if (!isAuthenticated) {
      signInWithFirebase();
      return;
    }

    if (isSaved) {
      removeCourse(courseId);
      trackSaveCourse(courseId, courseName, 'unsave');
    } else {
      saveCourse(courseId);
      trackSaveCourse(courseId, courseName, 'save');
    }
  };

  const handleCloseError = (event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setError(null);
  };

  const tooltipTitle = !isAuthenticated
    ? 'Sign in to save courses'
    : isSaved
      ? 'Remove from shortlist'
      : 'Add to shortlist';

  return (
    <>
      <Tooltip title={tooltipTitle}>
        <span>
          <IconButton
            onClick={handleSaveToggle}
            disabled={isMutating}
            aria-label={tooltipTitle}
            sx={(theme) => ({
              px: 0,
              color: theme.palette.primary.main,
              ...theme.applyStyles('dark', { color: theme.palette.primary[200] }),
              opacity: (isMutating || (!isSaved && !canAddMoreCourses)) ? 0.5 : 1,
              ...sx
            })}
            disableTouchRipple
          >
            {isSaved && isAuthenticated ? <BookmarkRemove /> : <BookmarkAddTwoTone />}
          </IconButton>
        </span>
      </Tooltip>

      <SignInErrorSnackbar error={signInError} onClose={clearSignInError} />
      <Portal>
        <Snackbar
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          open={!!error}
          autoHideDuration={4000}
          onClose={handleCloseError}
        >
          <Alert
            onClose={handleCloseError}
            severity="error"
            sx={{
              width: '100%',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            {error}
          </Alert>
        </Snackbar>
      </Portal>
    </>
  );
};

export default SaveCourseButton;