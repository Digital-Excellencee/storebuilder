const config = require('../config');

const { CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID, BASE_DOMAIN } = config;

async function createCloudflareSubdomain(subdomain) {
  try {
    if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ZONE_ID || !BASE_DOMAIN) {
      console.warn('[Cloudflare] API credentials or BASE_DOMAIN not configured');
      return { success: false, error: 'API not configured' };
    }
    const checkResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records?name=${subdomain}.${BASE_DOMAIN}`, {
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    const checkData = await checkResponse.json();
    if (checkData.success && checkData.result && checkData.result.length > 0) {
      console.log(`[Cloudflare] Subdomain ${subdomain}.${BASE_DOMAIN} already exists`);
      return { success: true, data: checkData.result[0], existing: true };
    }
    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'CNAME',
        name: subdomain,
        content: BASE_DOMAIN,
        proxied: true
      })
    });
    const data = await response.json();
    if (data.success) {
      console.log(`[Cloudflare] Subdomain ${subdomain}.${BASE_DOMAIN} created successfully`);
      return { success: true, data: data.result };
    }
    console.error('[Cloudflare] Failed to create subdomain:', data.errors);
    return { success: false, errors: data.errors };
  } catch (error) {
    console.error('[Cloudflare] Error creating subdomain:', error.message);
    return { success: false, error: error.message };
  }
}

async function deleteCloudflareSubdomain(subdomain) {
  try {
    if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ZONE_ID) {
      return { success: false, error: 'API not configured' };
    }
    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records?name=${subdomain}.${BASE_DOMAIN}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    const data = await response.json();
    if (data.success && data.result && data.result.length > 0) {
      for (const record of data.result) {
        const deleteResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records/${record.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'application/json'
          }
        });
        await deleteResponse.json();
      }
      console.log(`[Cloudflare] Subdomain ${subdomain}.${BASE_DOMAIN} deleted successfully`);
      return { success: true };
    }
    return { success: false, error: 'Record not found' };
  } catch (error) {
    console.error('[Cloudflare] Error deleting subdomain:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = { createCloudflareSubdomain, deleteCloudflareSubdomain };
