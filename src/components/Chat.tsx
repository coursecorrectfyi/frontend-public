'use client';

import { CurrentPage, MAX_MESSAGE_LENGTH } from '@/api/chat';
import { type ChatLimit, type ChatNotice, GUEST_SCOPES, type SendOutcome } from '@/hooks/use-chat-state';
import { trackEvent } from '@/utils/analytics';
import { useFirebaseSignIn } from '@/hooks/use-firebase-sign-in';
import KeyboardArrowRightRounded from '@mui/icons-material/KeyboardArrowRightRounded';
import RestartAlt from '@mui/icons-material/RestartAlt';
import SendIcon from '@mui/icons-material/Send';
import { Alert, alpha, Box, Button, IconButton, Paper, Stack, TextField, Tooltip, Typography, useTheme } from '@mui/material';
import { useAuth } from '@/hooks/use-auth';
import SignInErrorSnackbar from './auth/SignInErrorSnackbar';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import SafeMarkdown from './SafeMarkdown';

interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  isStreaming?: boolean;
}

const MessageBubble = ({ message }: { message: ChatMessage }) => {
  const theme = useTheme();
  const isBot = message.sender === 'bot';

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: isBot ? 'center' : 'flex-end',
        mb: 1.5,
        width: '100%',
      }}
    >
      <Paper
        elevation={0}
        sx={{
          maxWidth: isBot ? '100%' : '80%',
          p: 2,
          backgroundColor: isBot
            ? 'transparent'
            : `${alpha(theme.palette.primary.main, 0.1)} !important`,
          borderRadius: isBot ? 0 : 1,
          border: 'none',
        }}
      >
        {/* While streaming, render as plain text to avoid broken markdown mid-stream.
            Once done, switch to SafeMarkdown for full formatting. */}
        {message.isStreaming ? (
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
            {message.content}
            <Box component="span" sx={{ display: 'inline-block', width: 8, height: '1em', bgcolor: 'text.primary', ml: 0.5, verticalAlign: 'text-bottom', animation: 'blink 1s step-end infinite', '@keyframes blink': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0 } } }} />
          </Typography>
        ) : (
          <SafeMarkdown content={message.content} />
        )}
      </Paper>
    </Box>
  );
};

const LONG_CONVERSATION_THRESHOLD = 15;

/** Banner text when no backend message is available. */
export const DEFAULT_LIMIT_TEXT = "You've reached today's limit for questions.";

/** "You can ask again in n seconds." until `retryAt`, then nothing. */
function RetryCountdown({ retryAt }: { retryAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.ceil((retryAt - now) / 1000));
  if (seconds === 0) return null;
  return <> You can ask again in {seconds} second{seconds === 1 ? '' : 's'}.</>;
}

/** Show "n / 4,000" under the input from this many characters on. */
export const LENGTH_COUNTER_FROM = MAX_MESSAGE_LENGTH - 400;

/**
 * Counter under the input, and what to do when the message is too long. A long message (e.g. a paste) is never cut:
 * a cut-off question would be sent without the user noticing. It stays whole and can't be sent until shortened.
 */
export function lengthHint(length: number): string | undefined {
  if (length < LENGTH_COUNTER_FROM) return undefined;
  const counter = `${length.toLocaleString('en-US')} / ${MAX_MESSAGE_LENGTH.toLocaleString('en-US')}`;
  if (length <= MAX_MESSAGE_LENGTH) return counter;
  const over = length - MAX_MESSAGE_LENGTH;
  return `${counter}: too long to send. Remove ${over.toLocaleString('en-US')} character${over === 1 ? '' : 's'}.`;
}

interface ChatProps {
  messages: ChatMessage[];
  defaultMessage?: ChatMessage;
  defaultPrompts?: string[];
  /** May return what happened; a question that was `not_sent` is put back into the input. */
  onSendMessage: (message: string, currentPage: CurrentPage, searchTerm?: string) => void | Promise<SendOutcome | void>;
  isTyping: boolean;
  resetChat: () => void;
  isLimitReached?: boolean;
  /** The daily limit that was hit: its message is shown in the banner, its scope decides whether to offer sign-in. */
  limit?: ChatLimit | null;
  /** Why the last question could not be sent (rate limit, chat switched off, failure). */
  notice?: ChatNotice | null;
  onDismissNotice?: () => void;
  messageCount?: number;
  currentPage: CurrentPage;
  searchTerm?: string;
}

export default function Chat({
  messages,
  defaultMessage,
  defaultPrompts = [],
  onSendMessage,
  isTyping,
  resetChat,
  isLimitReached,
  limit,
  notice,
  onDismissNotice,
  messageCount = 0,
  currentPage,
  searchTerm = "",
}: ChatProps) {
  const theme = useTheme();
  const { isSignedIn: isAuthenticated } = useAuth();
  const router = useRouter();
  const [inputMessage, setInputMessage] = useState('');
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom when user sends a message or resets chat
  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  // Scroll to bottom when user sends a message
  useEffect(() => {
    // Only scroll to bottom when the last message is from the user
    if (messages.length > 0 && messages[messages.length - 1].sender === 'user') {
      scrollToBottom();
    }
  }, [messages]);

  // Scroll to bottom when typing indicator appears/disappears
  useEffect(() => {
    if (isTyping) {
      scrollToBottom();
    }
  }, [isTyping]);

  // Measured like the backend: surrounding whitespace doesn't count (docs/backend-api.md → chat `message`).
  const messageLength = inputMessage.trim().length;
  const isTooLong = messageLength > MAX_MESSAGE_LENGTH;

  // While rate limited, nothing can be sent until the wait is over (the hook clears the notice then).
  const isCoolingDown = notice?.kind === 'rate_limited';

  /**
   * A question that got no answer goes back into the input, so it can be sent again or copied. If something
   * new was typed meanwhile, the question goes first: nothing is lost.
   */
  const giveBack = (outcome: SendOutcome | void) => {
    if (!outcome || outcome.status !== 'not_sent') return;
    setInputMessage(current => (current.trim() ? `${outcome.message}\n\n${current}` : outcome.message));
  };

  const handleSend = async () => {
    const trimmed = inputMessage.trim()
    if (!trimmed || isLimitReached || isCoolingDown || trimmed.length > MAX_MESSAGE_LENGTH) return;

    setInputMessage('');
    giveBack(await onSendMessage(trimmed, currentPage, searchTerm));
  };

  const handleReset = () => {
    if (typeof window !== 'undefined' && window.confirm('Are you sure you want to reset this chat? All messages will be deleted.')) {
      resetChat();
      setInputMessage('');
      // Focus the input field after reset
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 100);
    }
  };

  const handlePromptClick = async (prompt: string) => {
    if (isLimitReached || isCoolingDown) return;

    // Send the prompt as a user message
    giveBack(await onSendMessage(prompt, currentPage, searchTerm));
  };

  const isLongConversation = messageCount >= LONG_CONVERSATION_THRESHOLD;
  const { signInWithFirebase, error: signInError, clearError: clearSignInError } = useFirebaseSignIn();

  return (
    <Paper
      elevation={0}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <SignInErrorSnackbar error={signInError} onClose={clearSignInError} />
      {/* Messages Container */}
      <Box
        ref={chatContainerRef}
        sx={{
          flex: 1,
          overflowY: 'auto',
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 'calc(100vh - 120px)', // Set a max height to ensure scrolling works
        }}
      >
        <Stack spacing={1}>
          {messages.length > 0 ? (
            messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
              />
            ))
          ) : (
            <>
              {defaultMessage && (
                <MessageBubble message={defaultMessage} />
              )}

              {/* Quick Prompts - only show when no messages and we have prompts */}
              {defaultPrompts && defaultPrompts.length > 0 && (
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    mt: 2,
                    gap: 1
                  }}
                >
                  {defaultPrompts.map((prompt, index) => (
                    <Button
                      key={index}
                      variant="outlined"
                      color="primary"
                      size="medium"
                      onClick={() => handlePromptClick(prompt)}
                      sx={{
                        borderRadius: 4,
                        px: 3,
                        py: 1,
                        textTransform: 'none',
                        fontWeight: 'normal',
                        backgroundColor: alpha(theme.palette.primary.main, 0.05),
                        '&:hover': {
                          backgroundColor: alpha(theme.palette.primary.main, 0.1),
                        },
                        boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.1)',
                        minWidth: '200px',
                        maxWidth: '80%',
                      }}
                    >
                      {prompt}
                    </Button>
                  ))}

                  {/* Learning Path CTA - navigates to early access page */}
                  <Button
                    variant="text"
                    color="primary"
                    size="medium"
                    endIcon={<KeyboardArrowRightRounded />}
                    onClick={() => {
                      trackEvent('learning_path_cta_click', { source: 'chat' });
                      router.push('/get-learning-path');
                    }}
                    sx={{
                      borderRadius: 4,
                      px: 2,
                      py: 0.75,
                      mt: 0.5,
                      textTransform: 'none',
                      fontWeight: 'normal',
                      fontSize: '0.875rem',
                      '&:hover': {
                        backgroundColor: alpha(theme.palette.primary.main, 0.08),
                      },
                    }}
                  >
                    Help me plan my learning
                  </Button>
                </Box>
              )}
            </>
          )}

          {isTyping && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ fontStyle: 'italic', ml: 2 }}
            >
              Cora is typing...
            </Typography>
          )}
        </Stack>
      </Box>

      {/* Daily limit reached */}
      {isLimitReached && (
        <Box
          sx={{
            p: 2,
            bgcolor: alpha(theme.palette.warning.main, 0.1),
            borderTop: 1,
            borderColor: theme.palette.warning.main,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1,
          }}
        >
          {/* The backend's own message: it says which limit was hit (yours, your network's, everyone's) (C1). */}
          <Typography color="warning.main" variant="body2" align="center">
            {limit?.message ?? DEFAULT_LIMIT_TEXT}
          </Typography>
          {!isAuthenticated && (!limit?.scope || GUEST_SCOPES.includes(limit.scope)) && (
            <Button
              variant="outlined"
              size="small"
              color="warning"
              onClick={signInWithFirebase}
            >
              Sign in with Google
            </Button>
          )}
        </Box>
      )}

      {/* Why the last question wasn't sent (it is back in the input) */}
      {notice && (
        <Alert
          severity={notice.kind === 'failed' ? 'error' : 'warning'}
          onClose={onDismissNotice}
          sx={{ mx: 2, mb: 1 }}
        >
          {notice.message}
          {notice.kind === 'rate_limited' && <RetryCountdown retryAt={notice.retryAt} />}
          {notice.kind === 'unavailable' && notice.signIn && (
            <Box sx={{ mt: 1 }}>
              <Button variant="outlined" size="small" color="warning" onClick={signInWithFirebase}>
                Sign in with Google
              </Button>
            </Box>
          )}
          {/* A daily limit that doesn't lock (network, everyone's totals): trying again costs nothing. */}
          {notice.kind === 'daily_limit' && (
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              {notice.signIn && !isAuthenticated && (
                <Button variant="outlined" size="small" color="warning" onClick={signInWithFirebase}>
                  Sign in with Google
                </Button>
              )}
              {inputMessage.trim() && (
                <Button variant="text" size="small" color="warning" onClick={() => void handleSend()}>
                  Try again
                </Button>
              )}
            </Stack>
          )}
        </Alert>
      )}

      {/* Long conversation nudge */}
      {isLongConversation && !isLimitReached && (
        <Box
          sx={{
            p: 1,
            bgcolor: alpha(theme.palette.info.main, 0.05),
            borderTop: 1,
            borderColor: 'divider',
          }}
        >
          <Typography color="text.secondary" variant="caption" align="center" display="block">
            Long conversation? Starting fresh may give better results.
          </Typography>
        </Box>
      )}

      {/* Input Area */}
      <Box
        sx={{
          p: 2,
          borderTop: isLongConversation || isLimitReached ? 0 : 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder={isLimitReached ? "Daily question limit reached" : "Type your message..."}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            size="small"
            multiline
            maxRows={4}
            inputRef={inputRef}
            error={isTooLong}
            helperText={lengthHint(messageLength)}
            // Read-only, not disabled, when locked: a question given back can still be selected and copied.
            slotProps={{ htmlInput: { readOnly: isLimitReached } }}
          />
          <IconButton
            color="primary"
            onClick={handleSend}
            disabled={!inputMessage.trim() || isLimitReached || isTooLong || isCoolingDown}
            sx={{
              alignSelf: 'flex-end',
              '&:hover': {
                color: theme.palette.primary.main,
                bgcolor: alpha(theme.palette.primary.main, 0.1),
              },
            }}
          >
            <SendIcon />
          </IconButton>
          <Tooltip title="New chat">
            <IconButton
              color='primary'
              onClick={handleReset}
              disabled={messages.length < 2}
              sx={{
                alignSelf: 'flex-end',
                '&:hover': {
                  color: theme.palette.primary.main,
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                },
              }}
            >
              <RestartAlt />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Paper>
  );
}