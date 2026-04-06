const { escapeHtml } = require('../helpers/html');
const { renderHtmlShell } = require('./shell');

function renderGlobalError(title, message, statusCode) {
  return renderHtmlShell(title, `
<div class="error-page">
  <div class="card error-card">
    <div class="badge badge-${statusCode === 404 ? 'pending' : 'cancelled'}">${escapeHtml(String(statusCode || 500))}</div>
    <h1 class="section-title">${escapeHtml(title)}</h1>
    <p class="section-subtitle">${escapeHtml(message)}</p>
    <div class="actions" style="justify-content:center;">
      <a class="btn" href="/">Home</a>
      <a class="btn btn-secondary" href="/login">Login</a>
    </div>
  </div>
</div>`);
}

module.exports = { renderGlobalError };
