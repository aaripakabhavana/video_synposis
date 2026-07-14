/**
 * Vidsyn AI — Authentication Configuration
 * ---------------------------------------------------------------------------
 * Single source of truth for auth settings. 
 */
window.AUTH_CONFIG = {
  // Supabase Configuration
  // Go to your Supabase project settings -> API to get these values
  SUPABASE_URL: 'https://orsshszgtquvjkisnlmk.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yc3Noc3pndHF1dmpraXNubG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1MjA2MTYsImV4cCI6MjA5OTA5NjYxNn0.vdHcyiDvxNUyCKBYN18hxESnVWya9Yt-ETb7uS14wF4',

  // Backend API base. Empty = same origin as the page, so it works both on
  // Vercel (https://your-app.vercel.app) and locally (http://localhost:8000).
  API_BASE_URL: '',

  // localStorage keys for offline fallback (optional, but good for caching)
  SESSION_KEY: 'vidsynCurrentUser',
  USER_PREFIX: 'vidsynUser_',
  LOGIN_HISTORY_KEY: 'vidsynLoginHistory'
};
