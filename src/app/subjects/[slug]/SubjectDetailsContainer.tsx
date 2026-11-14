'use client';

import { CurrentPage } from '@/api/chat';
import Chat from '@/components/Chat';
import ResourceList from '@/components/resource/ResourceList';
import { useChatState } from '@/hooks/use-chat-state';
import { useGetSubject } from '@/hooks/use-get-subject';
import { useSearchResources } from '@/hooks/use-search-resources';
import SplitViewLayout from '@/layouts/SplitViewLayout';
import type { ResourceFilters } from '@/types/resource';
import {
  Alert, Box, Breadcrumbs, Chip, Divider, Link,
  Skeleton, Stack, Typography,
} from '@mui/material';
import { useCallback, useState } from 'react';

interface SubjectDetailsContainerProps {
  slug: string;
}

export default function SubjectDetailsContainer({ slug }: SubjectDetailsContainerProps) {
  const { data: subject, isLoading: subjectLoading, error: subjectError } = useGetSubject(slug);

  // Derive search query from slug immediately — don't wait for the topic to load.
  // Once the topic loads we use the canonical name, which is usually the same.
  const searchQuery = subject?.topic.name ?? slug.replace(/-/g, ' ');

  const [filters, setFilters] = useState<ResourceFilters>({});
  const [filtersReady, setFiltersReady] = useState(false);

  const queryResult = useSearchResources(searchQuery, filters, filtersReady);

  const handleFiltersChange = useCallback((newFilters: ResourceFilters) => {
    setFilters(newFilters);
    setFiltersReady(true);
  }, []);

  const resourceIds = queryResult.data?.pages[0]?.data.map(r => r.id) ?? [];
  const { messages, isTyping, handleSendMessage, resetChat, isLimitReached, messageCount } =
    useChatState({ pageContextIds: resourceIds, contextKey: `subject:${slug}` });

  const topic = subject?.topic;
  const subtopics = subject?.subtopics;
  const parent = subject?.parent;

  const coraMessage = {
    id: '0',
    content: topic
      ? `You're exploring ${topic.name}. Want help finding the right course for your level and goals?`
      : `Looking for courses? I can help you find the right fit.`,
    sender: 'bot' as const,
    timestamp: new Date(),
  };

  // ── Header section (breadcrumb + title + description + subtopics) ──────────

  const renderHeader = () => {
    if (subjectError) {
      return (
        <Box sx={{ p: 2 }}>
          <Alert severity="error">Failed to load subject details.</Alert>
        </Box>
      );
    }

    if (subjectLoading) {
      return (
        <Box sx={{ p: 2 }}>
          <Skeleton variant="text" width="30%" sx={{ mb: 0.5 }} />
          <Skeleton variant="text" width="50%" height={36} sx={{ mb: 0.5 }} />
          <Skeleton variant="text" width="90%" />
          <Skeleton variant="text" width="75%" sx={{ mb: 1.5 }} />
          <Stack direction="row" spacing={1}>
            {[1, 2, 3, 4].map(i => <Skeleton key={i} variant="rounded" width={90} height={24} />)}
          </Stack>
        </Box>
      );
    }

    if (!topic) return null;

    return (
      <Box sx={{ px: 2, pt: 1.5, pb: 1.5 }}>
        {/* Breadcrumb — subtopic pages only */}
        {parent && (
          <Breadcrumbs sx={{ mb: 1, fontSize: '0.8rem' }}>
            <Link href="/subjects" color="inherit" underline="hover">Subjects</Link>
            <Link href={`/subjects/${parent.slug}`} color="inherit" underline="hover">
              {parent.name}
            </Link>
            <Typography fontSize="0.8rem" color="text.primary">{topic.name}</Typography>
          </Breadcrumbs>
        )}

        {/* Title + description */}
        <Typography variant="h5" component="h1" gutterBottom>
          {topic.name}
        </Typography>
        {topic.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {topic.description}
          </Typography>
        )}

        {/* Subtopics — domain pages only */}
        {subtopics && subtopics.length > 0 && (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
              Explore within {topic.name}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {subtopics.map(st => (
                <Chip
                  key={st.id}
                  label={st.name}
                  size="small"
                  component="a"
                  href={`/subjects/${st.slug}`}
                  clickable
                />
              ))}
            </Box>
          </Box>
        )}
      </Box>
    );
  };

  // ── Layout ─────────────────────────────────────────────────────────────────

  const rightContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Sticky topic header */}
      <Box sx={{ flexShrink: 0 }}>
        {renderHeader()}
        <Divider />
      </Box>

      {/* Course list — fills remaining height, scrolls internally */}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        <ResourceList
          query={searchQuery}
          titleSecondary="Courses in"
          onFiltersChange={handleFiltersChange}
          queryResult={queryResult}
          clickSource="subject_page"
          enrollSource="subject_page"
        />
      </Box>
    </Box>
  );

  return (
    <SplitViewLayout
      leftContent={
        <Chat
          messages={messages}
          defaultMessage={coraMessage}
          defaultPrompts={['Help me choose', "I'm a complete beginner — where do I start?", 'What jobs do these skills lead to?']}
          onSendMessage={handleSendMessage}
          isTyping={isTyping}
          resetChat={resetChat}
          isLimitReached={isLimitReached}
          messageCount={messageCount}
          currentPage={CurrentPage.SUBJECT_PAGE}
          searchTerm={topic?.name ?? searchQuery}
        />
      }
      rightContent={rightContent}
    />
  );
}
