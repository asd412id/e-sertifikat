import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { Toaster } from 'react-hot-toast'
import App from './App'
import { AuthProvider } from './context/AuthContext'

const theme = createTheme({
  shape: {
    borderRadius: 6,
  },
  palette: {
    primary: {
      main: '#667eea',
      light: '#93a5ff',
      dark: '#4c5fd6',
    },
    secondary: {
      main: '#764ba2',
      light: '#9a74c3',
      dark: '#5d3885',
    },
    background: {
      default: '#f8fafc',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: 'Roboto, Arial, sans-serif',
    h1: { fontWeight: 800 },
    h2: { fontWeight: 800 },
    h3: { fontWeight: 800 },
    h4: {
      fontWeight: 700,
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
    button: {
      fontWeight: 600,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#f8fafc',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 10,
          boxShadow: 'none',
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 10px 30px rgba(2, 6, 23, 0.12)',
          },
        },
        outlined: {
          borderWidth: 1,
          '&:hover': {
            borderWidth: 1,
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
        size: 'medium',
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          backgroundColor: 'rgba(2, 6, 23, 0.02)',
          transition: 'background-color 120ms ease, box-shadow 120ms ease',
          '&:hover': {
            backgroundColor: 'rgba(2, 6, 23, 0.035)',
          },
          '&.Mui-focused': {
            backgroundColor: '#ffffff',
            boxShadow: '0 0 0 4px rgba(102, 126, 234, 0.18)',
          },
        },
        notchedOutline: {
          borderColor: 'rgba(2, 6, 23, 0.12)',
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        select: ({ ownerState }) => {
          const isSmall = ownerState?.size === 'small'
          return {
            ...(isSmall
              ? {
                  paddingTop: 10,
                  paddingBottom: 10,
                }
              : null),
          }
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: ({ ownerState, theme }) => {
          const isSmall = ownerState?.size === 'small'
          return {
            fontWeight: 600,
            '&.MuiInputLabel-outlined': {
              transform: isSmall
                ? 'translate(14px, 12px) scale(1)'
                : 'translate(14px, 14px) scale(1)',
            },
            '&.MuiInputLabel-outlined.MuiInputLabel-shrink': {
              transform: 'translate(14px, -9px) scale(0.75)',
              backgroundColor: theme?.palette?.background?.paper || '#ffffff',
              padding: '0 6px',
              borderRadius: 6,
              lineHeight: 1.2,
            },
          }
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 10px 30px rgba(2, 6, 23, 0.08)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: 'none',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: {
          minHeight: 44,
        },
        indicator: {
          height: 3,
          borderRadius: 999,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 44,
          textTransform: 'none',
          fontWeight: 700,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 14,
          boxShadow: '0 20px 60px rgba(2, 6, 23, 0.22)',
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          borderRadius: 8,
          fontSize: '0.85rem',
          padding: '8px 10px',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          fontWeight: 600,
        },
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          border: '1px solid rgba(2, 6, 23, 0.10)',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 800,
          color: 'rgba(2, 6, 23, 0.72)',
          backgroundColor: 'rgba(2, 6, 23, 0.02)',
        },
      },
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <App />
        </AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              borderRadius: '10px',
            },
          }}
        />
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
