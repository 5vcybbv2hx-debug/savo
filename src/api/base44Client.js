import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

// Authenticated client (für eingeloggte User)
export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl
});

// Public client — kein User-Token, für öffentliche Seiten wie PublicDrinkMenu
// appId ist keine sensitive Info (sie steht in der URL)
export const publicBase44 = createClient({
  appId: appId || '695532713e60f5ccfc3522b9',
  token: null,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl
});
