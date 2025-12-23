const crypto = require('crypto');
const path = require('path');

const _randomId = () => {
  if (crypto.randomUUID) return crypto.randomUUID();
  return crypto.randomBytes(16).toString('hex');
};

const _sanitizeBaseName = (name) => {
  const raw = String(name || '').trim();
  const base = path.basename(raw);
  const ext = path.extname(base);
  const baseNoExt = ext ? base.slice(0, -ext.length) : base;

  const cleaned = String(baseNoExt)
    .replace(/[^\w\s-]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  return cleaned.substring(0, 60) || 'file';
};

const buildUniqueFileName = ({ prefix, originalName, extOverride } = {}) => {
  const safePrefix = String(prefix || 'file').replace(/[^\w-]/g, '').substring(0, 20) || 'file';
  const safeBase = _sanitizeBaseName(originalName);

  const extRaw = typeof extOverride === 'string' && extOverride
    ? extOverride
    : path.extname(String(originalName || ''));
  const ext = extRaw ? extRaw.toLowerCase() : '';

  const id = _randomId();
  return `${safePrefix}_${id}_${safeBase}${ext}`;
};

module.exports = {
  buildUniqueFileName
};
