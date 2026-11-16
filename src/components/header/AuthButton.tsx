'use client';

import BookmarkBorder from '@mui/icons-material/BookmarkBorder';
import Google from '@mui/icons-material/Google';
import Logout from '@mui/icons-material/Logout';
import { Avatar, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip } from '@mui/material';
import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import SignInErrorSnackbar from '@/components/auth/SignInErrorSnackbar';
import { useAuth } from '@/hooks/use-auth';
import { useFirebaseSignIn } from '@/hooks/use-firebase-sign-in';
import { signOutFirebase } from '@/lib/firebase';

export default function AuthButton() {
  const { data: session } = useSession();
  const { isSignedIn } = useAuth();
  const router = useRouter();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const { signInWithFirebase, signingIn, error: signInError, clearError } = useFirebaseSignIn();
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSavedCourses = () => {
    router.push('/saved');
    handleClose();
  };


  const handleSignOut = async () => {
    // Every session starts with a Firebase sign-in (user.provider is the sign-in method, e.g. "google", not
    // "firebase"), so always end the Firebase session too.
    try {
      await signOutFirebase();
    } catch (e) {
      console.error('Firebase signOut:', e);
    }
    await signOut();
    handleClose();
  };

  if (!isSignedIn) {
    return (
      <>
        <SignInErrorSnackbar error={signInError} onClose={clearError} />
        <Tooltip title={signingIn ? 'Signing in…' : 'Sign In'}>
          <span>
            <IconButton
              color='primary'
              onClick={signInWithFirebase}
              size="small"
              disableTouchRipple
              disabled={signingIn}
            >
              <Google />
            </IconButton>
          </span>
        </Tooltip>
      </>
    );
  }

  return (
    <>
      <IconButton
        onClick={handleClick}
        size="small"
        aria-controls={open ? 'account-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
      >
        <Avatar
          src={session?.user?.image ?? ''}
          alt={session?.user?.name ?? ''}
          sx={{ width: 24, height: 24 }}
        />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        id="account-menu"
        open={open}
        onClose={handleClose}
        onClick={handleClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={handleSavedCourses}>
          <ListItemIcon>
            <BookmarkBorder fontSize="small" />
          </ListItemIcon>
          <ListItemText>Saved Items</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleSignOut}>
          <ListItemIcon>
            <Logout fontSize="small" />
          </ListItemIcon>
          <ListItemText>Logout</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}