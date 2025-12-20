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
  PersonAddOutlined,
  PersonOutlined,
  EmailOutlined,
  LockOutlined,
  LoginOutlined,
  BadgeOutlined,
  VisibilityOutlined,
  VisibilityOffOutlined,
} from '@mui/icons-material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const Register = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [mathCaptcha, setMathCaptcha] = useState({
    num1: 0,
    num2: 0,
    userAnswer: ''
  });

  const { register } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Daftar - e-Sertifikat';
    // Generate initial math captcha
    generateMathCaptcha();
  }, []);

  const generateMathCaptcha = () => {
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    setMathCaptcha({ num1, num2, userAnswer: '' });
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleCaptchaChange = (e) => {
    setMathCaptcha({
      ...mathCaptcha,
      userAnswer: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validate math captcha
    const correctAnswer = mathCaptcha.num1 + mathCaptcha.num2;
    if (parseInt(mathCaptcha.userAnswer) !== correctAnswer || mathCaptcha.userAnswer === '') {
      setError('Jawaban captcha salah. Silakan coba lagi.');
      generateMathCaptcha(); // Generate new captcha
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Kata sandi tidak cocok');
      setLoading(false);
      return;
    }

    const { confirmPassword, ...registerData } = formData;
    const result = await register(registerData);

    if (result.success) {
      toast.success('Pendaftaran berhasil!');
      navigate('/dashboard');
    } else {
      setError(result.error);
    }

    setLoading(false);
  };

  const canSubmit = Boolean(
    formData.fullName &&
      formData.username &&
      formData.email &&
      formData.password &&
      formData.confirmPassword &&
      mathCaptcha.userAnswer !== '' &&
      !loading
  );

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
      <Container component="main" maxWidth="md">
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
              <PersonAddOutlined sx={{ fontSize: 40 }} />
            </Avatar>
            <Typography component="h1" variant="h4" sx={{ fontWeight: 800, mb: 0.5, letterSpacing: -0.4 }}>
              e-Sertifikat
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.92 }}>
              Buat akun untuk mulai mengelola sertifikat
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
              <Grid container spacing={2.5}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    required
                    fullWidth
                    id="fullName"
                    label="Nama Lengkap"
                    name="fullName"
                    autoComplete="name"
                    autoFocus
                    value={formData.fullName}
                    onChange={handleChange}
                    disabled={loading}
                    placeholder="Nama sesuai identitas"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <PersonOutlined sx={{ color: 'text.secondary' }} />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    required
                    fullWidth
                    id="username"
                    label="Nama Pengguna"
                    name="username"
                    autoComplete="username"
                    value={formData.username}
                    onChange={handleChange}
                    disabled={loading}
                    placeholder="contoh: budi123"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <BadgeOutlined sx={{ color: 'text.secondary' }} />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    required
                    fullWidth
                    id="email"
                    label="Alamat Email"
                    name="email"
                    autoComplete="email"
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
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    required
                    fullWidth
                    name="password"
                    label="Kata Sandi"
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    autoComplete="new-password"
                    value={formData.password}
                    onChange={handleChange}
                    disabled={loading}
                    placeholder="Minimal 8 karakter"
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
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    required
                    fullWidth
                    name="confirmPassword"
                    label="Konfirmasi Kata Sandi"
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    disabled={loading}
                    placeholder="Ulangi kata sandi"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockOutlined sx={{ color: 'text.secondary' }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowConfirmPassword(v => !v)}
                            edge="end"
                            disabled={loading}
                            aria-label={showConfirmPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                          >
                            {showConfirmPassword ? <VisibilityOffOutlined /> : <VisibilityOutlined />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>

                <Grid item xs={12}>
                  <Box sx={{ mb: 1.5 }}>
                    <Typography variant="body2" sx={{ mb: 1, fontWeight: 700, color: 'text.primary' }}>
                      Verifikasi Captcha
                    </Typography>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 2,
                        p: 2,
                        borderRadius: 2.25,
                        border: '1px solid rgba(2, 6, 23, 0.10)',
                        background: 'rgba(255,255,255,0.65)',
                        position: 'relative',
                        overflow: 'hidden'
                      }}
                    >
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          background: 'linear-gradient(45deg, #f0f0f0 25%, transparent 25%), linear-gradient(-45deg, #f0f0f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f0f0f0 75%), linear-gradient(-45deg, transparent 75%, #f0f0f0 75%)',
                          backgroundSize: '20px 20px',
                          backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                          opacity: 0.55,
                          pointerEvents: 'none'
                        }}
                      />
                      <Typography variant="h6" sx={{ fontWeight: 800, position: 'relative', zIndex: 1 }}>
                        {mathCaptcha.num1} + {mathCaptcha.num2} = ?
                      </Typography>
                      <TextField
                        required
                        type="number"
                        value={mathCaptcha.userAnswer}
                        onChange={handleCaptchaChange}
                        disabled={loading}
                        sx={{ width: '110px', position: 'relative', zIndex: 1, backgroundColor: 'rgba(255,255,255,0.85)' }}
                        inputProps={{
                          style: { textAlign: 'center' },
                          min: 0,
                          max: 20
                        }}
                      />
                      <Button
                        variant="outlined"
                        onClick={generateMathCaptcha}
                        disabled={loading}
                        size="small"
                        sx={{ position: 'relative', zIndex: 1, borderRadius: 2 }}
                      >
                        ↻
                      </Button>
                    </Box>
                    <Typography
                      variant="caption"
                      sx={{
                        textAlign: 'center',
                        display: 'block',
                        mt: 1,
                        color: 'text.secondary'
                      }}
                    >
                      Masukkan hasil penjumlahan di atas
                    </Typography>
                  </Box>
                </Grid>

                <Grid item xs={12}>
                  <Button
                    type="submit"
                    fullWidth
                    variant="contained"
                    size="large"
                    disabled={!canSubmit}
                    startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <PersonAddOutlined />}
                    sx={{
                      mt: 1,
                      py: 1.35,
                      borderRadius: 2,
                      fontSize: '1.05rem',
                      fontWeight: 700,
                    }}
                  >
                    {loading ? 'Sedang Mendaftar...' : 'Daftar Sekarang'}
                  </Button>
                </Grid>
              </Grid>

              <Divider sx={{ my: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  atau
                </Typography>
              </Divider>

              <Box textAlign="center">
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Sudah punya akun?
                </Typography>
                <Link
                  component={RouterLink}
                  to="/login"
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
                    <LoginOutlined sx={{ fontSize: 18 }} />
                    <span>Masuk Sekarang</span>
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

export default Register;
