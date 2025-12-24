import React, { useEffect, useState } from 'react';
import {
  Box,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Button,
  Typography
} from '@mui/material';
import { Close, OpenInNew } from '@mui/icons-material';

const PdfPreviewDialog = ({
  open,
  title = 'Preview Sertifikat',
  loading = false,
  error = '',
  blob,
  onClose
}) => {
  const [objectUrl, setObjectUrl] = useState('');

  useEffect(() => {
    if (!open) return;
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    setObjectUrl(url);
    return () => {
      try { URL.revokeObjectURL(url); } catch (_) {}
    };
  }, [open, blob]);

  useEffect(() => {
    if (open) return;
    setObjectUrl('');
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth={false}
      PaperProps={{
        sx: {
          width: '96vw',
          maxWidth: 1280,
          height: '92vh',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column'
        }
      }}
    >
      <DialogTitle sx={{ fontWeight: 950, pr: 6 }}>
        {title}
        <IconButton onClick={onClose} size="small" sx={{ position: 'absolute', right: 12, top: 12 }}>
          <Close fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0, overflow: 'hidden', flex: 1 }}>
        {loading ? (
          <Box display="flex" alignItems="center" justifyContent="center" height="100%">
            <CircularProgress />
          </Box>
        ) : error ? (
          <Box sx={{ p: 2.5 }}>
            <Typography variant="body2" color="error" sx={{ fontWeight: 800 }}>
              {error}
            </Typography>
          </Box>
        ) : objectUrl ? (
          <Box sx={{ height: '100%', width: '100%' }}>
            <iframe
              title="pdf-preview"
              src={objectUrl}
              style={{ border: 0, width: '100%', height: '100%' }}
            />
          </Box>
        ) : (
          <Box sx={{ p: 2.5 }}>
            <Typography variant="body2" color="text.secondary">
              Tidak ada preview.
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2, py: 1.5 }}>
        <Button onClick={onClose} sx={{ borderRadius: 2, fontWeight: 900 }}>
          Tutup
        </Button>
        <Button
          variant="outlined"
          startIcon={<OpenInNew />}
          disabled={!objectUrl}
          onClick={() => {
            if (!objectUrl) return;
            window.open(objectUrl, '_blank', 'noopener,noreferrer');
          }}
          sx={{ borderRadius: 2, fontWeight: 900 }}
        >
          Buka Tab Baru
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PdfPreviewDialog;
