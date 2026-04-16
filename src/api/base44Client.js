import { createClient } from '@base44/sdk';

export const base44 = createClient({
  appId: import.meta.env.VITE_APP_ID,
  requiresAuth: false,
});
