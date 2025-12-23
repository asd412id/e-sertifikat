import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  Pagination,
  Paper,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { UploadFile } from '@mui/icons-material';
import toast from 'react-hot-toast';

const AssetPickerDialog = ({
  open,
  onClose,
  mode,
  query,
  onQueryChange,
  onSearch,
  loading,
  assets,
  pagination,
  onPageChange,
  selectedId,
  setSelectedId,
  assetIdentifier,
  toAssetUrl,
  getExtLabel,
  uploading,
  uploadInputKey,
  onUploadFiles,
  onApplySelected
}) => {
  const [dragOver, setDragOver] = useState(false);
  const dragCounterRef = useRef(0);

  useEffect(() => {
    if (!open) return;
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
        onUploadFiles?.(list);
      } catch (_) {
      }
    };

    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [open, onUploadFiles]);

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
    onUploadFiles?.(list);
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        onClose?.();
      }}
      fullWidth
      maxWidth="md"
    >
      <DialogTitle sx={{ fontWeight: 'bold' }}>Pilih Asset</DialogTitle>
      <DialogContent
        dividers
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
        sx={{ position: 'relative' }}
      >
        {dragOver ? (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              zIndex: 2,
              backgroundColor: 'rgba(2, 6, 23, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none'
            }}
          >
            <Box
              sx={{
                px: 3,
                py: 2.5,
                borderRadius: 3,
                backgroundColor: 'background.paper',
                border: '2px dashed',
                borderColor: 'primary.main',
                boxShadow: '0 20px 60px rgba(0,0,0,0.25)'
              }}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 900, textAlign: 'center' }}>
                Lepaskan untuk upload
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 0.5 }}>
                Kamu juga bisa paste gambar dari clipboard
              </Typography>
            </Box>
          </Box>
        ) : null}
        <Stack spacing={2}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            alignItems={{ xs: 'stretch', sm: 'center' }}
            justifyContent="space-between"
          >
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.5}
              alignItems={{ xs: 'stretch', sm: 'center' }}
              sx={{ flex: 1, minWidth: 0 }}
            >
              <Button
                size="small"
                variant="contained"
                component="label"
                startIcon={uploading ? <CircularProgress size={18} color="inherit" /> : <UploadFile />}
                disabled={uploading}
                sx={{
                  borderRadius: 2,
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                  height: 40,
                  px: 2,
                  minWidth: { xs: '100%', sm: 140 },
                  alignSelf: { xs: 'stretch', sm: 'center' },
                  flexShrink: 0
                }}
              >
                Upload Baru
                <input
                  key={uploadInputKey}
                  hidden
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => onUploadFiles?.(e.target.files)}
                />
              </Button>

              <TextField
                size="small"
                value={query}
                onChange={(e) => onQueryChange?.(e.target.value)}
                placeholder="Cari nama file..."
                fullWidth
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onSearch?.();
                  }
                }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                        Total: {pagination?.totalCount ?? 0}
                      </Typography>
                    </InputAdornment>
                  )
                }}
                sx={{ minWidth: 0, '& .MuiInputBase-root': { height: 40 } }}
              />

              <Button
                size="small"
                variant="outlined"
                onClick={() => onSearch?.()}
                disabled={loading}
                sx={{ borderRadius: 2, height: 40, minWidth: 88, whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                Cari
              </Button>
            </Stack>
          </Stack>

          {loading ? (
            <Box display="flex" justifyContent="center" py={6}>
              <CircularProgress />
            </Box>
          ) : (assets || []).length === 0 ? (
            <Typography color="text.secondary" textAlign="center" py={6}>
              Tidak ada asset.
            </Typography>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)' },
                gap: 1.5
              }}
            >
              {(assets || []).map((a) => {
                const id = String(assetIdentifier?.(a) ?? a?.uuid ?? a?.path ?? a?.fileName ?? '');
                const isSelected = String(selectedId || '') === id;
                const thumb = a?.path ? toAssetUrl?.(a.path) : '';
                return (
                  <Paper
                    key={id}
                    variant="outlined"
                    onClick={() => setSelectedId?.(id)}
                    sx={{
                      cursor: 'pointer',
                      overflow: 'hidden',
                      borderRadius: 2,
                      borderColor: isSelected ? 'primary.main' : 'divider',
                      borderWidth: isSelected ? 2 : 1
                    }}
                  >
                    <Box
                      sx={{
                        height: 110,
                        backgroundColor: '#f3f4f6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={a?.originalFileName || a?.fileName || 'asset'}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          {getExtLabel?.(a?.fileName || a?.originalFileName) || 'FILE'}
                        </Typography>
                      )}
                    </Box>
                    <Box sx={{ p: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                        {a?.originalFileName || a?.fileName || a?.path || 'Asset'}
                      </Typography>
                      {Array.isArray(a?.usedBy) && a.usedBy.length ? (
                        <Typography variant="caption" color="text.secondary" noWrap>
                          Dipakai: {a.usedBy.length}
                        </Typography>
                      ) : (
                        <Typography variant="caption" color="text.secondary" noWrap>
                          Tidak digunakan
                        </Typography>
                      )}
                    </Box>
                  </Paper>
                );
              })}
            </Box>
          )}

          {pagination?.totalPages > 1 ? (
            <Box display="flex" justifyContent="center" pt={1}>
              <Pagination
                count={pagination.totalPages}
                page={pagination.currentPage}
                onChange={(_, p) => onPageChange?.(p)}
                color="primary"
                disabled={loading}
              />
            </Box>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          disabled={!selectedId}
          onClick={() => {
            if (!selectedId) {
              toast.error('Pilih asset terlebih dahulu');
              return;
            }
            onApplySelected?.();
          }}
        >
          {mode === 'background' ? 'Set Background' : mode === 'qrLogo' ? 'Set Logo QR' : 'Insert'}
        </Button>
        <Button
          onClick={() => {
            onClose?.();
          }}
        >
          Tutup
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AssetPickerDialog;
