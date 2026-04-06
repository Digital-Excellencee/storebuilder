const { escapeHtml } = require('./html');

function setFlash(req, type, message) {
  req.session.flash = { type: type || 'info', message: String(message || '') };
}

function consumeFlash(req) {
  const flash = req.session.flash || null;
  delete req.session.flash;
  return flash;
}

function renderFlashMessages(req) {
  const flash = consumeFlash(req);
  if (!flash || !flash.message) {
    return '';
  }
  const typeClass = flash.type === 'error' ? 'flash-error' : flash.type === 'success' ? 'flash-success' : 'flash-info';
  return `<div class="flash ${typeClass}">${escapeHtml(flash.message)}</div>`;
}

module.exports = { setFlash, consumeFlash, renderFlashMessages };
