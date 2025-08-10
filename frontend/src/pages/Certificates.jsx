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
  Checkbox,
  FormControlLabel,
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
import {
  VerticalAlignTop,
  VerticalAlignBottom,
  ArrowUpward,
  ArrowDownward
} from '@mui/icons-material';
import { Stage, Layer, Text, Image as KonvaImage, Transformer, Rect, Group } from 'react-konva';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { certificateService, eventService, participantService } from '../services/dataService';
import toast from 'react-hot-toast';

const Certificates = () => {
  // Used to force re-render after font load
  const [fontLoadedTick, setFontLoadedTick] = useState(0);
  // Debounce map for smoother UI updates (e.g., color pickers)
  const changeTimers = useRef({});
  const scheduleUpdate = (key, fn, delay = 80) => {
    if (changeTimers.current[key]) clearTimeout(changeTimers.current[key]);
    changeTimers.current[key] = setTimeout(fn, delay);
  };

  // Shared list of web-safe fonts that don't need remote loading
  const WEB_SAFE_FONTS = useRef([
    'Arial', 'Times New Roman', 'Helvetica', 'Georgia', 'Verdana', 'Tahoma', 'Trebuchet MS',
    'Segoe UI', 'Calibri', 'Cambria', 'Garamond', 'Courier New', 'Lucida Console', 'Monaco',
    'Comic Sans MS', 'Impact', 'Palatino', 'Bookman', 'Avant Garde'
  ]).current;

  // Helper: load a single font using webfontloader
  const loadFont = (fontFamily) => {
    return new Promise((resolve) => {
      if (WEB_SAFE_FONTS.includes(fontFamily)) {
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

  // Helper: preload a set of fonts (ignores web-safe)
  const preloadFonts = (families) => {
    try {
      const unique = Array.from(new Set((families || []).filter(f => f && !WEB_SAFE_FONTS.includes(f))));
      if (unique.length === 0) return;
      WebFont.load({
        google: { families: unique },
        active: () => setFontLoadedTick(t => t + 1),
        inactive: () => setFontLoadedTick(t => t + 1)
      });
    } catch (_) { /* noop */ }
  };

  // Preload all dropdown fonts once to render styles immediately on open
  const fontsPreloadedRef = useRef(false);
  const preloadDropdownFonts = () => {
    if (fontsPreloadedRef.current) return;
    try {
      const loadable = FONT_FAMILIES.filter(f => !WEB_SAFE_FONTS.includes(f));
      if (loadable.length === 0) return;
      WebFont.load({
        google: { families: loadable },
        active: () => { fontsPreloadedRef.current = true; setFontLoadedTick(t => t + 1); },
        inactive: () => { fontsPreloadedRef.current = true; setFontLoadedTick(t => t + 1); }
      });
    } catch (_) { /* noop */ }
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
  const transformerRef = useRef(null);
  const shapeRefs = useRef({});
  const [selectedElement, setSelectedElement] = useState(null);
  const [elements, setElements] = useState([]);
  const [backgroundImage, setBackgroundImage] = useState(null);
  const [backgroundImageObj, setBackgroundImageObj] = useState(null);
  const [backgroundImageFile, setBackgroundImageFile] = useState(null);
  const [stageSize, setStageSize] = useState({ width: 842, height: 595 }); // A4 landscape

  // Image cache for element previews
  const [imageCache, setImageCache] = useState({}); // { [elementId]: HTMLImageElement }
  const [lockImageRatio, setLockImageRatio] = useState(true);

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

  // Centralized list of available fonts for selection (includes system and Google fonts)
  const FONT_FAMILIES = [
    // Featured elegant/display/script fonts for certificates (curated)
    'Cinzel', 'Cinzel Decorative', 'Playfair Display', 'Cormorant Garamond', 'EB Garamond',
    'Libre Baskerville', 'Lora', 'Merriweather', 'Spectral', 'Crimson Text', 'Cardo', 'Prata', 'Marcellus',
    'Gilda Display', 'Forum', 'Cormorant SC', 'Cormorant Infant', 'Cormorant Upright',
    'Great Vibes', 'Alex Brush', 'Allura', 'Dancing Script', 'Sacramento', 'Parisienne', 'Tangerine',
    'Italianno', 'Satisfy', 'Kaushan Script', 'Yeseva One',

    // System and popular sans/serif
    'Arial', 'Times New Roman', 'Helvetica', 'Georgia', 'Verdana', 'Tahoma', 'Trebuchet MS',
    'Segoe UI', 'Calibri', 'Cambria', 'Garamond', 'Courier New', 'Brush Script MT', 'Lucida Console',
    'Monaco', 'Comic Sans MS', 'Impact', 'Palatino', 'Bookman', 'Avant Garde',

    // Additional Google fonts
    'Abel', 'Abril Fatface', 'Acme', 'Alfa Slab One', 'Amatic SC', 'Anton', 'Architects Daughter',
    'Archivo Black', 'Archivo Narrow', 'Arimo', 'Arvo', 'Asap', 'Assistant', 'Bangers', 'Bebas Neue',
    'Bitter', 'Bree Serif', 'Cabin', 'Cairo', 'Catamaran', 'Comfortaa',
    'Exo 2', 'Fira Sans', 'Fjalla One', 'Francois One', 'Gloria Hallelujah', 'Heebo', 'Hind',
    'Inconsolata', 'Indie Flower', 'Josefin Sans', 'Jost', 'Karla', 'Lato', 'Lobster', 'Montserrat',
    'Mukta', 'Nanum Gothic', 'Noto Sans', 'Noto Serif', 'Nunito', 'Open Sans', 'Oswald', 'Overpass',
    'Oxygen', 'Pacifico', 'Poppins', 'PT Sans', 'PT Serif', 'Quicksand', 'Raleway', 'Roboto',
    'Roboto Condensed', 'Roboto Mono', 'Roboto Slab', 'Rubik', 'Source Code Pro', 'Source Sans Pro',
    'Space Mono', 'Titillium Web', 'Ubuntu', 'Work Sans', 'Yanone Kaffeesatz', 'Zilla Slab'
  ];

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

  // Keep Transformer selection in sync
  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    const node = selectedElement ? shapeRefs.current[selectedElement.id] : null;
    if (node) {
      tr.nodes([node]);
      tr.getLayer() && tr.getLayer().batchDraw();
    } else {
      tr.nodes([]);
      tr.getLayer() && tr.getLayer().batchDraw();
    }
  }, [selectedElement, elements]);

  // ------- Layer Ordering Handlers -------
  const reorderElements = (fromIndex, toIndex) => {
    setElements((prev) => {
      const arr = [...prev];
      if (fromIndex < 0 || fromIndex >= arr.length) return prev;
      if (toIndex < 0) toIndex = 0;
      if (toIndex >= arr.length) toIndex = arr.length - 1;
      const [item] = arr.splice(fromIndex, 1);
      arr.splice(toIndex, 0, item);
      return arr;
    });
  };

  const handleBringToFront = () => {
    if (!selectedElement) return;
    const idx = elements.findIndex((e) => e.id === selectedElement.id);
    if (idx === -1) return;
    reorderElements(idx, elements.length - 1);
  };

  const handleSendToBack = () => {
    if (!selectedElement) return;
    const idx = elements.findIndex((e) => e.id === selectedElement.id);
    if (idx === -1) return;
    reorderElements(idx, 0);
  };

  const handleBringForward = () => {
    if (!selectedElement) return;
    const idx = elements.findIndex((e) => e.id === selectedElement.id);
    if (idx === -1 || idx === elements.length - 1) return;
    reorderElements(idx, idx + 1);
  };

  const handleSendBackward = () => {
    if (!selectedElement) return;
    const idx = elements.findIndex((e) => e.id === selectedElement.id);
    if (idx <= 0) return;
    reorderElements(idx, idx - 1);
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
      // Preload fonts used in the template so text renders with correct fonts
      const templateFonts = (template.design?.objects || [])
        .filter(el => el.type === 'text' && el.fontFamily)
        .map(el => el.fontFamily);
      preloadFonts(templateFonts);
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

  // Add static image element (after file selection)
  const handleAddImageFromFile = async (file) => {
    if (!file) return;

    // Immediate preview via local URL
    const localUrl = URL.createObjectURL(file);

    // Create element with temporary src; actual upload happens on save
    const id = Date.now().toString();
    const newImageEl = {
      id,
      type: 'image',
      x: 100,
      y: 100,
      width: 200,
      height: 120,
      opacity: 1,
      rotation: 0,
      draggable: true,
      src: localUrl,
      _file: file // keep file reference for upload on save
    };

    // Load into cache for Konva preview
    const img = new window.Image();
    img.src = localUrl;
    img.onload = () => setImageCache(prev => ({ ...prev, [id]: img }));
    img.onerror = () => toast.error('Gagal memuat pratinjau gambar');

    setElements(prev => [...prev, newImageEl]);
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
      // Ensure font is loaded when selecting a text element
      if (element.fontFamily) {
        loadFont(element.fontFamily).then(() => setFontLoadedTick(t => t + 1));
      }
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
    } else if (element.type === 'image') {
      // ensure image cached (for existing templates)
      if (element.src && !imageCache[element.id]) {
        let srcUrl = element.src;
        if (srcUrl.startsWith('/uploads/')) {
          const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
          srcUrl = `${apiBaseUrl}${srcUrl}`;
        }
        const img = new window.Image();
        img.src = srcUrl;
        img.crossOrigin = 'anonymous';
        img.onload = () => setImageCache(prev => ({ ...prev, [element.id]: img }));
        img.onerror = () => console.error('Gagal memuat gambar elemen');
      }
    }
  };

  const handleUpdateElement = (id, updates) => {
    // Update elements array
    setElements(prev => prev.map(el => (el.id === id ? { ...el, ...updates } : el)));
    // Keep selectedElement in sync so UI controls show latest values
    setSelectedElement(prev => (prev && prev.id === id ? { ...prev, ...updates } : prev));
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

      // Upload any pending image files for image elements
      const updatedObjects = [];
      for (const el of elements) {
        if (el.type === 'image' && el._file) {
          try {
            const uploadRes = await certificateService.uploadBackground(el._file);
            if (uploadRes.success && uploadRes.data?.url) {
              updatedObjects.push({ ...el, src: uploadRes.data.url, _file: undefined });
            } else {
              throw new Error('Gagal mengunggah gambar elemen');
            }
          } catch (e) {
            toast.error(e.message || 'Gagal mengunggah gambar elemen');
            setSaving(false);
            return;
          }
        } else {
          updatedObjects.push(el);
        }
      }

      const templateData = {
        name: templateName,
        eventId: parseInt(eventId),
        design: {
          objects: updatedObjects,
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

      const response = await certificateService.bulkDownloadCertificatesPDF(eventId, templateId);

      // Handle both blob and response object
      let blob;
      if (response instanceof Blob) {
        blob = response;
      } else if (response.data) {
        // If it's a response object with data
        blob = new Blob([response.data], { type: 'application/pdf' });
      } else {
        throw new Error('Format respons tidak valid');
      }

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

  // Load images for existing elements when opening editor
  useEffect(() => {
    const loadExistingImages = async () => {
      for (const el of elements) {
        if (el.type === 'image' && el.src && !imageCache[el.id]) {
          let srcUrl = el.src;
          if (srcUrl.startsWith('/uploads/')) {
            const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
            srcUrl = `${apiBaseUrl}${srcUrl}`;
          }
          const img = new window.Image();
          img.src = srcUrl;
          img.crossOrigin = 'anonymous';
          img.onload = () => setImageCache(prev => ({ ...prev, [el.id]: img }));
          img.onerror = () => console.error('Gagal memuat gambar elemen');
        }
      }
    };
    if (openDialog) loadExistingImages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openDialog]);

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
                      Tambah Gambar
                      <input
                        type="file"
                        hidden
                        accept="image/*"
                        onChange={(e) => handleAddImageFromFile(e.target.files?.[0])}
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
                    Properti {selectedElement.type === 'image' ? 'Gambar' : 'Teks'}
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
                          onOpen={preloadDropdownFonts}
                          onChange={async (e) => {
                            const font = e.target.value;
                            await handleUpdateTextProperties('fontFamily', font);
                          }}
                        >
                          {FONT_FAMILIES.map((font) => (
                            <MenuItem
                              key={font}
                              value={font}
                              onMouseEnter={() => loadFont(font)}
                              sx={{ fontFamily: `'${font}', sans-serif` }}
                            >
                              {font}
                            </MenuItem>
                          ))}
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

                      {/* Advanced text properties */}
                      <Divider />
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                        Lanjutan
                      </Typography>
                      <Box>
                        <Typography gutterBottom sx={{ fontWeight: 'bold' }}>
                          Rotasi: {Math.round(selectedElement.rotation || 0)}°
                        </Typography>
                        <Slider
                          value={selectedElement.rotation || 0}
                          onChange={(e, value) => handleUpdateElement(selectedElement.id, { rotation: Number(value) })}
                          min={-180}
                          max={180}
                          step={1}
                          valueLabelDisplay="auto"
                        />
                        <Button size="small" variant="text" onClick={() => handleUpdateElement(selectedElement.id, { rotation: 0 })}>
                          Reset Rotasi Teks
                        </Button>
                      </Box>

                      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                        <TextField
                          label="Background"
                          type="color"
                          value={selectedElement.bgColor || '#ffffff'}
                          onChange={(e) => handleUpdateElement(selectedElement.id, { bgColor: e.target.value })}
                          fullWidth
                        />
                        <TextField
                          label="Radius BG"
                          type="number"
                          value={Math.round(selectedElement.bgRadius || 0)}
                          onChange={(e) => handleUpdateElement(selectedElement.id, { bgRadius: Math.max(0, Number(e.target.value)) })}
                          fullWidth
                        />
                      </Box>
                      <Button size="small" variant="text" color="secondary" onClick={() => handleUpdateElement(selectedElement.id, { bgColor: undefined, bgPadding: undefined, bgRadius: undefined })}>
                        Reset Background
                      </Button>
                      <TextField
                        label="Padding BG"
                        type="number"
                        value={Math.round(selectedElement.bgPadding || 0)}
                        onChange={(e) => handleUpdateElement(selectedElement.id, { bgPadding: Math.max(0, Number(e.target.value)) })}
                        fullWidth
                      />

                      <Typography sx={{ fontWeight: 'bold' }}>Shadow Teks</Typography>
                      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                        <TextField
                          label="Warna"
                          type="color"
                          value={selectedElement.shadowColor || '#000000'}
                          onChange={(e) => handleUpdateElement(selectedElement.id, { shadowColor: e.target.value })}
                        />

                        <TextField
                          label="Blur"
                          type="number"
                          value={Math.round(selectedElement.shadowBlur || 0)}
                          onChange={(e) => handleUpdateElement(selectedElement.id, { shadowBlur: Math.max(0, Number(e.target.value)) })}
                        />
                      </Box>
                      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                        <TextField
                          label="Offset X"
                          type="number"
                          value={Math.round(selectedElement.shadowOffsetX || 0)}
                          onChange={(e) => handleUpdateElement(selectedElement.id, { shadowOffsetX: Number(e.target.value) })}
                        />
                        <TextField
                          label="Offset Y"
                          type="number"
                          value={Math.round(selectedElement.shadowOffsetY || 0)}
                          onChange={(e) => handleUpdateElement(selectedElement.id, { shadowOffsetY: Number(e.target.value) })}
                        />
                      </Box>
                      <Box>
                        <Typography gutterBottom sx={{ fontWeight: 'bold' }}>
                          Opacity Shadow: {typeof selectedElement.shadowOpacity === 'number' ? selectedElement.shadowOpacity.toFixed(2) : 1}
                        </Typography>
                        <Slider
                          value={typeof selectedElement.shadowOpacity === 'number' ? selectedElement.shadowOpacity : 1}
                          onChange={(e, value) => handleUpdateElement(selectedElement.id, { shadowOpacity: Number(value) })}
                          min={0}
                          max={1}
                          step={0.01}
                          valueLabelDisplay="auto"
                        />
                      </Box>
                      <Button size="small" variant="text" color="secondary" onClick={() => handleUpdateElement(selectedElement.id, { shadowColor: undefined, shadowBlur: undefined, shadowOffsetX: undefined, shadowOffsetY: undefined, shadowOpacity: undefined })}>
                        Reset Shadow Teks
                      </Button>

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

                  {selectedElement.type === 'image' && (
                    <Stack spacing={3}>
                      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                        <TextField
                          label="Posisi X"
                          type="number"
                          value={Math.round(selectedElement.x || 0)}
                          onChange={(e) => handleUpdateElement(selectedElement.id, { x: Number(e.target.value) })}
                          fullWidth
                        />
                        <TextField
                          label="Posisi Y"
                          type="number"
                          value={Math.round(selectedElement.y || 0)}
                          onChange={(e) => handleUpdateElement(selectedElement.id, { y: Number(e.target.value) })}
                          fullWidth
                        />
                      </Box>

                      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                        <TextField
                          label="Lebar (px)"
                          type="number"
                          value={Math.round(selectedElement.width || 100)}
                          onChange={(e) => handleUpdateElement(selectedElement.id, { width: Math.max(5, Number(e.target.value)) })}
                          fullWidth
                        />
                        <TextField
                          label="Tinggi (px)"
                          type="number"
                          value={Math.round(selectedElement.height || 100)}
                          onChange={(e) => handleUpdateElement(selectedElement.id, { height: Math.max(5, Number(e.target.value)) })}
                          fullWidth
                        />
                      </Box>

                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={lockImageRatio}
                            onChange={(e) => setLockImageRatio(e.target.checked)}
                          />
                        }
                        label="Kunci Rasio Gambar"
                      />

                      <Box>
                        <Typography gutterBottom sx={{ fontWeight: 'bold' }}>
                          Rotasi: {Math.round(selectedElement.rotation || 0)}°
                        </Typography>
                        <Slider
                          value={selectedElement.rotation || 0}
                          onChange={(e, value) => handleUpdateElement(selectedElement.id, { rotation: Number(value) })}
                          min={-180}
                          max={180}
                          step={1}
                          valueLabelDisplay="auto"
                        />
                        <Button size="small" variant="text" onClick={() => handleUpdateElement(selectedElement.id, { rotation: 0 })}>
                          Reset Rotasi
                        </Button>
                      </Box>

                      <Box>
                        <Typography gutterBottom sx={{ fontWeight: 'bold' }}>
                          Opacity: {typeof selectedElement.opacity === 'number' ? selectedElement.opacity.toFixed(2) : 1}
                        </Typography>
                        <Slider
                          value={typeof selectedElement.opacity === 'number' ? selectedElement.opacity : 1}
                          onChange={(e, value) => handleUpdateElement(selectedElement.id, { opacity: Number(value) })}
                          min={0.1}
                          max={1}
                          step={0.01}
                          valueLabelDisplay="auto"
                        />
                        <Button size="small" variant="text" onClick={() => handleUpdateElement(selectedElement.id, { opacity: 1 })}>
                          Reset Opacity
                        </Button>
                      </Box>

                      {/* Image border & shadow */}
                      <Divider />
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                        Border & Shadow
                      </Typography>
                      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                        <TextField
                          label="Warna Border"
                          type="color"
                          value={selectedElement.borderColor || '#000000'}
                          onChange={(e) => handleUpdateElement(selectedElement.id, { borderColor: e.target.value })}
                        />
                        <TextField
                          label="Lebar Border (px)"
                          type="number"
                          value={Math.round(selectedElement.borderWidth || 0)}
                          onChange={(e) => handleUpdateElement(selectedElement.id, { borderWidth: Math.max(0, Number(e.target.value)) })}
                        />
                      </Box>
                      <TextField
                        label="Radius (px)"
                        type="number"
                        value={Math.round(selectedElement.borderRadius || 0)}
                        onChange={(e) => handleUpdateElement(selectedElement.id, { borderRadius: Math.max(0, Number(e.target.value)) })}
                        fullWidth
                      />
                      <Button size="small" variant="text" color="secondary" onClick={() => handleUpdateElement(selectedElement.id, { borderColor: undefined, borderWidth: undefined, borderRadius: undefined })}>
                        Reset Border
                      </Button>

                      <Typography sx={{ fontWeight: 'bold' }}>Shadow Gambar</Typography>
                      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                        <TextField
                          label="Warna"
                          type="color"
                          value={selectedElement.shadowColor || '#000000'}
                          onChange={(e) => handleUpdateElement(selectedElement.id, { shadowColor: e.target.value })}
                        />
                        <TextField
                          label="Blur"
                          type="number"
                          value={Math.round(selectedElement.shadowBlur || 0)}
                          onChange={(e) => handleUpdateElement(selectedElement.id, { shadowBlur: Math.max(0, Number(e.target.value)) })}
                        />
                      </Box>
                      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                        <TextField
                          label="Offset X"
                          type="number"
                          value={Math.round(selectedElement.shadowOffsetX || 0)}
                          onChange={(e) => handleUpdateElement(selectedElement.id, { shadowOffsetX: Number(e.target.value) })}
                        />
                        <TextField
                          label="Offset Y"
                          type="number"
                          value={Math.round(selectedElement.shadowOffsetY || 0)}
                          onChange={(e) => handleUpdateElement(selectedElement.id, { shadowOffsetY: Number(e.target.value) })}
                        />
                      </Box>
                      <Box>
                        <Typography gutterBottom sx={{ fontWeight: 'bold' }}>
                          Opacity Shadow: {typeof selectedElement.shadowOpacity === 'number' ? selectedElement.shadowOpacity.toFixed(2) : 1}
                        </Typography>
                        <Slider
                          value={typeof selectedElement.shadowOpacity === 'number' ? selectedElement.shadowOpacity : 1}
                          onChange={(e, value) => handleUpdateElement(selectedElement.id, { shadowOpacity: Number(value) })}
                          min={0}
                          max={1}
                          step={0.01}
                          valueLabelDisplay="auto"
                        />
                      </Box>

                      <Button
                        fullWidth
                        variant="outlined"
                        color="error"
                        startIcon={<Delete />}
                        onClick={handleDeleteElement}
                        sx={{ borderRadius: 2, py: 1.5 }}
                      >
                        Hapus Elemen
                      </Button>
                    </Stack>
                  )}

                  {/* Layer Ordering Section (common) */}
                  <Divider sx={{ my: 3 }} />
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', mb: 1 }}>
                    Urutan Layer
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                    <Tooltip title="Ke Depan">
                      <IconButton size="small" onClick={handleBringToFront} sx={{ border: '1px solid', borderColor: 'divider' }}>
                        <VerticalAlignTop fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Naik 1">
                      <IconButton size="small" onClick={handleBringForward} sx={{ border: '1px solid', borderColor: 'divider' }}>
                        <ArrowUpward fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Turun 1">
                      <IconButton size="small" onClick={handleSendBackward} sx={{ border: '1px solid', borderColor: 'divider' }}>
                        <ArrowDownward fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Ke Belakang">
                      <IconButton size="small" onClick={handleSendToBack} sx={{ border: '1px solid', borderColor: 'divider' }}>
                        <VerticalAlignBottom fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
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
                  onMouseDown={(e) => {
                    // Deselect when clicking on empty area
                    const stage = e.target.getStage();
                    const clickedOnEmpty = e.target === stage;
                    if (clickedOnEmpty) {
                      setSelectedElement(null);
                      if (transformerRef.current) transformerRef.current.nodes([]);
                    }
                  }}
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
                          {element.type === 'text' ? (
                            <>
                              {/* Optional background for text */}
                              {element.bgColor && (
                                <Rect
                                  x={(element.x || 0) - (element.bgPadding || 0)}
                                  y={(element.y || 0) - (element.bgPadding || 0)}
                                  width={(element.width || 200) + 2 * (element.bgPadding || 0)}
                                  height={(element.fontSize ? element.fontSize * 1.3 : 32) + 2 * (element.bgPadding || 0)}
                                  fill={element.bgColor}
                                  cornerRadius={element.bgRadius || 0}
                                  listening={false}
                                />
                              )}
                              <Text
                                x={element.x || 0}
                                y={element.y || 0}
                                text={element.text}
                                fontSize={element.fontSize}
                                fontFamily={element.fontFamily}
                                fill={element.fill}
                                fontStyle={`${element.fontStyle === 'italic' ? 'italic' : 'normal'} ${element.fontWeight === 'bold' ? 'bold' : 'normal'}`.trim()}
                                textDecoration={element.textDecoration}
                                align={element.align || 'left'}
                                verticalAlign={element.verticalAlign || 'top'}
                                width={element.width || 200}
                                rotation={element.rotation || 0}
                                ref={(node) => { if (node) shapeRefs.current[element.id] = node; }}
                                shadowColor={element.shadowColor || 'rgba(0,0,0,0)'}
                                shadowBlur={element.shadowBlur || 0}
                                shadowOffset={{ x: element.shadowOffsetX || 0, y: element.shadowOffsetY || 0 }}
                                shadowOpacity={typeof element.shadowOpacity === 'number' ? element.shadowOpacity : 1}
                                draggable={element.draggable}
                                onClick={() => handleSelectElement(element)}
                                onDragEnd={(e) => {
                                  handleUpdateElement(element.id, { x: e.target.x(), y: e.target.y() });
                                }}
                                onTransformEnd={(e) => {
                                  const node = e.target;
                                  const scaleX = node.scaleX();
                                  const scaleY = node.scaleY();
                                  const prevWidth = element.width || 200;
                                  const prevFontSize = element.fontSize || 24;
                                  const newWidth = Math.max(50, prevWidth * scaleX);
                                  const newFontSize = Math.max(6, Math.round(prevFontSize * scaleY));
                                  handleUpdateElement(element.id, {
                                    x: node.x(),
                                    y: node.y(),
                                    width: newWidth,
                                    fontSize: newFontSize,
                                    rotation: node.rotation()
                                  });
                                  // sync sidebar properties immediately
                                  setTextProperties((prev) => ({
                                    ...prev,
                                    width: newWidth,
                                    fontSize: newFontSize
                                  }));
                                  node.scaleX(1);
                                  node.scaleY(1);
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
                            </>
                          ) : (
                            <>
                              {/* Outer group handles rotation, dragging, and SHADOW so it's not clipped */}
                              <Group
                                x={element.x || 0}
                                y={element.y || 0}
                                rotation={element.rotation || 0}
                                ref={(node) => { if (node) shapeRefs.current[element.id] = node; }}
                                draggable={element.draggable}
                                onClick={() => handleSelectElement(element)}
                                onDragEnd={(e) => {
                                  handleUpdateElement(element.id, { x: e.target.x(), y: e.target.y() });
                                }}
                                onTransformEnd={(e) => {
                                  const node = e.target;
                                  const scaleX = node.scaleX();
                                  const scaleY = node.scaleY();
                                  const newWidth = Math.max(5, (element.width || 100) * scaleX);
                                  const newHeight = Math.max(5, (element.height || 100) * scaleY);
                                  handleUpdateElement(element.id, {
                                    x: node.x(),
                                    y: node.y(),
                                    width: newWidth,
                                    height: newHeight,
                                    rotation: node.rotation()
                                  });
                                  node.scaleX(1);
                                  node.scaleY(1);
                                }}
                                shadowColor={element.shadowColor || 'rgba(0,0,0,0)'}
                                shadowBlur={element.shadowBlur || 0}
                                shadowOffset={{ x: element.shadowOffsetX || 0, y: element.shadowOffsetY || 0 }}
                                shadowOpacity={typeof element.shadowOpacity === 'number' ? element.shadowOpacity : 1}
                              >
                                {/* Inner clipped group for rounded corners and border */}
                                <Group
                                  clipFunc={element.borderRadius ? (ctx) => {
                                    const w = element.width || 100;
                                    const h = element.height || 100;
                                    const r = Math.min(element.borderRadius || 0, w / 2, h / 2);
                                    const x = 0, y = 0;
                                    ctx.beginPath();
                                    ctx.moveTo(x + r, y);
                                    ctx.arcTo(x + w, y, x + w, y + h, r);
                                    ctx.arcTo(x + w, y + h, x, y + h, r);
                                    ctx.arcTo(x, y + h, x, y, r);
                                    ctx.arcTo(x, y, x + w, y, r);
                                    ctx.closePath();
                                  } : undefined}
                                >
                                  <KonvaImage
                                    image={imageCache[element.id] || null}
                                    x={0}
                                    y={0}
                                    width={element.width || 100}
                                    height={element.height || 100}
                                    opacity={typeof element.opacity === 'number' ? element.opacity : 1}
                                    listening={true}
                                  />
                                  {(element.borderWidth || 0) > 0 && (
                                    <Rect
                                      x={0}
                                      y={0}
                                      width={element.width || 100}
                                      height={element.height || 100}
                                      stroke={element.borderColor || '#000'}
                                      strokeWidth={element.borderWidth || 1}
                                      cornerRadius={element.borderRadius || 0}
                                      listening={false}
                                    />
                                  )}
                                </Group>
                              </Group>
                              {isSelected && (
                                <Rect
                                  x={element.x || 0}
                                  y={element.y || 0}
                                  width={element.width || 100}
                                  height={element.height || 100}
                                  stroke="#1976d2"
                                  strokeWidth={2}
                                  dash={[6, 4]}
                                  listening={false}
                                />
                              )}
                            </>
                          )}
                        </React.Fragment>
                      );
                    })}
                    {/* Transformer for selected element (text or image) */}
                    <Transformer
                      ref={transformerRef}
                      rotateEnabled
                      keepRatio={selectedElement?.type === 'image' ? lockImageRatio : false}
                      boundBoxFunc={(oldBox, newBox) => {
                        const MIN_SIZE = 10;
                        if (newBox.width < MIN_SIZE || newBox.height < MIN_SIZE) {
                          return oldBox;
                        }
                        return newBox;
                      }}
                      enabledAnchors={['top-left','top-right','bottom-left','bottom-right','top-center','bottom-center','middle-left','middle-right']}
                    />
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
