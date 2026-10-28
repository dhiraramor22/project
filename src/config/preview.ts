/**
 * Preview mode configuration for Vercel static deployment.
 * 
 * When enabled, the app uses bundled demo data and mocks all API calls.
 * This mode is for UI inspection only - no backend required.
 * 
 * IMPORTANT: Preview mode is clearly labeled as DEMO-PREVIEW ONLY.
 * - No data persistence (changes are in-memory only, lost on refresh)
 * - Authentication is simulated with demo users
 * - All write operations are simulated or disabled with warnings
 */

export const isPreviewMode = (): boolean => {
  // Check environment variable first
  const env = (import.meta as any).env;
  if (env?.VITE_PREVIEW_MODE === 'true') {
    return true;
  }
  if (env?.VITE_PREVIEW_MODE === 'false') {
    return false;
  }
  
  // Auto-detect: if we're not in dev mode and running on Vercel static hosting
  if (env?.PROD && typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname.includes('.vercel.app') || hostname.includes('.vercel.com')) {
      return true;
    }
  }
  
  return false;
};

export const PREVIEW_MODE_NOTICE = 
  'DEMO PREVIEW MODE - UI inspection only. No backend connected. Changes are not persisted. This is not secure authentication.';

/**
 * Check if a write operation should be allowed in preview mode
 * Most writes are simulated in-memory; destructive operations may be disabled
 */
export const isWriteAllowedInPreview = (): boolean => {
  return isPreviewMode();
};

/**
 * Get message for disabled operations in preview mode
 */
export const getPreviewDisabledMessage = (): string => {
  return 'This operation is disabled in demo preview mode. Changes are not persisted without a backend.';
};
