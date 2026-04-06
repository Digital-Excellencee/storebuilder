// Cloudflare Worker - Reverse Proxy (URL stays same, content loads from main domain)

function getRootHost(hostname, appHost) {
  const explicitHost = String(appHost || '').trim().toLowerCase();
  if (explicitHost) return explicitHost;
  const parts = String(hostname || '').trim().toLowerCase().split('.').filter(Boolean);
  if (parts.length >= 3) return parts.slice(1).join('.');
  return String(hostname || '').trim().toLowerCase();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const hostname = url.hostname;
    
    const parts = hostname.split('.');
    if (parts.length >= 3) {
      const subdomain = parts[0];
      const ignored = ['www', 'mail', 'ftp', 'api', 'admin', 'cdn', 'static', 'assets'];
      
      if (!ignored.includes(subdomain)) {
        // Reverse Proxy - URL stays same, content loads from main domain
        const proxyUrl = new URL(request.url);
        proxyUrl.hostname = getRootHost(hostname, env && env.APP_HOST);
        proxyUrl.pathname = '/store/' + subdomain + url.pathname;
        
        const proxyRequest = new Request(proxyUrl.toString(), {
          method: request.method,
          headers: request.headers,
          body: request.body,
          redirect: 'follow'
        });
        
        const response = await fetch(proxyRequest);
        
        // Return response with original URL (no redirect)
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        });
      }
    }
    
    return fetch(request);
  }
}
