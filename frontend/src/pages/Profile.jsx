import React, { useState, useEffect, useRef } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Stack,
  Avatar,
  Grid,
  Tab,
  Tabs,
  Card,
  CardContent,
  Chip,
} from '@mui/material';
import {
  PersonOutlined,
  EmailOutlined,
  LockOutlined,
  SaveOutlined,
  EditOutlined,
  BadgeOutlined,
  LinkOutlined,
  LinkOffOutlined,
  OpenInNew,
  CheckCircleOutlined,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import api from '../services/api';
import toast from 'react-hot-toast';

const Profile = () => {
  const { user, updateUser, ssoIdentities, fetchSsoIdentities, unlinkSsoIdentity } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [error, setError] = useState('');
  const [ssoProviders, setSsoProviders] = useState([]);

  // Determine if user has password (treat undefined as true for backward compatibility)
  const userHasPassword = user?.hasPassword !== false;

  // Profile form data
  const [profileData, setProfileData] = useState({
    fullName: '',
    username: '',
    email: '',
  });

  // Password form data
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Set password form data (for SSO users without password)
  const [newPasswordData, setNewPasswordData] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  const [initialized, setInitialized] = useState(false);
  const ssoFetchedRef = useRef(false);

  useEffect(() => {
    document.title = 'Profil Saya - e-Sertifikat';
    
    // Only fetch once using ref to avoid re-renders
    if (ssoFetchedRef.current) return;
    ssoFetchedRef.current = true;
    
    // Fetch SSO providers
    const fetchProviders = async () => {
      try {
        const response = await api.get('/auth/sso/providers');
        setSsoProviders(response.data.data.providers || []);
      } catch (err) {
        console.log('SSO providers not available');
      }
    };
    fetchProviders();
    
    // Refresh SSO identities
    fetchSsoIdentities();
  }, [fetchSsoIdentities]);

  useEffect(() => {
    if (user && !initialized) {
      setProfileData({
        fullName: user.fullName || '',
        username: user.username || '',
        email: user.email || '',
      });
      setInitialized(true);
    }
  }, [user, initialized]);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    setError('');
  };

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileData(prevData => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prevData => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleSetPasswordChange = (e) => {
    const { name, value } = e.target;
    setNewPasswordData(prevData => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await api.put('/auth/profile', profileData);
      if (response.data.success) {
        updateUser(response.data.data.user);
        toast.success('Profil berhasil diperbarui!');
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Gagal memperbarui profil';
      setError(errorMessage);
      toast.error(errorMessage);
    }

    setLoading(false);
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('Kata sandi baru tidak cocok');
      setLoading(false);
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setError('Kata sandi baru minimal 6 karakter');
      setLoading(false);
      return;
    }

    try {
      const response = await api.put('/auth/change-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });

      if (response.data.success) {
        toast.success('Kata sandi berhasil diperbarui!');
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Gagal memperbarui kata sandi';
      setError(errorMessage);
      toast.error(errorMessage);
    }

    setLoading(false);
  };

  const handleSetPasswordSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (newPasswordData.newPassword !== newPasswordData.confirmPassword) {
      setError('Kata sandi tidak cocok');
      setLoading(false);
      return;
    }

    if (newPasswordData.newPassword.length < 6) {
      setError('Kata sandi minimal 6 karakter');
      setLoading(false);
      return;
    }

    try {
      const response = await api.post('/auth/set-password', {
        newPassword: newPasswordData.newPassword,
        confirmPassword: newPasswordData.confirmPassword,
      });

      if (response.data.success) {
        toast.success('Kata sandi berhasil diatur!');
        setNewPasswordData({
          newPassword: '',
          confirmPassword: '',
        });
        // Update user data to reflect hasPassword = true
        updateUser({ ...user, hasPassword: true });
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Gagal mengatur kata sandi';
      setError(errorMessage);
      toast.error(errorMessage);
    }

    setLoading(false);
  };

  // SSO functions
  const handleLinkSso = async (provider) => {
    try {
      setSsoLoading(true);
      // Get SSO redirect URL - will redirect back with code
      const response = await api.get(`/auth/sso/init?provider=${provider}&mode=link`);
      const { authUrl } = response.data.data;
      
      // Store that we're in link mode
      sessionStorage.setItem('sso_link_mode', 'true');
      
      // Redirect to SSO provider
      window.location.href = authUrl;
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal menghubungkan SSO');
      setSsoLoading(false);
    }
  };

  const handleUnlinkSso = async (provider) => {
    if (!window.confirm(`Yakin ingin memutuskan koneksi akun ${provider.toUpperCase()}?`)) {
      return;
    }
    
    try {
      setSsoLoading(true);
      const result = await unlinkSsoIdentity(provider);
      if (result.success) {
        toast.success('Koneksi SSO berhasil diputus');
      } else {
        toast.error(result.error || 'Gagal memutus koneksi SSO');
      }
    } catch (err) {
      toast.error('Gagal memutus koneksi SSO');
    } finally {
      setSsoLoading(false);
    }
  };

  const isProviderLinked = (providerId) => {
    return ssoIdentities.some(identity => identity.provider === providerId);
  };

  const getLinkedIdentity = (providerId) => {
    return ssoIdentities.find(identity => identity.provider === providerId);
  };

  const getProviderDisplayName = (providerId) => {
    const names = {
      simpatik: 'SIMPATIK'
    };
    return names[providerId] || providerId.toUpperCase();
  };




  return (
    <Layout>
      <Container maxWidth="md">
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.5, md: 3 },
            mb: 4,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            backgroundColor: 'background.paper',
          }}
        >
          <Stack direction="row" alignItems="center" spacing={2.5}>
            <Avatar
              sx={{
                width: 56,
                height: 56,
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                border: '1px solid rgba(255,255,255,0.9)',
                boxShadow: '0 10px 26px rgba(2, 6, 23, 0.12)',
                fontSize: '1.4rem',
                fontWeight: 800,
              }}
            >
              {user?.fullName?.charAt(0)?.toUpperCase() || 'U'}
            </Avatar>
            <Box>
              <Typography variant="h4" component="h1" sx={{ fontWeight: 800, mb: 0.25 }}>
                Profil Saya
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Kelola informasi profil dan keamanan akun Anda
              </Typography>
            </Box>
          </Stack>
        </Paper>

        {/* Tabs */}
        <Box sx={{ mb: 3 }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            sx={{
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '1rem',
                px: 3,
              },
            }}
          >
            <Tab label="Informasi Profil" />
            <Tab label={userHasPassword ? 'Ubah Kata Sandi' : 'Atur Kata Sandi'} />
            {ssoProviders.length > 0 && <Tab label="Koneksi SSO" />}
          </Tabs>
        </Box>

        {/* Tab Content */}
        <Box>
          {tabValue === 0 && (
            <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
              <CardContent sx={{ p: 4 }}>
                <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                  <Avatar
                    sx={{
                      width: 56,
                      height: 56,
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                      border: '1px solid rgba(255,255,255,0.9)',
                      boxShadow: '0 10px 26px rgba(2, 6, 23, 0.10)',
                    }}
                  >
                    <EditOutlined sx={{ fontSize: 28 }} />
                  </Avatar>
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 600 }}>
                      Informasi Profil
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Perbarui informasi profil Anda
                    </Typography>
                  </Box>
                </Stack>

                {error && (
                  <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
                    {error}
                  </Alert>
                )}

                <Box component="form" onSubmit={handleProfileSubmit}>
                  <Grid container spacing={3}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        required
                        fullWidth
                        id="fullName"
                        label="Nama Lengkap"
                        name="fullName"
                        value={profileData.fullName}
                        onChange={handleProfileChange}
                        disabled={loading}
                        InputProps={{
                          startAdornment: <PersonOutlined sx={{ mr: 1, color: 'text.secondary' }} />,
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
                        value={profileData.username}
                        onChange={handleProfileChange}
                        disabled={loading}
                        InputProps={{
                          startAdornment: <BadgeOutlined sx={{ mr: 1, color: 'text.secondary' }} />,
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
                        type="email"
                        value={profileData.email}
                        onChange={handleProfileChange}
                        disabled={loading}
                        InputProps={{
                          startAdornment: <EmailOutlined sx={{ mr: 1, color: 'text.secondary' }} />,
                        }}
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <Button
                        type="submit"
                        variant="contained"
                        size="large"
                        disabled={loading}
                        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SaveOutlined />}
                        sx={{
                          px: 4,
                          py: 1.5,
                          borderRadius: 2,
                          fontWeight: 700,
                        }}
                      >
                        {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
                      </Button>
                    </Grid>
                  </Grid>
                </Box>
              </CardContent>
            </Card>
          )}
          {tabValue === 1 && (
            <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
              <CardContent sx={{ p: 4 }}>
                <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                  <Avatar
                    sx={{
                      width: 56,
                      height: 56,
                      background: 'linear-gradient(135deg, #FF9800 0%, #F57C00 100%)',
                    }}
                  >
                    <LockOutlined sx={{ fontSize: 28 }} />
                  </Avatar>
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 600 }}>
                      {userHasPassword ? 'Ubah Kata Sandi' : 'Atur Kata Sandi'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {userHasPassword 
                        ? 'Perbarui kata sandi akun Anda untuk keamanan'
                        : 'Atur kata sandi agar bisa login tanpa SSO'}
                    </Typography>
                  </Box>
                </Stack>

                {error && (
                  <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
                    {error}
                  </Alert>
                )}

                {/* Form for users who already have password */}
                {userHasPassword ? (
                  <Box component="form" onSubmit={handlePasswordSubmit}>
                    <Grid container spacing={3}>
                      <Grid item xs={12}>
                        <TextField
                          required
                          fullWidth
                          name="currentPassword"
                          label="Kata Sandi Saat Ini"
                          type="password"
                          value={passwordData.currentPassword}
                          onChange={handlePasswordChange}
                          disabled={loading}
                          InputProps={{
                            startAdornment: <LockOutlined sx={{ mr: 1, color: 'text.secondary' }} />,
                          }}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              borderRadius: 2,
                            },
                          }}
                        />
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <TextField
                          required
                          fullWidth
                          name="newPassword"
                          label="Kata Sandi Baru"
                          type="password"
                          value={passwordData.newPassword}
                          onChange={handlePasswordChange}
                          disabled={loading}
                          InputProps={{
                            startAdornment: <LockOutlined sx={{ mr: 1, color: 'text.secondary' }} />,
                          }}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              borderRadius: 2,
                            },
                          }}
                        />
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <TextField
                          required
                          fullWidth
                          name="confirmPassword"
                          label="Konfirmasi Kata Sandi Baru"
                          type="password"
                          value={passwordData.confirmPassword}
                          onChange={handlePasswordChange}
                          disabled={loading}
                          InputProps={{
                            startAdornment: <LockOutlined sx={{ mr: 1, color: 'text.secondary' }} />,
                          }}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              borderRadius: 2,
                            },
                          }}
                        />
                      </Grid>

                      <Grid item xs={12}>
                        <Button
                          type="submit"
                          variant="contained"
                          size="large"
                          disabled={loading}
                          startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SaveOutlined />}
                          sx={{
                            px: 4,
                            py: 1.5,
                            borderRadius: 2,
                            fontWeight: 600,
                            background: 'linear-gradient(135deg, #FF9800 0%, #F57C00 100%)',
                            textTransform: 'none',
                            '&:hover': {
                              transform: 'translateY(-2px)',
                              boxShadow: '0 8px 25px rgba(255, 152, 0, 0.3)',
                            },
                          }}
                        >
                          {loading ? 'Mengubah...' : 'Ubah Kata Sandi'}
                        </Button>
                      </Grid>
                    </Grid>
                  </Box>
                ) : (
                  /* Form for SSO users who need to set password */
                  <Box component="form" onSubmit={handleSetPasswordSubmit}>
                    <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
                      Anda login menggunakan SSO dan belum memiliki kata sandi. 
                      Atur kata sandi agar dapat login menggunakan email dan kata sandi, 
                      serta dapat memutuskan koneksi SSO.
                    </Alert>

                    <Grid container spacing={3}>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          required
                          fullWidth
                          name="newPassword"
                          label="Kata Sandi Baru"
                          type="password"
                          value={newPasswordData.newPassword}
                          onChange={handleSetPasswordChange}
                          disabled={loading}
                          placeholder="Minimal 6 karakter"
                          InputProps={{
                            startAdornment: <LockOutlined sx={{ mr: 1, color: 'text.secondary' }} />,
                          }}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              borderRadius: 2,
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
                          value={newPasswordData.confirmPassword}
                          onChange={handleSetPasswordChange}
                          disabled={loading}
                          placeholder="Ulangi kata sandi"
                          InputProps={{
                            startAdornment: <LockOutlined sx={{ mr: 1, color: 'text.secondary' }} />,
                          }}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              borderRadius: 2,
                            },
                          }}
                        />
                      </Grid>

                      <Grid item xs={12}>
                        <Button
                          type="submit"
                          variant="contained"
                          size="large"
                          disabled={loading}
                          startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SaveOutlined />}
                          sx={{
                            px: 4,
                            py: 1.5,
                            borderRadius: 2,
                            fontWeight: 600,
                            background: 'linear-gradient(135deg, #FF9800 0%, #F57C00 100%)',
                            textTransform: 'none',
                            '&:hover': {
                              transform: 'translateY(-2px)',
                              boxShadow: '0 8px 25px rgba(255, 152, 0, 0.3)',
                            },
                          }}
                        >
                          {loading ? 'Menyimpan...' : 'Atur Kata Sandi'}
                        </Button>
                      </Grid>
                    </Grid>
                  </Box>
                )}
              </CardContent>
            </Card>
          )}

          {/* SSO Connections Tab */}
          {tabValue === 2 && ssoProviders.length > 0 && (
            <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
              <CardContent sx={{ p: 4 }}>
                <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                  <Avatar
                    sx={{
                      width: 56,
                      height: 56,
                      background: 'linear-gradient(135deg, #2d4b81 0%, #1a365d 100%)',
                    }}
                  >
                    <LinkOutlined sx={{ fontSize: 28 }} />
                  </Avatar>
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 600 }}>
                      Koneksi SSO
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Hubungkan akun Anda dengan layanan Single Sign-On
                    </Typography>
                  </Box>
                </Stack>

                <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
                  Dengan menghubungkan akun SSO, Anda dapat login lebih cepat tanpa perlu memasukkan email dan kata sandi.
                </Alert>

                {/* Warning for SSO-only users */}
                {!userHasPassword && ssoIdentities.length > 0 && (
                  <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
                    Anda belum mengatur kata sandi. Untuk dapat memutuskan koneksi SSO, 
                    silakan atur kata sandi terlebih dahulu di tab "Atur Kata Sandi".
                  </Alert>
                )}

                <Stack spacing={2}>
                  {ssoProviders.map((provider) => {
                    const isLinked = isProviderLinked(provider.id);
                    const linkedIdentity = getLinkedIdentity(provider.id);
                    
                    return (
                      <Paper
                        key={provider.id}
                        variant="outlined"
                        sx={{
                          p: 2.5,
                          borderRadius: 2,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: 2,
                          borderColor: isLinked ? 'success.light' : 'divider',
                          backgroundColor: isLinked ? 'rgba(46, 125, 50, 0.04)' : 'transparent'
                        }}
                      >
                        <Stack direction="row" alignItems="center" spacing={2}>
                          <Avatar
                            sx={{
                              width: 48,
                              height: 48,
                              bgcolor: '#2d4b81',
                              fontSize: '0.9rem',
                              fontWeight: 700
                            }}
                          >
                            {provider.name.substring(0, 2).toUpperCase()}
                          </Avatar>
                          <Box>
                            <Stack direction="row" alignItems="center" spacing={1}>
                              <Typography variant="subtitle1" fontWeight={600}>
                                {getProviderDisplayName(provider.id)}
                              </Typography>
                              {isLinked && (
                                <Chip
                                  size="small"
                                  icon={<CheckCircleOutlined sx={{ fontSize: 16 }} />}
                                  label="Terhubung"
                                  color="success"
                                  sx={{ fontWeight: 600 }}
                                />
                              )}
                            </Stack>
                            {isLinked && linkedIdentity?.providerEmail && (
                              <Typography variant="body2" color="text.secondary">
                                {linkedIdentity.providerEmail}
                              </Typography>
                            )}
                            {isLinked && linkedIdentity?.lastLoginAt && (
                              <Typography variant="caption" color="text.secondary">
                                Login terakhir: {new Date(linkedIdentity.lastLoginAt).toLocaleDateString('id-ID', {
                                  day: 'numeric',
                                  month: 'long',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </Typography>
                            )}
                          </Box>
                        </Stack>

                        <Box>
                          {isLinked ? (
                            <Button
                              variant="outlined"
                              color="error"
                              size="small"
                              startIcon={ssoLoading ? <CircularProgress size={16} /> : <LinkOffOutlined />}
                              onClick={() => handleUnlinkSso(provider.id)}
                              disabled={ssoLoading || (!userHasPassword && ssoIdentities.length <= 1)}
                              sx={{ borderRadius: 2, fontWeight: 600 }}
                            >
                              {ssoLoading ? 'Memproses...' : 'Putuskan'}
                            </Button>
                          ) : (
                            <Button
                              variant="contained"
                              size="small"
                              startIcon={ssoLoading ? <CircularProgress size={16} color="inherit" /> : <OpenInNew />}
                              onClick={() => handleLinkSso(provider.id)}
                              disabled={ssoLoading}
                              sx={{
                                borderRadius: 2,
                                fontWeight: 600,
                                backgroundColor: '#2d4b81',
                                '&:hover': { backgroundColor: '#1a365d' }
                              }}
                            >
                              {ssoLoading ? 'Menghubungkan...' : 'Hubungkan'}
                            </Button>
                          )}
                        </Box>
                      </Paper>
                    );
                  })}
                </Stack>
              </CardContent>
            </Card>
          )}
        </Box>
      </Container>
    </Layout>
  );
};

export default Profile;
