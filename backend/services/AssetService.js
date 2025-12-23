const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

const { CertificateTemplate, Event, Asset } = require('../models');
const { buildUniqueFileName } = require('../utils/fileNaming');
const { Op } = require('sequelize');

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

  async getUserAssets(userId, page = 1, limit = 50, q = '') {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (pageNum - 1) * limitNum;

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

    const query = String(q || '').trim();
    const andConditions = [
      { storedFileName: { [Op.notILike]: '.%' } }
    ];
    if (query) {
      andConditions.push({
        [Op.or]: [
          { storedFileName: { [Op.iLike]: `%${query}%` } },
          { originalFileName: { [Op.iLike]: `%${query}%` } }
        ]
      });
    }
    const whereClause = {
      userId,
      isActive: true,
      [Op.and]: andConditions
    };

    const { count, rows } = await Asset.findAndCountAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      limit: limitNum,
      offset
    });

    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    const assets = [];

    for (const rec of rows) {
      const fileName = rec.storedFileName;
      const filePath = path.join(uploadDir, fileName);

      let exists = false;
      let size = rec.sizeBytes ?? null;
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
        uuid: rec.uuid,
        path: rec.path,
        fileName,
        exists,
        size,
        lastModified,
        mimeType: rec.mimeType,
        ext: rec.ext,
        originalFileName: rec.originalFileName,
        createdAt: rec.createdAt,
        usedBy: usageMap.get(rec.path) || []
      });
    }

    const totalPages = Math.max(1, Math.ceil(count / limitNum));

    return {
      assets,
      totalCount: count,
      totalPages,
      currentPage: pageNum,
      limit: limitNum
    };
  }

  _mimeFromExt(ext) {
    const e = String(ext || '').toLowerCase();
    if (e === '.jpg' || e === '.jpeg') return 'image/jpeg';
    if (e === '.png') return 'image/png';
    if (e === '.webp') return 'image/webp';
    if (e === '.svg') return 'image/svg+xml';
    return null;
  }

  async createAssetFromUploadedFile({ userId, buffer, originalName, mimetype }) {
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    const storedFileName = buildUniqueFileName({ prefix: 'img', originalName });
    const filePath = path.join(uploadDir, storedFileName);
    await fs.writeFile(filePath, buffer);

    const ext = path.extname(storedFileName);
    const mimeType = mimetype || this._mimeFromExt(ext);
    const sizeBytes = buffer?.length ?? null;
    const assetPath = `/uploads/${storedFileName}`;

    const rec = await Asset.create({
      userId,
      storedFileName,
      originalFileName: originalName || null,
      path: assetPath,
      mimeType,
      ext,
      sizeBytes
    });

    return rec;
  }

  async backfillUserAssetsFromTemplates(userId) {
    const uploadDir = process.env.UPLOAD_DIR || './uploads';

    // Cleanup: ensure dotfiles never appear in DB for this user
    try {
      await Asset.destroy({
        where: {
          userId,
          storedFileName: { [Op.like]: '.%' }
        }
      });
    } catch (_) {
      // ignore
    }

    const templates = await CertificateTemplate.findAll({
      where: { isActive: true },
      include: [{
        model: Event,
        as: 'event',
        where: { userId, isActive: true },
        attributes: ['id']
      }],
      attributes: ['design', 'backgroundImage']
    });

    const discovered = new Set();

    for (const t of templates) {
      const assetSet = this._collectUploadAssetsFromDesign(t.design);
      if (typeof t.backgroundImage === 'string' && t.backgroundImage.startsWith('/uploads/')) {
        assetSet.add(t.backgroundImage);
      }
      for (const p of assetSet) discovered.add(p);
    }

    const allowedExt = new Set(['.jpg', '.jpeg', '.png', '.webp', '.svg']);

    let createdCount = 0;
    let skippedCount = 0;
    const missingFiles = [];

    for (const assetPath of discovered) {
      if (!assetPath || typeof assetPath !== 'string' || !assetPath.startsWith('/uploads/')) continue;
      const fileName = assetPath.replace('/uploads/', '');
      if (!fileName || fileName.startsWith('.')) continue;
      const ext = path.extname(fileName).toLowerCase();
      if (!allowedExt.has(ext)) continue;
      const filePath = path.join(uploadDir, fileName);

      const existing = await Asset.findOne({ where: { userId, path: assetPath, isActive: true } });
      if (existing) {
        skippedCount += 1;
        continue;
      }

      try {
        const st = await fs.stat(filePath);
        const mimeType = this._mimeFromExt(ext);
        await Asset.create({
          userId,
          storedFileName: fileName,
          originalFileName: null,
          path: assetPath,
          mimeType,
          ext,
          sizeBytes: st.size
        });
        createdCount += 1;
      } catch (e) {
        missingFiles.push({ path: assetPath });
      }
    }

    return { createdCount, skippedCount, missingFilesCount: missingFiles.length, missingFiles };
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

    const dbAsset = await Asset.findOne({ where: { userId, storedFileName: fileName, isActive: true } });

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

    if (dbAsset) {
      await dbAsset.destroy();
    }

    return { path: assetPath };
  }

  async deleteAssetByIdentifier(userId, identifier, force = false) {
    const raw = String(identifier || '').trim();
    if (!raw) {
      const err = new Error('Invalid asset identifier');
      err.statusCode = 400;
      throw err;
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw);
    if (isUuid) {
      const asset = await Asset.findOne({ where: { uuid: raw, userId, isActive: true } });
      if (!asset) {
        const err = new Error('Asset not found');
        err.statusCode = 404;
        throw err;
      }
      return await this.deleteAssetByFileName(userId, asset.storedFileName, force);
    }

    return await this.deleteAssetByFileName(userId, raw, force);
  }
}

module.exports = new AssetService();
