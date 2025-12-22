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
  Switch,
  Divider,
  Menu,
  Stack,
  Avatar,
  CardActions,
  Pagination,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Image,
  TextFields,
  Save,
  ArrowBack,
  ArrowForward,
  MoreVert,
  GetApp,
  Link as LinkIcon,
  ContentCopy,
  FormatBold,
  FormatItalic,
  FormatUnderlined,
  StrikethroughS,
  AlignHorizontalLeft,
  AlignHorizontalCenter,
  AlignHorizontalRight,
  AlignVerticalTop,
  AlignVerticalCenter,
  AlignVerticalBottom
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

  const clampNumber = (value, min, max, step) => {
    const v = Number(value);
    if (!Number.isFinite(v)) return min;
    const clamped = Math.min(max, Math.max(min, v));
    if (typeof step === 'number' && step > 0) {
      const snapped = Math.round((clamped - min) / step) * step + min;
      return Math.min(max, Math.max(min, Number(snapped.toFixed(6))));
    }
    return clamped;
  };

  const getElementBox = (el) => {
    const x = Number(el?.x || 0);
    const y = Number(el?.y || 0);
    const w = el?.type === 'image'
      ? Number(el?.width || 100)
      : Number(el?.width || 200);
    const lh = (el?.type === 'text')
      ? (typeof el?.lineHeight === 'number' && el.lineHeight > 0 ? el.lineHeight : 1)
      : 1;
    const h = el?.type === 'image'
      ? Number(el?.height || 100)
      : Number((el?.fontSize || 24) * lh);
    return { x, y, w, h };
  };

  // Alignment relative to the current selection (anchor = last clicked element)
  const alignSelectionToAnchor = (direction) => {
    const ids = selectedElementIds || [];
    if (!selectedElement || ids.length < 2) {
      return alignSelectedElement(direction);
    }

    const anchor = selectedElement;
    const anchorBox = getElementBox(anchor);

    setElements((prev) => prev.map((el) => {
      if (!ids.includes(el.id)) return el;
      if (el.id === anchor.id) return el;
      const b = getElementBox(el);
      const updates = {};
      switch (direction) {
        case 'left':
          updates.x = Math.round(anchorBox.x);
          break;
        case 'center-h':
          updates.x = Math.round(anchorBox.x + (anchorBox.w - b.w) / 2);
          break;
        case 'right':
          updates.x = Math.round(anchorBox.x + anchorBox.w - b.w);
          break;
        case 'top':
          updates.y = Math.round(anchorBox.y);
          break;
        case 'middle-v':
          updates.y = Math.round(anchorBox.y + (anchorBox.h - b.h) / 2);
          break;
        case 'bottom':
          updates.y = Math.round(anchorBox.y + anchorBox.h - b.h);
          break;
        default:
          break;
      }
      return Object.keys(updates).length ? { ...el, ...updates } : el;
    }));
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
  const [publicDownloadSettings, setPublicDownloadSettings] = useState({
    enabled: false,
    identifierField: '',
    matchMode: 'exact',
    searchFields: [],
    templateId: '',
    regenerateSlug: false,
    slug: '',
    resultFields: []
  });
  const [publicSettingsOpen, setPublicSettingsOpen] = useState(false);
  const [savingPublicSettings, setSavingPublicSettings] = useState(false);
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
  const [selectedElementIds, setSelectedElementIds] = useState([]);
  const [elements, setElements] = useState([]);
  const [pages, setPages] = useState([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [backgroundImage, setBackgroundImage] = useState(null);
  const [backgroundImageObj, setBackgroundImageObj] = useState(null);
  const backgroundImageRef = useRef(null);
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
    width: 200,
    wordWrap: true,
    lineHeight: 1,
    letterSpacing: 0
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

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState([]);

  const [deletePageConfirmOpen, setDeletePageConfirmOpen] = useState(false);
  const [pendingDeletePageIndex, setPendingDeletePageIndex] = useState(null);

  const leftPanelScrollRef = useRef(null);
  const leftPanelScrollTopRef = useRef(0);
  const measureTextTimerRef = useRef(null);

  // ---------- Undo/Redo History (Editor) ----------
  const historyPastRef = useRef([]);
  const historyFutureRef = useRef([]);
  const historyIgnoreRef = useRef(false);
  const historyLastPushAtRef = useRef(0);
  const HISTORY_MAX = 60;

  const buildPagesSnapshot = () => {
    const base = (pages && pages.length > 0)
      ? [...pages]
      : [{ objects: elements, background: backgroundImage, _backgroundFile: backgroundImageFile }];
    const idx = Math.max(0, Math.min(currentPageIndex, base.length - 1));
    base[idx] = {
      ...base[idx],
      objects: elements,
      background: backgroundImage,
      _backgroundFile: backgroundImageFile || base[idx]?._backgroundFile || null
    };
    return { pages: base, currentPageIndex: idx };
  };

  const clearHistory = () => {
    historyPastRef.current = [];
    historyFutureRef.current = [];
    historyLastPushAtRef.current = 0;
  };

  const pushHistorySnapshot = (reason = 'change') => {
    if (!openDialog) return;
    if (historyIgnoreRef.current) return;

    const now = Date.now();
    // throttle frequent updates (typing/slider drag)
    if (now - (historyLastPushAtRef.current || 0) < 350) return;

    const snap = buildPagesSnapshot();
    const snapshot = {
      pages: snap.pages,
      currentPageIndex: snap.currentPageIndex,
      selectedElementIds: Array.isArray(selectedElementIds) ? [...selectedElementIds] : [],
      selectedElementId: selectedElement?.id || null,
      backgroundImage: snap.pages?.[snap.currentPageIndex]?.background || null,
      _backgroundFile: snap.pages?.[snap.currentPageIndex]?._backgroundFile || null,
      reason,
      at: now,
    };

    historyPastRef.current.push(snapshot);
    if (historyPastRef.current.length > HISTORY_MAX) {
      historyPastRef.current = historyPastRef.current.slice(historyPastRef.current.length - HISTORY_MAX);
    }
    historyFutureRef.current = [];
    historyLastPushAtRef.current = now;
  };

  const restoreSnapshot = (snapshot) => {
    if (!snapshot || !snapshot.pages || !snapshot.pages.length) return;
    historyIgnoreRef.current = true;

    try {
      const idx = Math.max(0, Math.min(snapshot.currentPageIndex || 0, snapshot.pages.length - 1));
      const page = snapshot.pages[idx] || { objects: [], background: null, _backgroundFile: null };

      setPages(snapshot.pages);
      setCurrentPageIndex(idx);

      // mimic loadPageFromPages, but without committing anything
      setSelectedElement(null);
      setSelectedElementIds(Array.isArray(snapshot.selectedElementIds) ? snapshot.selectedElementIds : []);
      shapeRefs.current = {};
      transformerRef.current?.nodes([]);

      setElements(Array.isArray(page.objects) ? page.objects : []);
      setBackgroundImage(page.background || null);
      // Force background reload: on undo/redo, background URL may be unchanged so the backgroundImage effect won't re-run.
      if (page.background) {
        setBackgroundImageObj(null);
        let imageUrl = page.background;
        if (typeof imageUrl === 'string' && imageUrl.startsWith('/uploads/')) {
          const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
          imageUrl = `${apiBaseUrl}${page.background}`;
        }
        const image = new window.Image();
        image.src = imageUrl;
        image.onload = () => {
          setBackgroundImageObj(image);
        };
        image.onerror = () => {
          setBackgroundImageObj(null);
        };
      } else {
        setBackgroundImageObj(null);
      }
      setBackgroundImageFile(page._backgroundFile || null);

      // restore selection object (best-effort)
      if (snapshot.selectedElementId) {
        const found = (Array.isArray(page.objects) ? page.objects : []).find(o => o.id === snapshot.selectedElementId);
        if (found) setSelectedElement(found);
      }
    } finally {
      // let state flush before re-enabling history
      setTimeout(() => { historyIgnoreRef.current = false; }, 0);
    }
  };

  const undo = () => {
    if (!openDialog) return;
    const past = historyPastRef.current;
    if (!past || past.length === 0) return;

    const current = buildPagesSnapshot();
    historyFutureRef.current.push({
      pages: current.pages,
      currentPageIndex: current.currentPageIndex,
      selectedElementIds: Array.isArray(selectedElementIds) ? [...selectedElementIds] : [],
      selectedElementId: selectedElement?.id || null,
      backgroundImage: current.pages?.[current.currentPageIndex]?.background || null,
      _backgroundFile: current.pages?.[current.currentPageIndex]?._backgroundFile || null,
      reason: 'redo-base',
      at: Date.now(),
    });

    const prev = past.pop();
    restoreSnapshot(prev);
  };

  const redo = () => {
    if (!openDialog) return;
    const future = historyFutureRef.current;
    if (!future || future.length === 0) return;

    const current = buildPagesSnapshot();
    historyPastRef.current.push({
      pages: current.pages,
      currentPageIndex: current.currentPageIndex,
      selectedElementIds: Array.isArray(selectedElementIds) ? [...selectedElementIds] : [],
      selectedElementId: selectedElement?.id || null,
      backgroundImage: current.pages?.[current.currentPageIndex]?.background || null,
      _backgroundFile: current.pages?.[current.currentPageIndex]?._backgroundFile || null,
      reason: 'undo-base',
      at: Date.now(),
    });
    if (historyPastRef.current.length > HISTORY_MAX) {
      historyPastRef.current = historyPastRef.current.slice(historyPastRef.current.length - HISTORY_MAX);
    }

    const next = future.pop();
    restoreSnapshot(next);
  };

  useEffect(() => {
    if (!openDialog) return;
    const handler = (e) => {
      const key = String(e.key || '').toLowerCase();
      const isMac = /mac|iphone|ipad|ipod/i.test(navigator.platform);
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (!mod) return;

      // Avoid triggering while typing into inputs
      const t = e.target;
      const tag = (t && t.tagName) ? String(t.tagName).toLowerCase() : '';
      if (tag === 'input' || tag === 'textarea' || (t && t.isContentEditable)) {
        // allow undo/redo even when focused in text input? For now, keep native behavior.
        return;
      }

      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((key === 'y' && !e.shiftKey) || (key === 'z' && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openDialog, selectedElement?.id]);

  useEffect(() => {
    const el = leftPanelScrollRef.current;
    if (!el) return;
    const top = leftPanelScrollTopRef.current || 0;
    requestAnimationFrame(() => {
      if (leftPanelScrollRef.current) leftPanelScrollRef.current.scrollTop = top;
    });
  }, [tabValue, selectedElement?.id]);

  const nudgeSelection = (dx, dy) => {
    const ids = (selectedElementIds && selectedElementIds.length)
      ? selectedElementIds
      : (selectedElement ? [selectedElement.id] : []);
    if (!ids.length) return;

    pushHistorySnapshot('nudge');

    setElements((prev) => prev.map((el) => {
      if (!ids.includes(el.id)) return el;
      return { ...el, x: Math.round((el.x || 0) + dx), y: Math.round((el.y || 0) + dy) };
    }));

    setSelectedElement((prev) => {
      if (!prev || !ids.includes(prev.id)) return prev;
      return { ...prev, x: Math.round((prev.x || 0) + dx), y: Math.round((prev.y || 0) + dy) };
    });
  };

  useEffect(() => {
    if (!openDialog) return;

    const isEditableTarget = (target) => {
      if (!target) return false;
      const tag = (target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
      if (target.isContentEditable) return true;
      const role = target.getAttribute && target.getAttribute('role');
      if (role === 'textbox') return true;
      return false;
    };

    const onKeyDown = (e) => {
      if (!selectedElement && (!selectedElementIds || !selectedElementIds.length)) return;
      if (isEditableTarget(e.target)) return;

      let step;
      if (e.shiftKey) step = 10;
      else if (e.altKey) step = 1;
      else step = 5;

      let dx = 0;
      let dy = 0;
      switch (e.key) {
        case 'ArrowLeft':
          dx = -step;
          break;
        case 'ArrowRight':
          dx = step;
          break;
        case 'ArrowUp':
          dy = -step;
          break;
        case 'ArrowDown':
          dy = step;
          break;
        default:
          return;
      }
      e.preventDefault();
      nudgeSelection(dx, dy);
    };

    window.addEventListener('keydown', onKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openDialog, selectedElement, selectedElementIds]);

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
      const ev = response.data.event;
      setEvent(ev);
      setPublicDownloadSettings(prev => ({
        ...prev,
        enabled: !!ev.publicDownloadEnabled,
        identifierField: ev.publicDownloadIdentifierField || '',
        matchMode: ev.publicDownloadMatchMode || 'exact',
        searchFields: Array.isArray(ev.publicDownloadSearchFields) && ev.publicDownloadSearchFields.length
          ? ev.publicDownloadSearchFields
          : (ev.publicDownloadIdentifierField
            ? [{ name: ev.publicDownloadIdentifierField, matchMode: ev.publicDownloadMatchMode || 'exact', required: true }]
            : []),
        templateId: '',
        regenerateSlug: false,
        slug: ev.publicDownloadSlug || '',
        resultFields: Array.isArray(ev.publicDownloadResultFields) ? ev.publicDownloadResultFields : []
      }));
    } catch (error) {
      toast.error('Gagal memuat detail kegiatan');
      navigate('/events');
    }
  };

  const getPublicDownloadUrl = () => {
    const slug = event?.publicDownloadSlug;
    if (!slug) return '';
    return `${window.location.origin}/download/${slug}`;
  };

  const handleCopyPublicLink = async () => {
    try {
      const url = getPublicDownloadUrl();
      if (!url) {
        toast.error('Link belum tersedia. Simpan pengaturan terlebih dahulu.');
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success('Link berhasil disalin');
    } catch {
      toast.error('Gagal menyalin link');
    }
  };

  const handleSavePublicDownloadSettings = async () => {
    try {
      setSavingPublicSettings(true);

      const payload = {
        enabled: publicDownloadSettings.enabled,
        identifierField: publicDownloadSettings.identifierField,
        matchMode: publicDownloadSettings.matchMode,
        searchFields: publicDownloadSettings.searchFields,
        templateId: publicDownloadSettings.templateId || null,
        regenerateSlug: publicDownloadSettings.regenerateSlug,
        slug: publicDownloadSettings.slug,
        resultFields: publicDownloadSettings.resultFields
      };

      const response = await eventService.updatePublicDownloadSettings(eventId, payload);
      const updated = response.data.event;
      setEvent(updated);
      setPublicDownloadSettings(prev => ({ ...prev, regenerateSlug: false, slug: updated.publicDownloadSlug || prev.slug }));
      toast.success('Pengaturan link download berhasil disimpan');
      setPublicSettingsOpen(false);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Gagal menyimpan pengaturan');
    } finally {
      setSavingPublicSettings(false);
    }
  };

  // Keep Transformer selection in sync
  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    const nodes = (selectedElementIds || []).map((id) => shapeRefs.current[id]).filter(Boolean);
    if (nodes.length) {
      tr.nodes(nodes);
      tr.getLayer() && tr.getLayer().batchDraw();
    } else {
      tr.nodes([]);
      tr.getLayer() && tr.getLayer().batchDraw();
    }
  }, [selectedElementIds, elements]);

  // Handle click outside to deselect
  const handleStageClick = (e) => {
    // Only deselect if clicking on the stage itself (empty area)
    if (e.target === e.target.getStage()) {
      setSelectedElement(null);
      setSelectedElementIds([]);
    }
  };

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

  // Alignment relative to canvas (single selected element)
  const alignSelectedElement = (direction) => {
    if (!selectedElement) return;
    const el = selectedElement;
    let updates = {};
    const elWidth = el.width || (el.type === 'image' ? (el.width || 100) : 200);
    const elHeight = el.type === 'image' ? (el.height || 100) : (el.fontSize ? el.fontSize * 1.3 : 32);
    switch (direction) {
      case 'left':
        updates.x = 0;
        break;
      case 'center-h':
        updates.x = Math.round((stageSize.width - elWidth) / 2);
        break;
      case 'right':
        updates.x = Math.round(stageSize.width - elWidth);
        break;
      case 'top':
        updates.y = 0;
        break;
      case 'middle-v':
        updates.y = Math.round((stageSize.height - elHeight) / 2);
        break;
      case 'bottom':
        updates.y = Math.round(stageSize.height - elHeight);
        break;
      default:
        break;
    }
    if (Object.keys(updates).length) {
      handleUpdateElement(el.id, updates);
    }
  };

  const fetchTemplates = async (page = 1) => {
    try {
      setLoading(true);
      const response = await certificateService.getTemplates(eventId, page, pagination.limit);
      const nextTemplates = response.data.templates;
      setTemplates(nextTemplates);

      // Map stored FK (publicDownloadTemplateId) to template UUID for the dropdown
      setPublicDownloadSettings((prev) => {
        const fk = event?.publicDownloadTemplateId;
        if (!fk) return prev;
        const found = (nextTemplates || []).find((t) => t && t.id === fk);
        if (!found?.uuid) return prev;
        if (prev.templateId === found.uuid) return prev;
        return { ...prev, templateId: found.uuid };
      });
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

  const normalizeDesignToPages = (design) => {
    if (design?.pages && Array.isArray(design.pages) && design.pages.length > 0) {
      return design.pages.map((p) => ({
        objects: Array.isArray(p?.objects) ? p.objects : [],
        background: p?.background || null,
        _backgroundFile: p?._backgroundFile || null
      }));
    }
    return [
      {
        objects: Array.isArray(design?.objects) ? design.objects : [],
        background: design?.background || null,
        _backgroundFile: null
      }
    ];
  };

  const commitCurrentPageToPages = () => {
    setPages((prev) => {
      if (!prev || prev.length === 0) return prev;
      const idx = Math.max(0, Math.min(currentPageIndex, prev.length - 1));
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        objects: elements,
        background: backgroundImage,
        _backgroundFile: backgroundImageFile || next[idx]?._backgroundFile || null
      };
      return next;
    });
  };

  const loadPageFromPages = (idx, pagesList = null) => {
    const src = pagesList || pages;
    setSelectedElement(null);
    shapeRefs.current = {};
    transformerRef.current?.nodes([]);
    const page = src[idx];
    setElements(page?.objects || []);
    setBackgroundImage(page?.background || null);
    setBackgroundImageObj(null);
    setBackgroundImageFile(page?._backgroundFile || null);
    setCurrentPageIndex(idx);
  };

  const handleAddPage = () => {
    // commit current state into pages, then add a new empty page and switch to it
    const next = (() => {
      const base = (pages && pages.length > 0)
        ? [...pages]
        : [{ objects: elements, background: backgroundImage, _backgroundFile: backgroundImageFile }];
      const idx = Math.max(0, Math.min(currentPageIndex, base.length - 1));
      base[idx] = {
        ...base[idx],
        objects: elements,
        background: backgroundImage,
        _backgroundFile: backgroundImageFile || base[idx]?._backgroundFile || null
      };
      base.push({ objects: [], background: null, _backgroundFile: null });
      return base;
    })();

    setPages(next);
    loadPageFromPages(next.length - 1, next);
  };

  const handleDeleteCurrentPage = () => {
    if (!pages || pages.length <= 1) {
      toast.error('Minimal harus ada 1 halaman');
      return;
    }
    const idx = currentPageIndex;
    const next = [...pages];
    const removed = next[idx];
    if (removed?.background && typeof removed.background === 'string' && removed.background.startsWith('blob:')) {
      try { URL.revokeObjectURL(removed.background); } catch (_) { /* ignore */ }
    }
    next.splice(idx, 1);
    const nextIdx = Math.max(0, Math.min(idx - 1, next.length - 1));
    setPages(next);
    loadPageFromPages(nextIdx, next);
  };

  const requestDeleteCurrentPage = () => {
    if (!pages || pages.length <= 1) {
      toast.error('Minimal harus ada 1 halaman');
      return;
    }
    setPendingDeletePageIndex(currentPageIndex);
    setDeletePageConfirmOpen(true);
  };

  const handleGoToPage = (idx) => {
    if (idx === currentPageIndex) return;
    const next = [...pages];
    const curIdx = Math.max(0, Math.min(currentPageIndex, next.length - 1));
    next[curIdx] = {
      ...next[curIdx],
      objects: elements,
      background: backgroundImage,
      _backgroundFile: backgroundImageFile || next[curIdx]?._backgroundFile || null
    };
    setPages(next);
    loadPageFromPages(idx, next);
  };

  const handleOpenEditor = (template = null) => {
    if (template) {
      setSelectedTemplate(template);
      setTemplateName(template.name);
      const normalizedPages = normalizeDesignToPages(template.design);
      setPages(normalizedPages);
      setCurrentPageIndex(0);
      setElements(normalizedPages[0]?.objects || []);
      setStageSize({ width: template.width || 842, height: template.height || 595 });
      // Preload fonts used in the template so text renders with correct fonts
      const allObjects = normalizedPages.flatMap(p => p?.objects || []);
      const templateFonts = (allObjects || [])
        .filter(el => el.type === 'text' && el.fontFamily)
        .map(el => el.fontFamily);
      preloadFonts(templateFonts);
      // Load background image if it exists in the template
      if (normalizedPages[0]?.background) {
        setBackgroundImage(normalizedPages[0].background);
      } else {
        setBackgroundImage(null);
        setBackgroundImageObj(null);
      }
      setBackgroundImageFile(normalizedPages[0]?._backgroundFile || null);
    } else {
      setSelectedTemplate(null);
      setTemplateName('');
      setElements([]);
      setPages([{ objects: [], background: null, _backgroundFile: null }]);
      setCurrentPageIndex(0);
      setStageSize({ width: 842, height: 595 });
      setBackgroundImage(null);
      setBackgroundImageObj(null);
      setBackgroundImageFile(null);
    }
    // Clear the background file state
    setOpenDialog(true);
  };

  const handleCloseEditor = () => {
    commitCurrentPageToPages();
    setOpenDialog(false);
    setSelectedTemplate(null);
    setElements([]);
    setPages([]);
    setCurrentPageIndex(0);
    setSelectedElement(null);

    // Revoke the object URL to prevent memory leaks
    if (backgroundImage && backgroundImage.startsWith('blob:')) {
      URL.revokeObjectURL(backgroundImage);
    }
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
      wordWrap: textProperties.wordWrap,
      lineHeight: textProperties.lineHeight,
      letterSpacing: typeof textProperties.letterSpacing === 'number' ? textProperties.letterSpacing : 0,
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
      wordWrap: textProperties.wordWrap,
      lineHeight: textProperties.lineHeight,
      letterSpacing: 0,
      draggable: true,
      isDynamic: true,
      fieldName: field.name
    };
    setElements([...elements, newText]);
  };

  const handleSelectElement = (element, e) => {
    const shift = !!(e && e.evt && e.evt.shiftKey);
    if (shift) {
      setSelectedElement(element);
      setSelectedElementIds((prev) => {
        const cur = Array.isArray(prev) ? prev : [];
        const exists = cur.includes(element.id);
        const next = exists ? cur.filter((id) => id !== element.id) : [...cur, element.id];
        return next.length ? next : [element.id];
      });
    } else {
      setSelectedElement(element);
      setSelectedElementIds([element.id]);
    }

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
        width: element.width || 200,
        wordWrap: element.wordWrap !== undefined ? element.wordWrap : true
        ,
        lineHeight: element.lineHeight || 1,
        letterSpacing: typeof element.letterSpacing === 'number' ? element.letterSpacing : 0
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
    // Update elements array with change detection to prevent unnecessary re-renders
    setElements(prev => prev.map(el => {
      if (el.id !== id) return el;
      // shallow compare updates
      let changed = false;
      for (const k in updates) {
        if (Object.prototype.hasOwnProperty.call(updates, k) && el[k] !== updates[k]) {
          changed = true;
          break;
        }
      }
      return changed ? { ...el, ...updates } : el;
    }));
    // Keep selectedElement in sync so UI controls show latest values (only if something changed)
    setSelectedElement(prev => {
      if (!prev || prev.id !== id) return prev;
      let changed = false;
      for (const k in updates) {
        if (Object.prototype.hasOwnProperty.call(updates, k) && prev[k] !== updates[k]) { changed = true; break; }
      }
      return changed ? { ...prev, ...updates } : prev;
    });
  };

  const requestDeleteSelected = () => {
    const ids = (selectedElementIds && selectedElementIds.length)
      ? selectedElementIds
      : (selectedElement ? [selectedElement.id] : []);
    if (!ids.length) return;
    setPendingDeleteIds(ids);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteElement = () => {
    const ids = (pendingDeleteIds && pendingDeleteIds.length)
      ? pendingDeleteIds
      : (selectedElementIds && selectedElementIds.length ? selectedElementIds : (selectedElement ? [selectedElement.id] : []));
    if (!ids.length) {
      setDeleteConfirmOpen(false);
      return;
    }
    setElements((prev) => prev.filter(el => !ids.includes(el.id)));
    setSelectedElement(null);
    setSelectedElementIds([]);
    setPendingDeleteIds([]);
    setDeleteConfirmOpen(false);
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
      if (property === 'wordWrap') {
        // After DOM update, if we turned wrapping off, optionally expand width to natural text width
        if (value === false) {
          requestAnimationFrame(() => {
            const node = shapeRefs.current[selectedElement.id];
            if (node) {
              // text width without wrapping approximated by setting temporary wrap none and very large width
              const originalWidth = node.width();
              const originalWrap = node.wrap();
              try {
                node.wrap('none');
                node.width(10000); // large width to measure
                const naturalWidth = node.getClientRect().width; // includes transforms
                // restore
                node.wrap(originalWrap);
                node.width(originalWidth);
                // apply new width if bigger than current width
                const finalWidth = Math.ceil(Math.min(naturalWidth + 4, stageSize.width));
                handleUpdateElement(selectedElement.id, { width: finalWidth });
                setTextProperties(p => ({ ...p, width: finalWidth }));
              } catch (_) {
                // ignore measurement errors
              }
            }
          });
        }
      }
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateName) {
      toast.error('Mohon masukkan nama template');
      return;
    }

    try {
      setSaving(true);

      const sourcePagesBase = (pages && pages.length > 0)
        ? [...pages]
        : [{ objects: elements, background: backgroundImage, _backgroundFile: backgroundImageFile }];

      const curIdx = Math.max(0, Math.min(currentPageIndex, sourcePagesBase.length - 1));
      sourcePagesBase[curIdx] = {
        ...sourcePagesBase[curIdx],
        objects: elements,
        background: backgroundImage,
        _backgroundFile: backgroundImageFile || sourcePagesBase[curIdx]?._backgroundFile || null
      };

      const sourcePages = sourcePagesBase;
      const savedPages = [];

      for (const p of sourcePages) {
        // Upload background per page (if any new file selected)
        let pageBackgroundUrl = p?.background || null;
        const pageBgFile = p?._backgroundFile || null;
        if (pageBgFile) {
          const uploadResponse = await certificateService.uploadBackground(pageBgFile);
          if (uploadResponse.success) {
            pageBackgroundUrl = uploadResponse.data.url;
          } else {
            throw new Error('Gagal mengunggah gambar latar belakang');
          }
        }

        // Upload any pending image files for image elements & strip private keys
        const updatedObjects = [];
        for (const el of (p?.objects || [])) {
          const { _file, ...cleanBase } = el; // remove internal fields
          if (el.type === 'image' && el._file) {
            try {
              const uploadRes = await certificateService.uploadBackground(_file);
              if (uploadRes.success && uploadRes.data?.url) {
                updatedObjects.push({ ...cleanBase, src: uploadRes.data.url });
              } else {
                throw new Error('Gagal mengunggah gambar elemen');
              }
            } catch (e) {
              toast.error(e.message || 'Gagal mengunggah gambar elemen');
              setSaving(false);
              return;
            }
          } else {
            updatedObjects.push(cleanBase);
          }
        }

        savedPages.push({
          objects: updatedObjects,
          background: pageBackgroundUrl
        });
      }

      const templateData = {
        name: templateName,
        eventId: eventId,
        design: {
          pages: savedPages,
          // keep legacy fields for backward compatibility
          objects: savedPages[0]?.objects || [],
          background: savedPages[0]?.background || null
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

        await certificateService.updateTemplate(selectedTemplate.uuid, templateData);
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

  // Dynamic vertical alignment adjustment when text wraps / height changes
  useEffect(() => {
    if (!openDialog) return;

    if (measureTextTimerRef.current) {
      clearTimeout(measureTextTimerRef.current);
    }

    measureTextTimerRef.current = setTimeout(() => {
      const batch = [];
      elements.forEach(el => {
        if (el.type !== 'text') return;
        if (el.verticalAlign !== 'bottom' && el.verticalAlign !== 'middle') return;
        const node = shapeRefs.current[el.id];
        if (!node) return;
        let newHRaw;
        if (node.getClientRect) {
          try {
            newHRaw = node.getClientRect({ skipShadow: true }).height;
          } catch (e) {
            newHRaw = node.getClientRect().height;
          }
        } else {
          newHRaw = node.height();
        }
        const newH = Math.round((Number(newHRaw) || 0) * 10) / 10;
        const baseLineHeight = (el.fontSize || 24) * ((typeof el.lineHeight === 'number' && el.lineHeight > 0) ? el.lineHeight : 1);
        const prevH = (typeof el._measuredHeight === 'number' && el._measuredHeight > 0)
          ? (Math.round(el._measuredHeight * 10) / 10)
          : baseLineHeight;

        if (Math.abs(newH - prevH) < 0.6) return;

        const curY = Number(el.y || 0);
        if (el.verticalAlign === 'bottom') {
          const bottom = (el.y || 0) + prevH;
          const newTop = Math.round((bottom - newH) * 10) / 10;
          const next = {};
          if (Math.abs(newTop - curY) >= 0.6) next.y = newTop;
          next._measuredHeight = newH;
          batch.push({ id: el.id, updates: next });
        } else if (el.verticalAlign === 'middle') {
          const center = (el.y || 0) + prevH / 2;
          const newTop = Math.round((center - newH / 2) * 10) / 10;
          const next = {};
          if (Math.abs(newTop - curY) >= 0.6) next.y = newTop;
          next._measuredHeight = newH;
          batch.push({ id: el.id, updates: next });
        }
      });

      if (batch.length) {
        setElements(prev => prev.map(el => {
          const item = batch.find(b => b.id === el.id);
          if (!item) return el;
          const next = { ...el, ...item.updates };
          const sameY = (typeof item.updates.y === 'number') ? (Math.abs((el.y || 0) - item.updates.y) < 0.01) : true;
          const sameH = (typeof item.updates._measuredHeight === 'number')
            ? (Math.abs((el._measuredHeight || 0) - item.updates._measuredHeight) < 0.01)
            : true;
          return (sameY && sameH) ? el : next;
        }));

        const changedIds = new Set(batch.map(b => b.id));
        setSelectedElement(sel => {
          if (!sel) return sel;
          if (!changedIds.has(sel.id)) return sel;
          const b = batch.find(x => x.id === sel.id);
          if (!b) return sel;
          const next = { ...sel, ...b.updates };
          const sameY = (typeof b.updates.y === 'number') ? (Math.abs((sel.y || 0) - b.updates.y) < 0.01) : true;
          const sameH = (typeof b.updates._measuredHeight === 'number')
            ? (Math.abs((sel._measuredHeight || 0) - b.updates._measuredHeight) < 0.01)
            : true;
          return (sameY && sameH) ? sel : next;
        });
      }
    }, 60);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elements, fontLoadedTick, openDialog]);

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

      // Persist to current page so switching pages doesn't lose the selection
      setPages((prev) => {
        if (!prev || prev.length === 0) return prev;
        const idx = Math.max(0, Math.min(currentPageIndex, prev.length - 1));
        const next = [...prev];
        next[idx] = { ...next[idx], background: localUrl, _backgroundFile: file };
        return next;
      });

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
            <Stack direction="row" spacing={2} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
              <IconButton
                onClick={() => navigate('/events')}
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 2,
                  background: 'rgba(102, 126, 234, 0.14)',
                  border: '1px solid rgba(102, 126, 234, 0.22)',
                  color: 'primary.main',
                  '&:hover': {
                    background: 'rgba(102, 126, 234, 0.18)',
                  }
                }}
              >
                <ArrowBack />
              </IconButton>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="h4" component="h1" sx={{ fontWeight: 800, mb: 0.25 }}>
                  Template Sertifikat
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: { xs: 2, sm: 1 },
                    WebkitBoxOrient: 'vertical',
                    lineHeight: 1.25
                  }}
                >
                  {event?.title}
                </Typography>
              </Box>
            </Stack>
            <Button
              variant="contained"
              size="large"
              startIcon={<Add />}
              onClick={() => handleOpenEditor()}
              sx={{ px: 3, py: 1.25, borderRadius: 2, fontWeight: 700, flexShrink: 0, whiteSpace: 'nowrap' }}
            >
              Buat Template
            </Button>
          </Stack>
        </Paper>

        {/* Public Download Link Settings */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            mb: 4,
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider'
          }}
        >
          <Box display="flex" justifyContent="space-between" alignItems="flex-start" gap={2}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                Link Download Sertifikat (Publik)
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Bagikan link ini ke peserta.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                startIcon={<ContentCopy />}
                onClick={handleCopyPublicLink}
                disabled={!event?.publicDownloadSlug}
                sx={{ borderRadius: 2 }}
              >
                Copy Link
              </Button>
              <Button
                variant="contained"
                onClick={() => setPublicSettingsOpen(true)}
                sx={{ borderRadius: 2 }}
              >
                Pengaturan
              </Button>
            </Stack>
          </Box>

          <Box mt={2}>
            <TextField
              fullWidth
              label="Link Publik"
              value={getPublicDownloadUrl()}
              InputProps={{ readOnly: true, startAdornment: <LinkIcon sx={{ mr: 1, color: 'text.secondary' }} /> }}
            />
          </Box>
        </Paper>

        <Dialog
          open={publicSettingsOpen}
          onClose={() => setPublicSettingsOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Pengaturan Link Download (Publik)
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Atur field pencarian, mode match, dan info hasil yang ditampilkan.
              </Typography>
            </Box>
            <Button onClick={() => setPublicSettingsOpen(false)} sx={{ borderRadius: 2 }}>
              Tutup
            </Button>
          </DialogTitle>
          <DialogContent sx={{ pt: 2 }}>
            <Stack spacing={2} sx={{ mt: 0.5 }}>
              <Box>
                <Stack spacing={1.25}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={publicDownloadSettings.enabled}
                        onChange={(e) => setPublicDownloadSettings(s => ({ ...s, enabled: e.target.checked }))}
                      />
                    }
                    label="Aktifkan"
                  />

                  <TextField
                    fullWidth
                    label="Slug (Opsional)"
                    placeholder="contoh: bimtek-2025"
                    value={publicDownloadSettings.slug}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPublicDownloadSettings(s => ({ ...s, slug: val, regenerateSlug: false }));
                    }}
                    disabled={!publicDownloadSettings.enabled}
                    helperText="Kosongkan untuk auto-generate. Format: huruf kecil/angka dan '-' (tanpa spasi)."
                    size="small"
                    sx={{
                      '& .MuiOutlinedInput-input': {
                        py: 1.25,
                        lineHeight: 1.5,
                      },
                      '& .MuiOutlinedInput-input::placeholder': {
                        lineHeight: 1.5,
                      },
                    }}
                  />
                </Stack>
              </Box>

              <Divider />

              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
                  Kolom Pencarian (Peserta)
                </Typography>
                <Stack spacing={2}>
                  {(publicDownloadSettings.searchFields || []).map((sf, idx) => (
                    <Box
                      key={`${sf?.name || 'field'}-${idx}`}
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 130px 86px 34px',
                        gap: 1,
                        alignItems: 'center'
                      }}
                    >
                      <FormControl fullWidth>
                        <InputLabel>Kolom</InputLabel>
                        <Select
                          label="Kolom"
                          value={sf?.name || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPublicDownloadSettings(s => {
                              const next = Array.isArray(s.searchFields) ? [...s.searchFields] : [];
                              next[idx] = { ...(next[idx] || {}), name: val };
                              const legacy = idx === 0 ? { identifierField: val } : {};
                              return { ...s, ...legacy, searchFields: next };
                            });
                          }}
                          disabled={!publicDownloadSettings.enabled}
                          size="small"
                        >
                          {(event?.participantFields || []).map((f) => (
                            <MenuItem key={f.name} value={f.name}>{f.label} ({f.name})</MenuItem>
                          ))}
                        </Select>
                      </FormControl>

                      <FormControl fullWidth>
                        <InputLabel>Mode</InputLabel>
                        <Select
                          label="Mode"
                          value={sf?.matchMode || 'exact'}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPublicDownloadSettings(s => {
                              const next = Array.isArray(s.searchFields) ? [...s.searchFields] : [];
                              next[idx] = { ...(next[idx] || {}), matchMode: val };
                              const legacy = idx === 0 ? { matchMode: val } : {};
                              return { ...s, ...legacy, searchFields: next };
                            });
                          }}
                          disabled={!publicDownloadSettings.enabled}
                          size="small"
                        >
                          <MenuItem value="exact">Exact</MenuItem>
                          <MenuItem value="fuzzy">Fuzzy</MenuItem>
                        </Select>
                      </FormControl>

                      <Tooltip title="Wajib diisi" placement="top">
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Checkbox
                            size="small"
                            checked={sf?.required !== false}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setPublicDownloadSettings(s => {
                                const next = Array.isArray(s.searchFields) ? [...s.searchFields] : [];
                                next[idx] = { ...(next[idx] || {}), required: checked };
                                return { ...s, searchFields: next };
                              });
                            }}
                            disabled={!publicDownloadSettings.enabled}
                          />
                        </Box>
                      </Tooltip>

                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => {
                          setPublicDownloadSettings(s => {
                            const cur = Array.isArray(s.searchFields) ? s.searchFields : [];
                            const next = cur.filter((_, i) => i !== idx);
                            const first = next[0];
                            return {
                              ...s,
                              searchFields: next,
                              identifierField: first?.name || s.identifierField,
                              matchMode: first?.matchMode || s.matchMode
                            };
                          });
                        }}
                        disabled={!publicDownloadSettings.enabled || (publicDownloadSettings.searchFields || []).length <= 1}
                        sx={{ border: '1px solid', borderColor: 'divider', width: 34, height: 34 }}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Box>
                  ))}

                  <Box>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        setPublicDownloadSettings(s => {
                          const cur = Array.isArray(s.searchFields) ? [...s.searchFields] : [];
                          const fallbackName = (event?.participantFields || [])[0]?.name || '';
                          cur.push({ name: fallbackName, matchMode: 'exact', required: true });
                          if (!s.identifierField && cur[0]?.name) {
                            return { ...s, identifierField: cur[0].name, matchMode: cur[0].matchMode, searchFields: cur };
                          }
                          return { ...s, searchFields: cur };
                        });
                      }}
                      disabled={!publicDownloadSettings.enabled}
                      sx={{ borderRadius: 2 }}
                    >
                      Tambah Kolom
                    </Button>
                  </Box>
                </Stack>
              </Box>

              <Divider />

              <Box>
                <Stack spacing={2}>
                  <FormControl fullWidth>
                    <InputLabel>Template Default</InputLabel>
                    <Select
                      label="Template Default"
                      value={publicDownloadSettings.templateId}
                      onChange={(e) => setPublicDownloadSettings(s => ({ ...s, templateId: e.target.value }))}
                      disabled={!publicDownloadSettings.enabled}
                      size="small"
                    >
                      {templates.map((t) => (
                        <MenuItem key={t.uuid} value={String(t.uuid)}>{t.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl fullWidth>
                    <InputLabel>Info yang Ditampilkan</InputLabel>
                    <Select
                      label="Info yang Ditampilkan"
                      multiple
                      value={publicDownloadSettings.resultFields}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPublicDownloadSettings(s => ({ ...s, resultFields: Array.isArray(val) ? val : [] }));
                      }}
                      disabled={!publicDownloadSettings.enabled}
                      size="small"
                      renderValue={(selected) => {
                        const all = Array.isArray(event?.participantFields) ? event.participantFields : [];
                        const map = new Map(all.map(f => [f?.name, f?.label || f?.name]));
                        return (Array.isArray(selected) ? selected : []).map((n) => map.get(n) || n).join(', ');
                      }}
                    >
                      {(event?.participantFields || []).map((f) => (
                        <MenuItem key={f.name} value={f.name}>{f.label} ({f.name})</MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={publicDownloadSettings.regenerateSlug}
                        onChange={(e) => setPublicDownloadSettings(s => ({ ...s, regenerateSlug: e.target.checked, slug: e.target.checked ? '' : s.slug }))}
                        disabled={!publicDownloadSettings.enabled}
                      />
                    }
                    label="Generate ulang link (slug)"
                  />
                </Stack>
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setPublicSettingsOpen(false)} sx={{ borderRadius: 2 }}>
              Batal
            </Button>
            <Button
              variant="contained"
              startIcon={savingPublicSettings ? <CircularProgress size={18} color="inherit" /> : <Save />}
              onClick={handleSavePublicDownloadSettings}
              disabled={savingPublicSettings}
              sx={{ borderRadius: 2 }}
            >
              Simpan Pengaturan
            </Button>
          </DialogActions>
        </Dialog>

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
              <Grid item xs={12} md={6} lg={4} key={template.uuid}>
                <Card
                  elevation={0}
                  sx={{
                    borderRadius: 2,
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
                        <Tooltip title="Opsi Lainnya">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              setSelectedTemplate(template);
                              setAnchorEl(e.currentTarget);
                            }}
                            sx={{
                              ml: 0.75,
                              border: '1px solid',
                              borderColor: 'divider',
                              bgcolor: 'rgba(2, 6, 23, 0.02)',
                              '&:hover': { bgcolor: 'rgba(2, 6, 23, 0.04)' }
                            }}
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
                        Elemen: {(Array.isArray(template.design?.pages)
                          ? template.design.pages.reduce((sum, p) => sum + (Array.isArray(p?.objects) ? p.objects.length : 0), 0)
                          : (template.design?.objects?.length || 0))}
                      </Typography>
                    </Stack>
                  </CardContent>

                  <CardActions sx={{ px: 3, pb: 3 }}>
                    <Stack direction="row" spacing={1} width="100%">
                      <Button
                        variant="outlined"
                        size="medium"
                        startIcon={<Edit />}
                        onClick={() => handleOpenEditor(template)}
                        sx={{
                          flex: 1,
                          minHeight: 40,
                          borderRadius: 2,
                          fontWeight: 700,
                          bgcolor: 'rgba(2, 6, 23, 0.01)',
                          '&:hover': { bgcolor: 'rgba(2, 6, 23, 0.03)' }
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="contained"
                        size="medium"
                        startIcon={generating ? <CircularProgress size={16} /> : <GetApp />}
                        onClick={() => handleDownloadAll(template.uuid)}
                        disabled={generating || participants.length === 0}
                        sx={{ flex: 1, minHeight: 40, borderRadius: 2, fontWeight: 700 }}
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
            onClick={() => handleDeleteTemplate(selectedTemplate?.uuid)}
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
          <DialogTitle sx={{ pb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                {selectedTemplate ? 'Edit Template Sertifikat' : 'Buat Template Sertifikat'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Halaman {Math.min(currentPageIndex + 1, Math.max(1, pages?.length || 1))}/{Math.max(1, pages?.length || 1)}
              </Typography>
            </Box>

            <Stack direction="row" spacing={1} alignItems="center">
              <Tooltip title="Sebelumnya">
                <span>
                  <IconButton
                    size="small"
                    onClick={() => handleGoToPage(Math.max(0, currentPageIndex - 1))}
                    disabled={!pages || pages.length <= 1 || currentPageIndex <= 0}
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
                    onClick={() => handleGoToPage(Math.min((pages?.length || 1) - 1, currentPageIndex + 1))}
                    disabled={!pages || pages.length <= 1 || currentPageIndex >= (pages.length - 1)}
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
                onClick={handleAddPage}
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
                    onClick={requestDeleteCurrentPage}
                    disabled={!pages || pages.length <= 1}
                    sx={{ border: '1px solid', borderColor: 'divider' }}
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          </DialogTitle>
          <DialogContent sx={{ display: 'flex', gap: 3, p: 3 }}>
            {/* Panel Kiri - Tools */}
            <Paper
              elevation={0}
              sx={{
                width: 320,
                p: 3,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2
              }}
            >
              <Box
                sx={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 2,
                  bgcolor: 'background.paper',
                  pb: 2
                }}
              >
                <TextField
                  label="Nama Template"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  fullWidth
                  sx={{ mb: 2 }}
                />

                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                  <Tabs
                    value={tabValue}
                    onChange={(e, v) => setTabValue(v)}
                    sx={{
                      minHeight: 36,
                      '& .MuiTab-root': {
                        fontWeight: 'bold',
                        fontSize: '0.9rem',
                        minHeight: 36
                      }
                    }}
                  >
                    <Tab label="Elemen" />
                    <Tab label="Properti" />
                  </Tabs>
                </Box>

                <Divider sx={{ mt: 2 }} />
              </Box>

              <Box
                ref={leftPanelScrollRef}
                onScroll={(e) => {
                  leftPanelScrollTopRef.current = e.currentTarget.scrollTop;
                }}
                sx={{
                  flex: 1,
                  overflow: 'auto',
                  pt: 2,
                  pr: 1
                }}
              >
                <Box sx={{ display: tabValue === 0 ? 'block' : 'none' }}>
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

                <Box sx={{ display: tabValue === 1 ? 'block' : 'none' }}>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
                    Properti {selectedElement?.type === 'image' ? 'Gambar' : 'Teks'}
                  </Typography>

                  {selectedElement?.type === 'text' && (
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
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 92px', gap: 1.5, alignItems: 'center' }}>
                          <Slider
                            value={textProperties.fontSize}
                            onChange={(e, value) => handleUpdateTextProperties('fontSize', value)}
                            min={8}
                            max={72}
                            sx={{ mb: 1 }}
                          />
                          <TextField
                            type="number"
                            value={textProperties.fontSize}
                            inputProps={{ min: 8, max: 72, step: 1 }}
                            onChange={(e) => {
                              if (e.target.value === '') return;
                              const next = clampNumber(e.target.value, 8, 72, 1);
                              handleUpdateTextProperties('fontSize', next);
                            }}
                            size="small"
                          />
                        </Box>
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
                        onChange={(e) => {
                          const val = e.target.value; // capture before debounce (React event pooling)
                          scheduleUpdate('textFill', () => handleUpdateTextProperties('fill', val), 60);
                        }}
                        fullWidth
                      />

                      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 1.5 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
                          Gaya & Perataan
                        </Typography>

                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                          <ToggleButtonGroup
                            size="small"
                            value={(() => {
                              const v = [];
                              if (textProperties.fontWeight === 'bold') v.push('bold');
                              if (textProperties.fontStyle === 'italic') v.push('italic');
                              return v;
                            })()}
                            onChange={(_, values) => {
                              const v = Array.isArray(values) ? values : [];
                              handleUpdateTextProperties('fontWeight', v.includes('bold') ? 'bold' : 'normal');
                              handleUpdateTextProperties('fontStyle', v.includes('italic') ? 'italic' : 'normal');
                            }}
                          >
                            <ToggleButton value="bold" aria-label="Bold">
                              <FormatBold fontSize="small" />
                            </ToggleButton>
                            <ToggleButton value="italic" aria-label="Italic">
                              <FormatItalic fontSize="small" />
                            </ToggleButton>
                          </ToggleButtonGroup>

                          <ToggleButtonGroup
                            size="small"
                            value={(() => {
                              const td = textProperties.textDecoration || 'none';
                              const next = [];
                              if (td.includes('underline')) next.push('underline');
                              if (td.includes('line-through')) next.push('line-through');
                              return next;
                            })()}
                            onChange={(_, values) => {
                              const v = Array.isArray(values) ? values : [];
                              const td = v.length ? v.join(' ') : 'none';
                              handleUpdateTextProperties('textDecoration', td);
                            }}
                          >
                            <ToggleButton value="underline" aria-label="Underline">
                              <FormatUnderlined fontSize="small" />
                            </ToggleButton>
                            <ToggleButton value="line-through" aria-label="Strikethrough">
                              <StrikethroughS fontSize="small" />
                            </ToggleButton>
                          </ToggleButtonGroup>
                        </Box>

                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                          <ToggleButtonGroup
                            size="small"
                            exclusive
                            value={textProperties.align}
                            onChange={(_, v) => {
                              if (!v) return;
                              handleUpdateTextProperties('align', v);
                            }}
                          >
                            <ToggleButton value="left" aria-label="Align Left">
                              <AlignHorizontalLeft fontSize="small" />
                            </ToggleButton>
                            <ToggleButton value="center" aria-label="Align Center">
                              <AlignHorizontalCenter fontSize="small" />
                            </ToggleButton>
                            <ToggleButton value="right" aria-label="Align Right">
                              <AlignHorizontalRight fontSize="small" />
                            </ToggleButton>
                          </ToggleButtonGroup>

                          <ToggleButtonGroup
                            size="small"
                            exclusive
                            value={textProperties.verticalAlign}
                            onChange={(_, v) => {
                              if (!v) return;
                              handleUpdateTextProperties('verticalAlign', v);
                            }}
                          >
                            <ToggleButton value="top" aria-label="Align Top">
                              <AlignVerticalTop fontSize="small" />
                            </ToggleButton>
                            <ToggleButton value="middle" aria-label="Align Middle">
                              <AlignVerticalCenter fontSize="small" />
                            </ToggleButton>
                            <ToggleButton value="bottom" aria-label="Align Bottom">
                              <AlignVerticalBottom fontSize="small" />
                            </ToggleButton>
                          </ToggleButtonGroup>
                        </Box>
                      </Box>

                      <Box>
                        <Typography gutterBottom sx={{ fontWeight: 'bold' }}>
                          Lebar Teks
                        </Typography>
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 92px', gap: 1.5, alignItems: 'center' }}>
                          <Slider
                            value={textProperties.width || 200}
                            onChange={(e, value) => handleUpdateTextProperties('width', value)}
                            min={50}
                            max={stageSize.width}
                            valueLabelDisplay="auto"
                          />
                          <TextField
                            type="number"
                            value={Math.round(textProperties.width || 200)}
                            inputProps={{ min: 50, max: stageSize.width, step: 1 }}
                            onChange={(e) => {
                              if (e.target.value === '') return;
                              const next = clampNumber(e.target.value, 50, stageSize.width, 1);
                              handleUpdateTextProperties('width', Math.round(next));
                            }}
                            size="small"
                          />
                        </Box>
                      </Box>

                      <FormControlLabel
                        control={
                          <Switch
                            checked={textProperties.wordWrap}
                            onChange={(e) => handleUpdateTextProperties('wordWrap', e.target.checked)}
                            color="primary"
                          />
                        }
                        label="Word Wrap"
                      />

                      {/* Advanced text properties */}
                      <Divider />
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                        Lanjutan
                      </Typography>

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

                      <Box>
                        <Typography gutterBottom sx={{ fontWeight: 'bold' }}>
                          Opacity: {typeof selectedElement.opacity === 'number' ? selectedElement.opacity.toFixed(2) : 1}
                        </Typography>
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 92px', gap: 1.5, alignItems: 'center' }}>
                          <Slider
                            value={typeof selectedElement.opacity === 'number' ? selectedElement.opacity : 1}
                            onChange={(e, value) => handleUpdateElement(selectedElement.id, { opacity: Number(value) })}
                            min={0}
                            max={1}
                            step={0.01}
                            valueLabelDisplay="auto"
                          />
                          <TextField
                            type="number"
                            value={typeof selectedElement.opacity === 'number' ? Number(selectedElement.opacity.toFixed(2)) : 1}
                            inputProps={{ min: 0, max: 1, step: 0.01 }}
                            onChange={(e) => {
                              if (e.target.value === '') return;
                              const next = clampNumber(e.target.value, 0, 1, 0.01);
                              handleUpdateElement(selectedElement.id, { opacity: next });
                            }}
                            size="small"
                          />
                        </Box>
                        <Button size="small" variant="text" onClick={() => handleUpdateElement(selectedElement.id, { opacity: 1 })}>
                          Reset Opacity
                        </Button>
                      </Box>

                      <Box>
                        <Typography gutterBottom sx={{ fontWeight: 'bold' }}>
                          Letter Spacing: {typeof selectedElement.letterSpacing === 'number' ? selectedElement.letterSpacing.toFixed(1) : 0}px
                        </Typography>
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 92px', gap: 1.5, alignItems: 'center' }}>
                          <Slider
                            value={typeof selectedElement.letterSpacing === 'number' ? selectedElement.letterSpacing : 0}
                            onChange={(e, value) => handleUpdateElement(selectedElement.id, { letterSpacing: Number(value) })}
                            min={-5}
                            max={20}
                            step={0.1}
                            valueLabelDisplay="auto"
                          />
                          <TextField
                            type="number"
                            value={typeof selectedElement.letterSpacing === 'number' ? Number(selectedElement.letterSpacing.toFixed(1)) : 0}
                            inputProps={{ min: -5, max: 20, step: 0.1 }}
                            onChange={(e) => {
                              if (e.target.value === '') return;
                              const next = clampNumber(e.target.value, -5, 20, 0.1);
                              handleUpdateElement(selectedElement.id, { letterSpacing: next });
                            }}
                            size="small"
                          />
                        </Box>
                        <Button size="small" variant="text" onClick={() => handleUpdateElement(selectedElement.id, { letterSpacing: 0 })}>
                          Reset Letter Spacing
                        </Button>
                      </Box>

                      <Box>
                        <Typography gutterBottom sx={{ fontWeight: 'bold' }}>
                          Line Height: {typeof textProperties.lineHeight === 'number' ? textProperties.lineHeight.toFixed(2) : 1}
                        </Typography>
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 92px', gap: 1.5, alignItems: 'center' }}>
                          <Slider
                            value={typeof textProperties.lineHeight === 'number' ? textProperties.lineHeight : 1}
                            onChange={(e, value) => handleUpdateTextProperties('lineHeight', Number(value))}
                            min={0.6}
                            max={3}
                            step={0.01}
                            valueLabelDisplay="auto"
                          />
                          <TextField
                            type="number"
                            value={typeof textProperties.lineHeight === 'number' ? Number(textProperties.lineHeight.toFixed(2)) : 1}
                            inputProps={{ min: 0.6, max: 3, step: 0.01 }}
                            onChange={(e) => {
                              if (e.target.value === '') return;
                              const next = clampNumber(e.target.value, 0.6, 3, 0.01);
                              handleUpdateTextProperties('lineHeight', next);
                            }}
                            size="small"
                          />
                        </Box>
                        <Button size="small" variant="text" onClick={() => handleUpdateTextProperties('lineHeight', 1)}>
                          Reset Line Height
                        </Button>
                      </Box>

                      <Box>
                        <Typography gutterBottom sx={{ fontWeight: 'bold' }}>
                          Rotasi: {Math.round(selectedElement.rotation || 0)}°
                        </Typography>
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 92px', gap: 1.5, alignItems: 'center' }}>
                          <Slider
                            value={selectedElement.rotation || 0}
                            onChange={(e, value) => handleUpdateElement(selectedElement.id, { rotation: Number(value) })}
                            min={-180}
                            max={180}
                            step={1}
                            valueLabelDisplay="auto"
                          />
                          <TextField
                            type="number"
                            value={Math.round(selectedElement.rotation || 0)}
                            inputProps={{ min: -180, max: 180, step: 1 }}
                            onChange={(e) => {
                              if (e.target.value === '') return;
                              const next = clampNumber(e.target.value, -180, 180, 1);
                              handleUpdateElement(selectedElement.id, { rotation: Math.round(next) });
                            }}
                            size="small"
                          />
                        </Box>
                        <Button size="small" variant="text" onClick={() => handleUpdateElement(selectedElement.id, { rotation: 0 })}>
                          Reset Rotasi Teks
                        </Button>
                      </Box>

                      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                        <TextField
                          label="Background"
                          type="color"
                          value={selectedElement.bgColor || '#ffffff'}
                          onChange={(e) => {
                            const val = e.target.value;
                            scheduleUpdate('textBgColor', () => handleUpdateElement(selectedElement.id, { bgColor: val }), 60);
                          }}
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
                          onChange={(e) => {
                            const val = e.target.value;
                            scheduleUpdate('textShadowColor', () => handleUpdateElement(selectedElement.id, { shadowColor: val }), 60);
                          }}
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
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 92px', gap: 1.5, alignItems: 'center' }}>
                          <Slider
                            value={typeof selectedElement.shadowOpacity === 'number' ? selectedElement.shadowOpacity : 1}
                            onChange={(e, value) => handleUpdateElement(selectedElement.id, { shadowOpacity: Number(value) })}
                            min={0}
                            max={1}
                            step={0.01}
                            valueLabelDisplay="auto"
                          />
                          <TextField
                            type="number"
                            value={typeof selectedElement.shadowOpacity === 'number' ? Number(selectedElement.shadowOpacity.toFixed(2)) : 1}
                            inputProps={{ min: 0, max: 1, step: 0.01 }}
                            onChange={(e) => {
                              if (e.target.value === '') return;
                              const next = clampNumber(e.target.value, 0, 1, 0.01);
                              handleUpdateElement(selectedElement.id, { shadowOpacity: next });
                            }}
                            size="small"
                          />
                        </Box>
                      </Box>
                      <Button size="small" variant="text" color="secondary" onClick={() => handleUpdateElement(selectedElement.id, { shadowColor: undefined, shadowBlur: undefined, shadowOffsetX: undefined, shadowOffsetY: undefined, shadowOpacity: undefined })}>
                        Reset Shadow Teks
                      </Button>
                    </Stack>
                  )}

                  {selectedElement?.type === 'image' && (
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
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 92px', gap: 1.5, alignItems: 'center' }}>
                          <Slider
                            value={selectedElement.rotation || 0}
                            onChange={(e, value) => handleUpdateElement(selectedElement.id, { rotation: Number(value) })}
                            min={-180}
                            max={180}
                            step={1}
                            valueLabelDisplay="auto"
                          />
                          <TextField
                            type="number"
                            value={Math.round(selectedElement.rotation || 0)}
                            inputProps={{ min: -180, max: 180, step: 1 }}
                            onChange={(e) => {
                              if (e.target.value === '') return;
                              const next = clampNumber(e.target.value, -180, 180, 1);
                              handleUpdateElement(selectedElement.id, { rotation: Math.round(next) });
                            }}
                            size="small"
                          />
                        </Box>
                        <Button size="small" variant="text" onClick={() => handleUpdateElement(selectedElement.id, { rotation: 0 })}>
                          Reset Rotasi
                        </Button>
                      </Box>

                      <Box>
                        <Typography gutterBottom sx={{ fontWeight: 'bold' }}>
                          Opacity: {typeof selectedElement.opacity === 'number' ? selectedElement.opacity.toFixed(2) : 1}
                        </Typography>
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 92px', gap: 1.5, alignItems: 'center' }}>
                          <Slider
                            value={typeof selectedElement.opacity === 'number' ? selectedElement.opacity : 1}
                            onChange={(e, value) => handleUpdateElement(selectedElement.id, { opacity: Number(value) })}
                            min={0.1}
                            max={1}
                            step={0.01}
                            valueLabelDisplay="auto"
                          />
                          <TextField
                            type="number"
                            value={typeof selectedElement.opacity === 'number' ? Number(selectedElement.opacity.toFixed(2)) : 1}
                            inputProps={{ min: 0.1, max: 1, step: 0.01 }}
                            onChange={(e) => {
                              if (e.target.value === '') return;
                              const next = clampNumber(e.target.value, 0.1, 1, 0.01);
                              handleUpdateElement(selectedElement.id, { opacity: next });
                            }}
                            size="small"
                          />
                        </Box>
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
                          onChange={(e) => {
                            const val = e.target.value;
                            scheduleUpdate('imageBorderColor', () => handleUpdateElement(selectedElement.id, { borderColor: val }), 60);
                          }}
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
                          onChange={(e) => {
                            const val = e.target.value;
                            scheduleUpdate('imageShadowColor', () => handleUpdateElement(selectedElement.id, { shadowColor: val }), 60);
                          }}
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
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 92px', gap: 1.5, alignItems: 'center' }}>
                          <Slider
                            value={typeof selectedElement.shadowOpacity === 'number' ? selectedElement.shadowOpacity : 1}
                            onChange={(e, value) => handleUpdateElement(selectedElement.id, { shadowOpacity: Number(value) })}
                            min={0}
                            max={1}
                            step={0.01}
                            valueLabelDisplay="auto"
                          />
                          <TextField
                            type="number"
                            value={typeof selectedElement.shadowOpacity === 'number' ? Number(selectedElement.shadowOpacity.toFixed(2)) : 1}
                            inputProps={{ min: 0, max: 1, step: 0.01 }}
                            onChange={(e) => {
                              if (e.target.value === '') return;
                              const next = clampNumber(e.target.value, 0, 1, 0.01);
                              handleUpdateElement(selectedElement.id, { shadowOpacity: next });
                            }}
                            size="small"
                          />
                        </Box>
                      </Box>
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
                  {selectedElement && (
                    <>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                        Posisi (Canvas / Seleksi)
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
                        <Tooltip title="Rata Kiri">
                          <IconButton size="small" onClick={() => alignSelectionToAnchor('left')} sx={{ border: '1px solid', borderColor: 'divider' }}>
                            <AlignHorizontalLeft fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Tengah Horizontal">
                          <IconButton size="small" onClick={() => alignSelectionToAnchor('center-h')} sx={{ border: '1px solid', borderColor: 'divider' }}>
                            <AlignHorizontalCenter fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Rata Kanan">
                          <IconButton size="small" onClick={() => alignSelectionToAnchor('right')} sx={{ border: '1px solid', borderColor: 'divider' }}>
                            <AlignHorizontalRight fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Rata Atas">
                          <IconButton size="small" onClick={() => alignSelectionToAnchor('top')} sx={{ border: '1px solid', borderColor: 'divider' }}>
                            <AlignVerticalTop fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Tengah Vertikal">
                          <IconButton size="small" onClick={() => alignSelectionToAnchor('middle-v')} sx={{ border: '1px solid', borderColor: 'divider' }}>
                            <AlignVerticalCenter fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Rata Bawah">
                          <IconButton size="small" onClick={() => alignSelectionToAnchor('bottom')} sx={{ border: '1px solid', borderColor: 'divider' }}>
                            <AlignVerticalBottom fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </>
                  )}

                  {/* Delete (common, always at bottom) */}
                  {(selectedElement || (selectedElementIds && selectedElementIds.length)) && (
                    <>
                      <Divider sx={{ my: 2.5 }} />
                      <Button
                        fullWidth
                        variant="outlined"
                        color="error"
                        startIcon={<Delete />}
                        onClick={requestDeleteSelected}
                        sx={{ borderRadius: 2, py: 1.5 }}
                      >
                        Hapus Elemen
                      </Button>
                    </>
                  )}
                  {!selectedElement && (
                    <Typography variant="body2" color="text.secondary">
                      Pilih elemen di canvas untuk mengubah propertinya.
                    </Typography>
                  )}
                </Box>
              </Box>
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
                    const stage = e.target.getStage();
                    const tr = transformerRef.current;
                    // Ignore clicks on transformer handles
                    if (tr && (e.target === tr || e.target.getParent() === tr)) return;
                    // Determine if clicked target corresponds to any registered element node
                    const clickedNode = e.target;
                    const elementNodes = Object.values(shapeRefs.current || {});
                    const clickedOnElement = elementNodes.some(node => node === clickedNode || (node.findOne && node.findOne(`#${clickedNode.id()}`)));
                    // Treat background image as empty area
                    const clickedOnBackground = backgroundImageRef.current && clickedNode === backgroundImageRef.current;
                    if (!clickedOnElement || clickedOnBackground || clickedNode === stage) {
                      setSelectedElement(null);
                      setSelectedElementIds([]);
                      if (tr) {
                        tr.nodes([]);
                        tr.getLayer() && tr.getLayer().batchDraw();
                      }
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
                        ref={backgroundImageRef}
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
                                  height={(element.fontSize ? element.fontSize * (element.lineHeight || 1) : 32) + 2 * (element.bgPadding || 0)}
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
                                letterSpacing={typeof element.letterSpacing === 'number' ? element.letterSpacing : 0}
                                align={element.align || 'left'}
                                width={element.width || 200}
                                lineHeight={element.lineHeight || 1}
                                wrap={element.wordWrap === false ? 'none' : 'word'}
                                rotation={element.rotation || 0}
                                ref={(node) => { if (node) shapeRefs.current[element.id] = node; }}
                                shadowColor={element.shadowColor || 'rgba(0,0,0,0)'}
                                shadowBlur={element.shadowBlur || 0}
                                shadowOffset={{ x: element.shadowOffsetX || 0, y: element.shadowOffsetY || 0 }}
                                shadowOpacity={typeof element.shadowOpacity === 'number' ? element.shadowOpacity : 1}
                                draggable={element.draggable}
                                onClick={(e) => handleSelectElement(element, e)}
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
                              {/* Removed text bounding box rectangle as requested */}
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
                                onClick={(e) => handleSelectElement(element, e)}
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
                              {/* Removed image bounding box rectangle */}
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
                      enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right', 'top-center', 'bottom-center', 'middle-left', 'middle-right']}
                      shouldOverdrawWholeArea={true}
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

        {/* Confirm delete element(s) */}
        <Dialog
          open={deleteConfirmOpen}
          onClose={() => {
            setDeleteConfirmOpen(false);
            setPendingDeleteIds([]);
          }}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>Konfirmasi</DialogTitle>
          <DialogContent>
            <Typography>
              {pendingDeleteIds.length > 1
                ? `Hapus ${pendingDeleteIds.length} elemen yang dipilih?`
                : 'Hapus elemen yang dipilih?'}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setDeleteConfirmOpen(false);
                setPendingDeleteIds([]);
              }}
            >
              Batal
            </Button>
            <Button variant="contained" color="error" onClick={handleDeleteElement}>
              Hapus
            </Button>
          </DialogActions>
        </Dialog>

        {/* Confirm delete page */}
        <Dialog
          open={deletePageConfirmOpen}
          onClose={() => {
            setDeletePageConfirmOpen(false);
            setPendingDeletePageIndex(null);
          }}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>Konfirmasi</DialogTitle>
          <DialogContent>
            <Typography>
              {typeof pendingDeletePageIndex === 'number'
                ? `Hapus halaman ${pendingDeletePageIndex + 1}?`
                : 'Hapus halaman ini?'}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setDeletePageConfirmOpen(false);
                setPendingDeletePageIndex(null);
              }}
            >
              Batal
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={() => {
                setDeletePageConfirmOpen(false);
                setPendingDeletePageIndex(null);
                handleDeleteCurrentPage();
              }}
            >
              Hapus
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Layout>
  );
};

export default Certificates;
