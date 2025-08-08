import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Chip,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  CircularProgress,
  Alert,
  Tooltip,
  Fab,
  Menu,
  Pagination
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Upload,
  Download,
  FileDownload,
  MoreVert,
  FileUpload,
  Person,
  ArrowBack,
  Search,
  PictureAsPdf
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { participantService, eventService, certificateService } from '../services/dataService';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const Participants = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [participants, setParticipants] = useState([]);
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    limit: 10
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState(null);
  const [formData, setFormData] = useState({});
  const [participantFields, setParticipantFields] = useState([]);
  const [importDialog, setImportDialog] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [downloading, setDownloading] = useState(null); // Changed to store participant ID
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateDialog, setTemplateDialog] = useState(false);
  const [bulkPdfDownloading, setBulkPdfDownloading] = useState(false);
  const [currentParticipant, setCurrentParticipant] = useState(null); // For individual downloads

  useEffect(() => {
    if (eventId) {
      fetchEvent();
      fetchParticipants();
    }
  }, [eventId]);

  // Debounce search term
  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchTerm !== undefined) {
        fetchParticipants(1, searchTerm);
      }
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm]);

  const fetchEvent = async () => {
    try {
      const response = await eventService.getEvent(eventId);
      setEvent(response.data.event);
      setParticipantFields(response.data.event.participantFields || []);
    } catch (error) {
      toast.error('Gagal mengambil detail acara');
      navigate('/events');
    }
  };

  const fetchParticipants = async (page = 1, search = searchTerm) => {
    try {
      setLoading(true);
      const response = await participantService.getParticipants(eventId, page, pagination.limit, search);
      setParticipants(response.data.participants);
      setPagination({
        currentPage: response.data.currentPage,
        totalPages: response.data.totalPages,
        totalCount: response.data.totalCount,
        limit: response.data.limit || 10
      });
    } catch (error) {
      toast.error('Gagal mengambil data peserta');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchParticipants(1, searchTerm);
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchParticipants(newPage);
    }
  };

  const handleOpenDialog = (participant = null) => {
    if (participant) {
      setSelectedParticipant(participant);
      setFormData(participant.data || {});
    } else {
      setSelectedParticipant(null);
      // Initialize form with empty values for all fields
      const emptyData = {};
      participantFields.forEach(field => {
        emptyData[field.name] = '';
      });
      setFormData(emptyData);
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedParticipant(null);
    setFormData({});
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
      if (selectedParticipant) {
        await participantService.updateParticipant(selectedParticipant.id, formData);
        toast.success('Data peserta berhasil diperbarui');
      } else {
        await participantService.addParticipant(eventId, formData);
        toast.success('Peserta berhasil ditambahkan');
      }
      handleCloseDialog();
      fetchParticipants();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Operasi gagal');
    }
  };

  const handleDelete = async (participantId) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus peserta ini?')) {
      try {
        await participantService.deleteParticipant(participantId);
        toast.success('Peserta berhasil dihapus');
        fetchParticipants();
      } catch (error) {
        toast.error('Gagal menghapus peserta');
      }
    }
  };

  const handleImport = async () => {
    if (!importFile) {
      toast.error('Silakan pilih file Excel terlebih dahulu');
      return;
    }

    try {
      setImporting(true);
      const response = await participantService.importParticipants(eventId, importFile);

      if (response.success) {
        const { success, failed, errors } = response.data;
        let message = `Impor selesai: ${success} berhasil`;
        if (failed > 0) {
          message += `, ${failed} gagal`;
        }
        toast.success(message);

        if (errors.length > 0) {
          console.log('Import errors:', errors);
        }

        setImportDialog(false);
        setImportFile(null);
        fetchParticipants();
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Impor gagal');
    } finally {
      setImporting(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        setImportFile(file);
      } else {
        toast.error('Silakan pilih file Excel (.xlsx atau .xls)');
        e.target.value = '';
      }
    }
  };

  const downloadTemplate = () => {
    // Create Excel template based on participant fields
    const templateData = [{}];
    participantFields.forEach(field => {
      templateData[0][field.label] = field.name === 'name' ? 'Contoh Nama' :
        field.name === 'email' ? 'contoh@email.com' :
          field.name === 'phone' ? '081234567890' :
            field.name === 'organization' ? 'Contoh Organisasi' :
              field.name === 'position' ? 'Contoh Posisi' :
                'Contoh Data';
    });

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template Peserta');

    // Set column widths
    const colWidths = [];
    Object.keys(templateData[0]).forEach(() => colWidths.push({ wch: 20 }));
    ws['!cols'] = colWidths;

    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    saveAs(data, `template_peserta_${event?.title || 'acara'}.xlsx`);
    toast.success('Template Excel berhasil diunduh');
  };

  // Excel Export Function
  const handleExportExcel = async () => {
    try {
      setExporting(true);
      if (participants.length === 0) {
        toast.error('Tidak ada data peserta untuk diekspor');
        return;
      }

      // Fetch export data from backend
      const response = await participantService.exportParticipants(eventId);
      const exportData = response.data.participants;

      // Create workbook and worksheet
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Data Peserta');

      // Set column widths
      const colWidths = [];
      if (exportData.length > 0) {
        Object.keys(exportData[0]).forEach(() => colWidths.push({ wch: 20 }));
        ws['!cols'] = colWidths;
      }

      // Generate Excel file
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      const fileName = `peserta_${event?.title || 'acara'}_${new Date().toISOString().split('T')[0]}.xlsx`;
      saveAs(data, fileName);

      toast.success('Data peserta berhasil diekspor ke Excel');
    } catch (error) {
      toast.error('Gagal mengekspor data peserta: ' + (error.response?.data?.error || error.message));
    } finally {
      setExporting(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const response = await certificateService.getTemplates(eventId);
      setTemplates(response.data.templates || []);
    } catch (error) {
      console.error('Error loading templates:', error);
      toast.error('Gagal memuat template sertifikat');
    }
  };

  const handleBulkDownloadPDF = async () => {
    if (!selectedTemplate) {
      toast.error('Silakan pilih template terlebih dahulu');
      return;
    }

    try {
      setBulkPdfDownloading(true);

      // Call the service to get the PDF blob
      const blob = await certificateService.bulkDownloadCertificatesPDF(eventId, selectedTemplate.id);

      // Validate that we received a valid blob
      if (!blob || blob.size === 0) {
        throw new Error('File PDF kosong atau tidak valid');
      }

      // Create download link for the PDF file
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sertifikat_${event?.title?.replace(/[^\w\s-]/g, '') || 'acara'}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();

      // Clean up
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 100);

      toast.success('Berhasil mengunduh sertifikat PDF');
      setTemplateDialog(false);
    } catch (error) {
      console.error('Bulk PDF download error:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Gagal mengunduh sertifikat PDF';
      toast.error('Gagal mengunduh sertifikat PDF: ' + errorMessage);
    } finally {
      setBulkPdfDownloading(false);
    }
  };

  const handleOpenTemplatePicker = async () => {
    await loadTemplates();
    setTemplateDialog(true);
    setAnchorEl(null);
  };

  const handleGenerateAndDownloadCertificate = async (participantId, participantName) => {
    if (!selectedTemplate) {
      // Store the participant info for later use
      setCurrentParticipant({ id: participantId, name: participantName });
      setTemplateDialog(true);
      await loadTemplates();
      return;
    }

    try {
      setDownloading(participantId);

      // Call the service to generate and download individual certificate
      const blob = await certificateService.generateAndDownloadCertificate(selectedTemplate.id, participantId);

      // Validate that we received a valid blob
      if (!blob || blob.size === 0) {
        throw new Error('File sertifikat kosong atau tidak valid');
      }

      // Create download link for the certificate
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const fileName = `sertifikat_${participantName?.replace(/[^\w\s-]/g, '') || participantId}_${new Date().toISOString().split('T')[0]}.pdf`;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();

      // Clean up
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 100);

      toast.success(`Berhasil mengunduh sertifikat untuk ${participantName || 'peserta'}`);

      // Refresh participants data to update certificate status
      await loadParticipants();
    } catch (error) {
      console.error('Individual certificate generation and download error:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Gagal mengunduh sertifikat';
      toast.error('Gagal mengunduh sertifikat: ' + errorMessage);
    } finally {
      setDownloading(null);
    }
  };

  if (loading && !event) {
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
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box display="flex" alignItems="center">
            <IconButton onClick={() => navigate('/events')} sx={{ mr: 1 }}>
              <ArrowBack />
            </IconButton>
            <Box>
              <Typography variant="h4" component="h1">
                Peserta
              </Typography>
              <Typography variant="subtitle1" color="text.secondary">
                {event?.title}
              </Typography>
            </Box>
          </Box>
          <Box display="flex" gap={1}>
            <Button
              variant="outlined"
              startIcon={<MoreVert />}
              onClick={(e) => setAnchorEl(e.currentTarget)}
            >
              Aksi
            </Button>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => handleOpenDialog()}
            >
              Tambah Peserta
            </Button>
          </Box>
        </Box>

        {/* Actions Menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
        >
          <MenuItem onClick={() => { setImportDialog(true); setAnchorEl(null); }}>
            <Upload sx={{ mr: 1 }} />
            Impor dari Excel
          </MenuItem>
          <MenuItem onClick={() => { downloadTemplate(); setAnchorEl(null); }}>
            <Download sx={{ mr: 1 }} />
            Unduh Template
          </MenuItem>
          <MenuItem
            onClick={() => { handleExportExcel(); setAnchorEl(null); }}
            disabled={exporting}
          >
            {exporting ? <CircularProgress size={20} sx={{ mr: 1 }} /> : <FileDownload sx={{ mr: 1 }} />}
            {exporting ? 'Mengekspor...' : 'Ekspor ke Excel'}
          </MenuItem>
          <MenuItem
            onClick={handleOpenTemplatePicker}
            disabled={bulkPdfDownloading}
          >
            {bulkPdfDownloading ? <CircularProgress size={20} sx={{ mr: 1 }} /> : <PictureAsPdf sx={{ mr: 1 }} />}
            {bulkPdfDownloading ? 'Mengunduh...' : 'Unduh Semua Sertifikat (PDF)'}
          </MenuItem>
        </Menu>

        {/* Search and Pagination Controls */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box width="300px">
            <form onSubmit={handleSearch}>
              <TextField
                fullWidth
                size="small"
                placeholder="Cari peserta..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  endAdornment: (
                    <IconButton size="small" type="submit">
                      <Search />
                    </IconButton>
                  ),
                }}
              />
            </form>
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="body2" color="text.secondary">
              Total: {pagination.totalCount} peserta
            </Typography>
          </Box>
        </Box>

        {/* Participants Table */}
        <Card>
          <CardContent>
            {loading ? (
              <Box display="flex" justifyContent="center" py={4}>
                <CircularProgress />
              </Box>
            ) : participants.length === 0 ? (
              <Box textAlign="center" py={4}>
                <Person sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Tidak ada peserta
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Tambahkan peserta secara manual atau impor dari Excel
                </Typography>
                <Box display="flex" justifyContent="center" gap={2} mt={2}>
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => handleOpenDialog()}
                  >
                    Tambah Peserta
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<Upload />}
                    onClick={() => setImportDialog(true)}
                  >
                    Impor dari Excel
                  </Button>
                </Box>
              </Box>
            ) : (
              <>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>No</TableCell>
                        {participantFields.map((field) => (
                          <TableCell key={field.name}>
                            {field.label}
                            {field.required && <span style={{ color: 'red' }}>*</span>}
                          </TableCell>
                        ))}
                        <TableCell>Sertifikat</TableCell>
                        <TableCell>Aksi</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {participants.map((participant, index) => (
                        <TableRow key={participant.id}>
                          <TableCell>{index + 1 + (pagination.currentPage - 1) * pagination.limit}</TableCell>
                          {participantFields.map((field) => (
                            <TableCell key={field.name}>
                              {participant.data[field.name] || '-'}
                            </TableCell>
                          ))}
                          <TableCell>
                            <Chip
                              label={participant.certificateGenerated ? 'Tergenerate' : 'Belum'}
                              color={participant.certificateGenerated ? 'success' : 'default'}
                              size="small"
                            />
                            <Tooltip title={downloading === participant.id ? "Mengunduh..." : "Generate & Unduh Sertifikat"}>
                              <IconButton
                                size="small"
                                onClick={() => handleGenerateAndDownloadCertificate(
                                  participant.id,
                                  participant.data?.nama || participant.data?.name || `Peserta ${participant.id}`
                                )}
                                disabled={downloading === participant.id}
                              >
                                {downloading === participant.id ? <CircularProgress size={16} /> : <Download />}
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <Tooltip title="Edit">
                              <IconButton
                                size="small"
                                onClick={() => handleOpenDialog(participant)}
                              >
                                <Edit />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Hapus">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDelete(participant.id)}
                              >
                                <Delete />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* Pagination Controls */}
                {pagination.totalPages > 1 && (
                  <Box display="flex" justifyContent="center" alignItems="center" mt={2}>
                    <Pagination
                      count={pagination.totalPages}
                      page={pagination.currentPage}
                      onChange={(event, page) => handlePageChange(page)}
                      color="primary"
                      showFirstButton
                      showLastButton
                    />
                    <Typography variant="body2" color="text.secondary" ml={2}>
                      Halaman {pagination.currentPage} dari {pagination.totalPages}
                    </Typography>
                  </Box>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Add/Edit Participant Dialog */}
        <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
          <DialogTitle>
            {selectedParticipant ? 'Edit Peserta' : 'Tambah Peserta Baru'}
          </DialogTitle>
          <form onSubmit={handleSubmit}>
            <DialogContent>
              <Grid container spacing={2}>
                {participantFields.map((field) => (
                  <Grid item xs={12} sm={6} key={field.name}>
                    <TextField
                      name={field.name}
                      label={field.label}
                      type={field.type}
                      value={formData[field.name] || ''}
                      onChange={handleInputChange}
                      fullWidth
                      required={field.required}
                    />
                  </Grid>
                ))}
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseDialog}>Batal</Button>
              <Button type="submit" variant="contained">
                {selectedParticipant ? 'Perbarui' : 'Tambah'}
              </Button>
            </DialogActions>
          </form>
        </Dialog>

        {/* Import Dialog */}
        <Dialog open={importDialog} onClose={() => setImportDialog(false)}>
          <DialogTitle sx={{ fontWeight: 'bold', pb: 0 }}>Impor Peserta dari Excel</DialogTitle>
          <DialogContent sx={{ pt: 1, minWidth: 400 }}>
            <Alert severity="info" sx={{ mb: 2, borderRadius: 2, fontSize: '1rem', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Download sx={{ mr: 1, color: 'primary.main' }} />
                <span>
                  Pastikan file Excel Anda memiliki kolom berikut: <b>{participantFields.map(f => f.label).join(', ')}</b>
                </span>
              </Box>
            </Alert>
            <Button
              variant="outlined"
              startIcon={<Download />}
              onClick={downloadTemplate}
              sx={{ mb: 2, borderRadius: 2, fontWeight: 'bold', textTransform: 'none' }}
              fullWidth
            >
              Download Template
            </Button>
            <Paper elevation={0} sx={{ p: 2, background: '#f5f7fa', border: '1px dashed #bdbdbd', borderRadius: 2, textAlign: 'center', mb: 2 }}>
              <label htmlFor="import-excel-upload" style={{ cursor: 'pointer', display: 'block' }}>
                <Upload sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                <Typography variant="body1" sx={{ fontWeight: 500, mb: 0.5 }}>
                  Pilih file Excel untuk diimpor
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  (Format: .xlsx atau .xls)
                </Typography>
                <input
                  id="import-excel-upload"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              </label>
              {importFile && (
                <Typography variant="body2" sx={{ mt: 1, color: 'primary.main', fontWeight: 500 }}>
                  <Upload sx={{ fontSize: 18, mr: 0.5, verticalAlign: 'middle' }} />
                  {importFile.name}
                </Typography>
              )}
            </Paper>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setImportDialog(false)} sx={{ borderRadius: 2 }}>Batal</Button>
            <Button
              onClick={handleImport}
              variant="contained"
              disabled={!importFile || importing}
              startIcon={importing ? <CircularProgress size={20} /> : <Upload />}
              sx={{ borderRadius: 2, fontWeight: 'bold', minWidth: 120 }}
            >
              {importing ? 'Mengimpor...' : 'Impor'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Template Selection Dialog */}
        <Dialog open={templateDialog} onClose={() => {
          setTemplateDialog(false);
          setCurrentParticipant(null);
        }}>
          <DialogTitle>Pilih Template Sertifikat</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {currentParticipant 
                ? `Pilih template sertifikat untuk mengunduh sertifikat ${currentParticipant.name}.`
                : 'Pilih template sertifikat untuk mengunduh semua sertifikat peserta dalam satu file PDF.'
              }
            </Typography>
            {templates.length === 0 ? (
              <Alert severity="warning">
                Belum ada template sertifikat. Silakan buat template terlebih dahulu.
              </Alert>
            ) : (
              <FormControl fullWidth sx={{ mt: 2 }}>
                <InputLabel>Template Sertifikat</InputLabel>
                <Select
                  value={selectedTemplate?.id || ''}
                  onChange={(e) => {
                    const template = templates.find(t => t.id === e.target.value);
                    setSelectedTemplate(template);
                  }}
                  label="Template Sertifikat"
                >
                  {templates.map((template) => (
                    <MenuItem key={template.id} value={template.id}>
                      {template.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              setTemplateDialog(false);
              setCurrentParticipant(null);
            }}>
              Batal
            </Button>
            {currentParticipant ? (
              // Individual download button
              <Button
                onClick={() => {
                  handleGenerateAndDownloadCertificate(currentParticipant.id, currentParticipant.name);
                  setTemplateDialog(false);
                  setCurrentParticipant(null);
                }}
                variant="contained"
                disabled={!selectedTemplate || downloading === currentParticipant.id}
                startIcon={downloading === currentParticipant.id ? <CircularProgress size={20} /> : <Download />}
                sx={{ borderRadius: 2, fontWeight: 'bold', minWidth: 120 }}
              >
                {downloading === currentParticipant.id ? 'Mengunduh...' : 'Unduh Sertifikat'}
              </Button>
            ) : (
              // Bulk download button
              <Button
                onClick={handleBulkDownloadPDF}
                variant="contained"
                disabled={!selectedTemplate || bulkPdfDownloading}
                startIcon={bulkPdfDownloading ? <CircularProgress size={20} /> : <PictureAsPdf />}
                sx={{ borderRadius: 2, fontWeight: 'bold', minWidth: 120 }}
              >
                {bulkPdfDownloading ? 'Mengunduh...' : 'Unduh Semua (PDF)'}
              </Button>
            )}
          </DialogActions>
        </Dialog>
      </Box>
    </Layout>
  );
};

export default Participants;
