import React, { useState, useEffect } from 'react';
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
  Pagination
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  People,
  Verified,
  Event as EventIcon,
  DateRange,
  LocationOn,
  Settings,
  CalendarMonth,
  AccessTime,
  Article
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
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    limit: 10
  });
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
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

  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Kelola Acara - e-Sertifikat';
    fetchEvents();
  }, []);

  const fetchEvents = async (page = 1) => {
    try {
      setLoading(true);
      const response = await eventService.getEvents(page, pagination.limit);
      setEvents(response.data.events);
      setPagination({
        currentPage: response.data.currentPage,
        totalPages: response.data.totalPages,
        totalCount: response.data.totalCount,
        limit: response.data.limit || 10
      });
    } catch (error) {
      toast.error('Gagal memuat data acara');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (event = null) => {
    if (event) {
      setSelectedEvent(event);
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

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedEvent(null);
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
      if (selectedEvent) {
        await eventService.updateEvent(selectedEvent.id, formData);
        toast.success('Acara berhasil diperbarui');
      } else {
        await eventService.createEvent(formData);
        toast.success('Acara berhasil dibuat');
      }
      handleCloseDialog();
      fetchEvents();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Operasi gagal');
    }
  };

  const handleDelete = async (eventId) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus acara ini?')) {
      try {
        await eventService.deleteEvent(eventId);
        toast.success('Acara berhasil dihapus');
        fetchEvents();
      } catch (error) {
        toast.error('Gagal menghapus acara');
      }
    }
  };

  const handleAddField = () => {
    if (newField.name && newField.label) {
      setFormData({
        ...formData,
        participantFields: [...formData.participantFields, { ...newField }]
      });
      setNewField({ name: '', label: '', type: 'text', required: false });
      setFieldDialog(false);
    }
  };

  const handleRemoveField = (index) => {
    const fields = formData.participantFields.filter((_, i) => i !== index);
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
        {/* Header Section */}
        <Paper
          elevation={0}
          sx={{
            p: 4,
            mb: 4,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            borderRadius: 3
          }}
        >
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h3" component="h1" sx={{ fontWeight: 'bold', mb: 1 }}>
                Manajemen Acara
              </Typography>
              <Typography variant="h6" sx={{ opacity: 0.9 }}>
                Kelola dan atur acara serta sertifikat digital Anda
              </Typography>
            </Box>
            <Button
              variant="contained"
              size="large"
              startIcon={<Add />}
              onClick={() => handleOpenDialog()}
              sx={{
                backgroundColor: 'rgba(255,255,255,0.2)',
                '&:hover': {
                  backgroundColor: 'rgba(255,255,255,0.3)',
                },
                backdropFilter: 'blur(10px)',
                borderRadius: 2,
                py: 1.5,
                px: 3,
                fontWeight: 'bold'
              }}
            >
              Buat Acara Baru
            </Button>
          </Box>
        </Paper>

        {events.length === 0 ? (
          <Paper elevation={0} sx={{ border: '2px dashed', borderColor: 'divider', borderRadius: 3 }}>
            <CardContent>
              <Box textAlign="center" py={6}>
                <Avatar sx={{ width: 80, height: 80, mx: 'auto', mb: 3, bgcolor: 'primary.light' }}>
                  <EventIcon sx={{ fontSize: 40 }} />
                </Avatar>
                <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
                  Belum Ada Acara
                </Typography>
                <Typography variant="body1" color="text.secondary" gutterBottom sx={{ mb: 3 }}>
                  Mulai dengan membuat acara pertama Anda untuk mengelola sertifikat digital
                </Typography>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<Add />}
                  onClick={() => handleOpenDialog()}
                  sx={{ borderRadius: 2, py: 1.5, px: 4 }}
                >
                  Buat Acara Pertama
                </Button>
              </Box>
            </CardContent>
          </Paper>
        ) : (
          <Grid container spacing={3}>
            {events.map((event) => (
              <Grid item xs={12} md={6} lg={4} key={event.id}>
                <Card
                  elevation={0}
                  sx={{
                    borderRadius: 3,
                    border: '1px solid',
                    borderColor: 'divider',
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': {
                      boxShadow: '0 8px 25px rgba(0,0,0,0.12)',
                      transform: 'translateY(-2px)'
                    }
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                      <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', flex: 1 }}>
                        {event.title}
                      </Typography>
                      <Box>
                        <Tooltip title="Edit Acara">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenDialog(event)}
                            sx={{ ml: 1 }}
                          >
                            <Edit />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Hapus Acara">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDelete(event.id)}
                            sx={{ ml: 0.5 }}
                          >
                            <Delete />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>

                    {event.description && (
                      <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 2 }}>
                        {event.description}
                      </Typography>
                    )}

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

                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                      <Stack direction="row" spacing={1}>
                        <Chip
                          icon={<People />}
                          label={`${event.participantCount || 0} Peserta`}
                          size="small"
                          variant="outlined"
                          color="primary"
                        />
                        <Chip
                          icon={<Verified />}
                          label={`${event.templateCount || 0} Template`}
                          size="small"
                          variant="outlined"
                          color="secondary"
                        />
                      </Stack>
                    </Box>
                  </CardContent>

                  <CardActions sx={{ px: 3, pb: 3 }}>
                    <Stack direction="row" spacing={1} width="100%">
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<People />}
                        onClick={() => navigate(`/participants/${event.id}`)}
                        sx={{ flex: 1, borderRadius: 2 }}
                      >
                        Peserta
                      </Button>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<Settings />}
                        onClick={() => navigate(`/events/${event.id}/certificates`)}
                        sx={{ flex: 1, borderRadius: 2 }}
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
              onChange={(event, page) => fetchEvents(page)}
              color="primary"
              showFirstButton
              showLastButton
            />
            <Typography variant="body2" color="text.secondary" ml={2}>
              Halaman {pagination.currentPage} dari {pagination.totalPages}
            </Typography>
          </Box>
        )}

        {/* Dialog Buat/Edit Acara */}
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
              {selectedEvent ? 'Edit Acara' : 'Buat Acara Baru'}
            </Typography>
          </DialogTitle>
          <form onSubmit={handleSubmit}>
            <DialogContent sx={{ px: 3, py: 2 }}>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <TextField
                    name="title"
                    label="Judul Acara"
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
                      onClick={() => setFieldDialog(true)}
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
                              onClick={() => handleRemoveField(index)}
                              disabled={field.name === 'nama'} // Tidak boleh menghapus field nama
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
              <Button onClick={handleCloseDialog} sx={{ borderRadius: 2 }}>
                Batal
              </Button>
              <Button
                type="submit"
                variant="contained"
                sx={{ borderRadius: 2, px: 3 }}
              >
                {selectedEvent ? 'Perbarui' : 'Buat'}
              </Button>
            </DialogActions>
          </form>
        </Dialog>

        {/* Dialog Tambah Field */}
        <Dialog
          open={fieldDialog}
          onClose={() => setFieldDialog(false)}
          PaperProps={{
            sx: {
              borderRadius: 3,
            }
          }}
        >
          <DialogTitle>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              Tambah Field Peserta
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
              onClick={() => setFieldDialog(false)}
              sx={{ borderRadius: 2 }}
            >
              Batal
            </Button>
            <Button
              onClick={handleAddField}
              variant="contained"
              sx={{ borderRadius: 2, px: 3 }}
            >
              Tambah Field
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Layout>
  );
};

export default Events;
