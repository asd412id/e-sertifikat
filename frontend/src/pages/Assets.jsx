import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from '@mui/material';
import { DeleteOutline, Refresh, Close } from '@mui/icons-material';
import Layout from '../components/Layout';
import api from '../services/api';
import toast from 'react-hot-toast';

const formatBytes = (bytes) => {
  if (bytes === null || bytes === undefined) return '-';
  const n = Number(bytes);
  if (Number.isNaN(n)) return '-';
  if (n === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(n) / Math.log(k));
  const value = n / Math.pow(k, i);
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${sizes[i]}`;
};

const toAssetUrl = (assetPath) => {
  if (typeof assetPath !== 'string') return '';
  if (!assetPath.startsWith('/uploads/')) return assetPath;
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
  return `${apiBaseUrl}${assetPath}`;
};

const Assets = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [assets, setAssets] = useState([]);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const title = useMemo(() => 'Asset/File', []);

  useEffect(() => {
    document.title = `${title} - e-Sertifikat`;
  }, [title]);

  const fetchAssets = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/assets');
      const data = res?.data?.data || {};
      setAssets(Array.isArray(data.assets) ? data.assets : []);
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Gagal memuat asset');
      setAssets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  const openDeleteDialog = (asset) => {
    setSelectedAsset(asset || null);
    setDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    if (deleting) return;
    setDeleteDialogOpen(false);
    setSelectedAsset(null);
  };

  const doDeleteAsset = async ({ force }) => {
    if (!selectedAsset?.fileName) return;

    try {
      setDeleting(true);
      const qs = force ? '?force=true' : '';
      await api.delete(`/assets/${encodeURIComponent(selectedAsset.fileName)}${qs}`);
      toast.success('Asset berhasil dihapus');
      closeDeleteDialog();
      await fetchAssets();
    } catch (e) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.error || e?.message || 'Gagal menghapus asset';
      const data = e?.response?.data?.data;

      if (status === 409 && data?.usedBy) {
        setSelectedAsset((prev) => ({
          ...(prev || {}),
          usedBy: data.usedBy,
          path: data.path || prev?.path
        }));
        toast.error('Asset masih digunakan oleh template. Konfirmasi ulang untuk hapus paksa.');
        return;
      }

      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  const usedBy = Array.isArray(selectedAsset?.usedBy) ? selectedAsset.usedBy : [];
  const assetUrl = toAssetUrl(selectedAsset?.path);

  return (
    <Layout>
      <Box sx={{ mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={2}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 900, mb: 0.5 }}>
              Asset/File
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Kelola file asset yang digunakan pada template sertifikat kamu.
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={fetchAssets}
            disabled={loading}
          >
            Refresh
          </Button>
        </Stack>
      </Box>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      ) : null}

      <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ p: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>Daftar Asset</Typography>
            <Typography variant="caption" color="text.secondary">
              Total: {assets.length}
            </Typography>
          </Stack>
        </Box>

        {loading ? (
          <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800 }}>Preview</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>File</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Ukuran</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Last Modified</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Dipakai</TableCell>
                  <TableCell sx={{ fontWeight: 800 }} align="right">Aksi</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {assets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      Tidak ada asset yang terdeteksi pada template.
                    </TableCell>
                  </TableRow>
                ) : assets.map((a) => {
                  const url = toAssetUrl(a.path);
                  const usedCount = Array.isArray(a.usedBy) ? a.usedBy.length : 0;
                  return (
                    <TableRow key={a.path} hover>
                      <TableCell>
                        {url ? (
                          <Box
                            component="img"
                            src={url}
                            alt={a.fileName}
                            sx={{ width: 64, height: 36, objectFit: 'cover', borderRadius: 1, border: '1px solid', borderColor: 'divider', backgroundColor: '#fff' }}
                            onError={(e) => {
                              try { e.currentTarget.style.display = 'none'; } catch (_) {}
                            }}
                          />
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {a.fileName || '-'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {a.path || ''}
                        </Typography>
                        {!a.exists ? (
                          <Typography variant="caption" color="error.main" sx={{ display: 'block' }}>
                            File hilang di server
                          </Typography>
                        ) : null}
                      </TableCell>
                      <TableCell>{formatBytes(a.size)}</TableCell>
                      <TableCell>
                        {a.lastModified ? new Date(a.lastModified).toLocaleString() : '-'}
                      </TableCell>
                      <TableCell>{usedCount}</TableCell>
                      <TableCell align="right">
                        <IconButton
                          color="error"
                          onClick={() => openDeleteDialog(a)}
                          size="small"
                          disabled={!a.exists}
                        >
                          <DeleteOutline />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Dialog open={deleteDialogOpen} onClose={closeDeleteDialog} fullWidth maxWidth="sm">
        <DialogTitle sx={{ pr: 6 }}>
          Konfirmasi Hapus Asset
          <IconButton
            onClick={closeDeleteDialog}
            sx={{ position: 'absolute', right: 8, top: 8 }}
            disabled={deleting}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>File</Typography>
              <Typography variant="body2" color="text.secondary">{selectedAsset?.fileName || '-'}</Typography>
            </Box>

            {assetUrl ? (
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <Box
                  component="img"
                  src={assetUrl}
                  alt={selectedAsset?.fileName}
                  sx={{ maxWidth: '100%', maxHeight: 220, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}
                  onError={(e) => {
                    try { e.currentTarget.style.display = 'none'; } catch (_) {}
                  }}
                />
              </Box>
            ) : null}

            {usedBy.length ? (
              <>
                <Alert severity="warning">
                  Asset ini sedang digunakan oleh {usedBy.length} template. Menghapus file dapat membuat template tidak bisa menampilkan gambar.
                </Alert>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>Digunakan pada template</Typography>
                  <Stack spacing={1}>
                    {usedBy.map((u) => (
                      <Paper key={`${u.templateUuid}-${u.eventUuid}`} variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                        <Typography variant="body2" sx={{ fontWeight: 800 }}>{u.templateName || '-'} </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Event: {u.eventTitle || '-'}
                        </Typography>
                      </Paper>
                    ))}
                  </Stack>
                </Box>
              </>
            ) : (
              <Alert severity="info">Asset ini tidak terdeteksi digunakan oleh template mana pun.</Alert>
            )}

            <Divider />
            <Typography variant="caption" color="text.secondary">
              Setelah dihapus, file tidak dapat dipulihkan.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDeleteDialog} disabled={deleting}>Batal</Button>
          <Button
            variant="contained"
            color="error"
            disabled={deleting}
            onClick={() => doDeleteAsset({ force: usedBy.length > 0 })}
          >
            {deleting ? 'Menghapus...' : (usedBy.length ? 'Hapus Paksa' : 'Hapus')}
          </Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
};

export default Assets;
