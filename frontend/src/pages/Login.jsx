import React, { useState, useEffect, useRef } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Link,
  Alert,
  CircularProgress,
  Stack,
  Avatar,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
} from '@mui/material';
import {
  LoginOutlined,
  EmailOutlined,
  LockOutlined,
  PersonAddOutlined,
  VisibilityOutlined,
  VisibilityOffOutlined,
  OpenInNew,
} from '@mui/icons-material';
import { useNavigate, Link as RouterLink, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import api from '../services/api';

const AUTH_NOISE_BG = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
    <filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/></filter>
    <rect width="100%" height="100%" filter="url(#n)" opacity="0.25"/>
  </svg>`
)}`;

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [ssoProviders, setSsoProviders] = useState([]);

  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initializedRef = useRef(false);

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (isAuthenticated()) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    document.title = 'Masuk - e-Sertifikat';

    // Only run once
    if (initializedRef.current) return;
    initializedRef.current = true;

    // Check for SSO error from redirect
    const ssoError = searchParams.get('error');
    const ssoMessage = searchParams.get('message');
    if (ssoError) {
      setError(ssoMessage || 'Login SSO gagal. Silakan coba lagi.');
      // Clean up URL params without triggering re-render
      window.history.replaceState({}, '', '/login');
    }

    // Fetch available SSO providers
    const fetchSsoProviders = async () => {
      try {
        const response = await api.get('/auth/sso/providers');
        setSsoProviders(response.data.data.providers || []);
      } catch (err) {
        console.log('SSO providers not available:', err.message);
      }
    };
    fetchSsoProviders();
  }, [searchParams]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (loading) return; // Prevent double submit
    
    setLoading(true);
    setError('');

    try {
      const result = await login(formData.email, formData.password);

      if (result.success) {
        toast.success('Berhasil masuk!');
        navigate('/dashboard');
      } else {
        setError(result.error || 'Login gagal');
        setLoading(false);
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Terjadi kesalahan saat login');
      setLoading(false);
    }
  };

  const canSubmit = Boolean(formData.email && formData.password && !loading && !ssoLoading);

  const handleSsoLogin = async (provider) => {
    try {
      setSsoLoading(true);
      setError('');

      // Get SSO redirect URL from backend
      const response = await api.get(`/auth/sso/init?provider=${provider}`);
      const { authUrl } = response.data.data;

      // Redirect to SSO provider
      window.location.href = authUrl;
    } catch (err) {
      console.error('SSO init error:', err);
      setError(err.response?.data?.error || 'Gagal memulai login SSO');
      setSsoLoading(false);
    }
  };

  // Helper to get provider display name and icon
  const getProviderInfo = (provider) => {
    const providers = {
      simpatik: {
        name: 'SIMPATIK',
        color: '#2d4b81',
        bgColor: 'rgba(45, 75, 129, 0.08)',
        hoverBg: 'rgba(45, 75, 129, 0.15)',
        icon: null
      },
      google: {
        name: 'Google',
        color: '#4285f4',
        bgColor: 'rgba(66, 133, 244, 0.08)',
        hoverBg: 'rgba(66, 133, 244, 0.15)',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
        )
      },
      microsoft: {
        name: 'Microsoft',
        color: '#00a4ef',
        bgColor: 'rgba(0, 164, 239, 0.08)',
        hoverBg: 'rgba(0, 164, 239, 0.15)',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.4 11.4H0V0h11.4v11.4z" fill="#f25022"/>
            <path d="M24 11.4H12.6V0H24v11.4z" fill="#7fba00"/>
            <path d="M11.4 24H0V12.6h11.4V24z" fill="#00a4ef"/>
            <path d="M24 24H12.6V12.6H24V24z" fill="#ffb900"/>
          </svg>
        )
      },
      github: {
        name: 'GitHub',
        color: '#24292e',
        bgColor: 'rgba(36, 41, 46, 0.08)',
        hoverBg: 'rgba(36, 41, 46, 0.15)',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
          </svg>
        )
      }
    };
    return providers[provider.id] || { 
      name: provider.name, 
      color: '#1976d2',
      bgColor: 'rgba(25, 118, 210, 0.08)',
      hoverBg: 'rgba(25, 118, 210, 0.15)',
      icon: null
    };
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        position: 'relative',
        overflow: 'hidden',
        background:
          'radial-gradient(960px 520px at 12% 12%, rgba(15, 23, 42, 0.10) 0%, rgba(15, 23, 42, 0) 62%), radial-gradient(940px 520px at 92% 18%, rgba(79, 70, 229, 0.10) 0%, rgba(79, 70, 229, 0) 58%), linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
        '&::before': {
          content: '""',
          position: 'absolute',
          width: 560,
          height: 560,
          left: -180,
          top: -220,
          background: 'radial-gradient(circle at 30% 30%, rgba(15, 23, 42, 0.12), rgba(15, 23, 42, 0) 62%)',
          filter: 'blur(6px)',
          transform: 'rotate(12deg)',
          pointerEvents: 'none',
        },
        '&::after': {
          content: '""',
          position: 'absolute',
          width: 620,
          height: 620,
          right: -220,
          bottom: -280,
          background: 'radial-gradient(circle at 60% 60%, rgba(79, 70, 229, 0.14), rgba(79, 70, 229, 0) 60%)',
          filter: 'blur(8px)',
          transform: 'rotate(-8deg)',
          pointerEvents: 'none',
        },
      }}
    >
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url('${AUTH_NOISE_BG}')`,
          backgroundSize: '240px 240px',
          opacity: 0.045,
          mixBlendMode: 'multiply',
          pointerEvents: 'none'
        }}
      />
      <Container component="main" maxWidth="lg">
        <Paper
          elevation={0}
          sx={{
            borderRadius: 4,
            overflow: 'hidden',
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: '0 24px 80px rgba(2, 6, 23, 0.10)',
            backgroundColor: 'rgba(255,255,255,0.86)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <Grid container>
            <Grid item xs={12} md={5} sx={{ display: { xs: 'none', md: 'block' } }}>
              <Box
                sx={{
                  height: '100%',
                  p: 4,
                  position: 'relative',
                  overflow: 'hidden',
                  background:
                    'radial-gradient(980px 560px at 30% 18%, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 55%), linear-gradient(135deg, rgba(15, 23, 42, 0.96) 0%, rgba(30, 41, 59, 0.94) 72%, rgba(79, 70, 229, 0.74) 130%)',
                  color: 'rgba(255,255,255,0.96)',
                }}
              >
                <Box
                  aria-hidden
                  sx={{
                    position: 'absolute',
                    inset: -80,
                    backgroundImage: `url('${AUTH_NOISE_BG}')`,
                    backgroundSize: '220px 220px',
                    opacity: 0.10,
                    pointerEvents: 'none'
                  }}
                />
                <Box
                  aria-hidden
                  sx={{
                    position: 'absolute',
                    width: 420,
                    height: 420,
                    borderRadius: '50%',
                    left: -160,
                    bottom: -200,
                    background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.20), rgba(255,255,255,0) 60%)',
                    filter: 'blur(2px)',
                    pointerEvents: 'none'
                  }}
                />
                <Stack spacing={2} sx={{ position: 'relative' }}>
                  <Avatar
                    sx={{
                      width: 56,
                      height: 56,
                      bgcolor: 'rgba(255,255,255,0.20)',
                      border: '1px solid rgba(255,255,255,0.25)',
                      color: 'rgba(255,255,255,0.95)'
                    }}
                  >
                    <LoginOutlined />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: -0.6, lineHeight: 1.1 }}>
                      e-Sertifikat
                    </Typography>
                    <Typography variant="body1" sx={{ mt: 1, opacity: 0.92 }}>
                      Masuk untuk mengelola event, peserta, dan sertifikat digital dalam satu tempat.
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            </Grid>

            <Grid item xs={12} md={7}>
              <Box
                sx={{
                  p: { xs: 3, sm: 4 },
                  backgroundColor: 'rgba(255,255,255,0.70)',
                }}
              >
                <Stack spacing={0.75} sx={{ mb: 3 }} alignItems="center">
                  <Avatar
                    sx={{
                      width: 72,
                      height: 72,
                      bgcolor: 'rgba(102, 126, 234, 0.14)',
                      border: '1px solid rgba(102, 126, 234, 0.22)',
                      color: 'primary.main',
                    }}
                  >
                    <LoginOutlined sx={{ fontSize: 38 }} />
                  </Avatar>
                  <Typography component="h1" variant="h5" sx={{ fontWeight: 900, letterSpacing: -0.5 }}>
                    Masuk
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Selamat datang kembali
                  </Typography>
                </Stack>

                {error && (
                  <Alert
                    severity="error"
                    sx={{
                      mb: 3,
                      borderRadius: 2,
                      '& .MuiAlert-message': {
                        fontSize: '0.9rem',
                      }
                    }}
                  >
                    {error}
                  </Alert>
                )}

                <Box component="form" onSubmit={handleSubmit}>
                  <Stack spacing={2.5}>
                    <TextField
                      required
                      fullWidth
                      id="email"
                      label="Alamat Email"
                      name="email"
                      autoComplete="email"
                      autoFocus
                      value={formData.email}
                      onChange={handleChange}
                      disabled={loading}
                      placeholder="nama@domain.com"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <EmailOutlined sx={{ color: 'text.secondary' }} />
                          </InputAdornment>
                        ),
                      }}
                    />

                    <TextField
                      required
                      fullWidth
                      name="password"
                      label="Kata Sandi"
                      type={showPassword ? 'text' : 'password'}
                      id="password"
                      autoComplete="current-password"
                      value={formData.password}
                      onChange={handleChange}
                      disabled={loading}
                      placeholder="Masukkan kata sandi"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <LockOutlined sx={{ color: 'text.secondary' }} />
                          </InputAdornment>
                        ),
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              type="button"
                              onClick={() => setShowPassword(v => !v)}
                              edge="end"
                              disabled={loading}
                              aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                            >
                              {showPassword ? <VisibilityOffOutlined /> : <VisibilityOutlined />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />

                    <Button
                      type="submit"
                      fullWidth
                      variant="contained"
                      size="large"
                      disabled={!canSubmit}
                      startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <LoginOutlined />}
                      sx={{
                        mt: 1,
                        py: 1.35,
                        borderRadius: 2,
                        fontSize: '1.05rem',
                        fontWeight: 700,
                      }}
                    >
                      {loading ? 'Sedang Masuk...' : 'Masuk'}
                    </Button>

                    {/* SSO Login Buttons */}
                    {ssoProviders.length > 0 && (
                      <>
                        <Divider sx={{ my: 2 }}>
                          <Typography variant="body2" color="text.secondary">
                            atau masuk dengan
                          </Typography>
                        </Divider>

                        <Stack spacing={1.5}>
                          {ssoProviders.map((provider) => {
                            const info = getProviderInfo(provider);
                            return (
                              <Button
                                key={provider.id}
                                fullWidth
                                variant="outlined"
                                size="large"
                                disabled={loading || ssoLoading}
                                onClick={() => handleSsoLogin(provider.id)}
                                startIcon={ssoLoading ? <CircularProgress size={20} /> : (info.icon || <OpenInNew />)}
                                sx={{
                                  py: 1.25,
                                  borderRadius: 2,
                                  fontWeight: 600,
                                  borderColor: info.color,
                                  color: info.color,
                                  backgroundColor: info.bgColor,
                                  '&:hover': {
                                    borderColor: info.color,
                                    backgroundColor: info.hoverBg,
                                  },
                                }}
                              >
                                {ssoLoading ? 'Menghubungkan...' : `Masuk dengan ${info.name}`}
                              </Button>
                            );
                          })}
                        </Stack>
                      </>
                    )}
                  </Stack>

                  <Divider sx={{ my: 3 }}>
                    <Typography variant="body2" color="text.secondary">
                      atau
                    </Typography>
                  </Divider>

                  <Box textAlign="center">
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Belum punya akun?
                    </Typography>
                    <Link
                      component={RouterLink}
                      to="/register"
                      sx={{
                        textDecoration: 'none',
                        fontWeight: 600,
                        color: 'primary.main',
                        '&:hover': {
                          color: 'primary.dark',
                        },
                      }}
                    >
                      <Stack direction="row" alignItems="center" justifyContent="center" spacing={1}>
                        <PersonAddOutlined sx={{ fontSize: 18 }} />
                        <span>Daftar Sekarang</span>
                      </Stack>
                    </Link>
                  </Box>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      </Container>
    </Box>
  );
};

export default Login;
