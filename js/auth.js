/* ==========================================
   ZIMRENT — Authentication (Backend-connected)
   ========================================== */

const API = '/api/auth';

function getAuthHeader() {
  const token = getSessionToken();
  return token ? { Authorization: 'Bearer ' + token } : {};
}

function getSessionToken() {
  try {
    const raw = sessionStorage.getItem('zimrent_session');
    return raw ? JSON.parse(raw).token : null;
  } catch (e) {
    return null;
  }
}

function saveSession({ token, user }) {
  sessionStorage.setItem('zimrent_session', JSON.stringify({ token, user }));
}

function getSession() {
  try {
    const raw = sessionStorage.getItem('zimrent_session');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

// --- User Management ---
function getCurrentUser() {
  const session = getSession();
  return session ? session.user : null;
}

function loginUser(user) {
  saveSession({ token: user.token, user });
}

function logoutUser() {
  try {
    sessionStorage.removeItem('zimrent_session');
  } catch (e) {}
}

function isLoggedIn() {
  return !!getCurrentUser();
}

function requireLogin() {
  if (!isLoggedIn()) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

// --- Auth Event Handlers ---
function initLoginPage() {
  const form = document.getElementById('login-form');
  if (form) {
    form.addEventListener('submit', handleLogin);
  }

  if (isLoggedIn()) {
    window.location.href = 'dashboard.html';
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  try {
    const res = await fetch(`${API}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (!res.ok) {
      showError(data.error || 'Login failed');
      return;
    }

    loginUser(data);
    window.location.href = 'dashboard.html';
  } catch (err) {
    showError('Network error. Please try again.');
  }
}

function initRegisterPage() {
  const form = document.getElementById('register-form');
  if (form) {
    form.addEventListener('submit', handleRegister);
  }

  if (isLoggedIn()) {
    window.location.href = 'dashboard.html';
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const phone = document.getElementById('reg-phone').value.trim();
  const password = document.getElementById('reg-password').value;
  const confirmPassword = document.getElementById('reg-confirm').value;
  const role = document.getElementById('reg-role')?.value || 'tenant';

  if (!name || !email || !password) {
    showError('Name, email, and password are required.');
    return;
  }

  if (password !== confirmPassword) {
    showError('Passwords do not match.');
    return;
  }

  if (password.length < 6) {
    showError('Password must be at least 6 characters.');
    return;
  }

  try {
    const res = await fetch(`${API}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: name, email, phone, password, role })
    });

    const data = await res.json();
    if (!res.ok) {
      showError(data.error || 'Registration failed.');
      return;
    }

    loginUser(data);
    window.location.href = 'dashboard.html';
  } catch (err) {
    showError('Network error. Please try again.');
  }
}

function showError(message) {
  const errorEl = document.getElementById('auth-error');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }
}

function logout() {
  logoutUser();
  window.location.href = 'index.html';
}

// --- Navbar Update ---
function updateNavbar() {
  const user = getCurrentUser();
  const loginLink = document.getElementById('nav-login');
  const registerLink = document.getElementById('nav-register');
  const logoutLink = document.getElementById('nav-logout');
  const userInfo = document.getElementById('nav-user-info');

  if (user) {
    if (loginLink) loginLink.style.display = 'none';
    if (registerLink) registerLink.style.display = 'none';
    if (logoutLink) logoutLink.style.display = 'inline-block';
    if (userInfo) {
      userInfo.style.display = 'inline-block';
      userInfo.textContent = user.fullName || user.email;
    }
  } else {
    if (loginLink) loginLink.style.display = 'inline-block';
    if (registerLink) registerLink.style.display = 'inline-block';
    if (logoutLink) logoutLink.style.display = 'none';
    if (userInfo) userInfo.style.display = 'none';
  }
}

// --- Initialize ---
document.addEventListener('DOMContentLoaded', () => {
  updateNavbar();

  const page = window.location.pathname.split('/').pop();
  if (page === 'login.html') initLoginPage();
  if (page === 'register.html') initRegisterPage();
});