const { chromium } = require('playwright');
class PlaywrightPDFService {
  constructor() { this.browserPromise = null; }
  async getBrowser() {
    if (!this.browserPromise) {
      this.browserPromise = chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"], headless: true });
    }
    return this.browserPromise;
  }
  buildHTML(template, participant) {
    const fontFamilies = new Set();
    if (template.design?.objects) {
      for (const el of template.design.objects) {
        if (el.type === 'text' && el.fontFamily) {
          fontFamilies.add(el.fontFamily.replace(/['"]/g, '').trim());
        }
      }
    }
    const systemFonts = ['Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Courier New', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Segoe UI', 'Calibri', 'Cambria', 'Garamond', 'Lucida Console', 'Monaco', 'Comic Sans MS', 'Impact', 'Palatino', 'Bookman', 'Avant Garde', 'Century Gothic', 'Franklin Gothic Medium'];
    const googleFonts = [];
    for (const f of fontFamilies) { if (f && !systemFonts.includes(f)) { googleFonts.push(f.replace(/\s+/g, '+')); } }
    let fontLinks = '';
    if (googleFonts.length) {
      const uniq = [...new Set(googleFonts)];
      fontLinks = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?${uniq.map(f => `family=${f}:wght@300;400;500;600;700`).join('&')}&display=swap" rel="stylesheet">`;
    }
    let html = `<!DOCTYPE html><html><head><meta charset='UTF-8'><meta name='viewport' content='width=${template.width},initial-scale=1.0'>${fontLinks}<style>@page{size:${template.width}px ${template.height}px;margin:0;}html,body{margin:0;padding:0;width:${template.width}px;height:${template.height}px;overflow:hidden;}body{position:relative;font-family:Arial,sans-serif;} .container{width:100%;height:100%;position:relative;}`;
    if (template.design?.background) {
      let bg = template.design.background;
      if (bg.startsWith('/uploads/')) {
        // Try to inline the background as data URI to avoid network fetch issues
        try {
          const fs = require('fs');
          const path = require('path');
          const uploadDir = process.env.UPLOAD_DIR || './uploads';
          const fileName = bg.replace('/uploads/', '');
          const filePath = path.join(uploadDir, fileName);
          if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath);
            const ext = path.extname(filePath).toLowerCase();
            const mime = ext === '.png' ? 'image/png' : (ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'application/octet-stream');
            bg = `data:${mime};base64,${data.toString('base64')}`;
          } else {
            // fallback to absolute URL
            bg = `${process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT}`}${bg}`;
          }
        } catch (e) {
          bg = `${process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT}`}${bg}`;
        }
      }
      html += `.container{background-image:url('${bg}');background-size:${template.width}px ${template.height}px;background-position:0 0;background-repeat:no-repeat;}`;
    }
    html += '</style></head><body><div class="container">';
    if (template.design?.objects) {
      for (const el of template.design.objects) {
        if (el.type === 'text') {
          let text = el.text || ''; if (text.includes('{') && participant?.data) { for (const [k, v] of Object.entries(participant.data)) { text = text.replace(new RegExp(`{${k}}`, 'g'), v || ''); } }
          const styles = []; styles.push('position:absolute');
          const x = el.x || 0, y = el.y || 0, w = el.width || 200, h = (el.fontSize ? el.fontSize * 1.3 : 32);
          styles.push(`left:${x}px`, `top:${y}px`, `width:${w}px`, `height:${h}px`);
          if (el.fontSize) styles.push(`font-size:${el.fontSize}px`);
          if (el.fontSize) styles.push(`line-height:${el.fontSize * 1.05}px`);
          if (el.fontFamily) styles.push(`font-family:'${el.fontFamily.replace(/['"]/g, '').trim()}',sans-serif`);
          if (el.fill) styles.push(`color:${el.fill}`);
          if (el.fontWeight) styles.push(`font-weight:${el.fontWeight}`);
          if (el.fontStyle) styles.push(`font-style:${el.fontStyle}`);
          if (el.textDecoration) styles.push(`text-decoration:${el.textDecoration}`);
          if (el.align) styles.push(`text-align:${el.align}`);
          if (el.verticalAlign && (el.verticalAlign === 'middle' || el.verticalAlign === 'bottom')) {
            styles.push('display:flex;flex-direction:column');
            styles.push(el.verticalAlign === 'middle' ? 'justify-content:center' : 'justify-content:flex-end');
            if (el.align === 'right') styles.push('align-items:flex-end'); else if (el.align === 'center') styles.push('align-items:center'); else styles.push('align-items:flex-start');
          }
          styles.push('white-space:pre');
          styles.push('transform:translateZ(0)');
          html += `<div style="${styles.join(';')}">${text}</div>`;
        }
      }
    }
    html += '</div></body></html>';
    return html;
  }
  async createPDFFromTemplate(template, participant) {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    const html = this.buildHTML(template, participant);
    await page.setContent(html, { waitUntil: 'load', timeout: 45000 });
    const pdf = await page.pdf({ width: `${template.width}px`, height: `${template.height}px`, printBackground: true, pageRanges: '' });
    await page.close();
    return pdf;
  }
  async createBulkPDFFromTemplate(template, participants) {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    const pagesHTML = participants.map(p => this.buildHTML(template, p).replace('<body', '<body class="cert"'));
    const combined = `<!DOCTYPE html><html><head><meta charset='UTF-8'><style>@page{size:${template.width}px ${template.height}px;margin:0;} .page-break{page-break-after:always;}</style></head><body>${pagesHTML.map(h => h + "<div class='page-break'></div>").join('')}</body></html>`;
    await page.setContent(combined, { waitUntil: 'load', timeout: 60000 });
    const pdf = await page.pdf({ width: `${template.width}px`, height: `${template.height}px`, printBackground: true });
    await page.close();
    return pdf;
  }
}
module.exports = new PlaywrightPDFService();
