/**
 * Vidsyn AI — Google Sign-In (Supabase OAuth Integration)
 * ---------------------------------------------------------------------------
 * Renders the "Continue with Google" button and redirects to Supabase OAuth.
 *
 * Usage on login.html / signup.html:
 *   GoogleAuth.mount({ containerId: 'googleSignInBtn', roleSelectId: 'role' });
 */
(function (global) {
  function toast(title, msg, type) {
    if (global.showToast) global.showToast(title, msg, type);
  }

  function mount(opts) {
    var container = document.getElementById(opts.containerId);
    if (!container) return;

    // Render the social login Google button using the app's existing theme and styles
    container.innerHTML =
      '<button type="button" class="btn btn-outline-custom w-100 py-2.5 d-flex align-items-center justify-content-center gap-2">' +
      '<i class="bi bi-google"></i> Continue with Google</button>';

    var button = container.querySelector('button');
    if (!button) return;

    button.addEventListener('click', async function () {
      if (!global.supabaseClient) {
        toast('Configuration Error', 'Supabase client is not initialized.', 'error');
        return;
      }
      
      const originalHtml = button.innerHTML;
      button.disabled = true;
      button.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Redirecting...';

      try {
        // Build absolute redirect URL
        let redirectUrl = window.location.origin + window.location.pathname;
        // Strip off the current file (e.g. login.html) and replace with dashboard
        redirectUrl = redirectUrl.substring(0, redirectUrl.lastIndexOf('/')) + '/student-dashboard.html';

        const { data, error } = await global.supabaseClient.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUrl
          }
        });
        
        if (error) throw error;
      } catch (err) {
        button.disabled = false;
        button.innerHTML = originalHtml;
        toast('Google Sign-In Failed', err.message, 'error');
      }
    });
  }

  global.GoogleAuth = { mount: mount };
})(window);
