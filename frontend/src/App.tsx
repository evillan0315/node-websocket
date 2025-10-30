import React, { useState } from 'react';
import { Box, CssBaseline, ThemeProvider } from '@mui/material';
import { useStore } from '@nanostores/react';
import { themeStore } from '@/stores/themeStore';
import { lightTheme, darkTheme } from '@/theme';
import { Terminal } from '@/components/Terminal/Terminal';
import { useNavigate } from 'react-router-dom';
import { handleLogout } from '@/services/authService';

function App() {
  const { mode } = useStore(themeStore);
  const theme = mode === 'dark' ? darkTheme : lightTheme;
  const navigate = useNavigate();
  const [terminalHeight, setTerminalHeight] = useState(window.innerHeight - 64); // Example initial height, adjust as needed

  const onAppLogout = async () => {
    await handleLogout();
    navigate('/login'); // Redirect to login page
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw' }}>
        {/* Main Terminal Component */}
        <Terminal onLogout={onAppLogout} terminalHeight={terminalHeight} />
      </Box>
    </ThemeProvider>
  );
}

export default App;
