import React from 'react';
import { useStore } from '@nanostores/react';
import {
  Box,
  IconButton,
  Typography,
  Tooltip,
  useMediaQuery,
  useTheme,
  Paper,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import Brightness1Icon from '@mui/icons-material/Brightness1';

import { CarbonTerminal } from '@/components/icons/CarbonTerminal';
import {
  isTerminalVisible,
  setShowTerminal,
  disconnectTerminal,
} from '@/components/Terminal/stores/terminalStore';

interface TerminalToolbarProps {
  isConnected: boolean;
  currentPath: string;
  onConnect: () => void;
  onDisconnect: () => void;
  onSettings: () => void;
  onLogout: () => void;
  sx?: any;
}

const toolbarPaperSx = (theme: any) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: 0.6,
  backgroundColor: theme.palette.background.paper,
  color: theme.palette.text.primary,
  border: 0,
  borderBottom: `1px solid ${theme.palette.divider}`,
  borderRadius: 0,
  boxShadow: 0,
});

export const TerminalToolbar: React.FC<TerminalToolbarProps> = ({
  isConnected,
  currentPath,
  onConnect,
  onDisconnect,
  onSettings,
  onLogout,
  sx,
}) => {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const showTerminal = useStore(isTerminalVisible);

  /** ✅ Disconnect socket session first, then hide terminal */
  const handleCloseTerminal = () => {
    if (isConnected) {
      disconnectTerminal();
    }
    setShowTerminal(!showTerminal); // This toggles visibility, not necessarily closing the tab itself
  };

  return (
    <Paper
      sx={{ ...toolbarPaperSx(theme), ...sx }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Tooltip title="Close Terminal">
          <IconButton onClick={handleCloseTerminal} size="small">
            <CarbonTerminal fontSize={`1.2em`} />
          </IconButton>
        </Tooltip>
        <Typography variant="subtitle1" sx={{ marginRight: '16px' }}>
          Terminal
        </Typography>
      </Box>

      <Box>
        {!isSmallScreen && (
          <Tooltip title={isConnected ? 'Connected' : 'Disconnected'}>
            <IconButton
              onClick={handleCloseTerminal} // This action likely just hides the terminal in the UI context
              size="small"
              sx={{
                color: isConnected ? '#4caf50' : '#f44336',
                marginLeft: '8px',
              }}
            >
              <Brightness1Icon />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Paper>
  );
};
