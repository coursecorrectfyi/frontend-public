'use client';

import { CurrentPage } from '@/api/chat';
import { trackEvent } from '@/utils/analytics';
import { useFirebaseSignIn } from '@/hooks/use-firebase-sign-in';
import KeyboardArrowRightRounded from '@mui/icons-material/KeyboardArrowRightRounded';
import { RestartAlt, Send as SendIcon } from '@mui/icons-material';
import { alpha, Box, Button, IconButton, Paper, Stack, TextField, Tooltip, Typography, useTheme } from '@mui/material';
import { useSession } from 'next-auth/react';
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

interface ChatProps {
  messages: ChatMessage[];
  defaultMessage?: ChatMessage;
  defaultPrompts?: string[];
  onSendMessage: (message: string, currentPage: CurrentPage, searchTerm?: string) => void;
  isTyping: boolean;
  resetChat: () => void;
  isLimitReached?: boolean;
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
  messageCount = 0,
  currentPage,
  searchTerm = "",
}: ChatProps) {
  const theme = useTheme();
  const { status } = useSession();
  const isAuthenticated = status === 'authenticated';
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

  const handleSend = () => {
    let trimmed = inputMessage.trim()
    if (!trimmed || isLimitReached) return;

    onSendMessage(trimmed, currentPage, searchTerm);
    setInputMessage('');
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

  const handlePromptClick = (prompt: string) => {
    if (isLimitReached) return;

    // Send the prompt as a user message
    onSendMessage(prompt, currentPage, searchTerm);
  };

  const isLongConversation = messageCount >= LONG_CONVERSATION_THRESHOLD;
  const { signInWithFirebase } = useFirebaseSignIn();

  return (
    <Paper
      elevation={0}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
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
                <MessageBubble
                  message={defaultMessage}
                  isNewResponse={false}
                />
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
          <Typography color="warning.main" variant="body2" align="center">
            {isAuthenticated
              ? "You've used your free questions for today. Come back tomorrow."
              : "You've used your free questions for today. Sign in for more, or come back tomorrow."}
          </Typography>
          {!isAuthenticated && (
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
            placeholder={isLimitReached ? "Reset chat to continue..." : "Type your message..."}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            size="small"
            multiline
            maxRows={4}
            disabled={isLimitReached}
            inputRef={inputRef}
          />
          <IconButton
            color="primary"
            onClick={handleSend}
            disabled={!inputMessage.trim() || isLimitReached}
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