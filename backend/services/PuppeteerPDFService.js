const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { el } = require('date-fns/locale');

class PuppeteerPDFService {
  constructor() {
    this.browser = null;
  }

  async initialize() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async createPDFFromTemplate(template, participant) {
    try {
      await this.initialize();

      const page = await this.browser.newPage();

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

      // Create HTML content for the certificate
      const htmlContent = this.generateHTMLFromTemplate(template, participant);

      // Set content and wait for it to load
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

      // Generate PDF
      const pdfBuffer = await page.pdf({
        width: `${template.width}px`,
        height: `${template.height}px`,
        printBackground: true,
        margin: {
          top: 0,
          right: 0,
          bottom: 0,
          left: 0
        }
      });

      await page.close();
      return pdfBuffer;
    } catch (error) {
      throw error;
    }
  }

  generateHTMLFromTemplate(template, participant) {
    // Collect all unique font families used in the template
    const fontFamilies = new Set();
    if (template.design && template.design.objects) {
      for (const element of template.design.objects) {
        if (element.type === 'text' && element.fontFamily) {
          fontFamilies.add(element.fontFamily);
        }
      }
    }

    // Generate Google Fonts CSS import
    let googleFontsImport = '';
    const googleFonts = [];

    for (const fontFamily of fontFamilies) {
      // Skip standard fonts that don't need Google Fonts
      const standardFonts = [
        'Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Courier New',
        'Verdana', 'Tahoma', 'Trebuchet MS', 'Segoe UI', 'Calibri', 'Cambria',
        'Garamond', 'Lucida Console', 'Monaco', 'Comic Sans MS', 'Impact',
        'Palatino', 'Bookman', 'Avant Garde'
      ];

      if (!standardFonts.includes(fontFamily)) {
        // Convert font name to Google Fonts format (replace spaces with +)
        const googleFontName = fontFamily.replace(/\s+/g, '+');
        googleFonts.push(`${googleFontName}:wght@400;700`); // Include normal and bold weights
      }
    }

    if (googleFonts.length > 0) {
      googleFontsImport = `<link href="https://fonts.googleapis.com/css2?family=${googleFonts.join('&family=')}&display=swap" rel="stylesheet">`;
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
          if (element.fontFamily) styles.push(`font-family: '${element.fontFamily}', Arial, sans-serif`);
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
