'use client';

import { Box } from '@mui/material';
import { useTypewriter } from 'react-simple-typewriter';
import SafeMarkdown from './SafeMarkdown';
import { useEffect, useMemo, useRef } from 'react';

interface TypewriterMarkdownProps {
  content: string;
  className?: string;
}

export default function TypewriterMarkdown({
  content,
  className
}: TypewriterMarkdownProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate adaptive typing speed based on content length
  const adaptiveTypeSpeed = useMemo(() => {
    const contentLength = content.length;

    // For very short messages (< 100 chars), use medium speed
    if (contentLength < 100) return 10;

    // For medium messages (100-500 chars), use faster speed
    if (contentLength < 500) return 7;

    // For long messages (500-1000 chars), use even faster speed
    if (contentLength < 1000) return 4;

    // For very long messages (> 1000 chars), use fastest speed
    return 2;
  }, [content]);

  const [typewriterText, helper] = useTypewriter({
    words: [content],
    loop: 1,
    typeSpeed: adaptiveTypeSpeed,
    deleteSpeed: Infinity, // Never delete the text
  });

  // Scroll into view when text changes during typing
  useEffect(() => {
    if (typewriterText.length > 0 && containerRef.current) {
      // Only scroll if we're still typing
      if (!helper.isDone) {
        containerRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest' // Only scroll if needed
        });
      }
    }
  }, [typewriterText, helper.isDone]);

  // For new responses, apply the typewriter effect
  return (
    <Box
      ref={containerRef}
      className={className}
    >
      <SafeMarkdown content={typewriterText} />
    </Box>
  );
}
