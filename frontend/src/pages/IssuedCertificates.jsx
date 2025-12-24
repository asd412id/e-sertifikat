import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Stack,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Pagination,
  Tooltip,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton
} from '@mui/material';
import {
  CheckCircleOutline,
  Block,
  Refresh,
  VerifiedOutlined,
  SearchOutlined,
  DownloadOutlined,
  InfoOutlined,
  Close
} from '@mui/icons-material';
import Layout from '../components/Layout';
import api from '../services/api';
import toast from 'react-hot-toast';

const IssuedCertificates = () => {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [downloadLoading, setDownloadLoading] = useState('');
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [error, setError] = useState('');

  const didInitFetch = useRef(false);

  const [items, setItems] = useState([]);
  const [events, setEvents] = useState([]);

  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState('');

  const [filters, setFilters] = useState({
    search: '',
    eventId: 'all',
    status: 'active'
  });

  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    limit: 10
  });

  const title = useMemo(() => 'Sertifikat Terbit', []);

  useEffect(() => {
    document.title = title;
  }, [title]);

  const fetchData = async (page = pagination.currentPage, override = null, opts = {}) => {
    try {
      const silent = !!opts?.silent;
      if (!silent) setLoading(true);
      setError('');
      const f = override || filters;
      const queryEventId = f.eventId === 'all' ? '' : (f.eventId || '');
      const queryStatus = f.status === 'active' ? '' : (f.status || '');
      const qs = new URLSearchParams({
        page: String(page),
        limit: String(pagination.limit),
        search: f.search || '',
        eventId: queryEventId,
        status: queryStatus
      });
      const res = await api.get(`/certificates/issued?${qs.toString()}`);
      const data = res?.data?.data || {};
      setItems(Array.isArray(data.verifications) ? data.verifications : []);
      setEvents(Array.isArray(data.events) ? data.events : []);
      setPagination({
        currentPage: data.currentPage || page,
        totalPages: data.totalPages || 1,
        totalCount: data.totalCount || 0,
        limit: data.limit || pagination.limit
      });
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Gagal memuat daftar sertifikat');
      setItems([]);
      setEvents([]);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  };

  const openDetail = (row) => {
    setSelectedRow(row || null);
    setDetailOpen(true);
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setSelectedRow(null);
  };

  const openConfirm = (action) => {
    setConfirmAction(String(action || ''));
    setConfirmOpen(true);
  };

  const closeConfirm = () => {
    setConfirmOpen(false);
    setConfirmAction('');
  };

  const getConfirmCopy = () => {
    const st = String(selectedRow?.status || '').toLowerCase();
    if (confirmAction === 'approve') {
      return {
        title: 'Konfirmasi Approve',
        desc: st === 'approved'
          ? 'Sertifikat ini sudah berstatus APPROVED. Tetap lanjutkan approve ulang?'
          : 'Approve sertifikat ini agar valid saat diverifikasi?',
        confirmText: 'Approve',
        color: 'success'
      };
    }
    if (confirmAction === 'revoke') {
      return {
        title: 'Konfirmasi Revoke',
        desc: 'Revoke akan membuat sertifikat tidak valid saat diverifikasi. Lanjutkan?',
        confirmText: 'Revoke',
        color: 'error'
      };
    }
    if (confirmAction === 'delete') {
      return {
        title: 'Konfirmasi Hapus',
        desc: 'Hapus akan menandai sertifikat sebagai DELETED. Aksi ini tidak disarankan kecuali benar-benar diperlukan. Lanjutkan?',
        confirmText: 'Hapus',
        color: 'error'
      };
    }
    return {
      title: 'Konfirmasi',
      desc: 'Lanjutkan aksi ini?',
      confirmText: 'Lanjutkan',
      color: 'primary'
    };
  };

  const runConfirmedAction = async () => {
    if (!selectedRow?.token || !confirmAction) {
      closeConfirm();
      return;
    }
    const token = selectedRow.token;
    const action = confirmAction;
    closeConfirm();
    await doAction(token, action);
    if (action === 'delete') {
      closeDetail();
    }
  };

  const downloadIssuedCertificate = async (row) => {
    const templateId = row?.templateUuid;
    const participantId = row?.participantUuid;
    const downloadKey = `download:${String(templateId || '')}:${String(participantId || '')}`;
    try {
      if (!templateId || !participantId) {
        toast.error('Template atau peserta tidak ditemukan');
        return;
      }

      setDownloadLoading(downloadKey);
      const res = await api.post(
        `/certificates/templates/${templateId}/participants/${participantId}/download-pdf`,
        {},
        {
          responseType: 'blob',
          timeout: 90000
        }
      );

      const contentType = String(res?.headers?.['content-type'] || res?.headers?.['Content-Type'] || '').toLowerCase();
      const isBlob = (typeof Blob !== 'undefined') && (res.data instanceof Blob);
      const blob = isBlob
        ? res.data
        : new Blob([res.data], { type: contentType || 'application/pdf' });

      if (!blob || !blob.size) {
        throw new Error('File sertifikat kosong atau tidak valid');
      }

      if (contentType.includes('application/json') || contentType.includes('text/plain')) {
        try {
          const text = await blob.text();
          const parsed = JSON.parse(text);
          throw new Error(parsed?.error || 'Terjadi kesalahan saat memproses sertifikat');
        } catch (err) {
          throw err;
        }
      }

      const url = URL.createObjectURL(blob);

      let fileName = `sertifikat_${participantId}.pdf`;
      const cd = res?.headers?.['content-disposition'] || res?.headers?.['Content-Disposition'];
      if (cd && typeof cd === 'string') {
        const m = /filename\*?=(?:UTF-8''|\")?([^;\"]+)/i.exec(cd);
        if (m && m[1]) {
          fileName = decodeURIComponent(m[1].replace(/\"/g, '').trim());
        }
      }

      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => {
        try { URL.revokeObjectURL(url); } catch (_) {}
      }, 1500);
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.message || 'Gagal mengunduh sertifikat');
    } finally {
      setDownloadLoading('');
    }
  };

  useEffect(() => {
    if (!didInitFetch.current) {
      didInitFetch.current = true;
      fetchData(1);
      return;
    }
    const t = setTimeout(() => {
      fetchData(1);
    }, 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search, filters.eventId, filters.status]);

  const doAction = async (token, action) => {
    try {
      setActionLoading(`${action}:${token}`);
      setError('');

      if (action === 'approve') {
        await api.put(`/certificates/issued/${token}/approve`);
        toast.success('Sertifikat di-approve');
      } else if (action === 'revoke') {
        await api.put(`/certificates/issued/${token}/revoke`);
        toast.success('Sertifikat di-revoke');
      } else if (action === 'delete') {
        await api.delete(`/certificates/issued/${token}`);
        toast.success('Sertifikat dihapus');
      }

      await fetchData(pagination.currentPage, null, { silent: true });
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Aksi gagal');
    } finally {
      setActionLoading('');
    }
  };

  const renderStatusChip = (row) => {
    const st = String(row?.status || '').toLowerCase();
    if (st === 'revoked') return <Chip label="REVOKED" color="error" size="small" />;
    if (st === 'deleted') return <Chip label="DELETED" color="default" size="small" />;
    if (st === 'pending') return <Chip label="PENDING" color="warning" size="small" />;
    return <Chip label="APPROVED" color="success" size="small" />;
  };

  const renderEmptyState = () => {
    return (
      <Box sx={{ p: { xs: 3, sm: 4 }, textAlign: 'center' }}>
        <Box
          sx={{
            width: 86,
            height: 86,
            mx: 'auto',
            mb: 2,
            borderRadius: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'rgba(25, 118, 210, 0.08)',
            border: '1px solid rgba(25, 118, 210, 0.16)',
            color: 'primary.main'
          }}
        >
          <VerifiedOutlined sx={{ fontSize: 42 }} />
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 900, mb: 0.5 }}>
          Belum ada sertifikat terbit
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 520, mx: 'auto' }}>
          Sertifikat akan muncul setelah kamu mengunduh/meng-generate PDF untuk peserta.
          Coba generate sertifikat dari menu event, atau ubah filter pencarian.
        </Typography>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.25}
          justifyContent="center"
          sx={{ mt: 2.25 }}
        >
          <Button
            variant="outlined"
            startIcon={<SearchOutlined />}
            onClick={() => setFilters((p) => ({ ...p, search: '' }))}
            sx={{ borderRadius: 2, fontWeight: 800 }}
          >
            Reset Pencarian
          </Button>
          <Button
            variant="contained"
            startIcon={<Refresh />}
            onClick={() => fetchData(1)}
            sx={{ borderRadius: 2, fontWeight: 900 }}
          >
            Refresh
          </Button>
        </Stack>
      </Box>
    );
  };

  const renderMobileCards = () => {
    if (!items || items.length === 0) {
      return renderEmptyState();
    }

    return (
      <Box sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          {items.map((row) => {
            const token = row.token;
            const st = String(row?.status || '').toLowerCase();
            const disabled = !!actionLoading || !!downloadLoading || !!refreshLoading;
            const isDownloading = downloadLoading === `download:${String(row?.templateUuid || '')}:${String(row?.participantUuid || '')}`;

            return (
              <Card key={token} variant="outlined" sx={{ borderRadius: 3 }}>
                <CardContent sx={{ p: 2.25 }}>
                  <Stack spacing={1.5}>
                    <Box display="flex" alignItems="center" justifyContent="space-between" gap={1.5}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 950, lineHeight: 1.2 }}>
                          {row.templateName || 'Template'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                          {row.eventTitle || '-'}
                        </Typography>
                      </Box>
                      {renderStatusChip(row)}
                    </Box>

                    <Divider />

                    <Stack spacing={0.75}>
                      <Box display="flex" justifyContent="space-between" gap={2}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
                          Peserta
                        </Typography>
                        <Typography variant="caption" sx={{ fontWeight: 800, textAlign: 'right' }}>
                          {row.participantUuid || '-'}
                        </Typography>
                      </Box>
                      <Box display="flex" justifyContent="space-between" gap={2}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
                          Download
                        </Typography>
                        <Typography variant="caption" sx={{ fontWeight: 900 }}>
                          {Number(row.downloadCount || 0)}
                        </Typography>
                      </Box>
                    </Stack>

                    <Stack direction="row" spacing={1}>
                      <Button
                        fullWidth
                        size="small"
                        variant="contained"
                        startIcon={isDownloading ? <CircularProgress size={16} color="inherit" /> : <DownloadOutlined />}
                        disabled={disabled || st === 'deleted' || isDownloading}
                        onClick={() => downloadIssuedCertificate(row)}
                        sx={{ borderRadius: 2, fontWeight: 900 }}
                      >
                        Download
                      </Button>
                      <Button
                        fullWidth
                        size="small"
                        variant="outlined"
                        startIcon={<InfoOutlined />}
                        disabled={disabled}
                        onClick={() => openDetail(row)}
                        sx={{ borderRadius: 2, fontWeight: 900 }}
                      >
                        Detail
                      </Button>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      </Box>
    );
  };

  return (
    <Layout>
      <Box>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2} sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 900 }}>
              Sertifikat Terbit
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Unduh sertifikat, lihat detail, lalu approve/revoke dari halaman detail.
            </Typography>
          </Box>

          <Button
            variant="outlined"
            startIcon={refreshLoading ? <CircularProgress size={16} color="inherit" /> : <Refresh />}
            onClick={async () => {
              try {
                setRefreshLoading(true);
                await fetchData(pagination.currentPage);
              } finally {
                setRefreshLoading(false);
              }
            }}
            disabled={loading || refreshLoading}
            sx={{ borderRadius: 2, fontWeight: 800 }}
          >
            Refresh
          </Button>
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, mb: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }}>
            <TextField
              size="small"
              fullWidth
              label="Cari"
              placeholder="Cari event, template, UUID, atau field sertifikat"
              value={filters.search}
              onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
              InputProps={{
                sx: {
                  '& input': {
                    py: 1.25
                  }
                }
              }}
            />

            <FormControl size="small" fullWidth>
              <InputLabel id="issued-event">Event</InputLabel>
              <Select
                labelId="issued-event"
                label="Event"
                value={filters.eventId}
                onChange={(e) => setFilters((p) => ({ ...p, eventId: e.target.value }))}
                displayEmpty
                sx={{
                  '& .MuiSelect-select': {
                    py: 1.25
                  }
                }}
              >
                <MenuItem value="all">Semua</MenuItem>
                {(events || []).map((ev) => (
                  <MenuItem key={ev.uuid} value={ev.uuid}>
                    {ev.title}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" fullWidth>
              <InputLabel id="issued-status">Status</InputLabel>
              <Select
                labelId="issued-status"
                label="Status"
                value={filters.status}
                onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
                displayEmpty
                sx={{
                  '& .MuiSelect-select': {
                    py: 1.25
                  }
                }}
              >
                <MenuItem value="active">Aktif (exclude deleted)</MenuItem>
                <MenuItem value="approved">Approved</MenuItem>
                <MenuItem value="revoked">Revoked</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="deleted">Deleted</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
          {loading ? (
            <Box display="flex" justifyContent="center" alignItems="center" py={6}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                {renderMobileCards()}
              </Box>

              <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                {(items || []).length === 0 ? (
                  renderEmptyState()
                ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ width: 64 }}>No</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Event</TableCell>
                          <TableCell>Template</TableCell>
                          <TableCell>Peserta UUID</TableCell>
                          <TableCell align="right">Download</TableCell>
                          <TableCell sx={{ width: 220 }}>Aksi</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(items || []).map((row, idx) => {
                          const token = row.token;
                          const st = String(row?.status || '').toLowerCase();
                          const disabled = !!actionLoading || !!downloadLoading || !!refreshLoading;
                          const isDownloading = downloadLoading === `download:${String(row?.templateUuid || '')}:${String(row?.participantUuid || '')}`;
                          const rowNo = idx + 1 + (Number(pagination.currentPage || 1) - 1) * Number(pagination.limit || 10);
                          return (
                            <TableRow key={token} hover>
                              <TableCell>{rowNo}</TableCell>
                              <TableCell>{renderStatusChip(row)}</TableCell>
                              <TableCell>
                                <Typography
                                  variant="body2"
                                  sx={{
                                    fontWeight: 800,
                                    maxWidth: 240,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {row.eventTitle || '-'}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography
                                  variant="body2"
                                  sx={{
                                    fontWeight: 800,
                                    maxWidth: 240,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {row.templateName || '-'}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Tooltip title={row.participantUuid || ''} placement="top" arrow>
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                                      maxWidth: 320,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap'
                                    }}
                                  >
                                    {row.participantUuid || '-'}
                                  </Typography>
                                </Tooltip>
                              </TableCell>
                              <TableCell align="right">{Number(row.downloadCount || 0)}</TableCell>
                              <TableCell>
                                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                                  <Button
                                    size="small"
                                    variant="contained"
                                    startIcon={isDownloading ? <CircularProgress size={16} color="inherit" /> : <DownloadOutlined />}
                                    disabled={disabled || st === 'deleted' || isDownloading}
                                    onClick={() => downloadIssuedCertificate(row)}
                                    sx={{ borderRadius: 2, fontWeight: 800 }}
                                  >
                                    Download
                                  </Button>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    startIcon={<InfoOutlined />}
                                    disabled={disabled}
                                    onClick={() => openDetail(row)}
                                    sx={{ borderRadius: 2, fontWeight: 800 }}
                                  >
                                    Detail
                                  </Button>
                                </Stack>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}

                {Number(pagination.totalPages || 1) > 1 && (
                  <Box display="flex" justifyContent="center" alignItems="center" mt={2} pb={2}>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      mr={2}
                      sx={{ fontWeight: 800 }}
                    >
                      Total: {Number(pagination.totalCount || 0)}
                    </Typography>
                    <Pagination
                      count={Number(pagination.totalPages || 1)}
                      page={Number(pagination.currentPage || 1)}
                      onChange={(e, page) => fetchData(page)}
                      color="primary"
                      showFirstButton
                      showLastButton
                    />
                    <Typography variant="body2" color="text.secondary" ml={2}>
                      Halaman {Number(pagination.currentPage || 1)} dari {Number(pagination.totalPages || 1)}
                    </Typography>
                  </Box>
                )}
              </Box>
            </>
          )}
        </Paper>

        <Dialog open={detailOpen} onClose={closeDetail} fullWidth maxWidth="sm">
          <DialogTitle sx={{ fontWeight: 950, pr: 6 }}>
            Detail Sertifikat
            <IconButton onClick={closeDetail} size="small" sx={{ position: 'absolute', right: 12, top: 12 }}>
              <Close fontSize="small" />
            </IconButton>
          </DialogTitle>

          <DialogContent dividers>
            {selectedRow ? (
              <Stack spacing={1.25}>
                <Box display="flex" justifyContent="space-between" gap={2}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 800 }}>
                    Status
                  </Typography>
                  <Box>{renderStatusChip(selectedRow)}</Box>
                </Box>

                <Box display="flex" justifyContent="space-between" gap={2}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 800 }}>
                    Event
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 900, textAlign: 'right' }}>
                    {selectedRow.eventTitle || '-'}
                  </Typography>
                </Box>

                <Box display="flex" justifyContent="space-between" gap={2}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 800 }}>
                    Template
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 900, textAlign: 'right' }}>
                    {selectedRow.templateName || '-'}
                  </Typography>
                </Box>

                <Box display="flex" justifyContent="space-between" gap={2}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 800 }}>
                    Peserta UUID
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 900, textAlign: 'right' }}>
                    {selectedRow.participantUuid || '-'}
                  </Typography>
                </Box>

                <Box display="flex" justifyContent="space-between" gap={2}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 800 }}>
                    Token
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 900, textAlign: 'right' }}>
                    {selectedRow.token || '-'}
                  </Typography>
                </Box>

                <Box display="flex" justifyContent="space-between" gap={2}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 800 }}>
                    Download
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 900, textAlign: 'right' }}>
                    {Number(selectedRow.downloadCount || 0)}
                  </Typography>
                </Box>

                {Array.isArray(selectedRow.fields) && selectedRow.fields.length > 0 && (
                  <>
                    <Divider sx={{ my: 1 }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 950 }}>
                      Field Sertifikat
                    </Typography>
                    <Stack spacing={0.75}>
                      {selectedRow.fields.map((f, idx) => (
                        <Box key={`${f?.name || 'field'}-${idx}`} display="flex" justifyContent="space-between" gap={2}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
                            {f?.label || f?.name || 'Field'}
                          </Typography>
                          <Typography variant="caption" sx={{ fontWeight: 900, textAlign: 'right' }}>
                            {f?.value || '-'}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  </>
                )}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Tidak ada data
              </Typography>
            )}
          </DialogContent>

          <DialogActions sx={{ px: 2, py: 1.5 }}>
            {(() => {
              const isDownloading = selectedRow
                ? (downloadLoading === `download:${String(selectedRow?.templateUuid || '')}:${String(selectedRow?.participantUuid || '')}`)
                : false;
              const approveKey = selectedRow?.token ? `approve:${selectedRow?.token}` : '';
              const revokeKey = selectedRow?.token ? `revoke:${selectedRow?.token}` : '';
              const deleteKey = selectedRow?.token ? `delete:${selectedRow?.token}` : '';
              const isApproving = !!approveKey && actionLoading === approveKey;
              const isRevoking = !!revokeKey && actionLoading === revokeKey;
              const isDeleting = !!deleteKey && actionLoading === deleteKey;

              return (
                <>
            <Button
              variant="outlined"
              onClick={() => selectedRow && downloadIssuedCertificate(selectedRow)}
              startIcon={isDownloading ? <CircularProgress size={16} color="inherit" /> : <DownloadOutlined />}
              disabled={!selectedRow || String(selectedRow?.status || '').toLowerCase() === 'deleted' || !!actionLoading || !!downloadLoading || isDownloading}
              sx={{ borderRadius: 2, fontWeight: 900 }}
            >
              Download
            </Button>
            <Box sx={{ flex: 1 }} />
            <Button
              variant="text"
              color="error"
              disabled={!selectedRow || !!actionLoading || isDeleting}
              onClick={async () => {
                openConfirm('delete');
              }}
              sx={{ borderRadius: 2, fontWeight: 900 }}
            >
              Hapus
            </Button>
            <Button
              variant="contained"
              color="success"
              startIcon={isApproving ? <CircularProgress size={16} color="inherit" /> : <CheckCircleOutline />}
              disabled={!selectedRow || !!actionLoading || String(selectedRow?.status || '').toLowerCase() === 'deleted' || isApproving}
              onClick={async () => {
                openConfirm('approve');
              }}
              sx={{ borderRadius: 2, fontWeight: 900 }}
            >
              Approve
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={isRevoking ? <CircularProgress size={16} color="inherit" /> : <Block />}
              disabled={!selectedRow || !!actionLoading || String(selectedRow?.status || '').toLowerCase() === 'deleted' || isRevoking}
              onClick={async () => {
                openConfirm('revoke');
              }}
              sx={{ borderRadius: 2, fontWeight: 900 }}
            >
              Revoke
            </Button>
                </>
              );
            })()}
          </DialogActions>
        </Dialog>

        <Dialog open={confirmOpen} onClose={closeConfirm} fullWidth maxWidth="xs">
          <DialogTitle sx={{ fontWeight: 950, pr: 6 }}>
            {getConfirmCopy().title}
            <IconButton onClick={closeConfirm} size="small" sx={{ position: 'absolute', right: 12, top: 12 }}>
              <Close fontSize="small" />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers>
            <Typography variant="body2" color="text.secondary">
              {getConfirmCopy().desc}
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 2, py: 1.5 }}>
            <Button onClick={closeConfirm} sx={{ borderRadius: 2, fontWeight: 900 }}>
              Batal
            </Button>
            <Button
              variant="contained"
              color={getConfirmCopy().color}
              onClick={runConfirmedAction}
              disabled={!!actionLoading || !selectedRow?.token}
              sx={{ borderRadius: 2, fontWeight: 900 }}
            >
              {getConfirmCopy().confirmText}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Layout>
  );
};

export default IssuedCertificates;
