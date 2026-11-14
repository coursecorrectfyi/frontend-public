import { Box, Typography } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';

/**
 * @warning SECURITY RISK - Only use this component for trusted content!
 * This component renders markdown content and allows raw HTML tags through rehype-raw.
 * It should only be used for content from trusted sources (e.g., your own backend)
 * as it could lead to XSS attacks if used with user-generated content.
 * 
 * For user-generated content, use SafeMarkdown instead.
 * 
 * @example Safe Usage
 * ```tsx
 * // Content from your trusted API/backend
 * <UnsafeMarkdown content={course.details.overview} />
 * ```
 * 
 * @example Unsafe Usage - DO NOT DO THIS
 * ```tsx
 * // DON'T use with user comments or other untrusted content
 * <UnsafeMarkdown content={userComment.content} /> // Security risk!
 * ```
 * 
 * @see SafeMarkdown - Use this for user-generated content
 */
interface UnsafeMarkdownProps {
  /** 
   * The markdown content to render. 
   * @warning Must be from a trusted source as HTML tags will be rendered!
   */
  content: string;

  /** Optional class name for styling */
  className?: string;
}

/**
 * Renders markdown content with HTML support using rehype-raw.
 * @warning Only use this component for trusted content from the backend!
 */
export default function UnsafeMarkdown({ content, className }: UnsafeMarkdownProps) {
  // Replace all newlines with <br> tags
  const processedContent = content.replace(/\n/g, '<br>');

  return (
    <Box className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          p: ({ children }) => (
            <Typography variant="body1" color="text.primary">
              {children}
            </Typography>
          ),
          ul: ({ children }) => (
            <Box
              component="ul"
              sx={{
                marginLeft: 1,
                '& li': {
                  marginBottom: 1,
                },
                '& ul': {
                  marginTop: 1,
                  marginBottom: 2,
                },
              }}
            >
              {children}
            </Box>
          ),
          li: ({ children }) => (
            <Box component="li">
              {children}
            </Box>
          ),
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </Box>
  );
}