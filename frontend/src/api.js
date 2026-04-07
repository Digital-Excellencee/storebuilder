const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

async function request(path, options = {}) {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: {
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {})
    },
    method: options.method || 'GET',
    body: options.body ? (isFormData ? options.body : JSON.stringify(options.body)) : undefined
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'Request failed');
    error.status = response.status;
    error.payload = data;
    throw error;
  }
  return data;
}

export const api = {
  get: (path, token) => request(path, { token }),
  post: (path, body, token) => request(path, { method: 'POST', body, token }),
  put: (path, body, token) => request(path, { method: 'PUT', body, token }),
  upload: (path, formData, token) => request(path, { method: 'POST', body: formData, token }),
  del: (path, token) => request(path, { method: 'DELETE', token })
};

export { API_URL };
