import React, { useState, useEffect } from 'react';
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
} from '@mui/icons-material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

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
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Masuk - e-Sertifikat';
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(formData.email, formData.password);

    if (result.success) {
      toast.success('Berhasil masuk!');
      navigate('/dashboard');
    } else {
      setError(result.error);
    }

    setLoading(false);
  };

  const canSubmit = Boolean(formData.email && formData.password && !loading);

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
