import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  TextField,
  Button,
  Box,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { createSocketClient } from '@/services/socketClientFactory'; // NEW: Use factory for isolated socket
import { appendOutput } from '@/components/Terminal/stores/terminalStore';
import stripAnsi from 'strip-ansi';
import { useStore } from '@nanostores/react';
import { themeStore } from '@/stores/themeStore';
import { getToken } from '@/stores/authStore'; // Needed for direct connection in dialog

interface TerminalDialogProps {
  open: boolean;
  initialCwd?: string;
  onClose: () => void;
}

// Create a unique socket client instance specifically for this dialog.
// This ensures the dialog's connection is isolated from the main Terminal component.
const dialogTerminalSocketClient = createSocketClient('/terminal');

const TerminalDialog: React.FC<TerminalDialogProps> = ({
  open,
  initialCwd,
  onClose,
}) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const { mode } = useStore(themeStore);

  const [input, setInput] = useState('');
  const [output, setOutput] = useState<string[]>([]);

  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /** Auto-scroll to bottom when output changes */
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  /** Focus input when dialog opens or output is clicked */
  useEffect(() => {
    if (open) {
      // Use a timeout to ensure the dialog is fully rendered before focusing
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleOutputClick = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  /** Connect to socket on open and clean up on close */
  useEffect(() => {
    if (!open) {
        // If dialog is closing, disconnect the socket and clear output
        if (dialogTerminalSocketClient.isConnected()) {
            dialogTerminalSocketClient.disconnect();
        }
        setOutput([]);
        return;
    }

    let isMounted = true;
    const token = getToken(); // Retrieve auth token for this dialog's connection

    if (!token) {
        console.error('No authentication token available for TerminalDialog. Cannot connect.');
        // Optionally, display an error message in the dialog or close it.
        if (isMounted) {
            setOutput((prev) => [...prev, '\nAuthentication Error: No token found. Please log in.\n']);
        }
        return;
    }

    // Establish connection for the dialog's dedicated socket client
    dialogTerminalSocketClient.connect(initialCwd).then(() => {
      if (!isMounted) return;

      // Define handler for socket output, updating local state and global store
      const handleSocketOutput = (data: string) => {
        const plain = stripAnsi(data); // Strip ANSI escape codes for display
        setOutput((prev) => [...prev, plain]); // Update dialog's local output state
        appendOutput(plain); // Also append to global terminal store's output (optional, for history)
      };

      dialogTerminalSocketClient.on('output', handleSocketOutput);
      dialogTerminalSocketClient.on('terminal_output', handleSocketOutput); // Listen to both if backend emits differently

      console.log('TerminalDialog socket connected and listening.');

    }).catch(error => {
        console.error('TerminalDialog socket connection failed:', error);
        if (isMounted) {
            setOutput((prev) => [...prev, `\nConnection Error: ${error.message || String(error)}\n`]);
        }
    });

    // Cleanup function for the effect: disconnect and remove listeners
    return () => {
      isMounted = false;
      dialogTerminalSocketClient.off('output', handleSocketOutput);
      dialogTerminalSocketClient.off('terminal_output', handleSocketOutput);
      dialogTerminalSocketClient.disconnect();
      console.log('TerminalDialog socket disconnected during cleanup.');
    };
  }, [open, initialCwd]); // Re-run effect when dialog opens/closes or initialCwd changes

  const handleSend = () => {
    if (!input.trim()) return;
    // Emit input using the dialog's dedicated socket client
    dialogTerminalSocketClient.emit('input', { input: input + '\n' });
    setInput(''); // Clear input field
  };

  const handleResize = useCallback(() => {
    if (outputRef.current) {
      // Calculate terminal dimensions based on current div size
      const cols = Math.floor(outputRef.current.offsetWidth / 8); // Rough character width
      const rows = Math.floor(outputRef.current.offsetHeight / 16); // Rough character height
      // Emit resize event using the dialog's dedicated socket client
      dialogTerminalSocketClient.emit('resize', { cols, rows });
    }
  }, []);

  /** Handle window resize for terminal size adjustments */
  useEffect(() => {
    window.addEventListener('resize', handleResize);
    // Perform an initial resize on mount to correctly set terminal dimensions
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  const dialogContentSx = (mode: 'light' | 'dark', theme: any) => ({
    bgcolor:
      mode === 'dark' ? theme.palette.background.default : 'black',
    color: mode === 'dark' ? theme.palette.text.primary : 'white',
    fontFamily: 'monospace',
    p: 2,
    height: 400,
    overflowY: 'auto',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    borderRadius: 1,
  });

  const dialogActionsSx = {
    flexDirection: 'column', alignItems: 'stretch', p: 2
  };

  const sendButtonSx = {
    mt: 1, alignSelf: 'flex-end'
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={fullScreen}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        Terminal Session
        <IconButton aria-label="close" onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Box
          ref={outputRef}
          onClick={handleOutputClick}
          sx={dialogContentSx(mode, theme)}
        >
          {output.join('')}
        </Box>
      </DialogContent>

      <DialogActions
        sx={dialogActionsSx}
      >
        <TextField
          inputRef={inputRef}
          fullWidth
          size="small"
          variant="outlined"
          placeholder="Type a command"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSend();
            }
          }}
          InputProps={{
            sx: { fontFamily: 'monospace' },
          }}
        />
        <Button
          variant="contained"
          sx={sendButtonSx}
          onClick={handleSend}
        >
          Send
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TerminalDialog;
