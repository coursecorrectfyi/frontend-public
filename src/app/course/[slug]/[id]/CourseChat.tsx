'use client';

import { CurrentPage } from "@/api/chat";
import Chat from "@/components/Chat";
import { useChatState } from "@/hooks/use-chat-state";

interface CourseChatProps {
  courseId?: string;
}

export default function CourseChat({ courseId }: CourseChatProps) {
  const DEFAULT_CHAT_MESSAGE = {
    id: '0',
    content: "Curious if this is the right fit for you? I can help break it down—just ask!",
    sender: 'bot' as const,
    timestamp: new Date()
  };

  const { messages, isTyping, handleSendMessage, resetChat, isLimitReached, messageCount } = useChatState({
    pageContextIds: courseId ? [courseId] : [],
    contextKey: `resource:${courseId ?? 'unknown'}`,
  });

  return (
    <Chat
      messages={messages}
      defaultMessage={DEFAULT_CHAT_MESSAGE}
      defaultPrompts={[
        'Is this right for someone with my background?',
        'How long will this realistically take?',
        'What could I do after completing this?',
      ]}
      onSendMessage={handleSendMessage}
      isTyping={isTyping}
      resetChat={resetChat}
      isLimitReached={isLimitReached}
      messageCount={messageCount}
      currentPage={CurrentPage.COURSE_DETAIL}
    />
  );
}
