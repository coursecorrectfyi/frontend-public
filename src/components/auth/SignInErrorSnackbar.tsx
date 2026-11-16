'use client';

import { Alert, Portal, Snackbar } from '@mui/material';

/** Shows why sign-in failed (`error` from useFirebaseSignIn), wherever sign-in was started. */
export default function SignInErrorSnackbar({ error, onClose }: { error: string | null; onClose: () => void }) {
  return (
    <Portal>
      <Snackbar
        open={!!error}
        autoHideDuration={8000}
        onClose={(_event, reason) => {
          if (reason !== 'clickaway') onClose();
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={onClose}>
          {error}
        </Alert>
      </Snackbar>
    </Portal>
  );
}
