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
        background:
          'radial-gradient(900px 420px at 15% 10%, rgba(102, 126, 234, 0.16) 0%, rgba(102, 126, 234, 0) 60%), radial-gradient(900px 420px at 90% 20%, rgba(118, 75, 162, 0.12) 0%, rgba(118, 75, 162, 0) 55%), #f8fafc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      <Container component="main" maxWidth="sm">
        <Paper
          elevation={0}
          sx={{
            borderRadius: 4,
            overflow: 'hidden',
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: '0 24px 80px rgba(2, 6, 23, 0.10)',
            backgroundColor: 'background.paper',
          }}
        >
          <Box
            sx={{
              backgroundColor: 'transparent',
              color: 'text.primary',
              p: { xs: 3.5, sm: 4 },
              textAlign: 'center',
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Avatar
              sx={{
                width: 76,
                height: 76,
                mx: 'auto',
                mb: 2,
                bgcolor: 'rgba(102, 126, 234, 0.14)',
                border: '1px solid rgba(102, 126, 234, 0.22)',
                color: 'primary.main',
              }}
            >
              <LoginOutlined sx={{ fontSize: 40 }} />
            </Avatar>
            <Typography component="h1" variant="h4" sx={{ fontWeight: 800, mb: 0.5, letterSpacing: -0.4 }}>
              e-Sertifikat
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.92 }}>
              Masuk untuk mengelola event & sertifikat
            </Typography>
          </Box>

          <Box sx={{ p: { xs: 3, sm: 4 } }}>
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
                    color: '#667eea',
                    '&:hover': {
                      color: '#764ba2',
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
        </Paper>
      </Container>
    </Box>
  );
};

export default Login;
