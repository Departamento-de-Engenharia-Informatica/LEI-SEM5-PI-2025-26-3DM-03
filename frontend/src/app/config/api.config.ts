// Always use same-origin relative base.
// - In dev (`ng serve`), proxy.conf.json forwards /api/* and /authtest/* to the backend.
// - In prod, Nginx routes these paths to the right upstream.
export const API_BASE_URL = '';