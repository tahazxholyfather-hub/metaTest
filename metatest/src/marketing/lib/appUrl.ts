export function appUrl(): string {
  if (typeof location === 'undefined') return '/app/';
  const host = location.hostname;
  return host === 'localhost' || host === '127.0.0.1' ? 'http://localhost:5173/' : '/app/';
}
