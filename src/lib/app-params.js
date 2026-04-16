// App configuration for custom API backend.
// Auth is handled via JWT tokens in localStorage.

export const appParams = {
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:3000',
};
