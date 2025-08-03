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
} from '@mui/material';
import {
  PersonAddOutlined,
  PersonOutlined,
  EmailOutlined,
  LockOutlined,
  LoginOutlined,
  BadgeOutlined,
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

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
            border: '1px solid rgba(255,255,255,0.1)',
            backdropFilter: 'blur(20px)',
            background: 'rgba(255,255,255,0.95)',
          }}
        >
          {/* Header */}
          <Box
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              p: 4,
              textAlign: 'center',
            }}
          >
            <Avatar
              sx={{
                width: 80,
                height: 80,
                mx: 'auto',
                mb: 2,
                bgcolor: 'rgba(255,255,255,0.2)',
                backdropFilter: 'blur(10px)',
                border: '2px solid rgba(255,255,255,0.3)',
              }}
            >
              <PersonAddOutlined sx={{ fontSize: 40 }} />
            </Avatar>
            <Typography component="h1" variant="h3" sx={{ fontWeight: 'bold', mb: 1 }}>
              e-Sertifikat
            </Typography>
            <Typography variant="h6" sx={{ opacity: 0.9 }}>
              Buat Akun Baru
            </Typography>
          </Box>

          {/* Form */}
          <Box sx={{ p: 4 }}>
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
              <Grid container spacing={3}>
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
                    InputProps={{
                      startAdornment: <PersonOutlined sx={{ mr: 1, color: 'text.secondary' }} />,
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        backgroundColor: 'rgba(0,0,0,0.02)',
                        '&:hover': {
                          backgroundColor: 'rgba(0,0,0,0.04)',
                        },
                        '&.Mui-focused': {
                          backgroundColor: 'transparent',
                        },
                      },
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
                    InputProps={{
                      startAdornment: <BadgeOutlined sx={{ mr: 1, color: 'text.secondary' }} />,
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        backgroundColor: 'rgba(0,0,0,0.02)',
                        '&:hover': {
                          backgroundColor: 'rgba(0,0,0,0.04)',
                        },
                        '&.Mui-focused': {
                          backgroundColor: 'transparent',
                        },
                      },
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
                    InputProps={{
                      startAdornment: <EmailOutlined sx={{ mr: 1, color: 'text.secondary' }} />,
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        backgroundColor: 'rgba(0,0,0,0.02)',
                        '&:hover': {
                          backgroundColor: 'rgba(0,0,0,0.04)',
                        },
                        '&.Mui-focused': {
                          backgroundColor: 'transparent',
                        },
                      },
                    }}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    required
                    fullWidth
                    name="password"
                    label="Kata Sandi"
                    type="password"
                    id="password"
                    autoComplete="new-password"
                    value={formData.password}
                    onChange={handleChange}
                    disabled={loading}
                    InputProps={{
                      startAdornment: <LockOutlined sx={{ mr: 1, color: 'text.secondary' }} />,
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        backgroundColor: 'rgba(0,0,0,0.02)',
                        '&:hover': {
                          backgroundColor: 'rgba(0,0,0,0.04)',
                        },
                        '&.Mui-focused': {
                          backgroundColor: 'transparent',
                        },
                      },
                    }}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    required
                    fullWidth
                    name="confirmPassword"
                    label="Konfirmasi Kata Sandi"
                    type="password"
                    id="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    disabled={loading}
                    InputProps={{
                      startAdornment: <LockOutlined sx={{ mr: 1, color: 'text.secondary' }} />,
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        backgroundColor: 'rgba(0,0,0,0.02)',
                        '&:hover': {
                          backgroundColor: 'rgba(0,0,0,0.04)',
                        },
                        '&.Mui-focused': {
                          backgroundColor: 'transparent',
                        },
                      },
                    }}
                  />
                </Grid>

                <Grid item xs={12}>
                  <Box sx={{ mb: 2 }}>
                    <Typography
                      variant="body1"
                      sx={{
                        textAlign: 'center',
                        mb: 1,
                        fontWeight: 500,
                        color: 'text.primary'
                      }}
                    >
                      Verifikasi Captcha
                    </Typography>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 2,
                        p: 2,
                        borderRadius: 2,
                        border: '1px solid rgba(0,0,0,0.1)',
                        position: 'relative',
                        overflow: 'hidden'
                      }}
                    >
                      {/* Noise background */}
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
                          opacity: 0.7,
                          pointerEvents: 'none'
                        }}
                      />
                      <Typography variant="h6" sx={{ fontWeight: 'bold', position: 'relative', zIndex: 1 }}>
                        {mathCaptcha.num1} + {mathCaptcha.num2} = ?
                      </Typography>
                      <TextField
                        required
                        type="number"
                        value={mathCaptcha.userAnswer}
                        onChange={handleCaptchaChange}
                        disabled={loading}
                        sx={{ width: '100px', position: 'relative', zIndex: 1, backgroundColor: 'rgba(255,255,255,0.8)' }}
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
                        sx={{ position: 'relative', zIndex: 1 }}
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
                    disabled={loading || mathCaptcha.userAnswer === ''}
                    startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <PersonAddOutlined />}
                    sx={{
                      mt: 1,
                      py: 1.5,
                      borderRadius: 2,
                      fontSize: '1.1rem',
                      fontWeight: 600,
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      textTransform: 'none',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 8px 25px rgba(102, 126, 234, 0.3)',
                      },
                      '&:disabled': {
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        opacity: 0.7,
                      },
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
