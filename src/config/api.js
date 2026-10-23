// Production API Configuration Helper
// Automatically resolves same-origin on Render / Cloud production, or localhost:4000 in dev
const envBase = import.meta.env?.VITE_API_BASE_URL;

export const API_BASE_URL = envBase !== undefined 
  ? envBase 
  : (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://localhost:4000' 
      : '');

export function apiUrl(path = '') {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
}
