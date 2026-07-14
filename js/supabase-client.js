/**
 * Vidsyn AI — Supabase Initialization
 * ---------------------------------------------------------------------------
 * Initializes the Supabase JS client and makes it globally available.
 */
(function (global) {
  var cfg = global.AUTH_CONFIG || {};
  
  if (cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && cfg.SUPABASE_URL !== 'YOUR_SUPABASE_PROJECT_URL') {
    // Create a single supabase client for interacting with your database
    global.supabaseClient = supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    console.log("Supabase client initialized successfully.");
  } else {
    console.warn("Supabase not configured. Please set SUPABASE_URL and SUPABASE_ANON_KEY in auth-config.js.");
    global.supabaseClient = null;
  }
})(window);
