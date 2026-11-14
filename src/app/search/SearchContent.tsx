'use client';

import { CurrentPage } from '@/api/chat';
import Chat from '@/components/Chat';
import ResourceList from '@/components/resource/ResourceList';
import { useChatState } from '@/hooks/use-chat-state';
import { useSearchResources } from '@/hooks/use-search-resources';
import SplitViewLayout from '@/layouts/SplitViewLayout';
import type { ResourceFilters } from '@/types/resource';
import { useSearchParams } from 'next/navigation';
import { useCallback, useState } from 'react';

export default function SearchContent() {
  const searchQuery = useSearchParams()?.get('q') ?? '';

  // Filters are owned here; ResourceList calls back when they change.
  // filtersReady stays false until ResourceList fires its initial onFiltersChange,
  // preventing a wasted request with empty filters before defaults are applied.
  const [filters, setFilters] = useState<ResourceFilters>({});
  const [filtersReady, setFiltersReady] = useState(false);

  const queryResult = useSearchResources(searchQuery, filters, filtersReady);

  // Collect resource IDs for Cora context (first page only is enough)
  const firstPageResults = queryResult.data?.pages[0]?.data ?? [];
  const hasResults = firstPageResults.length > 0;
  const resourceIds = firstPageResults.map((r: { id: string }) => r.id);

  const {
    messages, isTyping, handleSendMessage, resetChat,
    isLimitReached, messageCount,
  } = useChatState({ pageContextIds: resourceIds, contextKey: `search:${searchQuery.toLowerCase()}` });

  const DEFAULT_CHAT_MESSAGE = {
    id: '0',
    content: hasResults
      ? `You've got results for "${searchQuery}". Want me to help you pick the one that fits you best?`
      : `I couldn't find resources for "${searchQuery}" either. Try rephrasing, or ask me — I can suggest alternatives from our catalogue.`,
    sender: 'bot' as const,
    timestamp: new Date(),
  };

  const chatComponent = (
    <Chat
      messages={messages}
      defaultMessage={DEFAULT_CHAT_MESSAGE}
      defaultPrompts={['Help me choose', "I'm a complete beginner — where do I start?", 'What jobs do these skills lead to?']}
      onSendMessage={handleSendMessage}
      isTyping={isTyping}
      resetChat={resetChat}
      isLimitReached={isLimitReached}
      messageCount={messageCount}
      currentPage={CurrentPage.SEARCH_RESULT}
      searchTerm={searchQuery}
    />
  );

  const handleFiltersChange = useCallback((newFilters: ResourceFilters) => {
    setFilters(newFilters);
    setFiltersReady(true);
  }, []);

  return (
    <SplitViewLayout
      leftContent={chatComponent}
      rightContent={
        <ResourceList
          query={searchQuery}
          titleSecondary="Results for"
          onFiltersChange={handleFiltersChange}
          queryResult={queryResult}
          trackSearchOutcome
        />
      }
    />
  );
}
