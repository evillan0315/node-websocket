import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { useStore } from '@nanostores/react';
import { themeStore } from '@/stores/themeStore';

interface TerminalSettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

const terminalSettingsPaperSx = (mode: 'light' | 'dark', theme: any) => ({
  color:
    mode === 'dark'
      ? theme.palette.text.primary
      : theme.palette.text.secondary,
  backgroundColor:
    mode === 'dark' ? theme.palette.background.default : '#2d2d30',
});

const closeButtonSx = {
  bgcolor: 'grey.800', '&:hover': { bgcolor: 'grey.700' }
};

const TerminalSettingsDialog: React.FC<TerminalSettingsDialogProps> = ({
  open,
  onClose,
}) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const { mode } = useStore(themeStore);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={fullScreen}
      PaperProps={{
        sx: terminalSettingsPaperSx(mode, theme),
      }}
    >
      <DialogTitle>Terminal Settings</DialogTitle>

      <DialogContent dividers>
        <p>Settings will be implemented here</p>
      </DialogContent>

      <DialogActions>
        <Button
          onClick={onClose}
          variant="contained"
          sx={closeButtonSx}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TerminalSettingsDialog;
