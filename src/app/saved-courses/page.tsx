'use client';

import { CurrentPage } from "@/api/chat";
import Chat from "@/components/Chat";
import ResourceCard from "@/components/resource/ResourceCard";
import { useChatState } from "@/hooks/use-chat-state";
import { useSavedCourses } from "@/hooks/use-saved-courses";
import MainLayout from "@/layouts/MainLayout";
import SplitViewLayout from "@/layouts/SplitViewLayout";
import { useFirebaseSignIn } from "@/hooks/use-firebase-sign-in";
import { openSearch } from "@/utils/search-events";
import SignInErrorSnackbar from "@/components/auth/SignInErrorSnackbar";
import QueryErrorAlert from "@/components/QueryErrorAlert";
import { Box, Button, Skeleton, Stack, Typography } from "@mui/material";

export default function SavedCourses() {
  const { savedItems, isLoading, error, refetch, isAuthenticated, authStatus } = useSavedCourses();
  const { signInWithFirebase, error: signInError, clearError } = useFirebaseSignIn();

  const DEFAULT_CHAT_MESSAGE = {
    id: '0',
    content: "Looking at a few different directions? I can help you compare them or recommend which ones to prioritize first.",
    sender: 'bot' as const,
    timestamp: new Date()
  };

  const { messages, isTyping, handleSendMessage, resetChat, isLimitReached, limit, notice, dismissNotice, messageCount } = useChatState({
    pageContextIds: savedItems.map(r => r.id),
    contextKey: 'saved',
  });

  const renderContent = () => {
    // Session still resolving, or items loading: skeletons rather than a flash of the sign-in prompt (B6)
    if (authStatus === 'loading' || isLoading) {
      return (
        <Box display="flex" flexDirection="column" p={2} gap={2}>
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} variant="rounded" width="100%" height={160} />
          ))}
        </Box>
      );
    }

    if (!isAuthenticated) {
      return (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom>Sign in to save resources</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Save resources across devices and let Cora help you compare them.
          </Typography>
          <Button variant="contained" onClick={signInWithFirebase}>
            Sign in with Google
          </Button>
          <SignInErrorSnackbar error={signInError} onClose={clearError} />
        </Box>
      );
    }

    if (error) {
      // The API client's messages are already written for users (e.g. "Your session has expired…").
      return (
        <Box p={3}>
          <QueryErrorAlert error={error} fallback={error instanceof Error ? error.message : 'Something went wrong.'} onRetry={() => void refetch()} />
        </Box>
      );
    }

    if (savedItems.length === 0) {
      return (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom>Nothing saved yet.</Typography>
          <Button variant="outlined" onClick={openSearch}>
            Browse resources →
          </Button>
        </Box>
      );
    }

    return (
      <Box sx={{ flex: 1, overflow: 'auto', px: 2, pb: 2 }}>
        <Stack spacing={1.5}>
          {savedItems.map((r, index) => <ResourceCard key={r.id} resource={r} position={index + 1} enrollSource="saved_courses" clickSource="saved_courses" />)}
        </Stack>
      </Box>
    );
  };

  return (
    <MainLayout>
      <SplitViewLayout
        leftContent={
          <Chat
            messages={messages}
            defaultMessage={DEFAULT_CHAT_MESSAGE}
            onSendMessage={handleSendMessage}
            isTyping={isTyping}
            resetChat={resetChat}
            defaultPrompts={['Compare these and recommend one to start', 'Am I missing anything important?', 'What order should I do these in?']}
            isLimitReached={isLimitReached}
            limit={limit}
            notice={notice}
            onDismissNotice={dismissNotice}
            messageCount={messageCount}
            currentPage={CurrentPage.SAVED_COURSES}
          />
        }
        rightContent={
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography variant="h6" color="text.secondary" sx={{ fontSize: '1.1rem' }}>
                Your{' '}
                <Typography component="span" variant="h6" color="text.primary" sx={{ fontSize: '1.1rem' }}>
                  saved items
                </Typography>
              </Typography>
            </Box>
            {renderContent()}
          </Box>
        }
      />
    </MainLayout>
  );
}
