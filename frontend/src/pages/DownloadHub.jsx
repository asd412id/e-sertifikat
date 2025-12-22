import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Stack,
  Avatar,
  Divider,
  Card,
  CardContent,
  Button,
  TextField,
  InputAdornment,
  Tooltip,
  Pagination
} from '@mui/material';
import {
  VerifiedOutlined,
  Event as EventIcon,
  ContentCopy,
  OpenInNew,
  Search
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';

const DownloadHub = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [events, setEvents] = useState([]);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    limit: 12
  });

  useEffect(() => {
    document.title = 'Download Sertifikat';
  }, []);

  const fetchEvents = async (page = 1, searchText = search) => {
    try {
      setLoading(true);
      setError('');
      const q = String(searchText || '').trim();
      const res = await api.get(
        `/certificates/public/events?page=${page}&limit=${pagination.limit}&search=${encodeURIComponent(q)}`
      );

      const data = res?.data?.data || {};
      const list = data?.events || [];
      setEvents(Array.isArray(list) ? list : []);
      setPagination({
        currentPage: data?.currentPage || page,
        totalPages: data?.totalPages || 1,
        totalCount: data?.totalCount || 0,
        limit: data?.limit || pagination.limit
      });
    } catch (e) {
      setError(e?.response?.data?.error || 'Gagal memuat daftar kegiatan');
      setEvents([]);
      setPagination((prev) => ({ ...prev, currentPage: 1, totalPages: 1, totalCount: 0 }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents(1, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchEvents(1, search);
    }, 450);
    return () => clearTimeout(handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const getPublicDownloadUrl = (event) => {
    const slug = event?.publicDownloadSlug;
    if (!slug) return '';
    return `${window.location.origin}/download/${slug}`;
  };

  const handleCopyLink = async (event) => {
    try {
      const url = getPublicDownloadUrl(event);
      if (!url) {
        toast.error('Link belum tersedia');
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success('Link berhasil disalin');
    } catch {
      toast.error('Gagal menyalin link');
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background:
          'radial-gradient(900px 420px at 15% 10%, rgba(102, 126, 234, 0.16) 0%, rgba(102, 126, 234, 0) 60%), radial-gradient(900px 420px at 90% 20%, rgba(118, 75, 162, 0.12) 0%, rgba(118, 75, 162, 0) 55%), #f8fafc',
        display: 'flex',
        alignItems: { xs: 'flex-start', sm: 'center' },
        justifyContent: 'center',
        p: { xs: 1.25, sm: 2 },
        py: { xs: 2, sm: 2 }
      }}
    >
      <Container component="main" maxWidth="md" disableGutters sx={{ px: { xs: 0, sm: 2 } }}>
        <Paper
          elevation={0}
          sx={{
            borderRadius: 4,
            overflow: 'hidden',
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: '0 24px 80px rgba(2, 6, 23, 0.10)',
            backgroundColor: 'background.paper'
          }}
        >
          <Box
            sx={{
              p: { xs: 3, sm: 4 },
              textAlign: 'center',
              borderBottom: '1px solid',
              borderColor: 'divider'
            }}
          >
            <Avatar
              sx={{
                width: { xs: 74, sm: 80 },
                height: { xs: 74, sm: 80 },
                mx: 'auto',
                mb: 2,
                bgcolor: 'rgba(102, 126, 234, 0.14)',
                border: '1px solid rgba(102, 126, 234, 0.22)',
                color: 'primary.main'
              }}
            >
              <VerifiedOutlined sx={{ fontSize: 40 }} />
            </Avatar>
            <Typography component="h1" variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
              Download Sertifikat
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Pilih kegiatan Anda untuk melanjutkan proses unduh sertifikat
            </Typography>
          </Box>

          <Box sx={{ p: { xs: 3, sm: 4 } }}>
            <Stack spacing={2.25}>
              <TextField
                fullWidth
                size="small"
                placeholder="Cari kegiatan..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search fontSize="small" />
                    </InputAdornment>
                  )
                }}
              />

              {loading ? (
                <Box display="flex" justifyContent="center" alignItems="center" py={6}>
                  <CircularProgress />
                </Box>
              ) : error ? (
                <Alert severity="error">{error}</Alert>
              ) : events.length === 0 ? (
                <Box textAlign="center" py={3}>
                  <Typography variant="body1" color="text.secondary">
                    Belum ada kegiatan yang membuka portal download sertifikat.
                  </Typography>
                </Box>
              ) : (
                <Stack spacing={2}>
                  {events.map((event) => (
                    <Card
                      key={event.publicDownloadSlug || event.uuid || event.id}
                      elevation={0}
                      sx={{
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 3,
                        transition: 'all 0.2s ease',
                        '&:hover': { boxShadow: 2 }
                      }}
                    >
                      <CardContent sx={{ p: 3 }}>
                        <Stack spacing={1.75}>
                          <Box display="flex" alignItems="flex-start" justifyContent="space-between" gap={2}>
                            <Box display="flex" alignItems="flex-start" gap={1.5} sx={{ minWidth: 0 }}>
                              <Avatar
                                sx={{
                                  width: 42,
                                  height: 42,
                                  bgcolor: 'rgba(118, 75, 162, 0.10)',
                                  border: '1px solid rgba(118, 75, 162, 0.18)',
                                  color: 'secondary.main'
                                }}
                              >
                                <EventIcon sx={{ fontSize: 22 }} />
                              </Avatar>
                              <Box sx={{ minWidth: 0 }}>
                                <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }} noWrap>
                                  {event.title}
                                </Typography>
                                {event.description ? (
                                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                                    {event.description}
                                  </Typography>
                                ) : null}
                              </Box>
                            </Box>

                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                              <Tooltip title="Salin Link">
                                <Button
                                  variant="outlined"
                                  startIcon={<ContentCopy />}
                                  onClick={() => handleCopyLink(event)}
                                  sx={{ borderRadius: 2, fontWeight: 800 }}
                                >
                                  Salin Link
                                </Button>
                              </Tooltip>
                              <Button
                                variant="contained"
                                startIcon={<OpenInNew />}
                                onClick={() => navigate(`/download/${event.publicDownloadSlug}`)}
                                sx={{ borderRadius: 2, fontWeight: 800 }}
                              >
                                Buka
                              </Button>
                            </Stack>
                          </Box>

                          <Divider />

                          <TextField
                            fullWidth
                            size="small"
                            label="Link Download"
                            value={getPublicDownloadUrl(event)}
                            InputProps={{ readOnly: true }}
                          />
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}

                  {pagination.totalPages > 1 && (
                    <Box display="flex" justifyContent="center" alignItems="center" pt={1}>
                      <Pagination
                        count={pagination.totalPages}
                        page={pagination.currentPage}
                        onChange={(e, page) => fetchEvents(page, search)}
                        color="primary"
                        showFirstButton
                        showLastButton
                      />
                    </Box>
                  )}
                </Stack>
              )}
            </Stack>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default DownloadHub;
