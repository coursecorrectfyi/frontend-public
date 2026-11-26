'use client';

import TryRounded from '@mui/icons-material/TryRounded';
import { alpha, Box, Container, Fab, Paper, SwipeableDrawer, useMediaQuery, useTheme } from '@mui/material';
import { ReactNode, useRef, useState } from 'react';
import { ImperativePanelHandle, Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

/** Fixed ids for react-resizable-panels (see the comment on the PanelGroup below). */
export const SPLIT_VIEW_IDS = {
  group: 'split-view',
  left: 'split-view-left',
  handle: 'split-view-handle',
  right: 'split-view-right',
} as const;

interface SplitViewLayoutProps {
  leftContent: ReactNode;
  rightContent: ReactNode;
}

export default function SplitViewLayout({ leftContent, rightContent }: SplitViewLayoutProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [isChatOpen, setIsChatOpen] = useState(false);
  const panelGroupRef = useRef<ImperativePanelHandle[]>([]);
  const DEFAULT_SPLIT_RATIO = 50; // Default 50/50 split

  const handleChatClose = () => setIsChatOpen(false);
  const handleChatOpen = () => setIsChatOpen(true);

  // Handler for double-click on resize handle to restore default split
  const handleDoubleClick = () => {
    if (panelGroupRef.current.length >= 2) {
      panelGroupRef.current[0].resize(DEFAULT_SPLIT_RATIO);
      panelGroupRef.current[1].resize(DEFAULT_SPLIT_RATIO);
    }
  };

  return (
    <Container
      maxWidth="lg"
      sx={{
        display: "flex",
        flexDirection: "column",
        height: { xs: '100%', md: "calc(100vh - 60px)" },
        py: 2, gap: 2
      }}
    >
      <Box
        sx={{
          display: 'flex', gap: 1,
          flexDirection: { xs: 'column', md: 'row' },
          position: 'relative',
          height: '100%'
        }}
      >
        {/* Desktop View with Resizable Panels.
            Fixed ids (and `order`, which the library requires with them): otherwise react-resizable-panels uses
            React's useId, and if the browser computes a different id than the server rendered (any difference in
            the tree above), its effects can't find the group's element and throw "No group found for id", which
            crashes the page. There is only one split view per page, so fixed ids can't collide. */}
        {!isMobile && (
          <PanelGroup id={SPLIT_VIEW_IDS.group} direction="horizontal" style={{ width: '100%', height: '100%' }}>
            <Panel
              id={SPLIT_VIEW_IDS.left}
              order={1}
              defaultSize={DEFAULT_SPLIT_RATIO}
              minSize={40} // Minimum percentage of total width
              style={{ minWidth: '300px' }}
              ref={(ref) => {
                if (ref) panelGroupRef.current[0] = ref;
              }}
            >
              <Paper
                sx={{
                  width: '100%',
                  height: '100%',
                  overflow: 'hidden',
                  position: 'relative',
                  border: theme => `1px solid ${theme.palette.divider}`,
                }}
              >
                {leftContent}
              </Paper>
            </Panel>

            <PanelResizeHandle id={SPLIT_VIEW_IDS.handle} onDoubleClick={handleDoubleClick}>
              <Box
                sx={{
                  width: '6px',
                  height: '95%',
                  backgroundColor: theme.palette.divider,
                  cursor: 'col-resize',
                  transition: 'background-color 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '4px',
                  margin: 'auto',
                  position: 'relative',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.primary.main, 0.4),
                  },
                  '&::after': {
                    content: '""',
                    width: '6px',
                    height: '50px',
                    backgroundColor: theme.palette.background.paper,
                    borderRadius: '2px',
                  }
                }}
              />
            </PanelResizeHandle>

            <Panel
              id={SPLIT_VIEW_IDS.right}
              order={2}
              defaultSize={DEFAULT_SPLIT_RATIO}
              minSize={40} // Minimum percentage of total width
              style={{ minWidth: '300px' }}
              ref={(ref) => {
                if (ref) panelGroupRef.current[1] = ref;
              }}
            >
              <Paper
                sx={{
                  width: '100%',
                  height: '100%',
                  overflow: 'auto',
                  position: 'relative',
                  border: theme => `1px solid ${theme.palette.divider}`,
                }}
              >
                {rightContent}
              </Paper>
            </Panel>
          </PanelGroup>
        )}

        {/* Mobile View (unchanged) */}
        {isMobile && (
          <>
            <Box
              sx={{
                display: 'flex',
                flex: 1,
                height: '100%'
              }}
            >
              <Paper
                sx={{
                  width: '100%',
                  overflow: 'auto',
                  position: 'relative',
                }}
              >
                {rightContent}
              </Paper>
            </Box>

            <Box
              sx={{
                display: { xs: 'block', md: 'none' },
                position: 'fixed',
                bottom: 16, right: 16,
                zIndex: 1000
              }}
            >
              <Fab
                color="primary"
                aria-label="chat"
                onClick={() => setIsChatOpen(!isChatOpen)}
              >
                <TryRounded />
              </Fab>
            </Box>

            <SwipeableDrawer
              anchor="bottom"
              open={isChatOpen}
              onClose={handleChatClose}
              onOpen={handleChatOpen}
              sx={{
                display: { xs: 'block', md: 'none' },
                '& .MuiDrawer-paper': {
                  height: '80vh',
                  borderTopLeftRadius: 16,
                  borderTopRightRadius: 16
                }
              }}
            >
              {leftContent}
            </SwipeableDrawer>
          </>
        )}
      </Box>
    </Container>
  );
}