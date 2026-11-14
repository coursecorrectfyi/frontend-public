'use client';

import { firebaseLogin } from '@/api/auth';
import { signInWithGoogle } from '@/lib/firebase';
import { trackUserSignIn } from '@/utils/analytics';
import { signIn } from 'next-auth/react';
import { useState } from 'react';

export function useFirebaseSignIn() {
  const [signingIn, setSigningIn] = useState(false);

  const signInWithFirebase = async () => {
    if (signingIn) return;
    setSigningIn(true);
    try {
      const idToken = await signInWithGoogle();
      const backendTokens = await firebaseLogin(idToken);
      await signIn('firebase-backend', {
        redirect: false,
        token: backendTokens.token,
        refreshToken: backendTokens.refreshToken,
        tokenExpires: String(backendTokens.tokenExpires),
        user: JSON.stringify(backendTokens.user),
      });
      trackUserSignIn('google');
    } catch (err) {
      console.error('Firebase sign-in failed:', err);
    } finally {
      setSigningIn(false);
    }
  };

  return { signInWithFirebase, signingIn };
}
