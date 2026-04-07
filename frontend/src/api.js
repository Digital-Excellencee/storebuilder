const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const GET_CACHE_TTL = 30000;
const getCache = new Map();
const inflightGets = new Map();

function buildCacheKey(path, token) {
  return `${path}::${token || ''}`;
}

function clearGetCache() {
  getCache.clear();
  inflightGets.clear();
}

async function request(path, options = {}) {
  const method = options.method || 'GET';
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const cacheKey = method === 'GET' ? buildCacheKey(path, options.token) : '';
  if (method === 'GET') {
    const cached = getCache.get(cacheKey);
    if (cached && (Date.now() - cached.at) < GET_CACHE_TTL) {
      return cached.data;
    }
    if (inflightGets.has(cacheKey)) {
      return inflightGets.get(cacheKey);
    }
  } else {
    clearGetCache();
  }

  const runner = (async () => {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: {
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {})
    },
    method,
    body: options.body ? (isFormData ? options.body : JSON.stringify(options.body)) : undefined
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'Request failed');
    error.status = response.status;
    error.payload = data;
    throw error;
  }
  if (method === 'GET') {
    getCache.set(cacheKey, { at: Date.now(), data });
  }
  return data;
  })();

  if (method === 'GET') {
    inflightGets.set(cacheKey, runner);
    return runner.finally(() => {
      inflightGets.delete(cacheKey);
    });
  }

  return runner;
}

export const api = {
  get: (path, token) => request(path, { token }),
  post: (path, body, token) => request(path, { method: 'POST', body, token }),
  put: (path, body, token) => request(path, { method: 'PUT', body, token }),
  upload: (path, formData, token) => request(path, { method: 'POST', body: formData, token }),
  del: (path, token) => request(path, { method: 'DELETE', token })
};

export { API_URL };
