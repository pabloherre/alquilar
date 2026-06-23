import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#0f766e' },
    secondary: { main: '#0ea5e9' },
    background: { default: '#f1f5f9', paper: '#ffffff' }
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: 'Poppins, "Segoe UI", sans-serif',
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 600 }
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          border: '1px solid #e2e8f0',
          boxShadow: '0 10px 24px rgba(15, 23, 42, 0.07)'
        }
      }
    }
  }
});

export default theme;