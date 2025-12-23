import React from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  Tooltip,
  Typography
} from '@mui/material';
import { Add, ArrowBack, ArrowForward, Delete, Save } from '@mui/icons-material';

const CertificateEditorDialog = ({
  open,
  onClose,
  isEdit,
  pageLabel,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onAddPage,
  onRequestDeletePage,
  canDeletePage,
  onCancel,
  onSave,
  saving,
  children
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      PaperProps={{
        sx: {
          height: '90vh',
          borderRadius: 3
        }
      }}
    >
      <DialogTitle sx={{ pb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
            {isEdit ? 'Edit Template Sertifikat' : 'Buat Template Sertifikat'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {pageLabel}
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} alignItems="center">
          <Tooltip title="Sebelumnya">
            <span>
              <IconButton
                size="small"
                onClick={onPrev}
                disabled={!canPrev}
                sx={{ border: '1px solid', borderColor: 'divider' }}
              >
                <ArrowBack fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Berikutnya">
            <span>
              <IconButton
                size="small"
                onClick={onNext}
                disabled={!canNext}
                sx={{ border: '1px solid', borderColor: 'divider' }}
              >
                <ArrowForward fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

          <Button
            size="small"
            variant="outlined"
            onClick={onAddPage}
            startIcon={<Add fontSize="small" />}
            sx={{ borderRadius: 2, textTransform: 'none' }}
          >
            Tambah Halaman
          </Button>
          <Tooltip title="Hapus halaman aktif">
            <span>
              <IconButton
                size="small"
                color="error"
                onClick={onRequestDeletePage}
                disabled={!canDeletePage}
                sx={{ border: '1px solid', borderColor: 'divider' }}
              >
                <Delete fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ display: 'flex', gap: 3, p: 3 }}>
        {children}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onCancel} sx={{ borderRadius: 2 }}>
          Batal
        </Button>
        <Button
          onClick={onSave}
          variant="contained"
          startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <Save />}
          disabled={saving}
          sx={{ borderRadius: 2, px: 3 }}
        >
          {saving ? 'Menyimpan...' : 'Simpan Template'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CertificateEditorDialog;
