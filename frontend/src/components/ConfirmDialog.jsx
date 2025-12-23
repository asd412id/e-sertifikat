import React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography
} from '@mui/material';
import { Close } from '@mui/icons-material';

const ConfirmDialog = ({
  open,
  title,
  description,
  confirmText = 'Konfirmasi',
  cancelText = 'Batal',
  confirmColor = 'primary',
  loading = false,
  onCancel,
  onConfirm
}) => {
  return (
    <Dialog open={Boolean(open)} onClose={loading ? undefined : onCancel} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pr: 6 }}>
        {title}
        <IconButton
          onClick={onCancel}
          sx={{ position: 'absolute', right: 8, top: 8 }}
          disabled={loading}
        >
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={loading}>{cancelText}</Button>
        <Button
          variant="contained"
          color={confirmColor}
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? 'Memproses...' : confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmDialog;
