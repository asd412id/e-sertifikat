import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Stack,
  Avatar,
  Divider
} from '@mui/material';
import {
  DownloadOutlined,
  VerifiedOutlined,
  ErrorOutline,
  BadgeOutlined
} from '@mui/icons-material';
import { useParams, Link as RouterLink } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';

const DownloadCertificate = () => {
  const { slug } = useParams();

  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [error, setError] = useState('');

  const [portalInfo, setPortalInfo] = useState(null);
  const [identifier, setIdentifier] = useState('');
  const [criteria, setCriteria] = useState({});
  const [searchResults, setSearchResults] = useState(null);

  const identifierLabel = portalInfo?.identifierLabel || portalInfo?.identifierField || 'Identitas';
  const matchMode = portalInfo?.matchMode || 'exact';
  const searchFields = Array.isArray(portalInfo?.searchFields) && portalInfo.searchFields.length
    ? portalInfo.searchFields
    : [{ name: portalInfo?.identifierField, label: identifierLabel, matchMode, required: true }].filter(f => f.name);

  const title = useMemo(() => {
    if (portalInfo?.event?.title) return `Download Sertifikat - ${portalInfo.event.title}`;
    return 'Download Sertifikat';
  }, [portalInfo]);

  useEffect(() => {
    document.title = title;
  }, [title]);

  useEffect(() => {
    let mounted = true;

    const fetchInfo = async () => {
      try {
        setLoading(true);
        setError('');

        const response = await api.get(`/certificates/public/${slug}`);
        if (!mounted) return;

        setPortalInfo(response.data.data);
      } catch (e) {
        if (!mounted) return;
        setError(e?.response?.data?.error || 'Portal tidak ditemukan atau sedang dinonaktifkan');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    if (slug) fetchInfo();

    return () => {
      mounted = false;
    };
  }, [slug]);

  const handleSearch = async (e) => {
    e.preventDefault();
    try {
      setSearching(true);
      setError('');
      setSearchResults(null);

      // Validate required fields
      for (const f of (searchFields || [])) {
        if (!f?.name) continue;
        const v = String((criteria && typeof criteria === 'object') ? (criteria[f.name] || '') : '').trim();
        if (f.required && !v) {
          setError(`Silakan isi ${String(f.label || f.name).toLowerCase()} terlebih dahulu`);
          return;
        }
      }

      // Legacy compatibility: allow single identifier if no searchFields defined
      if ((!searchFields || searchFields.length === 0) && !identifier.trim()) {
        setError('Silakan isi identitas terlebih dahulu');
        return;
      }

      const response = await api.post(
        `/certificates/public/${slug}/search`,
        {
          identifier: identifier.trim(),
          criteria
        },
        { timeout: 30000 }
      );

      const data = response?.data?.data;
      const results = data?.results || [];
      setSearchResults({
        query: data?.query,
        matchMode: data?.matchMode,
        identifierField: data?.identifierField,
        resultFields: data?.resultFields,
        results
      });

      if (!results.length) {
        setError('Data tidak ditemukan. Pastikan identitas sesuai instruksi panitia.');
      }
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Gagal mencari data');
    } finally {
      setSearching(false);
    }
  };

  const downloadBlobAsFile = (blob, fileName) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    }, 150);
  };

  const handleDownloadParticipant = async (participant) => {
    try {
      setDownloadingId(participant?.id);
      setError('');

      const response = await api.post(
        `/certificates/public/${slug}/participants/${participant.id}/download-pdf`,
        {
          identifier: identifier.trim(),
          criteria
        },
        {
          responseType: 'blob',
          timeout: 300000
        }
      );

      const blob = response.data;
      if (!blob || blob.size === 0) {
        throw new Error('File sertifikat kosong atau tidak valid');
      }

      const safeName = String(participant?.name || 'participant')
        .replace(/[^\w\s-]/g, '_')
        .replace(/\s+/g, '_')
        .substring(0, 50);
      const fileName = `sertifikat_${safeName}_${participant.id}.pdf`;
      downloadBlobAsFile(blob, fileName);
      toast.success('Sertifikat berhasil diunduh');
    } catch (e) {
      // Axios blob error handling: try parse JSON
      if (e?.response?.data instanceof Blob) {
        try {
          const text = await e.response.data.text();
          const parsed = JSON.parse(text);
          setError(parsed?.error || 'Gagal mengunduh sertifikat');
          return;
        } catch {
          setError('Gagal mengunduh sertifikat');
          return;
        }
      }
      setError(e?.response?.data?.error || e?.message || 'Gagal mengunduh sertifikat');
    } finally {
      setDownloadingId(null);
    }
  };

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
              p: 4,
              textAlign: 'center',
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Avatar
              sx={{
                width: 80,
                height: 80,
                mx: 'auto',
                mb: 2,
                bgcolor: 'rgba(102, 126, 234, 0.14)',
                border: '1px solid rgba(102, 126, 234, 0.22)',
                color: 'primary.main',
              }}
            >
              <VerifiedOutlined sx={{ fontSize: 40 }} />
            </Avatar>
            <Typography component="h1" variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
              Download Sertifikat
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.9 }}>
              {portalInfo?.event?.title || 'Portal Sertifikat'}
            </Typography>
          </Box>

          <Box sx={{ p: 4 }}>
            {loading ? (
              <Box display="flex" justifyContent="center" alignItems="center" py={6}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                {!portalInfo ? (
                  <Box textAlign="center" py={3}>
                    <Typography variant="body1" color="text.secondary">
                      Portal tidak tersedia.
                    </Typography>
                  </Box>
                ) : (
                  <>
                    {error && !(searchResults && Array.isArray(searchResults.results) && searchResults.results.length === 0) && (
                      <Alert severity="error" sx={{ borderRadius: 2, mb: 2 }} icon={<ErrorOutline />}>
                        {error}
                      </Alert>
                    )}

                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Masukkan data sesuai yang diminta panitia, lalu pilih data yang benar untuk mengunduh sertifikat.
                    </Typography>

                    <Box component="form" onSubmit={handleSearch}>
                      <Stack spacing={2.5}>
                        {(searchFields && searchFields.length ? searchFields : []).map((f) => (
                          <TextField
                            key={f.name}
                            fullWidth
                            label={f.label || f.name}
                            placeholder={(() => {
                              const base = String(f.label || f.name).toLowerCase();
                              return f.matchMode === 'fuzzy'
                                ? `Ketik ${base}...`
                                : `Masukkan ${base}...`;
                            })()}
                            helperText={f.matchMode === 'fuzzy'
                              ? `Pencarian mirip: bisa muncul beberapa hasil. Ketik ${String(f.label || f.name).toLowerCase()} sebagian, lalu pilih yang benar.`
                              : `Pencarian sama persis: pastikan ${String(f.label || f.name).toLowerCase()} sesuai.`}
                            value={String((criteria && typeof criteria === 'object') ? (criteria[f.name] || '') : '')}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCriteria((prev) => ({ ...(prev && typeof prev === 'object' ? prev : {}), [f.name]: val }));
                              // keep legacy single identifier for compatibility (first field)
                              if ((searchFields?.[0]?.name || portalInfo?.identifierField) === f.name) {
                                setIdentifier(val);
                              }
                            }}
                            disabled={searching || !!downloadingId}
                            InputProps={{
                              startAdornment: <BadgeOutlined sx={{ mr: 1, color: 'text.secondary' }} />
                            }}
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                borderRadius: 2,
                                backgroundColor: 'rgba(0,0,0,0.02)',
                                '&:hover': { backgroundColor: 'rgba(0,0,0,0.04)' },
                                '&.Mui-focused': { backgroundColor: 'transparent' },
                              },
                            }}
                          />
                        ))}

                        <Button
                          type="submit"
                          fullWidth
                          variant="contained"
                          size="large"
                          disabled={searching || loading || !!downloadingId}
                          startIcon={searching ? <CircularProgress size={20} color="inherit" /> : <DownloadOutlined />}
                          sx={{
                            mt: 1,
                            py: 1.35,
                            borderRadius: 2,
                            fontSize: '1.05rem',
                            fontWeight: 700,
                          }}
                        >
                          {searching ? 'Mencari...' : 'Cari Sertifikat'}
                        </Button>

                        {searchResults && (
                          <>
                            <Divider sx={{ my: 1.5 }}>
                              <Typography variant="caption" color="text.secondary">
                                hasil
                              </Typography>
                            </Divider>

                            {(searchResults.results || []).length === 0 ? (
                              <Alert severity="warning" sx={{ borderRadius: 2 }} icon={<ErrorOutline />}>
                                Tidak ada data yang cocok.
                              </Alert>
                            ) : (
                              <Stack spacing={1.25}>
                                {(searchResults.results || []).map((r) => (
                                  <Paper
                                    key={r.id}
                                    variant="outlined"
                                    sx={{
                                      borderRadius: 2,
                                      p: 1.5,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      gap: 2,
                                    }}
                                  >
                                    <Box sx={{ minWidth: 0 }}>
                                      <Typography sx={{ fontWeight: 800 }} noWrap>
                                        {r.name}
                                      </Typography>
                                      {Array.isArray(r.displayFields) && r.displayFields.length > 0 ? (
                                        r.displayFields.map((f) => (
                                          <Typography key={f.name} variant="body2" color="text.secondary" noWrap>
                                            {f.label}: {f.value}
                                          </Typography>
                                        ))
                                      ) : (
                                        <Typography variant="body2" color="text.secondary" noWrap>
                                          {r.identifierValue}
                                        </Typography>
                                      )}
                                    </Box>
                                    <Button
                                      variant="contained"
                                      size="small"
                                      onClick={() => handleDownloadParticipant(r)}
                                      disabled={!!downloadingId || searching}
                                      startIcon={downloadingId === r.id ? <CircularProgress size={16} color="inherit" /> : <DownloadOutlined />}
                                      sx={{ borderRadius: 2, fontWeight: 800, whiteSpace: 'nowrap' }}
                                    >
                                      {downloadingId === r.id ? 'Mengunduh...' : 'Download'}
                                    </Button>
                                  </Paper>
                                ))}
                              </Stack>
                            )}
                          </>
                        )}
                      </Stack>
                    </Box>
                  </>
                )}
              </>
            )}
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default DownloadCertificate;
