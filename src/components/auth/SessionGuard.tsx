'use client';

import { signOutFirebase } from '@/lib/firebase';
import { Alert, Snackbar } from '@mui/material';
import { signOut, useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

export const SESSION_ENDED_MESSAGE = 'Your session has ended. Sign in again to use your saved items.';

/**
 * Ends a NextAuth session whose backend tokens are gone: the backend rejected the refresh token (it lasts 7 days),
 * so nothing signed-in can work any more. Without this, the app would look signed in while every call failed.
 * Rendered once, in the app providers.
 */
export default function SessionGuard() {
  const { data, status } = useSession();
  const ended = status === 'authenticated' && !data?.backendTokens;
  const [notify, setNotify] = useState(false);

  useEffect(() => {
    if (!ended) return;
    setNotify(true);
    signOutFirebase().catch(() => {}); // best effort: the Firebase session is not used for anything else
    void signOut({ redirect: false });
  }, [ended]);

  return (
    <Snackbar open={notify} autoHideDuration={8000} onClose={() => setNotify(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
      <Alert severity="info" onClose={() => setNotify(false)}>
        {SESSION_ENDED_MESSAGE}
      </Alert>
    </Snackbar>
  );
}
