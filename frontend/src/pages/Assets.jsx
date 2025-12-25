import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  Paper,
  Stack,
  Pagination,
  Tooltip,
  Typography
} from '@mui/material';
import { DeleteOutline, Refresh, Close, UploadFile } from '@mui/icons-material';
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

const getExtLabel = (fileName) => {
  const raw = String(fileName || '').trim();
  const dot = raw.lastIndexOf('.');
  if (dot <= 0 || dot === raw.length - 1) return 'FILE';
  return raw.substring(dot + 1).toUpperCase();
};

const Assets = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [assets, setAssets] = useState([]);

  const [dragOver, setDragOver] = useState(false);
  const dragCounterRef = useRef(0);

  const [uploading, setUploading] = useState(false);
  const [uploadInputKey, setUploadInputKey] = useState(0);

  const [backfilling, setBackfilling] = useState(false);

  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    limit: 54
  });

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [selectedAssetIds, setSelectedAssetIds] = useState([]);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewAsset, setPreviewAsset] = useState(null);

  const title = useMemo(() => 'Asset/File', []);

  useEffect(() => {
    document.title = `${title} - e-Sertifikat`;
  }, [title]);

  const fetchAssets = async (page = pagination.currentPage) => {
    try {
      setLoading(true);
      setError('');
      setSelectedAssetIds([]);
      const res = await api.get('/assets', {
        params: {
          page,
          limit: pagination.limit
        }
      });
      const data = res?.data?.data || {};

      const list = Array.isArray(data.assets) ? data.assets : [];
      const nextCurrentPage = Number(data.currentPage || page || 1);
      const nextTotalPages = Number(data.totalPages || 1);
      const nextTotalCount = Number(data.totalCount || 0);
      const nextLimit = Number(data.limit || pagination.limit);

      setAssets(list);
      setPagination((prev) => ({
        ...(prev || {}),
        currentPage: nextCurrentPage,
        totalPages: nextTotalPages,
        totalCount: nextTotalCount,
        limit: nextLimit
      }));
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Gagal memuat asset');
      setAssets([]);
      setPagination((prev) => ({ ...(prev || {}), totalPages: 1, totalCount: 0 }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets(1);
  }, []);

  const handleUploadAsset = useCallback(async (files) => {
    const list = Array.from(files || []).filter(Boolean);
    if (!list.length) return;

    try {
      setUploading(true);

      let ok = 0;
      let fail = 0;

      for (const file of list) {
        try {
          const formData = new FormData();
          formData.append('file', file);
          await api.post('/assets/upload', formData, {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          });
          ok += 1;
        } catch (e) {
          fail += 1;
        }
      }

      await fetchAssets(1);

      if (fail > 0) {
        toast.error(`Upload selesai: ${ok} berhasil, ${fail} gagal`);
      } else {
        toast.success(`Berhasil upload ${ok} file`);
      }
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.message || 'Gagal upload asset');
    } finally {
      setUploading(false);
      setUploadInputKey((k) => k + 1);
    }
  }, [pagination.limit]);

  useEffect(() => {
    const onPaste = (e) => {
      try {
        const t = e?.target;
        const tag = (t && t.tagName) ? String(t.tagName).toLowerCase() : '';
        if (tag === 'input' || tag === 'textarea' || t?.isContentEditable) return;

        const items = e?.clipboardData?.items;
        const list = [];
        for (const it of (items || [])) {
          if (it && it.kind === 'file') {
            const f = it.getAsFile?.();
            if (f && typeof f.type === 'string' && f.type.startsWith('image/')) {
              list.push(f);
            }
          }
        }
        if (!list.length) return;
        e.preventDefault();
        handleUploadAsset(list);
      } catch (_) {
      }
    };

    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [handleUploadAsset]);

  const onDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const hasFiles = Array.from(e.dataTransfer?.items || []).some((x) => x && x.kind === 'file');
    if (!hasFiles) return;
    dragCounterRef.current += 1;
    setDragOver(true);
  };

  const onDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setDragOver(false);
    }
  };

  const onDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setDragOver(false);

    const list = Array.from(e.dataTransfer?.files || []).filter((f) => f && String(f.type || '').startsWith('image/'));
    if (!list.length) return;
    handleUploadAsset(list);
  };

  const assetIdentifier = (a) => a?.uuid || a?.fileName || a?.path || '';
  const selectedSet = useMemo(() => new Set(selectedAssetIds), [selectedAssetIds]);
  const selectableAssets = useMemo(() => (Array.isArray(assets) ? assets : []).filter(a => Boolean(assetIdentifier(a))), [assets]);
  const selectedAssets = useMemo(() => selectableAssets.filter(a => selectedSet.has(assetIdentifier(a))), [selectableAssets, selectedSet]);
  const anySelected = selectedAssetIds.length > 0;
  const allSelectedOnPage = selectableAssets.length > 0 && selectableAssets.every(a => selectedSet.has(assetIdentifier(a)));
  const noneSelectedOnPage = selectableAssets.every(a => !selectedSet.has(assetIdentifier(a)));

  const toggleSelectAsset = (asset, checked) => {
    const id = assetIdentifier(asset);
    if (!id) return;
    setSelectedAssetIds((prev) => {
      const cur = Array.isArray(prev) ? prev : [];
      const exists = cur.includes(id);
      if (checked === true && !exists) return [...cur, id];
      if (checked === false && exists) return cur.filter(x => x !== id);
      return exists ? cur.filter(x => x !== id) : [...cur, id];
    });
  };

  const selectAllOnPage = () => {
    setSelectedAssetIds((prev) => {
      const cur = Array.isArray(prev) ? prev : [];
      const curSet = new Set(cur);
      for (const a of selectableAssets) curSet.add(assetIdentifier(a));
      return Array.from(curSet);
    });
  };

  const selectNone = () => {
    setSelectedAssetIds([]);
  };

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
    const identifier = selectedAsset?.uuid || selectedAsset?.fileName;
    if (!identifier) return;

    try {
      setDeleting(true);
      const qs = force ? '?force=true' : '';
      await api.delete(`/assets/${encodeURIComponent(identifier)}${qs}`);
      toast.success('Asset berhasil dihapus');
      closeDeleteDialog();

      const nextTotal = Math.max(0, (pagination.totalCount || 0) - 1);
      const nextTotalPages = Math.max(1, Math.ceil(nextTotal / (pagination.limit || 54)));
      const nextPage = Math.min(pagination.currentPage || 1, nextTotalPages);
      await fetchAssets(nextPage);
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

  const previewUsedBy = Array.isArray(previewAsset?.usedBy) ? previewAsset.usedBy : [];
  const previewUrl = toAssetUrl(previewAsset?.path);

  const bulkUsedCount = selectedAssets.reduce((sum, a) => sum + (Array.isArray(a?.usedBy) ? a.usedBy.length : 0), 0);
  const bulkForce = bulkUsedCount > 0;

  const doBulkDelete = async () => {
    if (!selectedAssets.length) {
      setBulkDeleteDialogOpen(false);
      return;
    }

    try {
      setBulkDeleting(true);
      for (const a of selectedAssets) {
        if (a && a.exists === false) continue;
        const id = a?.uuid || a?.fileName;
        if (!id) continue;
        const qs = bulkForce ? '?force=true' : '';
        await api.delete(`/assets/${encodeURIComponent(id)}${qs}`);
      }
      toast.success(`Berhasil menghapus ${selectedAssets.length} asset`);
      setBulkDeleteDialogOpen(false);
      setSelectedAssetIds([]);
      await fetchAssets(pagination.currentPage);
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.message || 'Gagal menghapus beberapa asset');
    } finally {
      setBulkDeleting(false);
    }
  };

  return (
    <Layout>
      <Box
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
        sx={{ position: 'relative' }}
      >
        {dragOver ? (
          <Box
            sx={{
              position: 'fixed',
              inset: 0,
              zIndex: 1400,
              backgroundColor: 'rgba(2, 6, 23, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none'
            }}
          >
            <Box
              sx={{
                px: 4,
                py: 3,
                borderRadius: 3,
                backgroundColor: 'background.paper',
                border: '2px dashed',
                borderColor: 'primary.main',
                boxShadow: '0 20px 60px rgba(0,0,0,0.25)'
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 900, textAlign: 'center' }}>
                Lepaskan untuk upload
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 0.5 }}>
                Kamu juga bisa paste gambar dari clipboard
              </Typography>
            </Box>
          </Box>
        ) : null}

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
            <Stack direction="row" spacing={1} justifyContent={{ xs: 'flex-start', sm: 'flex-end' }}>
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={() => fetchAssets(pagination.currentPage)}
                disabled={loading || backfilling}
              >
                Refresh
              </Button>
              <Button
                variant="contained"
                component="label"
                startIcon={uploading ? <CircularProgress size={18} color="inherit" /> : <UploadFile />}
                disabled={loading || backfilling || uploading}
              >
                Upload
                <input
                  key={uploadInputKey}
                  type="file"
                  hidden
                  accept="image/*"
                  multiple
                  onChange={(e) => handleUploadAsset(e.target.files)}
                />
              </Button>
              <Button
                variant="contained"
                onClick={async () => {
                  try {
                    setBackfilling(true);
                    await api.post('/assets/backfill');
                    toast.success('Sinkronisasi asset selesai');
                    await fetchAssets(1);
                  } catch (e) {
                    toast.error(e?.response?.data?.error || e?.message || 'Gagal sinkronisasi asset');
                  } finally {
                    setBackfilling(false);
                  }
                }}
                disabled={loading || backfilling}
              >
                Sinkronisasi
              </Button>
            </Stack>
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
                Total: {pagination.totalCount}
              </Typography>
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} sx={{ mt: 1.5 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Button size="small" variant="outlined" onClick={selectAllOnPage} disabled={loading || allSelectedOnPage}>
                  Select All
                </Button>
                <Button size="small" variant="outlined" onClick={selectNone} disabled={loading || selectedAssetIds.length === 0}>
                  None
                </Button>
                <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                  Terpilih: {selectedAssetIds.length}
                </Typography>
              </Stack>

              <Button
                size="small"
                variant="contained"
                color="error"
                disabled={loading || !anySelected}
                onClick={() => setBulkDeleteDialogOpen(true)}
              >
                Hapus Terpilih
              </Button>
            </Stack>
          </Box>

          {loading ? (
          <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ p: 2.5 }}>
            {assets.length === 0 ? (
              <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
                Belum ada asset di library. Klik "Sinkronisasi" untuk memasukkan file uploads yang sudah ada.
              </Box>
            ) : (
              <Grid container spacing={2}>
                {assets.map((a) => {
                  const url = toAssetUrl(a.path);
                  const usedCount = Array.isArray(a.usedBy) ? a.usedBy.length : 0;
                  const ext = getExtLabel(a.fileName);
                  const id = assetIdentifier(a);
                  const checked = selectedSet.has(id);

                  return (
                    <Grid item xs={12} sm={6} md={4} lg={3} key={a.uuid || a.path}>
                      <Paper
                        variant="outlined"
                        sx={{
                          borderRadius: 3,
                          overflow: 'hidden',
                          position: 'relative',
                          cursor: 'pointer',
                          transition: 'transform 120ms ease, box-shadow 120ms ease',
                          '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: '0 10px 30px rgba(2,6,23,0.10)'
                          }
                        }}
                        onClick={() => {
                          setPreviewAsset(a);
                          setPreviewOpen(true);
                        }}
                      >
                        <Box
                          sx={{
                            height: 150,
                            backgroundColor: 'rgba(2, 6, 23, 0.04)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative'
                          }}
                        >
                          <Box
                            sx={{
                              position: 'absolute',
                              left: 10,
                              bottom: 10,
                              bgcolor: 'rgba(255,255,255,0.92)',
                              border: '1px solid',
                              borderColor: 'divider',
                              borderRadius: 2,
                              px: 0.25
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Checkbox
                              size="small"
                              checked={checked}
                              onChange={(e) => toggleSelectAsset(a, e.target.checked)}
                            />
                          </Box>

                          {url ? (
                            <Box
                              component="img"
                              src={url}
                              alt={a.fileName}
                              sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              onError={(e) => {
                                try { e.currentTarget.style.display = 'none'; } catch (_) {}
                              }}
                            />
                          ) : null}

                          <Chip
                            size="small"
                            label={ext}
                            sx={{
                              position: 'absolute',
                              left: 12,
                              top: 12,
                              fontWeight: 900,
                              bgcolor: 'rgba(255,255,255,0.92)',
                              border: '1px solid',
                              borderColor: 'divider'
                            }}
                          />

                          {!a.exists ? (
                            <Chip
                              size="small"
                              color="error"
                              label="Hilang"
                              sx={{
                                position: 'absolute',
                                right: 12,
                                top: 12,
                                fontWeight: 900,
                                bgcolor: 'rgba(255,255,255,0.92)',
                              }}
                            />
                          ) : null}

                          <Tooltip title="Hapus" placement="top">
                            <span>
                              <IconButton
                                size="small"
                                color="error"
                                disabled={!a.exists}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openDeleteDialog(a);
                                }}
                                sx={{
                                  position: 'absolute',
                                  right: 10,
                                  bottom: 10,
                                  bgcolor: 'rgba(255,255,255,0.92)',
                                  border: '1px solid',
                                  borderColor: 'divider',
                                  '&:hover': { bgcolor: 'rgba(255,255,255,1)' }
                                }}
                              >
                                <DeleteOutline fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Box>

                        <Box sx={{ p: 2 }}>
                          <Tooltip title={a.fileName || ''} placement="top">
                            <Typography variant="subtitle2" sx={{ fontWeight: 900 }} noWrap>
                              {a.fileName || '-'}
                            </Typography>
                          </Tooltip>

                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.75 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                              {formatBytes(a.size)}
                            </Typography>
                            <Divider orientation="vertical" flexItem />
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                              Dipakai: {usedCount}
                            </Typography>
                          </Stack>
                        </Box>
                      </Paper>
                    </Grid>
                  );
                })}
              </Grid>
            )}
          </Box>
          )}
        </Paper>

      {pagination.totalPages > 1 ? (
        <Box display="flex" justifyContent="center" alignItems="center" mt={3}>
          <Pagination
            count={pagination.totalPages}
            page={pagination.currentPage}
            onChange={(event, page) => {
              setPagination((prev) => ({ ...(prev || {}), currentPage: page }));
              fetchAssets(page);
            }}
            color="primary"
            showFirstButton
            showLastButton
            disabled={loading}
          />
        </Box>
      ) : null}

      <Dialog
        open={previewOpen}
        onClose={() => {
          setPreviewOpen(false);
          setPreviewAsset(null);
        }}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle sx={{ pr: 6 }}>
          Detail Asset
          <IconButton
            onClick={() => {
              setPreviewOpen(false);
              setPreviewAsset(null);
            }}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5}>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Nama File</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
                {previewAsset?.fileName || '-'}
              </Typography>
            </Box>

            {previewUrl ? (
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <Box
                  component="img"
                  src={previewUrl}
                  alt={previewAsset?.fileName}
                  sx={{ maxWidth: '100%', maxHeight: 520, borderRadius: 2, border: '1px solid', borderColor: 'divider', backgroundColor: '#fff' }}
                  onError={(e) => {
                    try { e.currentTarget.style.display = 'none'; } catch (_) {}
                  }}
                />
              </Box>
            ) : null}

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Tipe</Typography>
                <Typography variant="body2" color="text.secondary">
                  {getExtLabel(previewAsset?.fileName)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Ukuran</Typography>
                <Typography variant="body2" color="text.secondary">
                  {formatBytes(previewAsset?.size)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Last Modified</Typography>
                <Typography variant="body2" color="text.secondary">
                  {previewAsset?.lastModified ? new Date(previewAsset.lastModified).toLocaleString() : '-'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Dipakai</Typography>
                <Typography variant="body2" color="text.secondary">
                  {previewUsedBy.length}
                </Typography>
              </Box>
            </Box>

            {previewUsedBy.length ? (
              <>
                <Alert severity="warning">
                  Asset ini sedang digunakan oleh {previewUsedBy.length} template.
                </Alert>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>Digunakan pada template</Typography>
                  <Stack spacing={1}>
                    {previewUsedBy.map((u) => (
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
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setPreviewOpen(false);
              setPreviewAsset(null);
            }}
          >
            Tutup
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={!previewAsset?.exists}
            onClick={() => {
              setPreviewOpen(false);
              setSelectedAsset(previewAsset);
              setDeleteDialogOpen(true);
            }}
          >
            Hapus
          </Button>
        </DialogActions>
      </Dialog>

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

      <Dialog
        open={bulkDeleteDialogOpen}
        onClose={() => {
          if (bulkDeleting) return;
          setBulkDeleteDialogOpen(false);
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ pr: 6 }}>
          Hapus {selectedAssetIds.length} Asset
          <IconButton
            onClick={() => {
              if (bulkDeleting) return;
              setBulkDeleteDialogOpen(false);
            }}
            sx={{ position: 'absolute', right: 8, top: 8 }}
            disabled={bulkDeleting}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Alert severity={bulkForce ? 'warning' : 'info'}>
              {bulkForce
                ? `Sebagian asset terpilih sedang digunakan oleh template. Sistem akan memakai mode hapus paksa.`
                : 'Asset terpilih tidak terdeteksi dipakai template.'}
            </Alert>
            <Typography variant="body2" color="text.secondary">
              Terpilih: {selectedAssetIds.length}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkDeleteDialogOpen(false)} disabled={bulkDeleting}>Batal</Button>
          <Button variant="contained" color="error" disabled={bulkDeleting} onClick={doBulkDelete}>
            {bulkDeleting ? 'Menghapus...' : (bulkForce ? 'Hapus Paksa' : 'Hapus')}
          </Button>
        </DialogActions>
      </Dialog>

      </Box>
    </Layout>
  );
};

export default Assets;
