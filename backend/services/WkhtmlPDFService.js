const wkhtmltopdf = require('wkhtmltopdf');
const streamToBuffer = (stream) => new Promise((resolve, reject) => {
  const chunks = [];
  stream.on('data', (c) => chunks.push(c));
  stream.on('end', () => resolve(Buffer.concat(chunks)));
  stream.on('error', reject);
});

class WkhtmlPDFService {
  generateHTMLFromTemplate(template, participant) {
    // Reuse logic similar to Puppeteer service but simplified for wkhtml
    const fontFamilies = new Set();
    if (template.design?.objects) {
      for (const el of template.design.objects) {
        if (el.type === 'text' && el.fontFamily) {
          fontFamilies.add(el.fontFamily.replace(/['"]/g, '').trim());
        }
      }
    }
    const systemFonts = [
      'Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Courier New', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Segoe UI', 'Calibri', 'Cambria', 'Garamond', 'Lucida Console', 'Monaco', 'Comic Sans MS', 'Impact', 'Palatino', 'Bookman', 'Avant Garde', 'Century Gothic', 'Franklin Gothic Medium'
    ];
    const googleFonts = [];
    for (const f of fontFamilies) {
      if (f && !systemFonts.includes(f)) {
        // Basic weights assumption 400; wkhtmltopdf loads default if not specified.
        googleFonts.push(f.replace(/\s+/g, '+'));
      }
    }
    let googleImport = '';
    if (googleFonts.length) {
      const unique = [...new Set(googleFonts)];
      googleImport = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?${unique.map(f => `family=${f}:wght@300;400;500;600;700`).join('&')}&display=swap" rel="stylesheet">`;
    }
    let html = `<!DOCTYPE html><html><head><meta charset='UTF-8'>${googleImport}<style>@page{margin:0;size:${template.width}px ${template.height}px;}body{margin:0;padding:0;width:${template.width}px;height:${template.height}px;position:relative;font-family:Arial,sans-serif;} .container{width:100%;height:100%;position:relative;}`;
    if (template.design?.background) {
      let bg = template.design.background;
      if (bg.startsWith('/uploads/')) {
        bg = `${process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT}`}${bg}`;
      }
      html += `.container{background-image:url('${bg}');background-size:cover;background-position:center;background-repeat:no-repeat;}`;
    }
    html += '</style></head><body><div class="container">';
    if (template.design?.objects) {
      for (const el of template.design.objects) {
        if (el.type === 'text') {
          let text = el.text || '';
          if (text.includes('{') && participant?.data) {
            for (const [k, v] of Object.entries(participant.data)) {
              text = text.replace(new RegExp(`{${k}}`, 'g'), v || '');
            }
          }
          const styles = [];
          styles.push('position:absolute');
          const x = el.x || 0; const y = el.y || 0; const w = el.width || 200; const h = (el.fontSize ? el.fontSize * 1.3 : 32);
          styles.push(`left:${x}px`); styles.push(`top:${y}px`); styles.push(`width:${w}px`); styles.push(`height:${h}px`);
          if (el.fontSize) styles.push(`font-size:${el.fontSize}px`);
          if (el.fontFamily) styles.push(`font-family:'${el.fontFamily.replace(/['"]/g, '').trim()}',sans-serif`);
          if (el.fill) styles.push(`color:${el.fill}`);
          if (el.fontWeight) styles.push(`font-weight:${el.fontWeight}`);
          if (el.fontStyle) styles.push(`font-style:${el.fontStyle}`);
          if (el.textDecoration) styles.push(`text-decoration:${el.textDecoration}`);
          if (el.align) styles.push(`text-align:${el.align}`);
          styles.push('white-space:pre');
          if (el.verticalAlign && (el.verticalAlign === 'middle' || el.verticalAlign === 'bottom')) {
            styles.push('display:flex;flex-direction:column');
            styles.push(el.verticalAlign === 'middle' ? 'justify-content:center' : 'justify-content:flex-end');
            if (el.align === 'right') styles.push('align-items:flex-end'); else if (el.align === 'center') styles.push('align-items:center'); else styles.push('align-items:flex-start');
          }
          html += `<div style="${styles.join(';')}">${text}</div>`;
        }
      }
    }
    html += '</div></body></html>';
    return html;
  }

  async createPDFFromTemplate(template, participant) {
    const html = this.generateHTMLFromTemplate(template, participant);
    return await streamToBuffer(wkhtmltopdf(html, {
      pageWidth: `${template.width}px`,
      pageHeight: `${template.height}px`,
      marginTop: 0,
      marginLeft: 0,
      marginRight: 0,
      marginBottom: 0,
      disableSmartShrinking: true,
      printMediaType: true,
      encoding: 'UTF-8'
    }));
  }

  async createBulkPDFFromTemplate(template, participants) {
    // Concatenate pages (wkhtmltopdf does not support multiple pages via long HTML with custom page size reliably without page-breaks)
    const pages = participants.map(p => this.generateHTMLFromTemplate(template, p).replace('<body', '<body class="cert-page"'));
    const combined = `<!DOCTYPE html><html><head><meta charset='UTF-8'><style>@page{margin:0;size:${template.width}px ${template.height}px;} .page-break{page-break-after:always;}</style></head><body>${pages.map((p, i) => `${p}<div class='page-break'></div>`).join('')}</body></html>`;
    return await streamToBuffer(wkhtmltopdf(combined, {
      pageWidth: `${template.width}px`,
      pageHeight: `${template.height}px`,
      marginTop: 0,
      marginLeft: 0,
      marginRight: 0,
      marginBottom: 0,
      disableSmartShrinking: true,
      printMediaType: true,
      encoding: 'UTF-8'
    }));
  }
}

module.exports = new WkhtmlPDFService();
