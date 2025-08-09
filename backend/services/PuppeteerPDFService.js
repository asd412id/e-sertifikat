const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
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

        // Handle local upload files
        if (url.startsWith(`http://localhost:${process.env.PORT}/uploads/`)) {
          const fileName = url.replace(`http://localhost:${process.env.PORT}/uploads/`, '');
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

      // Create HTML content for all certificates
      const htmlContent = this.generateBulkHTMLFromTemplate(template, participants);

      // Set content and wait for it to load
      await page.setContent(htmlContent, {
        waitUntil: 'domcontentloaded', // Faster; we manually manage font loading below
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
        const MAX_WAIT = 8000; // 8s cap
        const start = Date.now();
        return new Promise((resolve) => {
          if (!document.fonts) return setTimeout(resolve, 1500);
          const check = () => {
            const pending = Array.from(document.fonts).filter(f => f.status !== 'loaded');
            if (!pending.length || Date.now() - start > MAX_WAIT) {
              requestAnimationFrame(() => resolve());
            } else {
              setTimeout(check, 250);
            }
          };
          if (document.fonts.status === 'loaded') {
            return resolve();
          }
          document.fonts.ready.finally(check);
          setTimeout(check, 250);
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

  generateBulkHTMLFromTemplate(template, participants) {
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

    // System/Web-safe fonts that don't need remote fetching
    const systemFonts = [
      'Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Courier New',
      'Verdana', 'Tahoma', 'Trebuchet MS', 'Segoe UI', 'Calibri', 'Cambria',
      'Garamond', 'Lucida Console', 'Monaco', 'Comic Sans MS', 'Impact',
      'Palatino', 'Bookman', 'Avant Garde', 'Century Gothic', 'Franklin Gothic Medium'
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

    // Process each font family used in the template
    for (const fontFamily of fontFamilies) {
      const cleanFontFamily = fontFamily.replace(/['"]/g, '').trim();

      if (!cleanFontFamily) continue;

      // Check if this is a Google Font
      if (!systemFonts.includes(cleanFontFamily)) {
        dynamicGoogleFonts.add(cleanFontFamily);
        let googleFontName = cleanFontFamily.replace(/\s+/g, '+');

        // Collect all font weights and styles used for this font
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

        googleFonts.push(`${googleFontName}:ital,wght@${weightString}`);
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
        // Convert to absolute path for Puppeteer
        backgroundUrl = `http://localhost:${process.env.PORT}${backgroundUrl}`;
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

        // Handle local upload files
        if (url.startsWith(`http://localhost:${process.env.PORT}/uploads/`)) {
          const fileName = url.replace(`http://localhost:${process.env.PORT}/uploads/`, '');
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

      // Create HTML content for the certificate
      const htmlContent = this.generateHTMLFromTemplate(template, participant);

      // Set content and wait for it to load
      await page.setContent(htmlContent, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      // Explicitly load all fonts before proceeding
      await page.evaluate(() => {
        const MAX_WAIT = 6000; // 6s cap
        const start = Date.now();
        return new Promise(resolve => {
          if (!document.fonts) return setTimeout(resolve, 1200);
          const check = () => {
            const pending = Array.from(document.fonts).filter(f => f.status !== 'loaded');
            if (!pending.length || Date.now() - start > MAX_WAIT) {
              requestAnimationFrame(resolve);
            } else {
              setTimeout(check, 200);
            }
          };
          if (document.fonts.status === 'loaded') return resolve();
          document.fonts.ready.finally(check);
          setTimeout(check, 200);
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

      // If fonts are not loaded properly, try to force a reload
      if (fontVerification.some(result => !result.isFontLoaded || !result.isFontApplied)) {
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

  generateHTMLFromTemplate(template, participant) {
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
    const fontWeights = new Set();

    // System/Web-safe fonts that don't need remote fetching
    const systemFonts = [
      'Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Courier New',
      'Verdana', 'Tahoma', 'Trebuchet MS', 'Segoe UI', 'Calibri', 'Cambria',
      'Garamond', 'Lucida Console', 'Monaco', 'Comic Sans MS', 'Impact',
      'Palatino', 'Bookman', 'Avant Garde', 'Century Gothic', 'Franklin Gothic Medium'
    ];
    // Dynamic Google fonts list
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

        googleFonts.push(`${googleFontName}:ital,wght@${weightString}`);
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
        // Convert to absolute path for Puppeteer
        backgroundUrl = `http://localhost:${process.env.PORT}${backgroundUrl}`;
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
