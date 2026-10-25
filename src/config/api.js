// Production API Configuration Helper
// Automatically resolves to live Render backend or same-origin
const envBase = import.meta.env?.VITE_API_BASE_URL;

export const PROD_BACKEND_URL = 'https://yeezy-loyalty.onrender.com';

function resolveApiBaseUrl() {
  if (envBase !== undefined && envBase !== '') {
    return envBase;
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    // When running directly on Render alongside Express server, use relative path
    if (host.endsWith('onrender.com')) {
      return '';
    }
    // Saved override from localStorage
    const saved = localStorage.getItem('yeezy_backend_url');
    if (saved) return saved;

    // In local dev, default to localhost:4000
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:4000';
    }

    // External frontend host (e.g. Vercel, Netlify, custom domain)
    return PROD_BACKEND_URL;
  }
  return PROD_BACKEND_URL;
}

export let API_BASE_URL = resolveApiBaseUrl();

export function setApiBaseUrl(url) {
  API_BASE_URL = url;
  if (typeof window !== 'undefined') {
    localStorage.setItem('yeezy_backend_url', url);
  }
}

export function apiUrl(path = '') {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
}

/**
 * Smart fetch wrapper that automatically fails over to the live Render backend
 * if local port 4000 is not running.
 */
export async function apiFetch(path, options = {}) {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const primaryUrl = `${API_BASE_URL}${cleanPath}`;
  
  try {
    const res = await fetch(primaryUrl, options);
    return res;
  } catch (err) {
    // If local dev server (port 4000) is unreachable, seamlessly fall back to live Render backend
    if (API_BASE_URL.includes('localhost') || API_BASE_URL.includes('127.0.0.1')) {
      console.warn(`[Yeezy API] Local server at ${API_BASE_URL} unreachable. Seamlessly falling back to live Render backend: ${PROD_BACKEND_URL}`);
      setApiBaseUrl(PROD_BACKEND_URL);
      const fallbackUrl = `${PROD_BACKEND_URL}${cleanPath}`;
      return await fetch(fallbackUrl, options);
    }
    throw err;
  }
}

