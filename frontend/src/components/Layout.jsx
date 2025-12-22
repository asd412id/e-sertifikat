import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Avatar,
  Menu,
  MenuItem,
  Container,
  useTheme,
  useMediaQuery,
  Divider,
  Paper,
  Badge,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard,
  Event,
  AccountCircle,
  Logout,
  Settings,
  Help,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LogoIcon from './LogoIcon';

const drawerWidth = 280;

const Layout = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const menuItems = [
    { text: 'Dasbor', icon: <Dashboard />, path: '/dashboard' },
    { text: 'Kegiatan', icon: <Event />, path: '/events' },
  ];

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleProfileClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileClose = () => {
    setAnchorEl(null);
  };

  const handleProfileNavigate = () => {
    navigate('/profile');
    handleProfileClose();
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
    handleProfileClose();
  };

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{
        p: 3,
        textAlign: 'center',
        backgroundColor: 'rgba(255,255,255,0.9)',
        borderBottom: '1px solid',
        borderColor: 'divider'
      }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <LogoIcon size={48} variant="gradient" />
        </Box>
        <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 800, mb: 0.5 }}>
          e-Sertifikat
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Sistem Manajemen Sertifikat Digital
        </Typography>
      </Box>

      <Box sx={{ p: 2 }}>
        <Paper
          elevation={0}
          sx={{
            p: 2,
            backgroundColor: theme.palette.grey[50],
            borderRadius: 2,
            mb: 2,
            border: '1px solid',
            borderColor: 'divider'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar
              sx={{
                width: 44,
                height: 44,
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                fontWeight: 800,
                fontSize: 18,
                flexShrink: 0
              }}
            >
              {user?.fullName?.charAt(0)?.toUpperCase()}
            </Avatar>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 800,
                  lineHeight: 1.15,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {user?.fullName || '-'}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  display: 'block',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {user?.email || ''}
              </Typography>
            </Box>
          </Box>
        </Paper>
      </Box>

      <List sx={{ px: 2, flex: 1 }}>
        {menuItems.map((item) => (
          <ListItemButton
            key={item.text}
            onClick={() => navigate(item.path)}
            sx={{
              borderRadius: 2,
              mb: 1,
              backgroundColor: location.pathname === item.path ? 'primary.main' : 'transparent',
              color: location.pathname === item.path ? 'white' : 'text.primary',
              '&:hover': {
                backgroundColor: location.pathname === item.path ? 'primary.dark' : 'action.hover',
              },
              transition: 'all 0.2s ease-in-out',
              boxShadow: location.pathname === item.path ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
            }}
          >
            <ListItemIcon sx={{
              color: location.pathname === item.path ? 'white' : 'text.secondary',
              minWidth: 40
            }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText
              primary={item.text}
              sx={{
                '& .MuiListItemText-primary': {
                  fontWeight: location.pathname === item.path ? 'bold' : 'normal',
                  fontSize: '0.95rem'
                }
              }}
            />
          </ListItemButton>
        ))}
      </List>

      <Divider />
      <List sx={{ px: 2, pb: 2 }}>
        <ListItemButton
          onClick={handleLogout}
          sx={{
            borderRadius: 2,
            color: 'error.main',
            '&:hover': {
              backgroundColor: 'error.light',
              color: 'white',
            },
            transition: 'all 0.2s ease-in-out',
          }}
        >
          <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>
            <Logout />
          </ListItemIcon>
          <ListItemText
            primary="Keluar"
            sx={{
              '& .MuiListItemText-primary': {
                fontSize: '0.95rem'
              }
            }}
          />
        </ListItemButton>
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          backgroundColor: 'rgba(255,255,255,0.92)',
          borderBottom: '1px solid',
          borderColor: 'divider',
          color: 'text.primary',
          backdropFilter: 'blur(12px)',
          borderRadius: 0
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="buka menu"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
            <LogoIcon showText size={24} variant="gradient" />
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography variant="body2" sx={{ mr: 2, display: { xs: 'none', sm: 'block' } }}>
              {user?.fullName}
            </Typography>
            <IconButton onClick={handleProfileClick} color="inherit">
              <Avatar sx={{
                width: 36,
                height: 36,
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                border: '1px solid rgba(255,255,255,0.9)',
                boxShadow: '0 6px 16px rgba(2, 6, 23, 0.12)',
                fontWeight: 800
              }}>
                {user?.fullName?.charAt(0)?.toUpperCase()}
              </Avatar>
            </IconButton>
          </Box>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleProfileClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            PaperProps={{
              elevation: 3,
              sx: {
                borderRadius: 2,
                mt: 1,
                minWidth: 200,
              }
            }}
          >
            <MenuItem onClick={handleProfileNavigate} sx={{ py: 1.5 }}>
              <ListItemIcon>
                <AccountCircle fontSize="small" />
              </ListItemIcon>
              Profil
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout} sx={{ py: 1.5, color: 'error.main' }}>
              <ListItemIcon sx={{ color: 'error.main' }}>
                <Logout fontSize="small" />
              </ListItemIcon>
              Keluar
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              borderRight: 'none',
              backgroundImage: 'linear-gradient(180deg, rgba(248,250,252,1) 0%, rgba(255,255,255,1) 70%)',
            },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              borderRight: 'none',
              boxShadow: '2px 0 8px rgba(0,0,0,0.1)',
              borderRadius: 0,
              backgroundImage: 'linear-gradient(180deg, rgba(248,250,252,1) 0%, rgba(255,255,255,1) 70%)',
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, md: 3 },
          width: { md: `calc(100% - ${drawerWidth}px)` },
          mt: 8,
          backgroundColor: '#f8fafc',
          minHeight: '100vh',
        }}
      >
        <Container maxWidth="xl" sx={{ py: { xs: 1, md: 2 } }}>
          {children}
        </Container>
      </Box>
    </Box>
  );
};

export default Layout;
