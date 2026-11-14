import { alpha, Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography, useTheme } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface SafeMarkdownProps {
  content: string;
  className?: string;
}

export default function SafeMarkdown({ content, className }: SafeMarkdownProps) {
  const theme = useTheme();

  return (
    <Box className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <Typography variant="body1" color="text.primary">
              {children}
            </Typography>
          ),
          a: ({ href, children }) => (
            <Typography
              component="a"
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              color="primary"
              sx={{ textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
            >
              {children}
            </Typography>
          ),
          table: ({ children }) => (
            <TableContainer component={Paper} elevation={0} sx={{ my: 1 }}>
              <Table size="small">{children}</Table>
            </TableContainer>
          ),
          thead: ({ children }) => (
            <TableHead sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
              {children}
            </TableHead>
          ),
          tbody: ({ children }) => <TableBody>{children}</TableBody>,
          tr: ({ children }) => <TableRow>{children}</TableRow>,
          th: ({ children }) => (
            <TableCell sx={{ fontWeight: 'bold' }}>{children}</TableCell>
          ),
          td: ({ children }) => <TableCell>{children}</TableCell>,
        }}
      >
        {content}
      </ReactMarkdown>
    </Box>
  );
}