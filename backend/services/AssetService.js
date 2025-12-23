const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

const { CertificateTemplate, Event } = require('../models');

class AssetService {
  _collectUploadAssetsFromDesign(design) {
    const assets = new Set();
    if (!design || typeof design !== 'object') return assets;

    const add = (p) => {
      if (typeof p === 'string' && p.startsWith('/uploads/')) assets.add(p);
    };

    const pages = (design.pages && Array.isArray(design.pages))
      ? design.pages
      : [{ background: design.background, objects: Array.isArray(design.objects) ? design.objects : [] }];

    for (const page of pages) {
      if (!page) continue;
      add(page.background);
      const objects = Array.isArray(page.objects) ? page.objects : [];
      for (const obj of objects) {
        if (!obj) continue;
        if (obj.type === 'image') add(obj.src);
        if (obj.type === 'qrcode') add(obj.logoSrc);
      }
    }

    return assets;
  }

  _toUsedByEntry(template) {
    return {
      templateUuid: template.uuid,
      templateName: template.name,
      eventUuid: template.event?.uuid,
      eventTitle: template.event?.title
    };
  }

  async getUserAssets(userId, page = 1, limit = 50) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));

    const templates = await CertificateTemplate.findAll({
      where: { isActive: true },
      include: [{
        model: Event,
        as: 'event',
        where: { userId, isActive: true },
        attributes: ['uuid', 'title']
      }],
      attributes: ['uuid', 'name', 'design', 'backgroundImage']
    });

    const usageMap = new Map();

    for (const t of templates) {
      const assetSet = this._collectUploadAssetsFromDesign(t.design);
      if (typeof t.backgroundImage === 'string' && t.backgroundImage.startsWith('/uploads/')) {
        assetSet.add(t.backgroundImage);
      }

      for (const assetPath of assetSet) {
        const usedBy = usageMap.get(assetPath) || [];
        usedBy.push(this._toUsedByEntry(t));
        usageMap.set(assetPath, usedBy);
      }
    }

    const uploadDir = process.env.UPLOAD_DIR || './uploads';

    const assets = [];
    for (const [assetPath, usedBy] of usageMap.entries()) {
      const fileName = assetPath.replace('/uploads/', '');
      const filePath = path.join(uploadDir, fileName);

      let exists = false;
      let size = null;
      let lastModified = null;

      try {
        const st = await fs.stat(filePath);
        exists = true;
        size = st.size;
        lastModified = st.mtime;
      } catch (e) {
        exists = false;
      }

      assets.push({
        path: assetPath,
        fileName,
        exists,
        size,
        lastModified,
        usedBy
      });
    }

    assets.sort((a, b) => {
      const am = a.lastModified ? new Date(a.lastModified).getTime() : 0;
      const bm = b.lastModified ? new Date(b.lastModified).getTime() : 0;
      return bm - am;
    });

    const totalCount = assets.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / limitNum));
    const normalizedPage = Math.min(pageNum, totalPages);
    const offset = (normalizedPage - 1) * limitNum;
    const pagedAssets = assets.slice(offset, offset + limitNum);

    return {
      assets: pagedAssets,
      totalCount,
      totalPages,
      currentPage: normalizedPage,
      limit: limitNum
    };
  }

  async _getAssetUsageAcrossTemplates(assetPath) {
    const templates = await CertificateTemplate.findAll({
      where: { isActive: true },
      include: [{
        model: Event,
        as: 'event',
        where: { isActive: true },
        required: true,
        attributes: ['uuid', 'title', 'userId']
      }],
      attributes: ['uuid', 'name', 'design', 'backgroundImage']
    });

    const usedBy = [];

    for (const t of templates) {
      if (t.backgroundImage === assetPath) {
        usedBy.push({
          templateUuid: t.uuid,
          templateName: t.name,
          eventUuid: t.event?.uuid,
          eventTitle: t.event?.title,
          userId: t.event?.userId
        });
        continue;
      }

      try {
        const d = t.design;
        if (d && JSON.stringify(d).includes(assetPath)) {
          usedBy.push({
            templateUuid: t.uuid,
            templateName: t.name,
            eventUuid: t.event?.uuid,
            eventTitle: t.event?.title,
            userId: t.event?.userId
          });
        }
      } catch (_) {
      }
    }

    return usedBy;
  }

  async deleteAssetByFileName(userId, fileName, force = false) {
    if (!fileName || typeof fileName !== 'string') {
      const err = new Error('Invalid file name');
      err.statusCode = 400;
      throw err;
    }

    if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
      const err = new Error('Invalid file name');
      err.statusCode = 400;
      throw err;
    }

    const assetPath = `/uploads/${fileName}`;

    const usedByAll = await this._getAssetUsageAcrossTemplates(assetPath);
    const usedBySelf = usedByAll.filter((x) => x.userId === userId).map((x) => ({
      templateUuid: x.templateUuid,
      templateName: x.templateName,
      eventUuid: x.eventUuid,
      eventTitle: x.eventTitle
    }));
    const usedByOthers = usedByAll.filter((x) => x.userId !== userId);

    if (usedByOthers.length) {
      const err = new Error('Forbidden');
      err.statusCode = 403;
      err.data = {
        path: assetPath,
        usedBy: usedByOthers.map((x) => ({
          templateUuid: x.templateUuid,
          templateName: x.templateName,
          eventUuid: x.eventUuid,
          eventTitle: x.eventTitle
        }))
      };
      throw err;
    }

    if (usedBySelf.length && !force) {
      const err = new Error('Asset is used by certificate templates');
      err.statusCode = 409;
      err.data = { path: assetPath, usedBy: usedBySelf };
      throw err;
    }

    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    const filePath = path.join(uploadDir, fileName);

    if (!fsSync.existsSync(filePath)) {
      const err = new Error('File not found');
      err.statusCode = 404;
      throw err;
    }

    await fs.unlink(filePath);

    return { path: assetPath };
  }
}

module.exports = new AssetService();
