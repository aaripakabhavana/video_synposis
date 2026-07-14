/**
 * Vidsyn AI — Dashboard session hydration + Logout
 * ---------------------------------------------------------------------------
 * Populates the logged-in user's Name, Email and Profile Picture into the
 * dashboard, and wires the Logout control to clear the session and return to
 * the login page. Works for the student dashboard.
 *
 * Loaded AFTER each dashboard's own inline script so it takes final precedence
 * (its DOMContentLoaded handler runs last).
 */
document.addEventListener('DOMContentLoaded', async function () {
  var Auth = window.VidsynAuth;
  // Protect the page: no session -> back to login.
  var user = Auth ? await Auth.requireAuth('login.html') : null;
  if (!user) return;

  var displayName = user.user_metadata?.full_name || (user.email ? user.email.split('@')[0] : 'User');

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el && value) el.textContent = value;
  }

  // Replaces an initials-avatar with the Google profile picture
  function setAvatar(el) {
    if (!el || !user.user_metadata?.avatar_url) return;
    el.innerHTML = '<img src="' + user.user_metadata.avatar_url + '" alt="' + displayName + '" ' +
      'referrerpolicy="no-referrer" ' +
      'style="width:100%;height:100%;border-radius:50%;object-fit:cover;">';
  }

  function applyAll() {
    // Student dashboard elements
    setText('currentUserDisplayName', displayName);
    setText('currentUserDisplayEmail', user.email);
    setText('profileNameDisplay', displayName);
    setText('displayProfileName', displayName);
    setText('displayProfileEmail', user.email);
    if (user.user_metadata?.phone) setText('displayProfilePhone', user.user_metadata.phone);
    setAvatar(document.getElementById('currentUserAvatarInitials'));
    setAvatar(document.getElementById('profileAvatarBig'));
  }

  applyAll();

  // The student dashboard re-renders avatars to initials when switching views,
  // so re-apply the picture right after any sidebar navigation.
  document.querySelectorAll('.sidebar-nav .nav-link').forEach(function (link) {
    link.addEventListener('click', function () { setTimeout(applyAll, 0); });
  });

  // Profile Dropdown click toggle logic
  var profileDropdown = document.querySelector('.profile-dropdown-container');
  if (profileDropdown) {
    var trigger = profileDropdown.querySelector('.d-flex.align-items-center.gap-2') || profileDropdown;
    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      profileDropdown.classList.toggle('show-menu');
    });
    document.addEventListener('click', function (e) {
      if (!profileDropdown.contains(e.target)) {
        profileDropdown.classList.remove('show-menu');
      }
    });
  }

  // Wire Logout: clear session, return to login page.
  document.querySelectorAll('.profile-menu-item.text-danger, [data-logout]').forEach(function (el) {
    el.addEventListener('click', async function (e) {
      e.preventDefault();
      await Auth.logout('login.html');
    });
  });
});
