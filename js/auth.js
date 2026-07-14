/**
 * Vidsyn AI — Core Auth & Session module (Supabase Integration)
 */
(function (global) {
  // ---- Session helpers ------------------------------------------------------
  async function getSession() {
    if (!global.supabaseClient) return null;
    const { data, error } = await global.supabaseClient.auth.getSession();
    if (error || !data.session) return null;
    return data.session.user;
  }

  // Clears the session and returns to the login page.
  async function logout(redirect) {
    if (global.supabaseClient) {
      await global.supabaseClient.auth.signOut();
    }
    window.location.href = redirect || 'login.html';
  }

  // Guards a protected page: redirects to login if no session exists.
  async function requireAuth(redirect) {
    if (!global.supabaseClient) {
      window.location.href = redirect || 'login.html';
      return null;
    }
    const { data, error } = await global.supabaseClient.auth.getSession();
    if (error || !data.session) {
      window.location.href = redirect || 'login.html';
      return null;
    }
    return data.session.user;
  }

  // Maps a role to its dashboard page.
  function roleForDashboard(role) {
    return 'student-dashboard.html';
  }

  // Sign in with Email and Password
  async function signInWithEmail(email, password) {
    if (!global.supabaseClient) throw new Error("Supabase not initialized");
    const { data, error } = await global.supabaseClient.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  }

  // Sign Up with Email and Password
  async function signUpWithEmail(email, password, name, role) {
    if (!global.supabaseClient) throw new Error("Supabase not initialized");
    const { data, error } = await global.supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          role: role
        }
      }
    });
    if (error) throw error;
    return data;
  }

  global.VidsynAuth = {
    getSession: getSession,
    logout: logout,
    requireAuth: requireAuth,
    roleForDashboard: roleForDashboard,
    signInWithEmail: signInWithEmail,
    signUpWithEmail: signUpWithEmail
  };
})(window);
