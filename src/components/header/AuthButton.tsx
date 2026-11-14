'use client';

import { BookmarkBorder, Google, Logout } from '@mui/icons-material';
import { Avatar, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip } from '@mui/material';
import { signIn, signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useFirebaseSignIn } from '@/hooks/use-firebase-sign-in';
import { signOutFirebase } from '@/lib/firebase';

export default function AuthButton() {
  const { data: session } = useSession();
  const router = useRouter();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const { signInWithFirebase, signingIn } = useFirebaseSignIn();
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSavedCourses = () => {
    router.push('/saved-courses');
    handleClose();
  };


  const handleSignOut = async () => {
    const isFirebaseUser = session?.backendTokens?.user?.provider === 'firebase';
    if (isFirebaseUser) {
      try {
        await signOutFirebase();
      } catch (e) {
        console.error('Firebase signOut:', e);
      }
    }
    await signOut();
    handleClose();
  };

  if (!session) {
    return (
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
          src={session.user?.image ?? ''}
          alt={session.user?.name ?? ''}
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