/**
 * Vidsyn AI - Main JavaScript
 * Handles theme toggling, scroll animations, statistics counter, 
 * ScrollSpy active link tracking, form validation, and other interactive UI elements.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize all core functions
  initTheme();
  initNavbarScroll();
  initScrollReveal();
  initStatsCounter();
  initScrollSpy();
  initContactForm();
  initBackToTop();
  checkSignupSuccess();
});

/**
 * Check for signup success query parameter and show modal
 */
function checkSignupSuccess() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('signup') === 'success') {
    const successModalEl = document.getElementById('successModal');
    if (successModalEl && window.bootstrap && window.bootstrap.Modal) {
      const successModal = new bootstrap.Modal(successModalEl);
      successModal.show();
    }
  }
}

/**
 * Theme Manager (Dark / Light Mode)
 */
function initTheme() {
  const themeToggleBtn = document.getElementById('themeToggle');
  if (!themeToggleBtn) return;

  // Check for saved theme preference, otherwise use system preference
  const savedTheme = localStorage.getItem('theme');
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  const initialTheme = savedTheme || (systemPrefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', initialTheme);
  document.documentElement.setAttribute('data-bs-theme', initialTheme); // Sync Bootstrap

  // Toggle theme on click
  themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    document.documentElement.setAttribute('data-bs-theme', newTheme); // Sync Bootstrap
    localStorage.setItem('theme', newTheme);
    
    // Play a subtle haptic-like scaling effect on click
    themeToggleBtn.style.transform = 'scale(0.9)';
    setTimeout(() => themeToggleBtn.style.transform = 'scale(1)', 150);
  });
}

/**
 * Navbar Scroll styling
 */
function initNavbarScroll() {
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;

  const handleScroll = () => {
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  };

  // Run on load in case page is refreshed while scrolled
  handleScroll();
  window.addEventListener('scroll', handleScroll);
}

/**
 * Scroll Reveal Animation (Intersection Observer)
 */
function initScrollReveal() {
  const revealElements = document.querySelectorAll('.reveal');
  if (revealElements.length === 0) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
        // Unobserve once animation is triggered
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.15,
    rootMargin: '0px 0px -50px 0px'
  });

  revealElements.forEach(el => observer.observe(el));
}

/**
 * Statistics Count-Up Animation
 */
function initStatsCounter() {
  const statsSection = document.getElementById('statistics');
  const statNumbers = document.querySelectorAll('.stat-number');
  if (!statsSection || statNumbers.length === 0) return;

  let animated = false;

  const startCounting = () => {
    statNumbers.forEach(stat => {
      const target = parseInt(stat.getAttribute('data-target'), 10);
      const suffix = stat.getAttribute('data-suffix') || '';
      const duration = 2000; // 2 seconds
      const startTime = performance.now();

      const updateCount = (currentTime) => {
        const elapsedTime = currentTime - startTime;
        const progress = Math.min(elapsedTime / duration, 1);
        
        // Ease out quad formula
        const easeProgress = progress * (2 - progress);
        const currentValue = Math.floor(easeProgress * target);

        // Format numbers with commas if they are large
        if (currentValue >= 1000) {
          stat.textContent = (currentValue / 1000).toFixed(1) + 'K' + suffix;
        } else {
          stat.textContent = currentValue + suffix;
        }

        if (progress < 1) {
          requestAnimationFrame(updateCount);
        } else {
          // Ensure exact final value is set
          stat.textContent = (target >= 1000 ? (target / 1000).toFixed(0) + 'K' : target) + suffix;
        }
      };

      requestAnimationFrame(updateCount);
    });
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !animated) {
        startCounting();
        animated = true;
        observer.unobserve(statsSection);
      }
    });
  }, { threshold: 0.3 });

  observer.observe(statsSection);
}

/**
 * ScrollSpy (Highlight active navbar link based on scroll position)
 */
function initScrollSpy() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.navbar-nav .nav-link');
  if (sections.length === 0 || navLinks.length === 0) return;

  const removeActive = () => {
    navLinks.forEach(link => {
      const href = link.getAttribute('href');
      // Only remove active from hash links on the same page
      if (href && (href.startsWith('#') || href === 'index.html' || href.startsWith('index.html#'))) {
        link.classList.remove('active');
      }
    });
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute('id');
        
        // Skip sections that don't have direct nav links (like statistics)
        if (id === 'statistics') return;

        removeActive();
        
        navLinks.forEach(link => {
          const href = link.getAttribute('href');
          if (href === '#' + id || (id === 'hero' && (href === '#' || href === 'index.html'))) {
            link.classList.add('active');
          }
        });
      }
    });
  }, {
    threshold: 0.2,
    rootMargin: '-30% 0px -40% 0px' // Center the detection zone
  });

  sections.forEach(section => observer.observe(section));
}

/**
 * Contact Form Validation & Toast Notification
 */
function initContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    
    if (!form.checkValidity()) {
      event.stopPropagation();
      form.classList.add('was-validated');
      return;
    }

    // Form is valid - simulate submission
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;
    
    // Show loading spinner inside button
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Sending...`;

    setTimeout(() => {
      // Reset button
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
      
      // Reset form
      form.reset();
      form.classList.remove('was-validated');
      
      // Show success toast
      showToast('Success', 'Your message has been sent successfully. We will get back to you soon!', 'success');
    }, 1500);
  });
}

/**
 * Back to Top Button
 */
function initBackToTop() {
  const backToTopBtn = document.getElementById('backToTop');
  if (!backToTopBtn) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 300) {
      backToTopBtn.classList.add('show');
    } else {
      backToTopBtn.classList.remove('show');
    }
  });

  backToTopBtn.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });
}

/**
 * Helper: Show Toast Notification
 * @param {string} title - Toast title
 * @param {string} message - Toast body message
 * @param {string} type - 'success' | 'error' | 'info'
 */
function showToast(title, message, type = 'success') {
  const toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) return;

  const toastId = 'toast_' + Date.now();
  const iconClass = type === 'success' ? 'bi-check-circle-fill text-success' : 'bi-exclamation-triangle-fill text-danger';

  const toastHtml = `
    <div id="${toastId}" class="toast custom-toast" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="toast-header border-0 bg-transparent">
        <i class="bi ${iconClass} me-2"></i>
        <strong class="me-auto">${title}</strong>
        <small class="text-muted">Just now</small>
        <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
      <div class="toast-body pt-0">
        ${message}
      </div>
    </div>
  `;

  toastContainer.insertAdjacentHTML('beforeend', toastHtml);
  
  const toastElement = document.getElementById(toastId);
  // Bootstrap 5 Toast init
  if (window.bootstrap && window.bootstrap.Toast) {
    const bsToast = new bootstrap.Toast(toastElement, { delay: 5000 });
    bsToast.show();

    // Remove from DOM after hidden
    toastElement.addEventListener('hidden.bs.toast', () => {
      toastElement.remove();
    });
  }
}
