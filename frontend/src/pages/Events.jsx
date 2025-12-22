import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Fab,
  CircularProgress,
  Alert,
  Tooltip,
  Paper,
  Stack,
  Divider,
  CardActions,
  Avatar,
  Pagination,
  InputAdornment
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  ContentCopy,
  Link as LinkIcon,
  People,
  Verified,
  Event as EventIcon,
  DateRange,
  LocationOn,
  Settings,
  CalendarMonth,
  AccessTime,
  Article,
  Search
} from '@mui/icons-material';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { eventService } from '../services/dataService';
import toast from 'react-hot-toast';

const Events = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const didInitSearchEffect = useRef(false);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    limit: 12
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isCopyMode, setIsCopyMode] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    location: '',
    participantFields: [
      { name: 'nama', label: 'Nama Lengkap', type: 'text', required: true },
      { name: 'instansi', label: 'Instansi', type: 'text', required: false }
    ]
  });
  const [fieldDialog, setFieldDialog] = useState(false);
  const [newField, setNewField] = useState({ name: '', label: '', type: 'text', required: false });
  const [editingFieldIndex, setEditingFieldIndex] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Kelola Kegiatan - e-Sertifikat';
    fetchEvents();
  }, []);

  // Debounce search
  useEffect(() => {
    if (!didInitSearchEffect.current) {
      didInitSearchEffect.current = true;
      return;
    }

    const handler = setTimeout(() => {
      fetchEvents(1, searchTerm);
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm]);

  const fetchEvents = async (page = 1, search = searchTerm) => {
    try {
      setLoading(true);
      const response = await eventService.getEvents(page, pagination.limit, search);
      setEvents(response.data.events);
      setPagination({
        currentPage: response.data.currentPage,
        totalPages: response.data.totalPages,
        totalCount: response.data.totalCount,
        limit: response.data.limit || 12
      });
    } catch (error) {
      toast.error('Gagal memuat data kegiatan');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchEvents(1, searchTerm);
  };

  const getPublicDownloadUrl = (event) => {
    const slug = event?.publicDownloadSlug;
    if (!slug) return '';
    return `${window.location.origin}/download/${slug}`;
  };

  const handleCopyPublicLink = async (event) => {
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

  const handleOpenDialog = (event = null) => {
    if (event) {
      setSelectedEvent(event);
      setIsCopyMode(false);
      setFormData({
        title: event.title,
        description: event.description || '',
        startDate: format(new Date(event.startDate), 'yyyy-MM-dd'),
        endDate: format(new Date(event.endDate), 'yyyy-MM-dd'),
        location: event.location || '',
        participantFields: event.participantFields || []
      });
    } else {
      setSelectedEvent(null);
      setIsCopyMode(false);
      setFormData({
        title: '',
        description: '',
        startDate: '',
        endDate: '',
        location: '',
        participantFields: [
          { name: 'nama', label: 'Nama Lengkap', type: 'text', required: true },
          { name: 'instansi', label: 'Instansi', type: 'text', required: false }
        ]
      });
    }
    setOpenDialog(true);
  };

  const handleOpenCopyDialog = (event) => {
    if (!event) return;
    setSelectedEvent(null);
    setIsCopyMode(true);

    const baseTitle = String(event.title || '').trim();
    const suffix = ' (Copy)';
    const maxLen = 200;
    const trimmedBase = baseTitle.length > (maxLen - suffix.length)
      ? baseTitle.slice(0, maxLen - suffix.length).trim()
      : baseTitle;
    const nextTitle = (trimmedBase || 'Kegiatan') + suffix;

    setFormData({
      title: nextTitle,
      description: event.description || '',
      startDate: format(new Date(event.startDate), 'yyyy-MM-dd'),
      endDate: format(new Date(event.endDate), 'yyyy-MM-dd'),
      location: event.location || '',
      participantFields: event.participantFields || []
    });
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    if (submitting) return;
    setOpenDialog(false);
    setSelectedEvent(null);
    setIsCopyMode(false);
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      if (selectedEvent && !isCopyMode) {
        await eventService.updateEvent(selectedEvent.uuid, formData);
        toast.success('Kegiatan berhasil diperbarui');
      } else {
        const payload = { ...formData };
        payload.title = String(payload.title || '').trim();
        if (payload.title.length > 200) payload.title = payload.title.slice(0, 200).trim();
        if (payload.title.length < 3) {
          throw new Error('Judul kegiatan minimal 3 karakter');
        }
        await eventService.createEvent(payload);
        toast.success(isCopyMode ? 'Kegiatan berhasil disalin' : 'Kegiatan berhasil dibuat');
      }
      handleCloseDialog();
      fetchEvents();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Operasi gagal');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (eventId) => {
    if (deletingId) return;
    if (window.confirm('Apakah Anda yakin ingin menghapus kegiatan ini?')) {
      try {
        setDeletingId(eventId);
        await eventService.deleteEvent(eventId);
        toast.success('Kegiatan berhasil dihapus');
        fetchEvents();
      } catch (error) {
        toast.error('Gagal menghapus kegiatan');
      } finally {
        setDeletingId(null);
      }
    }
  };

  const handleAddField = () => {
    if (!newField.name || !newField.label) return;

    const nextFields = [...(formData.participantFields || [])];
    if (editingFieldIndex !== null && editingFieldIndex >= 0 && editingFieldIndex < nextFields.length) {
      // Keep name stable on edit to avoid breaking existing participant data mapping
      const prev = nextFields[editingFieldIndex] || {};
      nextFields[editingFieldIndex] = {
        ...prev,
        label: newField.label,
        type: newField.type,
        required: newField.required,
      };
    } else {
      nextFields.push({ ...newField });
    }

    setFormData({ ...formData, participantFields: nextFields });
    setNewField({ name: '', label: '', type: 'text', required: false });
    setEditingFieldIndex(null);
    setFieldDialog(false);
  };

  const handleOpenAddField = () => {
    setEditingFieldIndex(null);
    setNewField({ name: '', label: '', type: 'text', required: false });
    setFieldDialog(true);
  };

  const handleOpenEditField = (index) => {
    const field = formData.participantFields?.[index];
    if (!field) return;
    setEditingFieldIndex(index);
    setNewField({
      name: field.name || '',
      label: field.label || '',
      type: field.type || 'text',
      required: !!field.required,
    });
    setFieldDialog(true);
  };

  const handleRemoveField = (index) => {
    const cur = Array.isArray(formData.participantFields) ? formData.participantFields : [];
    if (cur.length <= 1) {
      toast.error('Minimal harus ada 1 field peserta');
      return;
    }
    const field = cur[index];
    const label = field?.label || field?.name || 'field';
    const ok = window.confirm(`Hapus field peserta "${label}"? Data peserta yang sudah ada tidak akan dihapus, namun kolom ini tidak lagi digunakan.`);
    if (!ok) return;
    const fields = cur.filter((_, i) => i !== index);
    setFormData({ ...formData, participantFields: fields });
  };

  if (loading) {
    return (
      <Layout>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress />
        </Box>
      </Layout>
    );
  }

  return (
    <Layout>
      <Box>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.5, md: 3 },
            mb: 4,
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider',
            backgroundColor: 'background.paper',
          }}
        >
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={2}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 2,
                  background: 'rgba(102, 126, 234, 0.14)',
                  border: '1px solid rgba(102, 126, 234, 0.22)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'primary.main',
                }}
              >
                <EventIcon />
              </Box>
              <Box>
                <Typography variant="h4" component="h1" sx={{ fontWeight: 800, mb: 0.25 }}>
                  Manajemen Kegiatan
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Kelola dan atur kegiatan serta sertifikat digital Anda
                </Typography>
              </Box>
            </Stack>
            <Button
              variant="contained"
              size="large"
              startIcon={<Add />}
              onClick={() => handleOpenDialog()}
              sx={{ px: 3, py: 1.25, borderRadius: 2, fontWeight: 700 }}
            >
              Buat Kegiatan
            </Button>
          </Stack>
        </Paper>

        {/* Search + Total */}
        {events.length > 0 && (
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Box width={{ xs: '100%', sm: 360 }}>
              <form onSubmit={handleSearchSubmit}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Cari kegiatan..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search fontSize="small" />
                      </InputAdornment>
                    )
                  }}
                />
              </form>
            </Box>
            <Box display={{ xs: 'none', sm: 'block' }}>
              <Typography variant="body2" color="text.secondary">
                Total: {pagination.totalCount} kegiatan
              </Typography>
            </Box>
          </Box>
        )}

        {events.length === 0 ? (
          <Paper elevation={0} sx={{ border: '2px dashed', borderColor: 'divider', borderRadius: 3 }}>
            <CardContent>
              <Box textAlign="center" py={6}>
                <Avatar sx={{ width: 80, height: 80, mx: 'auto', mb: 3, bgcolor: 'primary.light' }}>
                  <EventIcon sx={{ fontSize: 40 }} />
                </Avatar>
                <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
                  Belum Ada Kegiatan
                </Typography>
                <Typography variant="body1" color="text.secondary" gutterBottom sx={{ mb: 3 }}>
                  Mulai dengan membuat kegiatan pertama Anda untuk mengelola sertifikat digital
                </Typography>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<Add />}
                  onClick={() => handleOpenDialog()}
                  sx={{ borderRadius: 2, py: 1.5, px: 4 }}
                >
                  Buat Kegiatan Pertama
                </Button>
              </Box>
            </CardContent>
          </Paper>
        ) : (
          <Grid container spacing={3}>
            {events.map((event) => (
              <Grid item xs={12} md={6} lg={4} key={event.uuid}>
                <Card
                  elevation={0}
                  sx={{
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    transition: 'all 0.2s ease-in-out',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    '&:hover': {
                      boxShadow: '0 8px 25px rgba(0,0,0,0.12)',
                      transform: 'translateY(-2px)'
                    }
                  }}
                >
                  <CardContent sx={{ p: 3, flex: 1 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                      <Tooltip title={event.title || ''} placement="top" arrow>
                        <Typography
                          variant="h6"
                          gutterBottom
                          sx={{
                            fontWeight: 'bold',
                            flex: 1,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            lineHeight: 1.25,
                            minHeight: '2.5em'
                          }}
                        >
                          {event.title}
                        </Typography>
                      </Tooltip>
                      <Box>
                        <Tooltip title="Edit Kegiatan">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenDialog(event)}
                            sx={{
                              ml: 1,
                              border: '1px solid',
                              borderColor: 'divider',
                              bgcolor: 'rgba(2, 6, 23, 0.02)',
                              '&:hover': { bgcolor: 'rgba(2, 6, 23, 0.04)' }
                            }}
                          >
                            <Edit />
                          </IconButton>
                        </Tooltip>
                        {event?.publicDownloadSlug && (
                          <Tooltip title="Salin Link">
                            <IconButton
                              size="small"
                              onClick={() => handleCopyPublicLink(event)}
                              sx={{
                                ml: 0.75,
                                border: '1px solid',
                                borderColor: 'divider',
                                bgcolor: 'rgba(2, 6, 23, 0.02)',
                                '&:hover': { bgcolor: 'rgba(2, 6, 23, 0.04)' }
                              }}
                            >
                              <LinkIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="Salin Kegiatan">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenCopyDialog(event)}
                            sx={{
                              ml: 0.75,
                              border: '1px solid',
                              borderColor: 'divider',
                              bgcolor: 'rgba(2, 6, 23, 0.02)',
                              '&:hover': { bgcolor: 'rgba(2, 6, 23, 0.04)' }
                            }}
                          >
                            <ContentCopy fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Hapus Kegiatan">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDelete(event.uuid)}
                            disabled={!!deletingId}
                            sx={{
                              ml: 0.75,
                              border: '1px solid',
                              borderColor: 'divider',
                              bgcolor: 'rgba(2, 6, 23, 0.02)',
                              '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.08)' }
                            }}
                          >
                            {deletingId === event.uuid ? <CircularProgress size={18} color="inherit" /> : <Delete />}
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>

                    <Tooltip title={event.description || ''} placement="top" arrow>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        gutterBottom
                        sx={{
                          mb: 2,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          minHeight: event.description ? '2.5em' : 0
                        }}
                      >
                        {event.description || ''}
                      </Typography>
                    </Tooltip>

                    <Stack spacing={1.5} sx={{ mb: 3 }}>
                      <Box display="flex" alignItems="center">
                        <CalendarMonth sx={{ fontSize: 18, mr: 1.5, color: 'primary.main' }} />
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {format(new Date(event.startDate), 'dd MMM yyyy', { locale: id })} - {format(new Date(event.endDate), 'dd MMM yyyy', { locale: id })}
                        </Typography>
                      </Box>

                      {event.location && (
                        <Box display="flex" alignItems="center">
                          <LocationOn sx={{ fontSize: 18, mr: 1.5, color: 'success.main' }} />
                          <Typography variant="body2">
                            {event.location}
                          </Typography>
                        </Box>
                      )}
                    </Stack>

                    <Divider sx={{ my: 2 }} />

                    <Stack direction="row" spacing={1} sx={{ mb: 2.5 }}>
                      <Chip
                        icon={<People />}
                        label={`${event.participantCount || 0} Peserta`}
                        size="small"
                        variant="filled"
                        sx={{
                          height: 28,
                          borderRadius: 10,
                          bgcolor: 'rgba(102, 126, 234, 0.12)',
                          color: 'primary.main',
                          border: '1px solid rgba(102, 126, 234, 0.22)',
                          '& .MuiChip-icon': { color: 'primary.main' },
                          '& .MuiChip-label': { px: 1.0, fontWeight: 700 }
                        }}
                      />
                      <Chip
                        icon={<Verified />}
                        label={`${event.templateCount || 0} Template`}
                        size="small"
                        variant="filled"
                        sx={{
                          height: 28,
                          borderRadius: 10,
                          bgcolor: 'rgba(118, 75, 162, 0.10)',
                          color: 'secondary.main',
                          border: '1px solid rgba(118, 75, 162, 0.18)',
                          '& .MuiChip-icon': { color: 'secondary.main' },
                          '& .MuiChip-label': { px: 1.0, fontWeight: 700 }
                        }}
                      />
                    </Stack>
                  </CardContent>

                  <CardActions sx={{ px: 3, pb: 3 }}>
                    <Stack direction="row" spacing={1} width="100%">
                      <Button
                        variant="outlined"
                        size="medium"
                        startIcon={<People />}
                        onClick={() => navigate(`/participants/${event.uuid}`)}
                        sx={{
                          flex: 1,
                          minHeight: 40,
                          borderRadius: 2,
                          fontWeight: 700,
                          bgcolor: 'rgba(2, 6, 23, 0.01)',
                          '&:hover': { bgcolor: 'rgba(2, 6, 23, 0.03)' }
                        }}
                      >
                        Peserta
                      </Button>
                      <Button
                        variant="contained"
                        size="medium"
                        startIcon={<Settings />}
                        onClick={() => navigate(`/events/${event.uuid}/certificates`)}
                        sx={{
                          flex: 1,
                          minHeight: 40,
                          borderRadius: 2,
                          fontWeight: 700
                        }}
                      >
                        Sertifikat
                      </Button>
                    </Stack>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        {/* Pagination Controls */}
        {pagination.totalPages > 1 && (
          <Box display="flex" justifyContent="center" alignItems="center" mt={4}>
            <Pagination
              count={pagination.totalPages}
              page={pagination.currentPage}
              onChange={(event, page) => fetchEvents(page, searchTerm)}
              color="primary"
              showFirstButton
              showLastButton
            />
            <Typography variant="body2" color="text.secondary" ml={2}>
              Halaman {pagination.currentPage} dari {pagination.totalPages}
            </Typography>
          </Box>
        )}

        {/* Dialog Buat/Edit Kegiatan */}
        <Dialog
          open={openDialog}
          onClose={handleCloseDialog}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 3,
            }
          }}
        >
          <DialogTitle sx={{ pb: 2 }}>
            <Typography variant="h5" component="div" sx={{ fontWeight: 'bold' }}>
              {selectedEvent ? 'Edit Kegiatan' : (isCopyMode ? 'Salin Kegiatan' : 'Buat Kegiatan Baru')}
            </Typography>
          </DialogTitle>
          <form onSubmit={handleSubmit}>
            <DialogContent sx={{ px: 3, py: 2 }}>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <TextField
                    name="title"
                    label="Judul Kegiatan"
                    value={formData.title}
                    onChange={handleInputChange}
                    fullWidth
                    required
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    name="description"
                    label="Deskripsi"
                    value={formData.description}
                    onChange={handleInputChange}
                    fullWidth
                    multiline
                    rows={3}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    name="startDate"
                    label="Tanggal Mulai"
                    type="date"
                    value={formData.startDate}
                    onChange={handleInputChange}
                    fullWidth
                    required
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    name="endDate"
                    label="Tanggal Selesai"
                    type="date"
                    value={formData.endDate}
                    onChange={handleInputChange}
                    fullWidth
                    required
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    name="location"
                    label="Lokasi"
                    value={formData.location}
                    onChange={handleInputChange}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Data Peserta</Typography>
                    <Button
                      variant="outlined"
                      startIcon={<Add />}
                      onClick={handleOpenAddField}
                      sx={{ borderRadius: 2 }}
                    >
                      Tambah Field
                    </Button>
                  </Box>
                  <Paper variant="outlined" sx={{ borderRadius: 2 }}>
                    <List>
                      {formData.participantFields.map((field, index) => (
                        <ListItem key={index} divider={index < formData.participantFields.length - 1}>
                          <ListItemText
                            primary={field.label}
                            secondary={`${field.name} (${field.type})${field.required ? ' - Wajib' : ''}`}
                          />
                          <ListItemSecondaryAction>
                            <IconButton
                              edge="end"
                              onClick={() => handleOpenEditField(index)}
                              sx={{ mr: 0.5 }}
                            >
                              <Edit />
                            </IconButton>
                            <IconButton
                              edge="end"
                              onClick={() => handleRemoveField(index)}
                              color="error"
                            >
                              <Delete />
                            </IconButton>
                          </ListItemSecondaryAction>
                        </ListItem>
                      ))}
                    </List>
                  </Paper>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
              <Button onClick={handleCloseDialog} disabled={submitting} sx={{ borderRadius: 2 }}>
                Batal
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={submitting}
                startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : null}
                sx={{ borderRadius: 2, px: 3 }}
              >
                {submitting
                  ? 'Menyimpan...'
                  : (selectedEvent && !isCopyMode ? 'Perbarui' : (isCopyMode ? 'Salin' : 'Simpan'))}
              </Button>
            </DialogActions>
          </form>
        </Dialog>

        {/* Dialog Tambah Field */}
        <Dialog
          open={fieldDialog}
          onClose={() => {
            setFieldDialog(false);
            setEditingFieldIndex(null);
            setNewField({ name: '', label: '', type: 'text', required: false });
          }}
          PaperProps={{
            sx: {
              borderRadius: 3,
            }
          }}
        >
          <DialogTitle>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              {editingFieldIndex !== null ? 'Edit Field Peserta' : 'Tambah Field Peserta'}
            </Typography>
          </DialogTitle>
          <DialogContent sx={{ px: 3, py: 2 }}>
            <Grid container spacing={3} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <TextField
                  label="Nama Field"
                  value={newField.name}
                  onChange={(e) => setNewField({ ...newField, name: e.target.value })}
                  fullWidth
                  helperText="Gunakan huruf kecil, tanpa spasi (contoh: 'jabatan', 'no_hp')"
                  disabled={editingFieldIndex !== null}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Label Field"
                  value={newField.label}
                  onChange={(e) => setNewField({ ...newField, label: e.target.value })}
                  fullWidth
                  helperText="Nama tampilan untuk field ini"
                />
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Tipe Field</InputLabel>
                  <Select
                    value={newField.type}
                    onChange={(e) => setNewField({ ...newField, type: e.target.value })}
                  >
                    <MenuItem value="text">Teks</MenuItem>
                    <MenuItem value="email">Email</MenuItem>
                    <MenuItem value="number">Angka</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Wajib Diisi</InputLabel>
                  <Select
                    value={newField.required}
                    onChange={(e) => setNewField({ ...newField, required: e.target.value })}
                  >
                    <MenuItem value={false}>Tidak</MenuItem>
                    <MenuItem value={true}>Ya</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button
              onClick={() => {
                setFieldDialog(false);
                setEditingFieldIndex(null);
                setNewField({ name: '', label: '', type: 'text', required: false });
              }}
              sx={{ borderRadius: 2 }}
            >
              Batal
            </Button>
            <Button
              onClick={handleAddField}
              variant="contained"
              sx={{ borderRadius: 2, px: 3 }}
            >
              {editingFieldIndex !== null ? 'Simpan' : 'Tambah Field'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Layout>
  );
};

export default Events;
