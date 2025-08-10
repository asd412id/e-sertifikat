const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const https = require('https');
// Removed unused locale import

class PuppeteerPDFService {
  constructor() {
    this.browser = null;
    this.initializationPromise = null; // To prevent multiple browser initializations
  }

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
    this.initializationPromise = puppeteer.launch({
      headless: true,
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

  async createBulkPDFFromTemplate(template, participants) {
    let page = null;
    try {
      await this.initialize();
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
        if (url.startsWith(`http://localhost:${port}/uploads/`) || url.startsWith(`http://localhost:${port}/api/uploads/`)) {
          const fileName = url.startsWith(`http://localhost:${port}/api/uploads/`)
            ? url.replace(`http://localhost:${port}/api/uploads/`, '')
            : url.replace(`http://localhost:${port}/uploads/`, '');
          const filePath = path.join(process.env.UPLOAD_DIR || './uploads', fileName);

          try {
            // Check if file exists
            if (fsSync.existsSync(filePath)) {
              const data = fsSync.readFileSync(filePath);
              const extension = path.extname(filePath).toLowerCase();
              let contentType = 'application/octet-stream';

              if (extension === '.png') {
                contentType = 'image/png';
              } else if (extension === '.jpg' || extension === '.jpeg') {
                contentType = 'image/jpeg';
              }

              request.respond({
                status: 200,
                contentType: contentType,
                headers: {
                  'Cache-Control': 'public, max-age=31536000'
                },
                body: data
              });
            } else {
              request.continue();
            }
          } catch (error) {
            console.error('Error reading file:', error);
            request.continue();
          }
        } else {
          request.continue();
        }
      });

      console.log(`Starting bulk PDF generation for ${participants.length} participants`);

      // Log font information for debugging
      if (template.design && template.design.objects) {
        const fontsUsed = new Set();
        template.design.objects.forEach(element => {
          if (element.type === 'text' && element.fontFamily) {
            fontsUsed.add(element.fontFamily);
          }
        });
        console.log('Fonts used in template:', Array.from(fontsUsed));
      }

      // Prepare local fonts CSS (download Google Fonts to local server)
      const localFontsCSS = await this.prepareLocalFonts(template);

      // Create HTML content for all certificates
      const htmlContent = this.generateBulkHTMLFromTemplate(template, participants, localFontsCSS);

      // Set content and wait for minimal readiness; fonts handled below
      await page.setContent(htmlContent, {
        waitUntil: 'domcontentloaded',
        timeout: 45000
      });

      // Set viewport to match template dimensions for better rendering
      await page.setViewport({
        width: template.width,
        height: template.height,
        deviceScaleFactor: 1
      });

      // Explicitly load all fonts before proceeding
      await page.evaluate(() => {
        const MAX_WAIT = 6000; // cap to keep flow fast; fonts use font-display:swap
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
      });

      // Force a reflow to ensure fonts are properly applied
      await page.evaluate(() => {
        document.body.offsetHeight;
      });

      console.log('Generating bulk PDF...');

      // Generate PDF with optimized settings for bulk
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

      console.log(`Bulk PDF generated successfully for ${participants.length} participants`);
      return pdfBuffer;
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
    }
  }

  generateBulkHTMLFromTemplate(template, participants, localFontsCSS = '') {
    // Collect all unique font families used in the template
    const fontFamilies = new Set();
    if (template.design && template.design.objects) {
      for (const element of template.design.objects) {
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

    // Add Google Fonts import to HTML
    if (googleFonts.length > 0) {
      const fontsQuery = googleFonts.join('&family=');
      googleFontsImport = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=${fontsQuery}&display=swap" rel="stylesheet">`;
      console.log(`Google Fonts import URL: https://fonts.googleapis.com/css2?family=${fontsQuery}&display=swap`);
    }

    // Preload background image if exists to accelerate first paint
    let backgroundPreloadLink = '';
    if (template.design && template.design.background) {
      let preloadUrl = template.design.background;
      if (preloadUrl.startsWith('/uploads/')) {
        const port = process.env.PORT || 3000;
        preloadUrl = `http://localhost:${port}/api${preloadUrl}`;
      }
      backgroundPreloadLink = `<link rel="preload" as="image" href="${preloadUrl}">`;
    }

    // Start building HTML
    let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
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

    // Add background image if it exists
    if (template.design && template.design.background) {
      // Handle local background images
      let backgroundUrl = template.design.background;
      if (backgroundUrl.startsWith('/uploads/')) {
        // Convert to absolute path for Puppeteer with correct API prefix
        const port = process.env.PORT || 3000;
        // Ensure we hit the Fastify static route: /api/uploads/
        backgroundUrl = `http://localhost:${port}/api${backgroundUrl}`; // becomes /api/uploads/...
      }

      html += `
        .certificate-container {
          background-image: url('${backgroundUrl}');
          background-size: ${template.width}px ${template.height}px;
          background-position: 0 0;
          background-repeat: no-repeat;
        }
      `;
    }

    html += `
      </style>
    </head>
    <body>
    `;

    // Generate a page for each participant
    participants.forEach((participant, index) => {
      html += `<div class="certificate-page">`;
      html += `<div class="certificate-container">`;

      // Add elements for this participant
      if (template.design && template.design.objects) {
        for (const element of template.design.objects) {
          if (element.type === 'text') {
            let text = element.text || '';

            // Replace dynamic placeholders with participant data
            if (text.includes('{')) {
              text = this.replacePlaceholders(text, participant.data);
            }

            // Create text element styles
            const styles = [];
            if (element.fontSize) styles.push(`font-size: ${element.fontSize}px`);

            // Apply font family with fallbacks
            if (element.fontFamily) {
              const cleanFontFamily = element.fontFamily.replace(/['"]/g, '').trim();

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

            // Position styles
            styles.push('position: absolute');
            let baseX = element.x || 0;
            let baseY = element.y || 0;
            let width = element.width || 200;
            if (width > template.width) width = template.width;
            styles.push(`left: ${baseX}px`);
            styles.push(`top: ${baseY}px`);
            styles.push(`width: ${width}px`);
            let height = (element.fontSize ? element.fontSize * 1.3 : 32);
            styles.push(`height: ${height}px`);

            // Text alignment
            if (element.align) {
              styles.push(`text-align: ${element.align}`);
            }

            // Vertical alignment
            if (element.verticalAlign === 'middle' || element.verticalAlign === 'bottom') {
              styles.push('display: flex');
              styles.push('flex-direction: column');
              if (element.verticalAlign === 'middle') {
                styles.push('justify-content: center');
              } else if (element.verticalAlign === 'bottom') {
                styles.push('justify-content: flex-end');
              }
              if (element.align === 'right') {
                styles.push('align-items: flex-end');
              } else if (element.align === 'center') {
                styles.push('align-items: center');
              } else {
                styles.push('align-items: flex-start');
              }
            } else {
              if (element.fontSize) {
                styles.push(`line-height: 1.35rem`);
              }
            }

            styles.push('overflow: visible');
            styles.push('white-space: pre');

            html += `<div style="${styles.join('; ')}">${text}</div>`;
          }
        }
      }

      html += `</div>`;
      html += `</div>`;
    });

    html += `
    </body>
    </html>
    `;

    console.log(`Generated bulk HTML with ${participants.length} pages and Google Fonts:`, googleFonts);
    return html;
  }

  async createPDFFromTemplate(template, participant) {
    let page = null;
    try {
      await this.initialize();
      page = await this.browser.newPage();
      await page.setCacheEnabled(true);

      // Set a longer timeout for page operations
      page.setDefaultTimeout(45000); // faster fail

      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36');
      // Enable local file access
      await page.setRequestInterception(true);

      page.on('request', (request) => {
        const url = request.url();
        const port = process.env.PORT || 3000;

        // Handle local upload files (support both legacy /uploads and current /api/uploads)
        if (url.startsWith(`http://localhost:${port}/uploads/`) || 
            url.startsWith(`http://localhost:${port}/api/uploads/`)) {
          const fileName = url.startsWith(`http://localhost:${port}/api/uploads/`)
            ? url.replace(`http://localhost:${port}/api/uploads/`, '')
            : url.replace(`http://localhost:${port}/uploads/`, '');
          const filePath = path.join(process.env.UPLOAD_DIR || './uploads', fileName);

          try {
            // Check if file exists
            if (fsSync.existsSync(filePath)) {
              const data = fsSync.readFileSync(filePath);
              const extension = path.extname(filePath).toLowerCase();
              let contentType = 'application/octet-stream';

              if (extension === '.png') {
                contentType = 'image/png';
              } else if (extension === '.jpg' || extension === '.jpeg') {
                contentType = 'image/jpeg';
              }

              request.respond({
                status: 200,
                contentType: contentType,
                body: data
              });
            } else {
              request.continue();
            }
          } catch (error) {
            console.error('Error reading file:', error);
            request.continue();
          }
        } else {
          request.continue();
        }
      });

      // Log font information for debugging
      if (template.design && template.design.objects) {
        const fontsUsed = new Set();
        template.design.objects.forEach(element => {
          if (element.type === 'text' && element.fontFamily) {
            fontsUsed.add(element.fontFamily);
          }
        });
        console.log('Fonts used in template:', Array.from(fontsUsed));
      }

      // Prepare local fonts CSS (download Google Fonts to local server)
      const localFontsCSS = await this.prepareLocalFonts(template);

      // Create HTML content for the certificate
      const htmlContent = this.generateHTMLFromTemplate(template, participant, localFontsCSS);

      // Set content and wait for it to load
      await page.setContent(htmlContent, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      // Explicitly load all fonts before proceeding
      await page.evaluate(() => {
        const MAX_WAIT = 10000; // Increased to 10s cap
        const start = Date.now();
        return new Promise(resolve => {
          if (!document.fonts) return setTimeout(resolve, 1500);
          const check = () => {
            const pending = Array.from(document.fonts).filter(f => f.status !== 'loaded');
            if (!pending.length || Date.now() - start > MAX_WAIT) {
              requestAnimationFrame(resolve);
            } else {
              setTimeout(check, 500); // Increased check interval
            }
          };
          if (document.fonts.status === 'loaded') {
            return resolve();
          }
          document.fonts.ready.finally(check);
          setTimeout(check, 500);
        });
      });

      // Force a reflow to ensure fonts are properly applied
      await page.evaluate(() => {
        document.body.offsetHeight;
      });

      // Check for font loading errors
      const fontErrors = await page.evaluate(() => {
        const errors = [];
        if (document.fonts) {
          document.fonts.forEach((font) => {
            if (font.status === 'error') {
              errors.push({
                family: font.family,
                style: font.style,
                weight: font.weight,
                status: font.status
              });
            }
          });
        }
        return errors;
      });

      if (fontErrors.length > 0) {
        console.warn('Font loading errors detected:', fontErrors);
      }

      // Additional check: verify that text elements are using the correct fonts
      const fontVerification = await page.evaluate(() => {
        const results = [];
        const textElements = document.querySelectorAll('div[style*="font-family"]');

        textElements.forEach((element, index) => {
          const computedStyle = window.getComputedStyle(element);
          const fontFamily = computedStyle.fontFamily;
          const fontSize = computedStyle.fontSize;

          // Extract the first font name from the font-family string
          const firstFont = fontFamily.split(',')[0].replace(/['"]/g, '').trim();

          // Check if the font family is loaded - check against the first font in the fallback list
          let isFontLoaded = false;
          if (document.fonts) {
            isFontLoaded = Array.from(document.fonts).some(font => {
              // Compare font family names (remove quotes and trim)
              const fontName = font.family.replace(/['"]/g, '').trim();
              return fontName === firstFont && font.status === 'loaded';
            });
          }

          // Also check if the font is actually being used by comparing the computed font
          const actualFont = computedStyle.fontFamily;
          const isFontApplied = actualFont.includes(firstFont);

          // Check if the font is being rendered correctly by measuring text width
          // This is a more reliable way to check if a font is actually applied
          const testElement = document.createElement('span');
          testElement.style.fontFamily = fontFamily;
          testElement.style.fontSize = fontSize;
          testElement.style.position = 'absolute';
          testElement.style.left = '-9999px';
          testElement.style.visibility = 'hidden';
          testElement.textContent = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
          document.body.appendChild(testElement);

          const testWidth = testElement.offsetWidth;
          document.body.removeChild(testElement);

          // Compare with a fallback font
          const fallbackElement = document.createElement('span');
          fallbackElement.style.fontFamily = 'Arial, sans-serif';
          fallbackElement.style.fontSize = fontSize;
          fallbackElement.style.position = 'absolute';
          fallbackElement.style.left = '-9999px';
          fallbackElement.style.visibility = 'hidden';
          fallbackElement.textContent = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
          document.body.appendChild(fallbackElement);

          const fallbackWidth = fallbackElement.offsetWidth;
          document.body.removeChild(fallbackElement);

          // If the widths are different by more than 2px, the font is likely being applied
          const isFontRendering = Math.abs(testWidth - fallbackWidth) > 2;

          results.push({
            element: index,
            fontFamily: fontFamily,
            firstFont: firstFont,
            fontSize: fontSize,
            isFontLoaded: isFontLoaded,
            isFontApplied: isFontApplied,
            isFontRendering: isFontRendering,
            testWidth: testWidth,
            fallbackWidth: fallbackWidth,
            text: element.textContent.substring(0, 50) + '...'
          });
        });

        return results;
      });

      console.log('Font verification results:', fontVerification);

      // If fonts are not loaded properly (excluding system fonts), try to force a reload
      const systemFonts = [
        'Arial','Helvetica','Times New Roman','Georgia','Courier New',
        'Verdana','Tahoma','Trebuchet MS','Segoe UI','Calibri','Cambria',
        'Garamond','Lucida Console','Monaco','Comic Sans MS','Impact',
        'Palatino','Bookman','Avant Garde','Century Gothic','Franklin Gothic Medium',
        'Brush Script MT'
      ];
      const needReload = fontVerification.some(result => (!result.isFontLoaded || !result.isFontApplied) && !systemFonts.includes(result.firstFont));
      if (needReload) {
        console.log('Some fonts failed to load or apply, attempting to force reload...');
        await page.evaluate(() => {
          // Force a style recalculation
          document.body.style.display = 'none';
          document.body.offsetHeight;
          document.body.style.display = '';
        });

        // Wait a bit more for fonts to load
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Generate PDF with optimized settings
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
        preferCSSPageSize: true
      });

      return pdfBuffer;
    } catch (error) {
      console.error('Error generating PDF:', error);
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
    }
  }

  generateHTMLFromTemplate(template, participant, localFontsCSS = '') {
    // Define system fonts and CSS font-family mapping (keep in sync with bulk generator)
    const systemFonts = [
      'Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Courier New',
      'Verdana', 'Tahoma', 'Trebuchet MS', 'Segoe UI', 'Calibri', 'Cambria',
      'Garamond', 'Lucida Console', 'Monaco', 'Comic Sans MS', 'Impact',
      'Palatino', 'Bookman', 'Avant Garde', 'Century Gothic', 'Franklin Gothic Medium'
    ];
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
      'Pacifico': "'Pacifico', cursive",
      'Lobster': "'Lobster', sans-serif"
    };
    // Collect all unique font families used in the template
    const fontFamilies = new Set();
    if (template.design && template.design.objects) {
      for (const element of template.design.objects) {
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
    const googleFonts = [];
    // Dynamic Google fonts list
    const dynamicGoogleFonts = new Set();

    // Process each font family used in the template
    for (const fontFamily of fontFamilies) {
      // Clean up font family name - remove quotes and extra spaces
      const cleanFontFamily = fontFamily.replace(/['"]/g, '').trim();

      if (!cleanFontFamily) continue;

      // Check if this is a Google Font
      if (!systemFonts.includes(cleanFontFamily)) {
        dynamicGoogleFonts.add(cleanFontFamily);
        // Convert font name to Google Fonts format
        let googleFontName = cleanFontFamily.replace(/\s+/g, '+');

        // Collect all font weights used for this font
        const weights = [];
        const styles = [];
        if (template.design && template.design.objects) {
          for (const element of template.design.objects) {
            if (element.type === 'text' && element.fontFamily === cleanFontFamily) {
              // Handle font weight
              if (element.fontWeight === 'bold' || element.fontWeight === '700') {
                weights.push('700');
              } else if (element.fontWeight === '600') {
                weights.push('600');
              } else if (element.fontWeight === '500') {
                weights.push('500');
              } else if (element.fontWeight === '300') {
                weights.push('300');
              } else {
                weights.push('400');
              }

              // Handle font style
              if (element.fontStyle === 'italic') {
                styles.push('italic');
              }
            }
          }
        }

        // Get unique weights and styles
        const uniqueWeights = [...new Set(weights)].sort();
        const hasItalic = styles.includes('italic');

        // Build weight string with italic support
        let weightString = uniqueWeights.length > 0 ? uniqueWeights.join(';') : '400';
        if (hasItalic) {
          // Add italic versions of each weight
          const italicWeights = uniqueWeights.map(w => `1,${w}`);
          weightString = `0,${weightString};${italicWeights.join(';')}`;
        } else {
          weightString = `0,${weightString}`;
        }

        googleFonts.push(`${googleFontName}:wght@${weightString}`);
        console.log(`Added Google Font: ${googleFontName} with weights: ${weightString}`);
      } else {
        console.log(`Skipping system font: ${cleanFontFamily}`);
      }
    }

    // Add Google Fonts import to HTML
    if (googleFonts.length > 0) {
      const fontsQuery = googleFonts.join('&family=');
      googleFontsImport = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=${fontsQuery}&display=swap" rel="stylesheet">`;
      console.log(`Google Fonts import URL: https://fonts.googleapis.com/css2?family=${fontsQuery}&display=swap`);
    }

    // Start building HTML
    let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      ${googleFontsImport}
      <style>
      ${localFontsCSS}
      </style>
      <style>
        @page {
          size: ${template.width}px ${template.height}px;
          margin: 0;
        }
        body {
          margin: 0;
          padding: 0;
          width: ${template.width}px;
          height: ${template.height}px;
          position: relative;
          font-family: Arial, sans-serif;
        }
        .certificate-container {
          width: 100%;
          height: 100%;
          position: relative;
        }
    `;

    // Add background image if it exists
    if (template.design && template.design.background) {
      // Handle local background images
      let backgroundUrl = template.design.background;
      if (backgroundUrl.startsWith('/uploads/')) {
        // Convert to absolute path for Puppeteer with correct API prefix
        const port = process.env.PORT || 3000;
        // Ensure we hit the Fastify static route: /api/uploads/
        backgroundUrl = `http://localhost:${port}/api${backgroundUrl}`; // becomes /api/uploads/...
      }

      html += `
        .certificate-container {
          background-image: url('${backgroundUrl}');
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
        }
      `;
    }

    html += `
      </style>
    </head>
    <body>
      <div class="certificate-container">
    `;

    // Add elements
    if (template.design && template.design.objects) {
      for (const element of template.design.objects) {
        if (element.type === 'text') {
          let text = element.text || '';

          // Replace dynamic placeholders with participant data
          if (text.includes('{')) {
            text = this.replacePlaceholders(text, participant.data);
          }

          // Create text element styles
          const styles = [];
          if (element.fontSize) styles.push(`font-size: ${element.fontSize}px`);

          // Apply font family with fallbacks
          if (element.fontFamily) {
            const cleanFontFamily = element.fontFamily.replace(/['"]/g, '').trim();

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

          // Position styles - always use the element's x,y coordinates as base
          styles.push('position: absolute');
          // Set base position and dimensions
          let baseX = element.x || 0;
          let baseY = element.y || 0;
          let width = element.width || 200;
          // Clamp width to template width
          if (width > template.width) width = template.width;
          styles.push(`left: ${baseX}px`);
          styles.push(`top: ${baseY}px`);
          styles.push(`width: ${width}px`);
          // Set height for vertical alignment (use fontSize * 1.3 for line height)
          let height = (element.fontSize ? element.fontSize * 1.3 : 32);
          styles.push(`height: ${height}px`);
          // Text alignment in bounding box
          if (element.align) {
            styles.push(`text-align: ${element.align}`);
          }
          // Vertical alignment: only use flex for middle/bottom, not for top
          if (element.verticalAlign === 'middle' || element.verticalAlign === 'bottom') {
            styles.push('display: flex');
            styles.push('flex-direction: column');
            // Set justify-content for vertical alignment within the bounding box
            if (element.verticalAlign === 'middle') {
              styles.push('justify-content: center');
            } else if (element.verticalAlign === 'bottom') {
              styles.push('justify-content: flex-end');
            }
            // Set align-items for horizontal alignment within the bounding box
            if (element.align === 'right') {
              styles.push('align-items: flex-end');
            } else if (element.align === 'center') {
              styles.push('align-items: center');
            } else {
              styles.push('align-items: flex-start');
            }
          } else {
            // For top alignment, use block layout and set line-height to match font size for perfect top alignment
            if (element.fontSize) {
              styles.push(`line-height: 1.35rem`);
            }
          }
          // Prevent text wrapping
          styles.push('overflow: visible');
          styles.push('white-space: pre');

          html += `<div style="${styles.join('; ')}">${text}</div>`;
        }
      }
    }

    html += `
      </div>
    </body>
    </html>
    `;

    console.log('Generated HTML with Google Fonts:', googleFonts);
    return html;
  }

  replacePlaceholders(text, participantData) {
    let result = text;

    // Replace placeholders like {nama}, {instansi}, etc.
    for (const [key, value] of Object.entries(participantData)) {
      const placeholder = `{${key}}`;
      result = result.replace(new RegExp(placeholder, 'g'), value || '');
    }

    return result;
  }
}

module.exports = new PuppeteerPDFService();

// --------------- Helper methods for local Google Fonts caching ---------------
// Add methods on the prototype to keep class layout intact
PuppeteerPDFService.prototype.prepareLocalFonts = async function(template) {
  try {
    const { googleFonts, families } = this._buildGoogleFontsQuery(template);
    if (!googleFonts.length) return '';

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
      console.warn('Primary Google Fonts CSS fetch failed, retrying simplified URL:', primaryErr.message);
      console.log('Retry Google Fonts import URL:', simpleUrl);
      cssText = await this._fetchText(simpleUrl, {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
      });
    }

    // Ensure fonts directory exists
    const fontsRoot = path.join(__dirname, '..', 'fonts');
    await fs.mkdir(fontsRoot, { recursive: true });

    // Find all font URLs in CSS (woff2 preferred)
    const urlRegex = /url\(([^)]+)\)\s*format\(['"]woff2['"]\)/g;
    let match;
    const replacements = [];

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
          await this._downloadFile(fontUrl, localPath);
        }
        const localUrl = `http://localhost:${process.env.PORT || 3000}/api/fonts/${familyDir}/${fileName}`;
        replacements.push({ remote: fontUrl, local: localUrl });
      } catch (e) {
        console.warn('Failed caching font URL:', fontUrl, e.message);
      }
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

    return localCss;
  } catch (e) {
    console.warn('prepareLocalFonts failed, falling back to remote Google Fonts:', e.message);
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

  // Collect font families
  if (template.design?.objects) {
    for (const el of template.design.objects) {
      if (el.type === 'text' && el.fontFamily) {
        const fam = el.fontFamily.replace(/['"]/g, '').trim();
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
  if (template.design?.objects) {
    for (const el of template.design.objects) {
      if (el.type === 'text' && el.fontFamily) {
        const fam = el.fontFamily.replace(/['"]/g, '').trim();
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

PuppeteerPDFService.prototype._fetchText = function(url, headers = {}) {
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

PuppeteerPDFService.prototype._downloadFile = function(url, destPath) {
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

PuppeteerPDFService.prototype._sanitizeFamilyDir = function(segment) {
  return segment.toLowerCase().replace(/[^a-z0-9-_]/g, '_');
};
