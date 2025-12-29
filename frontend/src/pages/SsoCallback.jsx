import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Button,
  Stack,
  Avatar
} from '@mui/material';
import {
  CheckCircleOutlined,
  ErrorOutline,
  LoginOutlined
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';

/**
 * SSO Callback Page
 * Handles the redirect from SSO provider after authentication
 * URL: /auth/sso/callback?token=...&isNewUser=...&provider=...
 */
const SsoCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { updateUser } = useAuth();
  const processedRef = useRef(false);

  const [status, setStatus] = useState('processing'); // processing, success, error
  const [message, setMessage] = useState('Memproses autentikasi SSO...');
  const [errorDetails, setErrorDetails] = useState('');

  useEffect(() => {
    // Prevent double processing
    if (processedRef.current) return;
    processedRef.current = true;

    const processCallback = async () => {
      try {
        // Check for error from backend redirect
        const error = searchParams.get('error');
        const errorMessage = searchParams.get('message');

        if (error) {
          setStatus('error');
          setMessage('Autentikasi SSO gagal');
          setErrorDetails(errorMessage || 'Terjadi kesalahan saat login dengan SSO');
          return;
        }

        // Get token and user info from URL params
        const token = searchParams.get('token');
        const isNewUser = searchParams.get('isNewUser') === '1';
        const returnUrl = searchParams.get('returnUrl');

        if (!token) {
          setStatus('error');
          setMessage('Token tidak ditemukan');
          setErrorDetails('Tidak ada token autentikasi dari SSO provider');
          return;
        }

        // Store token first
        localStorage.setItem('token', token);

        // Fetch user profile with token in header directly
        // This ensures the token is used even if interceptor hasn't picked it up yet
        const profileResponse = await api.get('/auth/profile', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const user = profileResponse.data.data.user;

        // Store user data
        localStorage.setItem('user', JSON.stringify(user));
        updateUser(user);

        // Set success status
        setStatus('success');
        setMessage(isNewUser 
          ? 'Akun berhasil dibuat melalui SSO!' 
          : 'Berhasil masuk dengan SSO!'
        );

        // Show toast
        toast.success(isNewUser 
          ? `Selamat datang, ${user.fullName}! Akun baru telah dibuat.`
          : `Selamat datang kembali, ${user.fullName}!`
        );

        // Redirect after short delay
        setTimeout(() => {
          const destination = returnUrl || '/dashboard';
          navigate(destination, { replace: true });
        }, 1500);

      } catch (err) {
        console.error('SSO callback error:', err);
        setStatus('error');
        setMessage('Gagal memproses autentikasi');
        setErrorDetails(err.response?.data?.error || err.message || 'Terjadi kesalahan tidak terduga');

        // Clear any partial auth state
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    };

    processCallback();
  }, [searchParams, navigate, updateUser]);

  const handleRetryLogin = () => {
    navigate('/login', { replace: true });
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={0}
          sx={{
            p: 4,
            borderRadius: 3,
            textAlign: 'center',
            border: '1px solid',
            borderColor: 'divider',
            backgroundColor: 'background.paper'
          }}
        >
          {status === 'processing' && (
            <Stack spacing={3} alignItems="center">
              <CircularProgress size={60} thickness={4} />
              <Typography variant="h6" fontWeight={600}>
                {message}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Mohon tunggu sebentar...
              </Typography>
            </Stack>
          )}

          {status === 'success' && (
            <Stack spacing={3} alignItems="center">
              <Avatar
                sx={{
                  width: 80,
                  height: 80,
                  bgcolor: 'success.light',
                  color: 'success.main'
                }}
              >
                <CheckCircleOutlined sx={{ fontSize: 48 }} />
              </Avatar>
              <Typography variant="h5" fontWeight={700} color="success.main">
                {message}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Anda akan dialihkan ke dashboard...
              </Typography>
              <CircularProgress size={24} />
            </Stack>
          )}

          {status === 'error' && (
            <Stack spacing={3} alignItems="center">
              <Avatar
                sx={{
                  width: 80,
                  height: 80,
                  bgcolor: 'error.light',
                  color: 'error.main'
                }}
              >
                <ErrorOutline sx={{ fontSize: 48 }} />
              </Avatar>
              <Typography variant="h5" fontWeight={700} color="error.main">
                {message}
              </Typography>
              {errorDetails && (
                <Alert severity="error" sx={{ width: '100%', textAlign: 'left' }}>
                  {errorDetails}
                </Alert>
              )}
              <Button
                variant="contained"
                startIcon={<LoginOutlined />}
                onClick={handleRetryLogin}
                sx={{ mt: 2 }}
              >
                Kembali ke Halaman Login
              </Button>
            </Stack>
          )}
        </Paper>
      </Container>
    </Box>
  );
};

export default SsoCallback;
