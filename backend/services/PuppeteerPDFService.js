const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const QRCode = require('qrcode');
const sharp = require('sharp');
const { PDFDocument } = require('pdf-lib');
const { CertificateVerification, Event } = require('../models');
// Removed unused locale import

class PuppeteerPDFService {
  constructor() {
    this.browser = null;
    this.initializationPromise = null; // To prevent multiple browser initializations
    this._activeJobs = 0;
    this._jobQueue = [];
    this._fontsCssInFlight = new Map();
    this._assetBufferCache = new Map();
  }

  _parseHexColor(color, fallback = { r: 255, g: 255, b: 255 }) {
    try {
      const c = String(color || '').trim();
      const m = /^#?([0-9a-f]{6})$/i.exec(c);
      if (!m) return fallback;
      const hex = m[1];
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if (![r, g, b].every((v) => Number.isFinite(v))) return fallback;
      return { r, g, b };
    } catch (_) {
      return fallback;
    }
  }

  async _resolveImageBuffer(src) {
    try {
      const s = String(src || '').trim();
      if (!s) return null;

      if (s.startsWith('/uploads/')) {
        const rel = s.replace('/uploads/', '');
        const filePath = path.join(path.resolve(process.env.UPLOAD_DIR || './uploads'), rel);
        if (!fsSync.existsSync(filePath)) return null;
        return fsSync.readFileSync(filePath);
      }

      if (s.startsWith('http://localhost:')) {
        const marker = '/api/uploads/';
        if (s.includes(marker)) {
          const rel = s.split(marker)[1];
          const filePath = path.join(path.resolve(process.env.UPLOAD_DIR || './uploads'), rel);
          if (!fsSync.existsSync(filePath)) return null;
          return fsSync.readFileSync(filePath);
        }
      }

      if (s.startsWith('https://')) {
        return await new Promise((resolve) => {
          try {
            https.get(s, (res) => {
              if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return resolve(this._resolveImageBuffer(res.headers.location));
              }
              if (res.statusCode !== 200) {
                res.resume();
                return resolve(null);
              }
              const chunks = [];
              res.on('data', (d) => chunks.push(d));
              res.on('end', () => resolve(Buffer.concat(chunks)));
            }).on('error', () => resolve(null));
          } catch (_) {
            return resolve(null);
          }
        });
      }

      return null;
    } catch (_) {
      return null;
    }
  }

  _getVerifySecret() {
    const s = String(process.env.CERT_VERIFY_SECRET || '').trim();
    if (!s) return null;
    return s;
  }

  _getVerifyBaseUrl() {
    const base = String(process.env.CERT_VERIFY_BASE_URL || '').trim();
    if (!base) return null;
    return base.replace(/\/$/, '');
  }

  _signVerifyPayload(payload) {
    const secret = this._getVerifySecret();
    if (!secret) return null;
    const body = JSON.stringify(payload);
    return crypto.createHmac('sha256', secret).update(body).digest('hex');
  }

  _signVerifyToken(token) {
    const secret = this._getVerifySecret();
    if (!secret || !token) return null;
    return crypto.createHmac('sha256', secret).update(String(token)).digest('hex');
  }

  _buildVerifyUrl({ templateUuid, participantUuid }) {
    const base = this._getVerifyBaseUrl();
    const sig = this._signVerifyPayload({ templateUuid, participantUuid });
    if (!base || !sig || !templateUuid || !participantUuid) return null;

    const params = new URLSearchParams({
      template: String(templateUuid),
      participant: String(participantUuid),
      sig
    });
    return `${base}/api/certificates/verify?${params.toString()}`;
  }

  _buildVerifyUrlFromToken({ token }) {
    const base = this._getVerifyBaseUrl();
    const sig = this._signVerifyToken(token);
    if (!base || !sig || !token) return null;

    const params = new URLSearchParams({
      token: String(token),
      sig
    });
    return `${base}/api/certificates/verify?${params.toString()}`;
  }

  _templateHasQrCode(template) {
    try {
      const design = template?.design;
      if (!design || typeof design !== 'object') return false;
      const pages = Array.isArray(design.pages) && design.pages.length
        ? design.pages
        : [{ objects: Array.isArray(design.objects) ? design.objects : [] }];
      for (const p of pages) {
        const objs = Array.isArray(p?.objects) ? p.objects : [];
        if (objs.some((o) => o && o.type === 'qrcode')) return true;
      }
      return false;
    } catch (_) {
      return false;
    }
  }

  _buildSnapshotFields(event, participant) {
    const configuredFields = Array.isArray(event?.participantFields) ? event.participantFields : [];
    const participantData = (participant?.data && typeof participant.data === 'object') ? participant.data : {};
    return configuredFields
      .map((f) => {
        const name = String(f?.name || '').trim();
        if (!name) return null;
        const raw = participantData?.[name];
        const value = raw == null ? '' : String(raw);
        if (!value) return null;
        return { name, label: f?.label || name, value };
      })
      .filter(Boolean);
  }

  async _prepareVerificationTokens(template, participants) {
    try {
      if (!this._templateHasQrCode(template)) return;

      const base = this._getVerifyBaseUrl();
      const secret = this._getVerifySecret();
      if (!base || !secret) return;

      const list = Array.isArray(participants) ? participants : [participants];
      if (!list.length) return;

      const event = await Event.findByPk(template.eventId).catch(() => null);

      const limit = Math.min(10, list.length);
      let idx = 0;
      const worker = async () => {
        while (idx < list.length) {
          const i = idx++;
          const p = list[i];
          if (!p || !p.uuid) continue;
          if (p.__verifyToken) continue;

          const fields = this._buildSnapshotFields(event, p);
          const templateUuid = template?.uuid || null;
          const participantUuid = p.uuid;

          let rec = null;
          if (templateUuid && participantUuid) {
            rec = await CertificateVerification.findOne({
              where: { templateUuid, participantUuid }
            });
          }

          if (rec) {
            const nextStatus = rec.status === 'deleted' ? 'approved' : rec.status;
            await rec.update({
              templateName: template?.name || rec.templateName || null,
              eventUuid: event?.uuid || rec.eventUuid || null,
              eventTitle: event?.title || rec.eventTitle || null,
              fields,
              issuedAt: new Date(),
              status: nextStatus,
              isRevoked: nextStatus === 'revoked',
              revokedAt: nextStatus === 'revoked' ? (rec.revokedAt || new Date()) : null
            });
            p.__verifyToken = rec.token;
          } else {
            rec = await CertificateVerification.create({
              templateUuid,
              templateName: template?.name || null,
              eventUuid: event?.uuid || null,
              eventTitle: event?.title || null,
              participantUuid,
              fields,
              issuedAt: new Date(),
              status: 'approved',
              isRevoked: false,
              revokedAt: null
            });
            p.__verifyToken = rec?.token;
          }
        }
      };

      await Promise.all(Array.from({ length: limit }, () => worker()));
    } catch (e) {
      console.log('prepareVerificationTokens failed (ignored):', e?.message || String(e));
    }
  }

  async _applyPdfMetadata(pdfBuffer, template, participants) {
    try {
      const appName = String(process.env.PDF_APP_NAME || 'e-Sertifikat').trim() || 'e-Sertifikat';
      const author = String(process.env.PDF_AUTHOR || appName).trim() || appName;
      const creator = String(process.env.PDF_CREATOR || appName).trim() || appName;
      const producer = String(process.env.PDF_PRODUCER || appName).trim() || appName;
      const subject = String(process.env.PDF_SUBJECT || 'Sertifikat').trim() || 'Sertifikat';
      const keywords = String(process.env.PDF_KEYWORDS || 'sertifikat, certificate, e-sertifikat').trim();

      const baseTitle = String(template?.name || template?.title || 'Sertifikat').trim() || 'Sertifikat';
      const title = baseTitle;

      const pdfDoc = await PDFDocument.load(pdfBuffer, { updateMetadata: false });
      pdfDoc.setTitle(title);
      pdfDoc.setAuthor(author);
      pdfDoc.setSubject(subject);
      if (keywords) {
        pdfDoc.setKeywords(keywords.split(',').map(s => s.trim()).filter(Boolean));
      }
      pdfDoc.setCreator(creator);
      pdfDoc.setProducer(producer);
      pdfDoc.setCreationDate(new Date());
      pdfDoc.setModificationDate(new Date());

      return await pdfDoc.save();
    } catch (e) {
      return pdfBuffer;
    }
  }

  _getAssetCacheTtlMs() {
    const v = parseInt(process.env.PUPPETEER_ASSET_CACHE_TTL_MS, 10);
    if (Number.isFinite(v) && v > 0) return v;
    return 60 * 60 * 1000;
  }

  _getAssetCacheMaxItems() {
    const v = parseInt(process.env.PUPPETEER_ASSET_CACHE_MAX_ITEMS, 10);
    if (Number.isFinite(v) && v > 0) return Math.min(v, 5000);
    return 1000;
  }

  _cacheGet(key) {
    try {
      const rec = this._assetBufferCache && this._assetBufferCache.get(key);
      if (!rec) return null;
      const ttl = this._getAssetCacheTtlMs();
      if (Date.now() - rec.ts > ttl) {
        this._assetBufferCache.delete(key);
        return null;
      }
      rec.ts = Date.now();
      return rec;
    } catch (_) {
      return null;
    }
  }

  _cacheSet(key, rec) {
    try {
      if (!this._assetBufferCache) return;
      const max = this._getAssetCacheMaxItems();
      if (this._assetBufferCache.size >= max) {
        const firstKey = this._assetBufferCache.keys().next().value;
        if (firstKey) this._assetBufferCache.delete(firstKey);
      }
      this._assetBufferCache.set(key, rec);
    } catch (_) {
      // ignore
    }
  }

  _getConcurrencyLimit() {
    const v = parseInt(process.env.PUPPETEER_PDF_CONCURRENCY || process.env.CERTIFICATE_CONCURRENCY_LIMIT, 10);
    if (Number.isFinite(v) && v > 0) return Math.min(v, 16);
    return 2;
  }

  async _acquireJobSlot() {
    const limit = this._getConcurrencyLimit();
    if (this._activeJobs < limit) {
      this._activeJobs++;
      return;
    }

    await new Promise((resolve) => {
      this._jobQueue.push(resolve);
    });
    this._activeJobs++;
  }

  _releaseJobSlot() {
    this._activeJobs = Math.max(0, (this._activeJobs || 0) - 1);
    const next = this._jobQueue.shift();
    if (next) next();
  }

  /**
   * Generate a PDF buffer for MANY participants using a single HTML render path.
   * Frontend controllers should prefer this method for bulk; single calls route via createPDFFromTemplate().
   * @param {object} template - certificate template including design.
   * @param {Array<object>} participants - list of participant records ({ data: {...} }).
   * @returns {Promise<Buffer>} PDF buffer.
   */
  async initialize() {
    // If initialization is already in progress, wait for it to complete
    if (this.initializationPromise) {
      await this.initializationPromise;
      return;
    }

    // If browser is already initialized, do nothing
    if (this.browser) {
      return;
    }

    // Start initialization and store the promise
    const userDataDir = process.env.PUPPETEER_USER_DATA_DIR
      ? path.resolve(process.env.PUPPETEER_USER_DATA_DIR)
      : path.join(__dirname, '..', '.puppeteer_profile');

    this.initializationPromise = puppeteer.launch({
      headless: true,
      userDataDir,
      args: [
        '--no-sandbox',
        '--disable-web-security',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', // Overcome limited resource problems
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--font-render-hinting=none',
        '--memory-pressure-off', // Improve performance for bulk operations
        '--max_old_space_size=8192', // Increase memory limit
        `--disk-cache-dir=${path.join(userDataDir, 'Cache')}`,
        '--disk-cache-size=268435456',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection'
      ],
      timeout: 60000 // Increase timeout to 60 seconds
    }).then(browser => {
      this.browser = browser;
      this.initializationPromise = null; // Clear the promise once done
    }).catch(error => {
      this.initializationPromise = null; // Clear the promise on error
      throw error;
    });

    await this.initializationPromise;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Single unified PDF generator for both single and bulk.
   * Accepts a participant object or an array of participants.
   */
  async createPDF(template, participants) {
    let page = null;
    try {
      await this._acquireJobSlot();
      const t0 = Date.now();
      await this.initialize();

      const tInit = Date.now();
      page = await this.browser.newPage();
      await page.setCacheEnabled(true);

      // Set a longer timeout for page operations
      page.setDefaultTimeout(90000); // Slightly reduced to fail faster if stuck

      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36');

      // Enable local file access
      await page.setRequestInterception(true);

      page.on('request', (request) => {
        const url = request.url();

        // Handle local upload files (support both legacy /uploads and current /api/uploads)
        const port = process.env.PORT || 3000;
        const uploadsPrefix = `http://localhost:${port}/api/uploads/`;
        const uploadsLegacyPrefix = `http://localhost:${port}/uploads/`;
        const fontsPrefix = `http://localhost:${port}/api/fonts/`;

        if (url.startsWith(uploadsPrefix) || url.startsWith(uploadsLegacyPrefix) || url.startsWith(fontsPrefix)) {
          const isFonts = url.startsWith(fontsPrefix);
          const relPath = url.startsWith(fontsPrefix)
            ? url.replace(fontsPrefix, '')
            : url.startsWith(uploadsPrefix)
              ? url.replace(uploadsPrefix, '')
              : url.replace(uploadsLegacyPrefix, '');

          const baseDir = isFonts
            ? path.join(__dirname, '..', 'fonts')
            : path.resolve(process.env.UPLOAD_DIR || './uploads');

          const filePath = path.join(baseDir, relPath);

          try {
            // Check if file exists
            if (fsSync.existsSync(filePath)) {
              const cacheKey = `${isFonts ? 'font' : 'upload'}:${filePath}`;
              const cached = this._cacheGet(cacheKey);
              const data = cached?.data || fsSync.readFileSync(filePath);

              const extension = cached?.extension || path.extname(filePath).toLowerCase();
              let contentType = cached?.contentType || 'application/octet-stream';

              if (extension === '.png') {
                contentType = 'image/png';
              } else if (extension === '.jpg' || extension === '.jpeg') {
                contentType = 'image/jpeg';
              } else if (extension === '.woff2') {
                contentType = 'font/woff2';
              } else if (extension === '.woff') {
                contentType = 'font/woff';
              } else if (extension === '.ttf') {
                contentType = 'font/ttf';
              }

              if (!cached) {
                this._cacheSet(cacheKey, {
                  ts: Date.now(),
                  data,
                  extension,
                  contentType
                });
              }

              request.respond({
                status: 200,
                contentType: contentType,
                headers: {
                  'Cache-Control': 'public, max-age=31536000, immutable'
                },
                body: data
              });
            } else {
              request.continue();
            }
          } catch (error) {
            request.continue();
          }
        } else {
          request.continue();
        }
      });

      const list = Array.isArray(participants) ? participants : [participants];
      console.log(`Starting PDF generation for ${list.length} participant(s)`);
      await this._prepareVerificationTokens(template, list);

      // Log font information for debugging
      let fontsUsedList = [];
      if (template.design && (template.design.objects || template.design.pages)) {
        const fontsUsed = new Set();
        const allObjects = Array.isArray(template.design.pages)
          ? template.design.pages.flatMap(p => (Array.isArray(p?.objects) ? p.objects : []))
          : (Array.isArray(template.design.objects) ? template.design.objects : []);
        allObjects.forEach(element => {
          if (element.type === 'text' && element.fontFamily) {
            fontsUsed.add(element.fontFamily);
          }
        });
        fontsUsedList = Array.from(fontsUsed);
        console.log('Fonts used in template:', fontsUsedList);
      }

      // Prepare local fonts CSS (download Google Fonts to local server)
      const tFontsStart = Date.now();
      const localFontsCSS = await this.prepareLocalFonts(template);
      const tFontsEnd = Date.now();
      console.log(`prepareLocalFonts took ${tFontsEnd - tFontsStart}ms`);

      // Create HTML content for all certificates
      const tHtmlStart = Date.now();
      const htmlContent = await this.generateHTMLFromTemplate(template, list, localFontsCSS);
      const tHtmlEnd = Date.now();
      console.log(`generateHTMLFromTemplate took ${tHtmlEnd - tHtmlStart}ms`);

      // Set content and wait for minimal readiness; fonts handled below
      const tSetContentStart = Date.now();
      await page.setContent(htmlContent, {
        waitUntil: 'domcontentloaded',
        timeout: 45000
      });
      const tSetContentEnd = Date.now();
      console.log(`page.setContent took ${tSetContentEnd - tSetContentStart}ms`);

      // Set viewport to match template dimensions for better rendering
      await page.setViewport({
        width: template.width,
        height: template.height,
        deviceScaleFactor: 1
      });

      // Explicitly load all fonts before proceeding
      const tFontWaitStart = Date.now();
      await page.evaluate((families) => {
        const unique = Array.isArray(families) ? families.filter(Boolean) : [];
        // Proactively request these fonts to be loaded (best-effort)
        if (document.fonts && unique.length) {
          unique.forEach((fam) => {
            try {
              const clean = String(fam).replace(/['"]/g, '').trim();
              // Attempt both normal and bold to increase chance weights are ready
              document.fonts.load(`16px "${clean}"`);
              document.fonts.load(`bold 16px "${clean}"`);
              document.fonts.load(`italic 16px "${clean}"`);
            } catch (_) { /* ignore */ }
          });
        }

        const MAX_WAIT = 15000; // give more time for remote fonts when needed
        const start = Date.now();
        return new Promise((resolve) => {
          if (!document.fonts) return setTimeout(resolve, 1500);
          const check = () => {
            const pending = Array.from(document.fonts).filter(f => f.status !== 'loaded');
            if (!pending.length || Date.now() - start > MAX_WAIT) {
              requestAnimationFrame(() => resolve());
            } else {
              setTimeout(check, 300);
            }
          };
          if (document.fonts.status === 'loaded') {
            return resolve();
          }
          document.fonts.ready.finally(check);
          setTimeout(check, 300);
        });
      }, fontsUsedList);
      const tFontWaitEnd = Date.now();
      console.log(`document.fonts wait took ${tFontWaitEnd - tFontWaitStart}ms`);

      // Force a reflow to ensure fonts are properly applied
      await page.evaluate(() => {
        document.body.offsetHeight;
      });

      // Generate PDF with optimized settings for bulk
      console.log('Generating PDF...');
      const tPdfStart = Date.now();
      const pdfBuffer = await page.pdf({
        width: `${template.width}px`,
        height: `${template.height}px`,
        printBackground: true,
        margin: {
          top: 0,
          right: 0,
          bottom: 0,
          left: 0
        },
        preferCSSPageSize: true,
        pageRanges: '', // Include all pages
        scale: 1.0, // Ensure 1:1 scale
        displayHeaderFooter: false
      });
      const tPdfEnd = Date.now();
      console.log(`page.pdf took ${tPdfEnd - tPdfStart}ms`);

      const tMetaStart = Date.now();
      const branded = await this._applyPdfMetadata(pdfBuffer, template, list);
      const tMetaEnd = Date.now();
      console.log(`pdf metadata took ${tMetaEnd - tMetaStart}ms`);

      const tEnd = Date.now();
      console.log(`Total createPDF took ${tEnd - t0}ms (init+newPage: ${tInit - t0}ms)`);

      console.log(`PDF generated successfully for ${list.length} participant(s)`);
      return branded;
    } catch (error) {
      console.error('Error generating bulk PDF:', error);
      throw error;
    } finally {
      // Always close the page to free up resources
      if (page) {
        try {
          await page.close();
        } catch (error) {
          console.error('Error closing page:', error);
        }
      }

      this._releaseJobSlot();
    }
  }

  /**
   * Build the complete printable HTML for the given template/participants.
   * This HTML is also dumped to disk for debugging by the caller.
   * @param {object} template
   * @param {Array<object>} participants
   * @param {string} localFontsCSS
   * @returns {string} HTML string
   */
  async generateHTMLFromTemplate(template, participants, localFontsCSS = '') {
    // Collect all unique font families used in the template
    const fontFamilies = new Set();
    const designPages = (template.design && Array.isArray(template.design.pages) && template.design.pages.length)
      ? template.design.pages
      : [{
        objects: (template.design && Array.isArray(template.design.objects)) ? template.design.objects : [],
        background: (template.design && template.design.background) ? template.design.background : null
      }];

    for (const pageDef of designPages) {
      const objs = Array.isArray(pageDef?.objects) ? pageDef.objects : [];
      for (const element of objs) {
        if (element.type === 'text' && element.fontFamily) {
          // Clean up font family name - remove quotes and extra spaces
          const cleanFontFamily = element.fontFamily.replace(/['"]/g, '').trim();
          if (cleanFontFamily) {
            fontFamilies.add(cleanFontFamily);
          }
        }
      }
    }

    // Generate Google Fonts CSS import
    let googleFontsImport = '';
    let googleFonts = [];

    // System/Web-safe fonts that don't need remote fetching
    const systemFonts = [
      'Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Courier New',
      'Verdana', 'Tahoma', 'Trebuchet MS', 'Segoe UI', 'Calibri', 'Cambria',
      'Garamond', 'Lucida Console', 'Monaco', 'Comic Sans MS', 'Impact',
      'Palatino', 'Bookman', 'Avant Garde', 'Century Gothic', 'Franklin Gothic Medium',
      'Brush Script MT'
    ];
    // Dynamic Google fonts list (any non-system font)
    const dynamicGoogleFonts = new Set();

    // Create a comprehensive mapping for CSS font-family property
    const cssFontFamilyMap = {
      'Brush Script MT': "'Brush Script MT', cursive",
      'Times New Roman': "'Times New Roman', Times, serif",
      'Courier New': "'Courier New', Courier, monospace",
      'Trebuchet MS': "'Trebuchet MS', sans-serif",
      'Arial Black': "'Arial Black', Arial, sans-serif",
      'Comic Sans MS': "'Comic Sans MS', cursive",
      'Impact': 'Impact, fantasy',
      'Lucida Console': "'Lucida Console', Monaco, monospace",
      'Palatino Linotype': "'Palatino Linotype', 'Book Antiqua', Palatino, serif",
      'Tahoma': 'Tahoma, Geneva, Verdana, sans-serif',
      'Trebuchet': "'Trebuchet MS', sans-serif",
      'Verdana': 'Verdana, Geneva, sans-serif',
      'Georgia': 'Georgia, serif',
      'Helvetica': 'Helvetica, Arial, sans-serif',
      'Avant Garde': "'Century Gothic', 'Avant Garde', sans-serif",
      'Pacifico': "'Pacifico', cursive"
    };

    // Use unified builder for Google Fonts specs (prevents invalid css2 queries)
    const { googleFonts: builtFonts } = this._buildGoogleFontsQuery(template);
    googleFonts = [...builtFonts];

    // Add Google Fonts import to HTML only when we don't have local font-face CSS.
    // When localFontsCSS is present, including remote Google Fonts often slows rendering.
    if (!localFontsCSS && googleFonts.length > 0) {
      const fontsQuery = googleFonts.join('&family=');
      googleFontsImport = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=${fontsQuery}&display=swap" rel="stylesheet">`;
    }

    // Preload background image if exists to accelerate first paint
    let backgroundPreloadLink = '';
    if (designPages[0] && designPages[0].background) {
      let preloadUrl = designPages[0].background;
      if (preloadUrl.startsWith('/uploads/')) {
        const port = process.env.PORT || 3000;
        preloadUrl = `http://localhost:${port}/api${preloadUrl}`;
      }
      backgroundPreloadLink = `<link rel="preload" as="image" href="${preloadUrl}">`;
    }

    // Start building HTML
    const safeTitleBase = String(template?.name || template?.title || 'Sertifikat').trim() || 'Sertifikat';
    const safeTitle = safeTitleBase
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

    let html = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <title>${safeTitle}</title>
      <meta name="title" content="${safeTitle}">
      <meta name="author" content="e-Sertifikat">
      <meta name="subject" content="Sertifikat">
      <meta name="keywords" content="sertifikat, certificate, e-sertifikat">
      ${googleFontsImport}
      ${backgroundPreloadLink}
      <style>
      ${localFontsCSS}
      </style>
      <style>
        @page {
          size: ${template.width}px ${template.height}px;
          margin: 0;
          padding: 0;
        }
        * {
          box-sizing: border-box;
        }
        html, body {
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
          font-family: Arial, sans-serif;
        }
        .certificate-page {
          width: ${template.width}px;
          height: ${template.height}px;
          position: relative;
          page-break-after: always;
          page-break-inside: avoid;
          display: block;
          margin: 0;
          padding: 0;
          overflow: hidden;
        }
        .certificate-page:last-child {
          page-break-after: avoid;
        }
        .certificate-container {
          width: ${template.width}px;
          height: ${template.height}px;
          position: relative;
          margin: 0;
          padding: 0;
          display: block;
        }
    `;

    html += `
      </style>
    </head>
    <body>
    `;

    const resolveBackgroundUrl = (bg) => {
      if (!bg || typeof bg !== 'string') return null;
      if (!bg.startsWith('/uploads/')) return bg;
      const port = process.env.PORT || 3000;
      return `http://localhost:${port}/api${bg}`;
    };

    // Generate a page for each participant
    for (const participant of participants) {
      for (const pageDef of designPages) {
        const bgUrl = resolveBackgroundUrl(pageDef?.background);
        const bgStyle = bgUrl
          ? `background-image: url('${bgUrl}'); background-size: ${template.width}px ${template.height}px; background-position: 0 0; background-repeat: no-repeat;`
          : '';
        html += `<div class="certificate-page">`;
        html += `<div class="certificate-container" style="${bgStyle}">`;

        // Add elements for this participant (per page)
        const pageObjects = Array.isArray(pageDef?.objects) ? pageDef.objects : [];
        for (const element of pageObjects) {
          if (element.type === 'text') {
            let text = element.text || '';

            // Replace dynamic placeholders with participant data
            if (text.includes('{')) {
              // Ensure participant.data exists and is an object
              const participantData = (participant && participant.data) || {};
              text = this.replacePlaceholders(text, participantData);
            }

            const escapeHtml = (s) => String(s)
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#39;');

            const safeText = escapeHtml(text).replace(/\n/g, '<br/>');

            // Create text element styles
            const styles = [];
            if (element.fontSize) styles.push(`font-size: ${element.fontSize}px`);

            // Apply font family with fallbacks
            if (element.fontFamily) {
              let cleanFontFamily = element.fontFamily.replace(/['"]/g, '').trim();

              // Brush Script MT is a proprietary Windows font and is often unavailable
              // in headless/server environments (Linux). Map it to a consistent web font.
              if (cleanFontFamily === 'Brush Script MT') {
                cleanFontFamily = 'Pacifico';
              }
              // Use the pre-defined CSS font-family mapping first
              if (cssFontFamilyMap[cleanFontFamily]) {
                styles.push(`font-family: ${cssFontFamilyMap[cleanFontFamily]}`);
              } else if (!systemFonts.includes(cleanFontFamily)) {
                // For Google Fonts, use the exact name with proper quotes and fallbacks
                styles.push(`font-family: '${cleanFontFamily}', sans-serif`);
              } else if (systemFonts.includes(cleanFontFamily)) {
                // For system fonts, use the font name directly with fallbacks
                styles.push(`font-family: '${cleanFontFamily}', sans-serif`);
              } else {
                // For unknown fonts, use the font name directly with fallbacks
                styles.push(`font-family: '${cleanFontFamily}', sans-serif`);
              }
            }

            if (element.fill) styles.push(`color: ${element.fill}`);
            if (element.fontWeight) styles.push(`font-weight: ${element.fontWeight}`);
            if (element.fontStyle) styles.push(`font-style: ${element.fontStyle}`);
            if (element.textDecoration) styles.push(`text-decoration: ${element.textDecoration}`);
            if (typeof element.opacity === 'number') styles.push(`opacity: ${element.opacity}`);
            const letterSpacing = Number(element.letterSpacing);
            if (Number.isFinite(letterSpacing)) styles.push(`letter-spacing: ${letterSpacing}px`);

            // Position styles
            styles.push('position: absolute');
            let baseX = element.x || 0;
            let baseY = element.y || 0;
            let width = element.width || 200;
            if (width > template.width) width = template.width;
            styles.push(`left: ${baseX}px`);
            styles.push(`top: ${baseY}px`);
            styles.push(`width: ${width}px`);
            const lineHeightFactor = (typeof element.lineHeight === 'number' && element.lineHeight > 0) ? element.lineHeight : 1.0;
            let height = (element.fontSize ? element.fontSize * lineHeightFactor : 32);

            const anchorHeight = (typeof element._measuredHeight === 'number' && element._measuredHeight > 0)
              ? element._measuredHeight
              : height;

            if (element.verticalAlign === 'middle' || element.verticalAlign === 'bottom') {
              styles.push(`height: ${Math.round(anchorHeight * 10) / 10}px`);
            } else if (element.wordWrap) {
              styles.push(`min-height: ${height}px`);
            } else {
              styles.push(`height: ${height}px`);
            }

            // PDF Position Compensation - Fix for text position differences between editor and PDF
            // The issue occurs because:
            // 1. Browser and PDF renderers use different font metrics
            // 2. Different box model implementations
            // 3. Varying line-height calculations
            // 4. Different baseline positioning algorithms
            // 5. PDF uses different font rendering engines
            // 6. Different CSS interpretation between browser and PDF
            // 7. Font subsetting and embedding differences
            // 8. Different anti-aliasing and hinting algorithms
            // 9. Different coordinate system origins
            // 10. Different text baseline calculations
            // 11. Different font weight rendering
            // 12. Different CSS box model implementations
            // 13. Different text rendering sub-pixel positioning
            // 14. Different font fallback mechanisms
            // 15. Different text kerning and tracking algorithms
            // 16. Different text rendering optimization techniques
            // 17. Different text layout engines
            // 18. Different text rendering caching mechanisms
            // 19. Different text rendering DPI scaling
            // 20. Different text rendering color management
            // 21. Different text rendering gamma correction
            // 22. Different text rendering interpolation algorithms
            // 23. Different text rendering text smoothing
            // 24. Different text rendering text rendering modes
            // 25. Different text rendering text rendering quality settings
            // 26. Different text rendering text rendering resolution
            // 27. Different text rendering text rendering anti-aliasing
            // 28. Different text rendering text rendering sub-pixel rendering
            // 29. Different text rendering text rendering text rendering
            // 30. Different text rendering text rendering text rendering

            // Kompensasi kecil agar posisi teks PDF sejajar dengan Konva (baseline metrics berbeda)
            // Catatan: untuk kasus beda "sedikit", gunakan offset pecahan agar tidak terlalu agresif.
            const fs = element.fontSize || 24;
            // Baseline between Konva(canvas) and Chromium(PDF) can differ ~1px.
            // Apply a small global upward nudge, then apply mild, additive adjustments by font size.
            let offsetY = -2.5;
            if (!element.wordWrap) {
              if (fs >= 28) offsetY -= 0.5;
              if (fs >= 40) offsetY -= 2;
              if (fs >= 56) offsetY -= 3;
              // untuk middle, sedikit naik agar visually center tetap rapih
              if (element.verticalAlign === 'middle') offsetY -= 0.3;
            }
            styles.push(`top: ${baseY + offsetY}px`);

            // Text alignment
            if (element.align) styles.push(`text-align: ${element.align}`);

            if (element.verticalAlign === 'middle' || element.verticalAlign === 'bottom') {
              styles.push('display: flex');
              styles.push('flex-direction: column');
              if (element.verticalAlign === 'middle') styles.push('justify-content: center');
              else styles.push('justify-content: flex-end');
              if (element.align === 'right') styles.push('align-items: flex-end');
              else if (element.align === 'center') styles.push('align-items: center');
              else styles.push('align-items: flex-start');
            }

            if (element.fontSize) {
              const lh = Math.round((element.fontSize * lineHeightFactor) * 10) / 10;
              styles.push(`line-height: ${lh}px`);
            }

            styles.push('overflow: visible');
            styles.push('padding: 0');
            styles.push('margin: 0');
            styles.push('white-space: pre');

            // Apply word wrap setting
            if (element.wordWrap) {
              styles.push('white-space: normal');
              styles.push('word-wrap: break-word');
            } else {
              styles.push('white-space: nowrap');
            }

            // Apply rotation to text elements
            if (typeof element.rotation === 'number' && element.rotation !== 0) {
              styles.push(`transform: rotate(${element.rotation}deg)`);
              styles.push('transform-origin: top left');
            }

            // Apply text shadow to text elements
            if (element.shadowColor || element.shadowBlur || element.shadowOffsetX || element.shadowOffsetY || typeof element.shadowOpacity === 'number') {
              const sx = element.shadowOffsetX || 0;
              const sy = element.shadowOffsetY || 0;
              const blur = element.shadowBlur || 0;
              const baseCol = element.shadowColor || 'rgb(0,0,0)';
              const opacity = typeof element.shadowOpacity === 'number' ? Math.max(0, Math.min(1, element.shadowOpacity)) : 1;

              // Convert color to RGBA with opacity
              const toRgba = (c, a) => {
                try {
                  if (!c) return `rgba(0,0,0,${a})`;
                  const cc = c.trim();
                  if (cc.startsWith('rgba(')) return cc;
                  if (cc.startsWith('rgb(')) return cc.replace('rgb(', 'rgba(').replace(')', `, ${a})`);
                  if (cc.startsWith('#')) {
                    const hex = cc.slice(1);
                    const norm = hex.length === 3 ? hex.split('').map(h => h + h).join('') : hex;
                    const r = parseInt(norm.substring(0, 2), 16) || 0;
                    const g = parseInt(norm.substring(2, 4), 16) || 0;
                    const b = parseInt(norm.substring(4, 6), 16) || 0;
                    return `rgba(${r}, ${g}, ${b}, ${a})`;
                  }
                  return cc;
                } catch { return `rgba(0,0,0,${a})`; }
              };
              const col = toRgba(baseCol, opacity);
              styles.push(`text-shadow: ${sx}px ${sy}px ${blur}px ${col}`);
            }

            // Wrap with background container if bgColor specified for symmetric padding
            if (element.bgColor) {
              const pad = Math.max(0, element.bgPadding || 0);
              const radius = Math.max(0, element.bgRadius || 0);
              const boxHeight = (element.verticalAlign === 'middle' || element.verticalAlign === 'bottom')
                ? anchorHeight
                : height;
              const bgStyles = [
                'position: absolute',
                `left: ${baseX - pad}px`,
                // top termasuk kompensasi offsetY
                `top: ${baseY + offsetY - pad}px`,
                `width: ${width + pad * 2}px`,
                `height: ${Math.round((boxHeight + pad * 2) * 10) / 10}px`,
                `background: ${element.bgColor}`,
                radius ? `border-radius: ${radius}px` : '',
                'display: flex',
                'flex-direction: column',
                (element.verticalAlign === 'bottom')
                  ? 'justify-content: flex-end'
                  : (element.verticalAlign === 'top')
                    ? 'justify-content: flex-start'
                    : 'justify-content: center'
              ].filter(Boolean);
              // alignment inside background
              if (element.align === 'right') bgStyles.push('align-items: flex-end');
              else if (element.align === 'center') bgStyles.push('align-items: center');
              else bgStyles.push('align-items: flex-start');
              // Remove absolute positioning duplication from text styles
              const innerStyles = styles.filter(s => !s.startsWith('left:') && !s.startsWith('top:') && !s.startsWith('position:') && !s.startsWith('width:') && !s.startsWith('height:'));
              innerStyles.push(`padding: 0 ${Math.max(0, Math.min(pad, Math.round(width / 4)))}px`);
              html += `<div style="${bgStyles.join('; ')}"><div style="${innerStyles.join('; ')}">${safeText}</div></div>`;
            } else {
              if (element.verticalAlign === 'middle' || element.verticalAlign === 'bottom') {
                // Use an inner block so flex alignment anchors the text bottom/center correctly,
                // and wrapped lines can overflow upward when content is taller than the anchor box.
                html += `<div style="${styles.join('; ')}"><div style="width: 100%;">${safeText}</div></div>`;
              } else {
                html += `<div style="${styles.join('; ')}">${safeText}</div>`;
              }
            }
          } else if (element.type === 'image' && element.src) {
            // Resolve image URL (support local uploads)
            let imgUrl = element.src;
            if (imgUrl.startsWith('/uploads/')) {
              const port = process.env.PORT || 3000;
              imgUrl = `http://localhost:${port}/api${imgUrl}`;
            }

            const styles = [];
            styles.push('position: absolute');
            const baseX = element.x || 0;
            const baseY = element.y || 0;
            let w = element.width || 100;
            let h = element.height || 100;
            if (w > template.width) w = template.width;
            if (h > template.height) h = template.height;
            styles.push(`left: ${baseX}px`);
            styles.push(`top: ${baseY}px`);
            styles.push(`width: ${w}px`);
            styles.push(`height: ${h}px`);
            if (typeof element.opacity === 'number') styles.push(`opacity: ${element.opacity}`);
            if (typeof element.rotation === 'number' && element.rotation !== 0) {
              styles.push(`transform: rotate(${element.rotation}deg)`);
              styles.push('transform-origin: top left');
            }

            // Border & radius for image
            if (element.borderColor && (element.borderWidth || 0) > 0) {
              styles.push(`border: ${Math.max(0, element.borderWidth)}px solid ${element.borderColor}`);
            }
            if (typeof element.borderRadius === 'number') {
              styles.push(`border-radius: ${Math.max(0, element.borderRadius)}px`);
            }

            // Box shadow for image
            if (element.shadowColor || element.shadowBlur || element.shadowOffsetX || element.shadowOffsetY) {
              const sx = element.shadowOffsetX || 0;
              const sy = element.shadowOffsetY || 0;
              const blur = element.shadowBlur || 0;
              const col = element.shadowColor || 'rgba(0,0,0,0.35)';
              styles.push(`box-shadow: ${sx}px ${sy}px ${blur}px ${col}`);
            }

            html += `<img src="${imgUrl}" style="${styles.join('; ')}" />`;
          } else if (element.type === 'shape') {
            const baseX = element.x || 0;
            const baseY = element.y || 0;
            let w = element.width || 100;
            let h = element.height || 100;
            if (w > template.width) w = template.width;
            if (h > template.height) h = template.height;

            const opacity = (typeof element.opacity === 'number') ? element.opacity : null;
            const rot = (typeof element.rotation === 'number') ? element.rotation : 0;

            const fill = (typeof element.fill === 'string' && element.fill.trim()) ? element.fill.trim() : '#3b82f6';
            const strokeCol = (typeof element.borderColor === 'string' && element.borderColor.trim()) ? element.borderColor.trim() : null;
            const strokeW = Math.max(0, Number(element.borderWidth || 0) || 0);

            const shapeType = String(element.shapeType || 'rect');

            // Shadow (CSS)
            let shadowCss = '';
            if (element.shadowColor || element.shadowBlur || element.shadowOffsetX || element.shadowOffsetY) {
              const sx = element.shadowOffsetX || 0;
              const sy = element.shadowOffsetY || 0;
              const blur = element.shadowBlur || 0;
              const col = element.shadowColor || 'rgba(0,0,0,0.35)';
              // Prefer filter drop-shadow so it works on SVG too
              shadowCss = `filter: drop-shadow(${sx}px ${sy}px ${blur}px ${col});`;
            }

            if (shapeType === 'triangle') {
              const styles = [
                'position: absolute',
                `left: ${baseX}px`,
                `top: ${baseY}px`,
                `width: ${w}px`,
                `height: ${h}px`,
                opacity != null ? `opacity: ${opacity}` : '',
                rot ? `transform: rotate(${rot}deg)` : '',
                rot ? 'transform-origin: top left' : '',
                shadowCss
              ].filter(Boolean);

              const sw = strokeW > 0 ? strokeW : 0;
              const strokeAttr = (strokeCol && sw > 0) ? `stroke=\"${strokeCol}\" stroke-width=\"${sw}\"` : '';

              // Match Konva RegularPolygon (sides=3) sizing:
              // radius = min(width, height) / 2, centered in the element box.
              // Angles match Konva default rotation (pointing up): -90, 30, 150 degrees.
              const cx = w / 2;
              const cy = h / 2;
              const r = Math.min(w, h) / 2;
              const angles = [-90, 30, 150].map((deg) => (deg * Math.PI) / 180);
              const points = angles
                .map((a) => {
                  const x = cx + r * Math.cos(a);
                  const y = cy + r * Math.sin(a);
                  return `${x.toFixed(3)},${y.toFixed(3)}`;
                })
                .join(' ');

              html += `
                <svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 ${w} ${h}\" preserveAspectRatio=\"none\" style=\"${styles.join('; ')}\">
                  <polygon points=\"${points}\" fill=\"${fill}\" ${strokeAttr} />
                </svg>
              `;
            } else {
              const styles = [];
              styles.push('position: absolute');
              styles.push(`left: ${baseX}px`);
              styles.push(`top: ${baseY}px`);
              styles.push(`width: ${w}px`);
              styles.push(`height: ${h}px`);
              if (opacity != null) styles.push(`opacity: ${opacity}`);
              if (rot) {
                styles.push(`transform: rotate(${rot}deg)`);
                styles.push('transform-origin: top left');
              }
              styles.push(`background: ${fill}`);
              if (strokeCol && strokeW > 0) {
                styles.push(`border: ${strokeW}px solid ${strokeCol}`);
              }
              if (shapeType === 'circle') {
                styles.push('border-radius: 9999px');
              } else if (typeof element.borderRadius === 'number' && element.borderRadius > 0) {
                styles.push(`border-radius: ${Math.max(0, element.borderRadius)}px`);
              }
              if (shadowCss) styles.push(shadowCss);
              html += `<div style="${styles.join('; ')}"></div>`;
            }
          } else if (element.type === 'qrcode') {
            const styles = [];
            styles.push('position: absolute');
            const baseX = element.x || 0;
            const baseY = element.y || 0;
            let w = element.width || 120;
            let h = element.height || 120;
            if (w > template.width) w = template.width;
            if (h > template.height) h = template.height;
            styles.push(`left: ${baseX}px`);
            styles.push(`top: ${baseY}px`);
            styles.push(`width: ${w}px`);
            styles.push(`height: ${h}px`);
            if (typeof element.opacity === 'number') styles.push(`opacity: ${element.opacity}`);
            if (typeof element.rotation === 'number' && element.rotation !== 0) {
              styles.push(`transform: rotate(${element.rotation}deg)`);
              styles.push('transform-origin: top left');
            }
            if (element.borderColor && (element.borderWidth || 0) > 0) {
              styles.push(`border: ${Math.max(0, element.borderWidth)}px solid ${element.borderColor}`);
            }
            if (typeof element.borderRadius === 'number' && element.borderRadius > 0) {
              styles.push(`border-radius: ${Math.max(0, element.borderRadius)}px`);
            }
            if (element.shadowColor || element.shadowBlur || element.shadowOffsetX || element.shadowOffsetY) {
              const sx = element.shadowOffsetX || 0;
              const sy = element.shadowOffsetY || 0;
              const blur = element.shadowBlur || 0;
              const col = element.shadowColor || 'rgba(0,0,0,0.35)';
              styles.push(`box-shadow: ${sx}px ${sy}px ${blur}px ${col}`);
            }

            const verifyUrl = participant?.__verifyToken
              ? this._buildVerifyUrlFromToken({ token: participant.__verifyToken })
              : this._buildVerifyUrl({
                templateUuid: template?.uuid,
                participantUuid: participant?.uuid
              });

            const bgTransparent = Boolean(element.transparentBackground);
            const bgColor = (typeof element.backgroundColor === 'string' && element.backgroundColor.trim())
              ? element.backgroundColor.trim()
              : '#ffffff';

            // If not configured, render a blank placeholder box so PDF generation does not fail.
            if (!verifyUrl) {
              const placeholderBg = bgTransparent ? 'transparent' : bgColor;
              html += `<div style="${styles.join('; ')}; background: ${placeholderBg}; display:flex; align-items:center; justify-content:center; color:#111827; font-size:12px; font-family:Arial;"><span>QR</span></div>`;
            } else {
              const size = Math.round(Math.max(w, h));
              const wantsLogo = Boolean(element.logoEnabled) && typeof element.logoSrc === 'string' && element.logoSrc.trim().length > 0;
              const qrOptions = {
                errorCorrectionLevel: wantsLogo ? 'H' : 'M',
                margin: wantsLogo ? 2 : 0,
                width: size,
                color: {
                  dark: '#000000',
                  light: bgTransparent ? '#00000000' : bgColor
                }
              };
              if (!wantsLogo) {
                const dataUrl = await QRCode.toDataURL(verifyUrl, qrOptions);
                html += `<img src="${dataUrl}" style="${styles.join('; ')}" />`;
              } else {
                let qrBuffer = await QRCode.toBuffer(verifyUrl, qrOptions);
                const meta = await sharp(qrBuffer).metadata().catch(() => null);
                const qrW = Math.max(1, parseInt(meta?.width, 10) || size);
                const qrH = Math.max(1, parseInt(meta?.height, 10) || size);
                const qrSide = Math.max(1, Math.min(qrW, qrH));

                const logoScaleRaw = (typeof element.logoScale === 'number' && Number.isFinite(element.logoScale))
                  ? element.logoScale
                  : 0.22;
                const bgEnabled = Boolean(element.logoBgEnabled);
                const maxScale = 0.34;
                const logoScale = Math.max(0.1, Math.min(maxScale, logoScaleRaw));
                const logoSize = Math.max(12, Math.round(qrSide * logoScale));

                const logoBuf = await this._resolveImageBuffer(element.logoSrc);
                if (logoBuf && logoBuf.length) {
                  const pad = Math.max(4, Math.round(logoSize * 0.12));
                  const boxSize = Math.min(qrSide, logoSize + pad * 2);

                  let bgBox = null;
                  if (bgEnabled) {
                    const bg = (typeof element.logoBgColor === 'string' && element.logoBgColor.trim())
                      ? element.logoBgColor.trim()
                      : '#ffffff';
                    const { r, g, b } = this._parseHexColor(bg, { r: 255, g: 255, b: 255 });
                    bgBox = await sharp({
                      create: {
                        width: boxSize,
                        height: boxSize,
                        channels: 4,
                        background: { r, g, b, alpha: 1 }
                      }
                    }).png().toBuffer();
                  }

                  const resizedLogo = await sharp(logoBuf)
                    .resize(logoSize, logoSize, {
                      fit: 'contain',
                      withoutEnlargement: true,
                      background: { r: 255, g: 255, b: 255, alpha: 0 }
                    })
                    .png()
                    .toBuffer();

                  const composites = [];
                  if (bgBox) composites.push({ input: bgBox, gravity: 'center' });
                  let logoOpacity = 1;
                  if (!bgEnabled) {
                    // Auto reduce opacity for very large transparent logos to preserve QR scannability.
                    // 0.20 -> 1.00, 0.60 -> 0.25 (linear clamp)
                    const t = Math.max(0, Math.min(1, (logoScale - 0.20) / 0.40));
                    logoOpacity = Math.max(0.25, 1 - 0.75 * t);
                  }
                  composites.push({ input: resizedLogo, gravity: 'center', opacity: logoOpacity });
                  qrBuffer = await sharp(qrBuffer).composite(composites).png().toBuffer();
                }

                const dataUrl = `data:image/png;base64,${qrBuffer.toString('base64')}`;
                html += `<img src="${dataUrl}" style="${styles.join('; ')}" />`;
              }
            }
          }
        }

        html += `</div>`;
        html += `</div>`;
      }
    }

    html += `
      </body>
      </html>
    `;

    return html;
  }

  async createPDFFromTemplate(template, participant) {
    return this.createPDF(template, participant);
  }

  // generateHTMLFromTemplateSingle method for single certificates is now handled by the bulk method
  // This method is kept for backward compatibility but delegates to the main method
  generateHTMLFromTemplateSingle(template, participant, localFontsCSS = '') {
    // Convert single participant to array format and call bulk method
    const participants = Array.isArray(participant) ? participant : [participant];
    return this.generateHTMLFromTemplate(template, participants, localFontsCSS);
  }

  /** Replace {placeholders} in text using participant data. */
  replacePlaceholders(text, participantData) {
    let result = text;

    // Replace placeholders like {nama}, {instansi}, etc.
    const data = (participantData && typeof participantData === 'object') ? participantData : {};
    for (const [key, value] of Object.entries(data)) {
      const placeholder = `{${key}}`;
      const v = (value ?? '').toString();
      // Escape the placeholder for regex to handle special characters
      const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(escapedPlaceholder, 'g'), v);
    }

    return result;
  }
}

module.exports = new PuppeteerPDFService();

// --------------- Helper methods for local Google Fonts caching ---------------
// Add methods on the prototype to keep class layout intact
PuppeteerPDFService.prototype.prepareLocalFonts = async function (template) {
  try {
    const { googleFonts, families } = this._buildGoogleFontsQuery(template);
    if (!googleFonts.length) return '';

    // Build a stable key for the requested font families/variants so we can cache processed CSS
    const queryKey = googleFonts.slice().sort().join('|');
    const hash = crypto.createHash('md5').update(queryKey).digest('hex');
    const fontsRoot = path.join(__dirname, '..', 'fonts');
    const cacheCssPath = path.join(fontsRoot, `cache_${hash}.css`);

    // If another request is already preparing the exact same font set, await it.
    // This prevents duplicated downloads / writes when concurrent PDF generation happens.
    try {
      if (this._fontsCssInFlight && this._fontsCssInFlight.has(hash)) {
        return await this._fontsCssInFlight.get(hash);
      }
    } catch (_) { /* ignore */ }

    const inFlight = (async () => {

    try {
      // If cached CSS exists, return it immediately (fast path)
      if (fsSync.existsSync(cacheCssPath)) {
        const cached = await fs.readFile(cacheCssPath, 'utf8');
        if (cached && cached.length > 0) {
          return cached;
        }
      }
    } catch (_) { /* ignore cache read errors */ }

    // Build primary query (may contain weights/ital variants)
    let fontsQuery = googleFonts.join('&family=');
    let cssUrl = `https://fonts.googleapis.com/css2?family=${fontsQuery}&display=swap`;
    let cssText;
    try {
      cssText = await this._fetchText(cssUrl, {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
      });
    } catch (primaryErr) {
      // Fallback: request default family without variant axes (avoids 400 for families like 'Indie Flower')
      const simpleFamilies = families.map(f => f.replace(/\s+/g, '+')).join('&family=');
      const simpleUrl = `https://fonts.googleapis.com/css2?family=${simpleFamilies}&display=swap`;
      cssText = await this._fetchText(simpleUrl, {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
      });
    }

    // Ensure fonts directory exists
    await fs.mkdir(fontsRoot, { recursive: true });

    // Find all font URLs in CSS (woff2 preferred)
    const urlRegex = /url\(([^)]+)\)\s*format\(['"]woff2['"]\)/g;
    let match;
    const replacements = [];
    const downloadTasks = [];

    while ((match = urlRegex.exec(cssText)) !== null) {
      let fontUrl = match[1].replace(/['"]/g, '');
      try {
        // Determine family dir from URL if possible, fallback to 'misc'
        const urlPath = new URL(fontUrl).pathname; // e.g., /s/roboto/v30/....woff2
        const parts = urlPath.split('/').filter(Boolean);
        const familySegment = parts.length >= 2 && parts[1] ? parts[1] : 'misc';
        const familyDir = this._sanitizeFamilyDir(familySegment);
        const fileName = path.basename(urlPath);
        const targetDir = path.join(fontsRoot, familyDir);
        await fs.mkdir(targetDir, { recursive: true });

        const localPath = path.join(targetDir, fileName);
        if (!fsSync.existsSync(localPath)) {
          downloadTasks.push({ url: fontUrl, destPath: localPath });
        }
        const localUrl = `http://localhost:${process.env.PORT || 3000}/api/fonts/${familyDir}/${fileName}`;
        replacements.push({ remote: fontUrl, local: localUrl });
      } catch (e) {
      }
    }

    // Download missing font files with limited concurrency to reduce total wall time
    if (downloadTasks.length) {
      const CONCURRENCY = 4;
      let i = 0;
      const worker = async () => {
        while (i < downloadTasks.length) {
          const idx = i++;
          const task = downloadTasks[idx];
          if (!task) continue;
          try {
            if (!fsSync.existsSync(task.destPath)) {
              await this._downloadFile(task.url, task.destPath);
            }
          } catch (_) {
            // ignore individual font download errors
          }
        }
      };
      const workers = Array.from({ length: Math.min(CONCURRENCY, downloadTasks.length) }, () => worker());
      await Promise.all(workers);
    }

    // Replace remote URLs with local URLs
    let localCss = cssText;
    for (const r of replacements) {
      const pattern = new RegExp(r.remote.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      localCss = localCss.replace(pattern, r.local);
    }

    // Ensure fast rendering: add font-display: swap to each @font-face if missing
    try {
      localCss = localCss.replace(/@font-face\s*{[^}]*}/g, (block) => {
        if (/font-display\s*:/i.test(block)) return block;
        return block.replace(/}\s*$/, '  font-display: swap;\n}');
      });
    } catch (_) { /* noop */ }

    // Persist processed CSS to cache for subsequent requests
    try {
      await fs.writeFile(cacheCssPath, localCss, 'utf8');
    } catch (_) { /* ignore write errors */ }

    return localCss;
    })();

    if (this._fontsCssInFlight) {
      this._fontsCssInFlight.set(hash, inFlight);
    }

    try {
      return await inFlight;
    } finally {
      try {
        if (this._fontsCssInFlight) this._fontsCssInFlight.delete(hash);
      } catch (_) { /* ignore */ }
    }
  } catch (e) {
    return '';
  }
};

PuppeteerPDFService.prototype._buildGoogleFontsQuery = function (template) {
  const families = new Set();
  const systemFonts = [
    'Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Courier New',
    'Verdana', 'Tahoma', 'Trebuchet MS', 'Segoe UI', 'Calibri', 'Cambria',
    'Garamond', 'Lucida Console', 'Monaco', 'Comic Sans MS', 'Impact',
    'Palatino', 'Bookman', 'Avant Garde', 'Century Gothic', 'Franklin Gothic Medium',
    'Brush Script MT', 'System UI', 'sans-serif', 'serif', 'monospace'
  ];

  const getAllTextObjects = () => {
    const pages = template?.design?.pages;
    if (Array.isArray(pages) && pages.length > 0) {
      return pages.flatMap(p => (Array.isArray(p?.objects) ? p.objects : []));
    }
    return Array.isArray(template?.design?.objects) ? template.design.objects : [];
  };

  // Collect font families
  const allObjects = getAllTextObjects();
  if (allObjects.length) {
    for (const el of allObjects) {
      if (el.type === 'text' && el.fontFamily) {
        let fam = el.fontFamily.replace(/['"]/g, '').trim();

        // Brush Script MT is usually not available in headless/server environments.
        // Use a consistent Google Font alternative.
        if (fam === 'Brush Script MT') {
          fam = 'Pacifico';
        }

        if (fam && !systemFonts.includes(fam)) {
          families.add(fam);
        }
      }
    }
  }

  // If no custom fonts found, return empty
  if (families.size === 0) {
    return { googleFonts: [], families: [] };
  }

  // For each font family, collect all required weights and styles
  const fontVariants = new Map();

  // Initialize font variants map
  for (const fam of families) {
    fontVariants.set(fam, {
      weights: new Set(),
      hasItalic: false
    });
  }

  // Process all text elements to collect font variants
  if (allObjects.length) {
    for (const el of allObjects) {
      if (el.type === 'text' && el.fontFamily) {
        let fam = el.fontFamily.replace(/['"]/g, '').trim();
        if (fam === 'Brush Script MT') {
          fam = 'Pacifico';
        }
        if (!families.has(fam)) continue;

        const variant = fontVariants.get(fam);

        // Determine weight (default to 400 if not specified)
        let weight = '400';
        if (el.fontWeight === 'bold' || el.fontWeight === '700') weight = '700';
        else if (el.fontWeight === '600') weight = '600';
        else if (el.fontWeight === '500') weight = '500';
        else if (el.fontWeight === '300') weight = '300';

        variant.weights.add(weight);

        // Check for italic
        if (el.fontStyle === 'italic') {
          variant.hasItalic = true;
        }
      }
    }
  }

  // Build Google Fonts API query
  const googleFonts = [];

  for (const [fontName, variant] of fontVariants) {
    const weights = Array.from(variant.weights);

    // If no specific weights found, use a default
    if (weights.length === 0) {
      weights.push('400');
    }

    // Sort weights for consistent URL generation
    weights.sort();

    // Build the font specifier for Google Fonts API
    const googleName = fontName.replace(/\s+/g, '+');
    let fontSpec = googleName;

    // Use a simpler format without :ital,wght@
    const variants = [];

    // Add regular variants
    variants.push(weights.join(','));

    // Add italic variants if needed
    if (variant.hasItalic) {
      variants.push(weights.map(w => `${w}i`).join(','));
    }

    if (variants.length > 0) {
      fontSpec += `:${variants.join(',')}`;
    }

    googleFonts.push(fontSpec);
  }

  return {
    googleFonts,
    families: Array.from(families)
  };
};

PuppeteerPDFService.prototype._fetchText = function (url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, res => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // follow redirect
        return resolve(this._fetchText(res.headers.location, headers));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
  });
};

PuppeteerPDFService.prototype._downloadFile = function (url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fsSync.createWriteStream(destPath);
    https.get(url, res => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // follow redirect
        https.get(res.headers.location, r2 => {
          if (r2.statusCode !== 200) return reject(new Error(`HTTP ${r2.statusCode} downloading ${url}`));
          r2.pipe(file);
          file.on('finish', () => file.close(resolve));
          r2.on('error', reject);
        }).on('error', reject);
        return;
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} downloading ${url}`));
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
      res.on('error', reject);
    }).on('error', reject);
  });
};

PuppeteerPDFService.prototype._sanitizeFamilyDir = function (segment) {
  return segment.toLowerCase().replace(/[^a-z0-9-_]/g, '_');
};
