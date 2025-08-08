import React, { useState, useEffect, useRef } from 'react';
// Import webfontloader for dynamic font loading
import WebFont from 'webfontloader';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Tooltip,
  Paper,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Divider,
  Menu,
  Stack,
  Avatar,
  CardActions,
  Pagination
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Image,
  TextFields,
  Save,
  ArrowBack,
  MoreVert,
  GetApp
} from '@mui/icons-material';
import { Stage, Layer, Text, Image as KonvaImage, Transformer, Rect } from 'react-konva';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { certificateService, eventService, participantService } from '../services/dataService';
import toast from 'react-hot-toast';

const Certificates = () => {
  // Used to force re-render after font load
  const [, setFontLoadedTick] = useState(0);

  // Helper: load font using webfontloader
  const loadFont = (fontFamily) => {
    return new Promise((resolve) => {
      // List of web safe fonts that don't need loading
      const webSafeFonts = [
        'Arial', 'Times New Roman', 'Helvetica', 'Georgia', 'Verdana', 'Tahoma', 'Trebuchet MS',
        'Segoe UI', 'Calibri', 'Cambria', 'Garamond', 'Courier New', 'Lucida Console', 'Monaco',
        'Comic Sans MS', 'Impact', 'Palatino', 'Bookman', 'Avant Garde'
      ];
      if (webSafeFonts.includes(fontFamily)) {
        resolve();
        return;
      }
      WebFont.load({
        google: { families: [fontFamily] },
        active: resolve,
        inactive: resolve
      });
    });
  };
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    limit: 10
  });
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateName, setTemplateName] = useState('');
  const [tabValue, setTabValue] = useState(0);

  // Konva editor state
  const [stageRef, setStageRef] = useState(null);
  const [selectedElement, setSelectedElement] = useState(null);
  const [elements, setElements] = useState([]);
  const [backgroundImage, setBackgroundImage] = useState(null);
  const [backgroundImageObj, setBackgroundImageObj] = useState(null);
  const [backgroundImageFile, setBackgroundImageFile] = useState(null);
  const [stageSize, setStageSize] = useState({ width: 842, height: 595 }); // A4 landscape

  // Text properties
  const [textProperties, setTextProperties] = useState({
    fontSize: 24,
    fontFamily: 'Arial',
    fill: '#000000',
    text: 'Sample Text',
    fontWeight: 'normal',
    fontStyle: 'normal',
    textDecoration: 'none',
    align: 'left',
    verticalAlign: 'top',
    width: 200
  });

  const [anchorEl, setAnchorEl] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.title = 'Kelola Sertifikat - e-Sertifikat';
    if (eventId) {
      fetchEvent();
      fetchTemplates();
      fetchParticipants();
    }
  }, [eventId]);

  const fetchEvent = async () => {
    try {
      const response = await eventService.getEvent(eventId);
      setEvent(response.data.event);
    } catch (error) {
      toast.error('Gagal memuat detail acara');
      navigate('/events');
    }
  };

  const fetchTemplates = async (page = 1) => {
    try {
      setLoading(true);
      const response = await certificateService.getTemplates(eventId, page, pagination.limit);
      setTemplates(response.data.templates);
      setPagination({
        currentPage: response.data.currentPage,
        totalPages: response.data.totalPages,
        totalCount: response.data.totalCount,
        limit: response.data.limit || 10
      });
    } catch (error) {
      toast.error('Gagal memuat template');
    } finally {
      setLoading(false);
    }
  };

  const fetchParticipants = async () => {
    try {
      const response = await participantService.getParticipants(eventId);
      setParticipants(response.data.participants);
    } catch (error) {
      console.error('Gagal memuat peserta');
    }
  };

  const handleOpenEditor = (template = null) => {
    if (template) {
      setSelectedTemplate(template);
      setTemplateName(template.name);
      setElements(template.design?.objects || []);
      setStageSize({ width: template.width || 842, height: template.height || 595 });
      // Load background image if it exists in the template
      if (template.design?.background) {
        setBackgroundImage(template.design.background);
      } else {
        setBackgroundImage(null);
        setBackgroundImageObj(null);
      }
    } else {
      setSelectedTemplate(null);
      setTemplateName('');
      setElements([]);
      setStageSize({ width: 842, height: 595 });
      setBackgroundImage(null);
      setBackgroundImageObj(null);
    }
    // Clear the background file state
    setBackgroundImageFile(null);
    setOpenDialog(true);
  };

  const handleCloseEditor = () => {
    setOpenDialog(false);
    setSelectedTemplate(null);
    setElements([]);
    setSelectedElement(null);

    // Revoke the object URL to prevent memory leaks
    if (backgroundImage && backgroundImage.startsWith('blob:')) {
      URL.revokeObjectURL(backgroundImage);
    }

    // Clear background states
    setBackgroundImage(null);
    setBackgroundImageObj(null);
    setBackgroundImageFile(null);
  };

  // Helper function to calculate text positioning based on alignment
  const calculateTextPosition = (element, textNode) => {
    if (!textNode) return { x: element.x, y: element.y };

    let adjustedX = element.x || 0;
    let adjustedY = element.y || 0;

    // Get text dimensions
    const textWidth = textNode.width();
    const textHeight = textNode.height();

    // Handle horizontal alignment
    if (element.align === 'center') {
      // For center alignment, we don't need to adjust x position
      // because Konva's align property handles this internally
    } else if (element.align === 'right') {
      // For right alignment, we don't need to adjust x position
      // because Konva's align property handles this internally
    }

    // Handle vertical alignment
    if (element.verticalAlign === 'middle') {
      adjustedY = element.y - (textHeight / 2);
    } else if (element.verticalAlign === 'bottom') {
      adjustedY = element.y - textHeight;
    }

    return { x: adjustedX, y: adjustedY };
  };

  const handleAddText = () => {
    const newText = {
      id: Date.now().toString(),
      type: 'text',
      x: 100,
      y: 100,
      text: textProperties.text,
      fontSize: textProperties.fontSize,
      fontFamily: textProperties.fontFamily,
      fill: textProperties.fill,
      fontWeight: textProperties.fontWeight,
      fontStyle: textProperties.fontStyle,
      textDecoration: textProperties.textDecoration,
      align: textProperties.align,
      verticalAlign: textProperties.verticalAlign,
      width: 200, // Set default width for proper alignment
      draggable: true
    };
    setElements([...elements, newText]);
  };

  const handleAddDynamicText = (field) => {
    const newText = {
      id: Date.now().toString(),
      type: 'text',
      x: 100,
      y: 100,
      text: `{${field.name}}`,
      fontSize: 24,
      fontFamily: 'Arial',
      fill: '#000000',
      width: 200, // Set default width for proper alignment
      align: 'left',
      verticalAlign: 'top',
      draggable: true,
      isDynamic: true,
      fieldName: field.name
    };
    setElements([...elements, newText]);
  };

  const handleSelectElement = (element) => {
    setSelectedElement(element);
    if (element.type === 'text') {
      setTextProperties({
        fontSize: element.fontSize || 24,
        fontFamily: element.fontFamily || 'Arial',
        fill: element.fill || '#000000',
        text: element.text || '',
        fontWeight: element.fontWeight || 'normal',
        fontStyle: element.fontStyle || 'normal',
        textDecoration: element.textDecoration || 'none',
        align: element.align || 'left',
        verticalAlign: element.verticalAlign || 'top',
        width: element.width || 200
      });
    }
  };

  const handleUpdateElement = (id, updates) => {
    setElements(elements.map(el => el.id === id ? { ...el, ...updates } : el));
  };

  const handleDeleteElement = () => {
    if (selectedElement) {
      setElements(elements.filter(el => el.id !== selectedElement.id));
      setSelectedElement(null);
    }
  };

  // Enhanced: handle font family change with font loading
  const handleUpdateTextProperties = async (property, value) => {
    if (property === 'fontFamily') {
      await loadFont(value);
      setFontLoadedTick(tick => tick + 1); // force re-render
    }
    setTextProperties(prev => ({ ...prev, [property]: value }));
    if (selectedElement && selectedElement.type === 'text') {
      handleUpdateElement(selectedElement.id, { [property]: value });
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateName) {
      toast.error('Mohon masukkan nama template');
      return;
    }

    try {
      setSaving(true);
      // Upload background image if a new file is selected
      let backgroundUrl = backgroundImage;
      if (backgroundImageFile) {
        const uploadResponse = await certificateService.uploadBackground(backgroundImageFile);
        if (uploadResponse.success) {
          backgroundUrl = uploadResponse.data.url;
        } else {
          throw new Error('Gagal mengunggah gambar latar belakang');
        }
      }

      const templateData = {
        name: templateName,
        eventId: parseInt(eventId),
        design: {
          objects: elements,
          background: backgroundUrl
        },
        width: stageSize.width,
        height: stageSize.height
      };

      if (selectedTemplate) {
        // If we're updating and have a new background, delete the old one
        if (backgroundImageFile && selectedTemplate.design?.background) {
          // Extract filename from the old background URL
          const oldBackgroundUrl = selectedTemplate.design.background;
          if (oldBackgroundUrl.startsWith('/uploads/')) {
            // We don't need to delete the old file on the frontend,
            // but we should let the backend know to replace it
            console.log('Replacing background image:', oldBackgroundUrl);
          }
        }

        await certificateService.updateTemplate(selectedTemplate.id, templateData);
        toast.success('Template berhasil diperbarui');
      } else {
        await certificateService.createTemplate(templateData);
        toast.success('Template berhasil dibuat');
      }

      handleCloseEditor();
      fetchTemplates();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Operasi gagal');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus template ini?')) {
      try {
        await certificateService.deleteTemplate(templateId);
        toast.success('Template berhasil dihapus');
        fetchTemplates();
      } catch (error) {
        toast.error('Gagal menghapus template');
      }
    }
  };

  const handleDownloadAll = async (templateId) => {
    try {
      setGenerating(true);
      toast.loading('Memulai proses download sertifikat... Ini mungkin memakan waktu beberapa menit.', { duration: 5000 });

      const blob = await certificateService.bulkDownloadCertificatesPDF(eventId, templateId);

      // Validate that we received a valid blob
      if (!blob || blob.size === 0) {
        throw new Error('File PDF kosong atau tidak valid');
      }

      // Create download link for the PDF file
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sertifikat_semua_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();

      // Clean up
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 100);

      toast.success('Berhasil mengunduh semua sertifikat dalam satu file PDF');
    } catch (error) {
      console.error('Bulk download error:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Gagal mengunduh sertifikat';
      toast.error('Gagal mengunduh sertifikat: ' + errorMessage);
    } finally {
      setGenerating(false);
      setAnchorEl(null);
    }
  };

  useEffect(() => {
    if (backgroundImage) {
      // Prepend API base URL for background images stored as /uploads/ paths
      let imageUrl = backgroundImage;
      if (backgroundImage.startsWith('/uploads/')) {
        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
        // Remove /api part and trailing slash if present
        imageUrl = `${apiBaseUrl}${backgroundImage}`;
      }

      const image = new window.Image();
      image.src = imageUrl;
      image.onload = () => {
        setBackgroundImageObj(image);
      };
      image.onerror = (error) => {
        console.error('Failed to load background image:', error);
        toast.error('Gagal memuat gambar latar belakang');
      };
    }
  }, [backgroundImage]);

  const handleBackgroundUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Store the file object for later upload
      setBackgroundImageFile(file);

      // Create a local URL for immediate display
      const localUrl = URL.createObjectURL(file);
      setBackgroundImage(localUrl);

      toast.success('Latar belakang berhasil dipilih');
    }
  };

  if (loading) {
    return (
      <Layout>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress size={60} />
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
            <Box display="flex" alignItems="center">
              <IconButton
                onClick={() => navigate('/events')}
                sx={{
                  mr: 2,
                  color: 'white',
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  '&:hover': {
                    backgroundColor: 'rgba(255,255,255,0.3)',
                  }
                }}
              >
                <ArrowBack />
              </IconButton>
              <Box>
                <Typography variant="h3" component="h1" sx={{ fontWeight: 'bold', mb: 1 }}>
                  Template Sertifikat
                </Typography>
                <Typography variant="h6" sx={{ opacity: 0.9 }}>
                  {event?.title}
                </Typography>
              </Box>
            </Box>
            <Button
              variant="contained"
              size="large"
              startIcon={<Add />}
              onClick={() => handleOpenEditor()}
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
              Buat Template
            </Button>
          </Box>
        </Paper>

        {templates.length === 0 ? (
          <Paper elevation={0} sx={{ border: '2px dashed', borderColor: 'divider', borderRadius: 3 }}>
            <CardContent>
              <Box textAlign="center" py={6}>
                <Avatar sx={{ width: 80, height: 80, mx: 'auto', mb: 3, bgcolor: 'primary.light' }}>
                  <TextFields sx={{ fontSize: 40 }} />
                </Avatar>
                <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
                  Belum Ada Template Sertifikat
                </Typography>
                <Typography variant="body1" color="text.secondary" gutterBottom sx={{ mb: 3 }}>
                  Mulai dengan membuat template sertifikat pertama Anda
                </Typography>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<Add />}
                  onClick={() => handleOpenEditor()}
                  sx={{ borderRadius: 2, py: 1.5, px: 4 }}
                >
                  Buat Template Pertama
                </Button>
              </Box>
            </CardContent>
          </Paper>
        ) : (
          <Grid container spacing={3}>
            {templates.map((template) => (
              <Grid item xs={12} md={6} lg={4} key={template.id}>
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
                        {template.name}
                      </Typography>
                      <Box>
                        <Tooltip title="Edit Template">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenEditor(template)}
                            sx={{ ml: 1 }}
                          >
                            <Edit />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Opsi Lainnya">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              setSelectedTemplate(template);
                              setAnchorEl(e.currentTarget);
                            }}
                            sx={{ ml: 0.5 }}
                          >
                            <MoreVert />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>

                    <Stack spacing={1.5} sx={{ mb: 3 }}>
                      <Typography variant="body2" color="text.secondary">
                        Ukuran: {template.width} x {template.height}px
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Elemen: {template.design?.objects?.length || 0}
                      </Typography>
                    </Stack>
                  </CardContent>

                  <CardActions sx={{ px: 3, pb: 3 }}>
                    <Stack direction="row" spacing={1} width="100%">
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<Edit />}
                        onClick={() => handleOpenEditor(template)}
                        sx={{ flex: 1, borderRadius: 2 }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={generating ? <CircularProgress size={16} /> : <GetApp />}
                        onClick={() => handleDownloadAll(template.id)}
                        disabled={generating || participants.length === 0}
                        sx={{ flex: 1, borderRadius: 2 }}
                      >
                        Download Semua
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
              onChange={(event, page) => fetchTemplates(page)}
              color="primary"
              showFirstButton
              showLastButton
            />
            <Typography variant="body2" color="text.secondary" ml={2}>
              Halaman {pagination.currentPage} dari {pagination.totalPages}
            </Typography>
          </Box>
        )}

        {/* Menu Aksi */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
          PaperProps={{
            elevation: 3,
            sx: {
              borderRadius: 2,
              mt: 1,
              minWidth: 180,
            }
          }}
        >
          <MenuItem
            onClick={() => handleDeleteTemplate(selectedTemplate?.id)}
            sx={{ py: 1.5, color: 'error.main' }}
          >
            <Delete sx={{ mr: 1.5 }} />
            Hapus Template
          </MenuItem>
        </Menu>

        {/* Dialog Editor Sertifikat */}
        <Dialog
          open={openDialog}
          onClose={handleCloseEditor}
          maxWidth="xl"
          fullWidth
          PaperProps={{
            sx: {
              height: '90vh',
              borderRadius: 3
            }
          }}
        >
          <DialogTitle sx={{ pb: 2 }}>
            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
              {selectedTemplate ? 'Edit Template Sertifikat' : 'Buat Template Sertifikat'}
            </Typography>
          </DialogTitle>
          <DialogContent sx={{ display: 'flex', gap: 3, p: 3 }}>
            {/* Panel Kiri - Tools */}
            <Paper
              elevation={0}
              sx={{
                width: 320,
                p: 3,
                overflow: 'auto',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2
              }}
            >
              <TextField
                label="Nama Template"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                fullWidth
                sx={{ mb: 3 }}
              />

              <Tabs
                value={tabValue}
                onChange={(e, v) => setTabValue(v)}
                sx={{
                  mb: 3,
                  '& .MuiTab-root': {
                    fontWeight: 'bold',
                    fontSize: '0.9rem'
                  }
                }}
              >
                <Tab label="Elemen" />
                <Tab label="Properti" />
              </Tabs>

              {tabValue === 0 && (
                <Box>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
                    Tambah Elemen
                  </Typography>

                  <Stack spacing={2} sx={{ mb: 3 }}>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<TextFields />}
                      onClick={handleAddText}
                      sx={{
                        borderRadius: 2,
                        py: 1.5,
                        justifyContent: 'flex-start'
                      }}
                    >
                      Tambah Teks
                    </Button>

                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<Image />}
                      component="label"
                      sx={{
                        borderRadius: 2,
                        py: 1.5,
                        justifyContent: 'flex-start'
                      }}
                    >
                      Unggah Latar Belakang
                      <input
                        type="file"
                        hidden
                        accept="image/*"
                        onChange={handleBackgroundUpload}
                      />
                    </Button>
                  </Stack>

                  <Divider sx={{ my: 3 }} />

                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
                    Field Dinamis
                  </Typography>
                  <Stack spacing={1}>
                    {event?.participantFields?.map((field) => (
                      <Button
                        key={field.name}
                        fullWidth
                        variant="outlined"
                        onClick={() => handleAddDynamicText(field)}
                        sx={{
                          borderRadius: 2,
                          py: 1.5,
                          justifyContent: 'flex-start',
                          textTransform: 'none'
                        }}
                      >
                        {field.label}
                      </Button>
                    ))}
                  </Stack>
                </Box>
              )}

              {tabValue === 1 && selectedElement && (
                <Box>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
                    Properti Teks
                  </Typography>

                  {selectedElement.type === 'text' && (
                    <Stack spacing={3}>
                      <TextField
                        label="Teks"
                        value={textProperties.text}
                        onChange={(e) => handleUpdateTextProperties('text', e.target.value)}
                        fullWidth
                        multiline
                        rows={2}
                      />

                      <Box>
                        <Typography gutterBottom sx={{ fontWeight: 'bold' }}>
                          Ukuran Font: {textProperties.fontSize}px
                        </Typography>
                        <Slider
                          value={textProperties.fontSize}
                          onChange={(e, value) => handleUpdateTextProperties('fontSize', value)}
                          min={8}
                          max={72}
                          sx={{ mb: 1 }}
                        />
                      </Box>

                      <FormControl fullWidth>
                        <InputLabel>Font Family</InputLabel>
                        <Select
                          value={textProperties.fontFamily}
                          onChange={async (e) => {
                            const font = e.target.value;
                            await handleUpdateTextProperties('fontFamily', font);
                          }}
                        >
                          <MenuItem value="Arial">Arial</MenuItem>
                          <MenuItem value="Times New Roman">Times New Roman</MenuItem>
                          <MenuItem value="Helvetica">Helvetica</MenuItem>
                          <MenuItem value="Georgia">Georgia</MenuItem>
                          <MenuItem value="Verdana">Verdana</MenuItem>
                          <MenuItem value="Tahoma">Tahoma</MenuItem>
                          <MenuItem value="Trebuchet MS">Trebuchet MS</MenuItem>
                          <MenuItem value="Segoe UI">Segoe UI</MenuItem>
                          <MenuItem value="Calibri">Calibri</MenuItem>
                          <MenuItem value="Cambria">Cambria</MenuItem>
                          <MenuItem value="Garamond">Garamond</MenuItem>
                          <MenuItem value="Courier New">Courier New</MenuItem>
                          <MenuItem value="Brush Script MT">Brush Script MT</MenuItem>
                          <MenuItem value="Lucida Console">Lucida Console</MenuItem>
                          <MenuItem value="Monaco">Monaco</MenuItem>
                          <MenuItem value="Comic Sans MS">Comic Sans MS</MenuItem>
                          <MenuItem value="Impact">Impact</MenuItem>
                          <MenuItem value="Palatino">Palatino</MenuItem>
                          <MenuItem value="Bookman">Bookman</MenuItem>
                          <MenuItem value="Avant Garde">Avant Garde</MenuItem>
                          <MenuItem value="Abel">Abel</MenuItem>
                          <MenuItem value="Abril Fatface">Abril Fatface</MenuItem>
                          <MenuItem value="Acme">Acme</MenuItem>
                          <MenuItem value="Alfa Slab One">Alfa Slab One</MenuItem>
                          <MenuItem value="Amatic SC">Amatic SC</MenuItem>
                          <MenuItem value="Anton">Anton</MenuItem>
                          <MenuItem value="Architects Daughter">Architects Daughter</MenuItem>
                          <MenuItem value="Archivo Black">Archivo Black</MenuItem>
                          <MenuItem value="Archivo Narrow">Archivo Narrow</MenuItem>
                          <MenuItem value="Arimo">Arimo</MenuItem>
                          <MenuItem value="Arvo">Arvo</MenuItem>
                          <MenuItem value="Asap">Asap</MenuItem>
                          <MenuItem value="Assistant">Assistant</MenuItem>
                          <MenuItem value="Bangers">Bangers</MenuItem>
                          <MenuItem value="Bebas Neue">Bebas Neue</MenuItem>
                          <MenuItem value="Bitter">Bitter</MenuItem>
                          <MenuItem value="Bree Serif">Bree Serif</MenuItem>
                          <MenuItem value="Cabin">Cabin</MenuItem>
                          <MenuItem value="Cairo">Cairo</MenuItem>
                          <MenuItem value="Catamaran">Catamaran</MenuItem>
                          <MenuItem value="Cinzel">Cinzel</MenuItem>
                          <MenuItem value="Comfortaa">Comfortaa</MenuItem>
                          <MenuItem value="Cormorant Garamond">Cormorant Garamond</MenuItem>
                          <MenuItem value="Crimson Text">Crimson Text</MenuItem>
                          <MenuItem value="Dancing Script">Dancing Script</MenuItem>
                          <MenuItem value="Dosis">Dosis</MenuItem>
                          <MenuItem value="EB Garamond">EB Garamond</MenuItem>
                          <MenuItem value="Exo 2">Exo 2</MenuItem>
                          <MenuItem value="Fira Sans">Fira Sans</MenuItem>
                          <MenuItem value="Fjalla One">Fjalla One</MenuItem>
                          <MenuItem value="Francois One">Francois One</MenuItem>
                          <MenuItem value="Gloria Hallelujah">Gloria Hallelujah</MenuItem>
                          <MenuItem value="Heebo">Heebo</MenuItem>
                          <MenuItem value="Hind">Hind</MenuItem>
                          <MenuItem value="Inconsolata">Inconsolata</MenuItem>
                          <MenuItem value="Indie Flower">Indie Flower</MenuItem>
                          <MenuItem value="Josefin Sans">Josefin Sans</MenuItem>
                          <MenuItem value="Jost">Jost</MenuItem>
                          <MenuItem value="Karla">Karla</MenuItem>
                          <MenuItem value="Lato">Lato</MenuItem>
                          <MenuItem value="Libre Baskerville">Libre Baskerville</MenuItem>
                          <MenuItem value="Lobster">Lobster</MenuItem>
                          <MenuItem value="Lora">Lora</MenuItem>
                          <MenuItem value="Merriweather">Merriweather</MenuItem>
                          <MenuItem value="Montserrat">Montserrat</MenuItem>
                          <MenuItem value="Mukta">Mukta</MenuItem>
                          <MenuItem value="Nanum Gothic">Nanum Gothic</MenuItem>
                          <MenuItem value="Noto Sans">Noto Sans</MenuItem>
                          <MenuItem value="Noto Serif">Noto Serif</MenuItem>
                          <MenuItem value="Nunito">Nunito</MenuItem>
                          <MenuItem value="Open Sans">Open Sans</MenuItem>
                          <MenuItem value="Oswald">Oswald</MenuItem>
                          <MenuItem value="Overpass">Overpass</MenuItem>
                          <MenuItem value="Oxygen">Oxygen</MenuItem>
                          <MenuItem value="Pacifico">Pacifico</MenuItem>
                          <MenuItem value="Playfair Display">Playfair Display</MenuItem>
                          <MenuItem value="Poppins">Poppins</MenuItem>
                          <MenuItem value="PT Sans">PT Sans</MenuItem>
                          <MenuItem value="PT Serif">PT Serif</MenuItem>
                          <MenuItem value="Quicksand">Quicksand</MenuItem>
                          <MenuItem value="Raleway">Raleway</MenuItem>
                          <MenuItem value="Roboto">Roboto</MenuItem>
                          <MenuItem value="Roboto Condensed">Roboto Condensed</MenuItem>
                          <MenuItem value="Roboto Mono">Roboto Mono</MenuItem>
                          <MenuItem value="Roboto Slab">Roboto Slab</MenuItem>
                          <MenuItem value="Rubik">Rubik</MenuItem>
                          <MenuItem value="Source Code Pro">Source Code Pro</MenuItem>
                          <MenuItem value="Source Sans Pro">Source Sans Pro</MenuItem>
                          <MenuItem value="Space Mono">Space Mono</MenuItem>
                          <MenuItem value="Spectral">Spectral</MenuItem>
                          <MenuItem value="Titillium Web">Titillium Web</MenuItem>
                          <MenuItem value="Ubuntu">Ubuntu</MenuItem>
                          <MenuItem value="Work Sans">Work Sans</MenuItem>
                          <MenuItem value="Yanone Kaffeesatz">Yanone Kaffeesatz</MenuItem>
                          <MenuItem value="Zilla Slab">Zilla Slab</MenuItem>
                        </Select>
                      </FormControl>

                      <TextField
                        label="Warna"
                        type="color"
                        value={textProperties.fill}
                        onChange={(e) => handleUpdateTextProperties('fill', e.target.value)}
                        fullWidth
                      />

                      <FormControl fullWidth>
                        <InputLabel>Ketebalan Font</InputLabel>
                        <Select
                          value={textProperties.fontWeight}
                          onChange={(e) => handleUpdateTextProperties('fontWeight', e.target.value)}
                        >
                          <MenuItem value="normal">Normal</MenuItem>
                          <MenuItem value="bold">Tebal</MenuItem>
                        </Select>
                      </FormControl>

                      <FormControl fullWidth>
                        <InputLabel>Gaya Font</InputLabel>
                        <Select
                          value={textProperties.fontStyle}
                          onChange={(e) => handleUpdateTextProperties('fontStyle', e.target.value)}
                        >
                          <MenuItem value="normal">Normal</MenuItem>
                          <MenuItem value="italic">Miring</MenuItem>
                        </Select>
                      </FormControl>

                      <FormControl fullWidth>
                        <InputLabel>Dekorasi Teks</InputLabel>
                        <Select
                          value={textProperties.textDecoration}
                          onChange={(e) => handleUpdateTextProperties('textDecoration', e.target.value)}
                        >
                          <MenuItem value="none">Tidak Ada</MenuItem>
                          <MenuItem value="underline">Garis Bawah</MenuItem>
                          <MenuItem value="line-through">Coret</MenuItem>
                        </Select>
                      </FormControl>

                      <FormControl fullWidth>
                        <InputLabel>Perataan Teks</InputLabel>
                        <Select
                          value={textProperties.align}
                          onChange={(e) => handleUpdateTextProperties('align', e.target.value)}
                        >
                          <MenuItem value="left">Kiri</MenuItem>
                          <MenuItem value="center">Tengah</MenuItem>
                          <MenuItem value="right">Kanan</MenuItem>
                        </Select>
                      </FormControl>

                      <FormControl fullWidth>
                        <InputLabel>Perataan Vertikal</InputLabel>
                        <Select
                          value={textProperties.verticalAlign}
                          onChange={(e) => handleUpdateTextProperties('verticalAlign', e.target.value)}
                        >
                          <MenuItem value="top">Atas</MenuItem>
                          <MenuItem value="middle">Tengah</MenuItem>
                          <MenuItem value="bottom">Bawah</MenuItem>
                        </Select>
                      </FormControl>

                      <Box>
                        <Typography gutterBottom sx={{ fontWeight: 'bold' }}>
                          Lebar Teks
                        </Typography>
                        <Slider
                          value={textProperties.width || 200}
                          onChange={(e, value) => handleUpdateTextProperties('width', value)}
                          min={50}
                          max={stageSize.width}
                          valueLabelDisplay="auto"
                        />
                      </Box>

                      <Button
                        fullWidth
                        variant="outlined"
                        color="error"
                        startIcon={<Delete />}
                        onClick={handleDeleteElement}
                        sx={{
                          borderRadius: 2,
                          py: 1.5
                        }}
                      >
                        Hapus Elemen
                      </Button>
                    </Stack>
                  )}
                </Box>
              )}
            </Paper>

            {/* Panel Kanan - Canvas */}
            <Box sx={{ flex: 1, overflow: 'auto', bgcolor: '#f8fafc', borderRadius: 2, p: 2 }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
                Preview Sertifikat
              </Typography>
              <Paper
                elevation={3}
                sx={{
                  p: 3,
                  display: 'inline-block',
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider'
                }}
              >
                <Stage
                  width={stageSize.width}
                  height={stageSize.height}
                  ref={setStageRef}
                  style={{ border: '2px solid #e0e0e0', background: 'white', borderRadius: '8px' }}
                >
                  <Layer>
                    {backgroundImageObj && (
                      <KonvaImage
                        image={backgroundImageObj}
                        x={0}
                        y={0}
                        width={stageSize.width}
                        height={stageSize.height}
                      />
                    )}
                    {elements.map((element) => {
                      const isSelected = selectedElement && selectedElement.id === element.id;
                      return (
                        <React.Fragment key={element.id}>
                          <Text
                            x={element.x || 0}
                            y={element.y || 0}
                            text={element.text}
                            fontSize={element.fontSize}
                            fontFamily={element.fontFamily}
                            fill={element.fill}
                            fontStyle={
                              `${element.fontStyle === 'italic' ? 'italic' : 'normal'} ${element.fontWeight === 'bold' ? 'bold' : 'normal'}`.trim()
                            }
                            textDecoration={element.textDecoration}
                            align={element.align || 'left'}
                            verticalAlign={element.verticalAlign || 'top'}
                            width={element.width || 200}
                            draggable={element.draggable}
                            onClick={() => handleSelectElement(element)}
                            onDragEnd={(e) => {
                              handleUpdateElement(element.id, {
                                x: e.target.x(),
                                y: e.target.y()
                              });
                            }}
                          />
                          {isSelected && (
                            <Rect
                              x={element.x || 0}
                              y={element.y || 0}
                              width={element.width || 200}
                              height={element.fontSize ? element.fontSize * 1.3 : 32}
                              stroke="#1976d2"
                              strokeWidth={2}
                              dash={[6, 4]}
                              listening={false}
                            />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </Layer>
                </Stage>
              </Paper>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button
              onClick={handleCloseEditor}
              sx={{ borderRadius: 2 }}
            >
              Batal
            </Button>
            <Button
              onClick={handleSaveTemplate}
              variant="contained"
              startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <Save />}
              disabled={saving}
              sx={{ borderRadius: 2, px: 3 }}
            >
              {saving ? 'Menyimpan...' : 'Simpan Template'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Layout>
  );
};

export default Certificates;
