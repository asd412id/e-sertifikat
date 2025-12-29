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
        color: '#757575',
        icon: (
          <img 
            src="https://app.maccaqe.id/assets/disdik-BFbEH7A4.png" 
            alt="SIMPATIK" 
            style={{ width: 18, height: 18, objectFit: 'contain' }} 
          />
        )
      },
      google: {
        name: 'Google',
        color: '#757575',
        icon: (
          <svg width="18" height="18" viewBox="0 0 48 48">
            <rect fill="#fff" x="0" y="0" width="48" height="48" rx="4"/>
            <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
            <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
            <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
            <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
          </svg>
        )
      },
      microsoft: {
        name: 'Microsoft',
        color: '#757575',
        icon: (
          <svg width="18" height="18" viewBox="0 0 48 48">
            <rect fill="#fff" x="0" y="0" width="48" height="48" rx="4"/>
            <path fill="#f25022" d="M6 6h16v16H6z"/>
            <path fill="#7fba00" d="M26 6h16v16H26z"/>
            <path fill="#00a4ef" d="M6 26h16v16H6z"/>
            <path fill="#ffb900" d="M26 26h16v16H26z"/>
          </svg>
        )
      },
      github: {
        name: 'GitHub',
        color: '#24292e',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
          </svg>
        )
      }
    };
    return providers[provider.id] || { 
      name: provider.name, 
      color: '#757575',
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
                                  borderColor: 'divider',
                                  color: 'text.primary',
                                  backgroundColor: 'transparent',
                                  '&:hover': {
                                    borderColor: 'text.secondary',
                                    backgroundColor: 'rgba(0, 0, 0, 0.04)',
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
