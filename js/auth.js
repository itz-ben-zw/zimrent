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

function loginUser(data) {
  saveSession({ token: data.token, user: data.user });
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

function getCurrentUserId() {
  const user = getCurrentUser();
  return user ? user.id : null;
}

// --- Auth Event Handlers ---
function initLoginPage() {
  const form = document.getElementById('login-form');
  if (form) {
    form.addEventListener('submit', handleLogin);
  }

  // Auth tab switching
  document.querySelectorAll('.auth-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.auth-tab').forEach(b => {
        b.style.background = 'white';
        b.style.color = 'var(--text-dark)';
        b.style.border = '1px solid var(--border)';
      });
      document.querySelectorAll('.auth-panel').forEach(p => p.style.display = 'none');
      btn.style.background = 'var(--primary)';
      btn.style.color = 'white';
      btn.style.border = 'none';
      document.getElementById('panel-' + btn.dataset.tab).style.display = 'block';
    });
  });

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
      if (data.error && data.error.includes('Too many')) {
        console.warn('Rate-limited by backend:', data.error);
      }
      return;
    }

    loginUser(data);
    if (data.user.role === 'tenant') {
      window.location.href = 'listings.html';
    } else {
      window.location.href = 'dashboard.html';
    }
  } catch (err) {
    showError('Network error. Please try again.');
  }
}

// --- Phone OTP Login ---
async function sendOTP() {
  const phone = document.getElementById('login-phone').value.trim();
  if (!phone) {
    showError('Please enter your phone number.');
    return;
  }

  const btn = document.getElementById('send-otp-btn');
  btn.disabled = true;
  btn.textContent = 'Sending...';

  try {
    const res = await fetch(`${API}/phone/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });
    const data = await res.json();
    btn.disabled = false;
    btn.textContent = 'Send OTP';

    if (!res.ok) {
      showError(data.error || 'Failed to send OTP');
      return;
    }

    document.getElementById('phone-step-1').style.display = 'none';
    document.getElementById('phone-step-2').style.display = 'block';
    document.getElementById('otp-phone-display').textContent = phone;
    if (data.debug) {
      console.log('📱 OTP for debugging:', data.debug);
      document.getElementById('login-otp').placeholder = `Debug: ${data.debug}`;
    }
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Send OTP';
    showError('Network error. Please try again.');
  }
}

async function verifyOTP() {
  const phone = document.getElementById('otp-phone-display').textContent;
  const otp = document.getElementById('login-otp').value.trim();
  if (!otp) {
    showError('Please enter the OTP code.');
    return;
  }

  try {
    const res = await fetch(`${API}/phone/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, otp })
    });
    const data = await res.json();
    if (!res.ok) {
      showError(data.error || 'Network error. Please try again.');
      if (data.error && data.error.includes('Too many')) {
        console.warn('Rate-limited by backend:', data.error);
      }
      return;
    }

    loginUser(data);
    if (data.user.role === 'tenant') {
      window.location.href = 'listings.html';
    } else {
      window.location.href = 'dashboard.html';
    }
  } catch (err) {
    showError('Network error. Please try again.');
  }
}

function resetPhoneLogin() {
  document.getElementById('phone-step-1').style.display = 'block';
  document.getElementById('phone-step-2').style.display = 'none';
  document.getElementById('login-otp').value = '';
  document.getElementById('login-otp').placeholder = '6-digit code';
  hideError();
}

// --- Google Sign-In ---
function handleGoogleLogin() {
  const GOOGLE_CLIENT_ID = '264173024062-vci0i2i5i75524gu8cnfpf79l48i241q.apps.googleusercontent.com';
  if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.includes('YOUR_GOOGLE_CLIENT_ID')) {
    showError('Google Sign-In is not configured yet. Please use Email or Phone login.');
    return;
  }
  if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
    showError('Google Sign-In is loading. Please try again in a moment.');
    return;
  }

  const btn = document.getElementById('google-login-btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Signing in with Google...';
  }

  const tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: 'email profile',
    callback: (response) => {
      if (!response.access_token) {
        showError('Google sign-in was cancelled or failed. Please try again.');
        if (btn) { btn.disabled = false; btn.textContent = 'Continue with Google'; }
        return;
      }
      fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: 'Bearer ' + response.access_token }
      })
      .then(r => r.json())
      .then(googleUser => {
        return fetch(`${API}/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: googleUser.email,
            fullName: googleUser.name,
            googleId: googleUser.sub,
            profileImage: googleUser.picture
          })
        });
      })
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          showError(data.error || 'Google sign-in failed.');
          if (btn) { btn.disabled = false; btn.textContent = 'Continue with Google'; }
          return;
        }
        loginUser(data);
        if (data.user.role === 'tenant') {
          window.location.href = 'listings.html';
        } else {
          window.location.href = 'dashboard.html';
        }
      })
      .catch(err => {
        showError('Network error during Google sign-in. Please try again.');
        console.error('Google login error:', err);
        if (btn) { btn.disabled = false; btn.textContent = 'Continue with Google'; }
      });
    }
  });

  tokenClient.requestAccessToken();
}

function initRegisterPage() {
  const form = document.getElementById('register-form');
  if (form) {
    form.addEventListener('submit', handleRegister);
  }

  // Profile picture preview
  const picInput = document.getElementById('reg-pic-input');
  if (picInput) {
    picInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        document.getElementById('reg-pic-img').src = ev.target.result;
        document.getElementById('reg-pic-img').style.display = 'block';
        document.getElementById('reg-pic-placeholder').style.display = 'none';
      };
      reader.readAsDataURL(file);
    });
  }

  if (isLoggedIn()) {
    window.location.href = 'dashboard.html';
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('reg-name').value.trim();
  const username = document.getElementById('reg-username')?.value.trim() || '';
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
    // Use FormData for file upload support
    const picFile = document.getElementById('reg-pic-input')?.files?.[0];
    
    const headers = { 'Content-Type': 'application/json' };
    const body = JSON.stringify({ fullName: name, username, email, phone, password, role });

    // If profile image is selected, include it
    let finalBody, finalHeaders;
    if (picFile) {
      const formData = new FormData();
      formData.append('fullName', name);
      formData.append('username', username);
      formData.append('email', email);
      formData.append('phone', phone);
      formData.append('password', password);
      formData.append('role', role);
      formData.append('profileImage', picFile);
      finalBody = formData;
      finalHeaders = {}; // Content-Type set by FormData
    } else {
      finalBody = JSON.stringify({ fullName: name, username, email, phone, password, role });
      finalHeaders = { 'Content-Type': 'application/json' };
    }

    const res = await fetch(`${API}/register`, {
      method: 'POST',
      headers: picFile ? undefined : { 'Content-Type': 'application/json' },
      body: finalBody
    });

    const data = await res.json();
    if (!res.ok) {
      showError(data.error || 'Registration failed.');
      return;
    }

    loginUser(data);
    if (data.user.role === 'tenant') {
      window.location.href = 'listings.html';
    } else {
      window.location.href = 'dashboard.html';
    }
  } catch (err) {
    showError('Network error. Please try again.');
  }
}

function showError(message) {
  const errorEl = document.getElementById('auth-error');
  const successEl = document.getElementById('auth-success');
  if (successEl) successEl.style.display = 'none';
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }
}

function hideError() {
  const errorEl = document.getElementById('auth-error');
  if (errorEl) errorEl.style.display = 'none';
  const successEl = document.getElementById('auth-success');
  if (successEl) successEl.style.display = 'none';
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
  const messagesLink = document.getElementById('nav-messages');
  const profileLink = document.getElementById('nav-profile');

  if (user) {
    if (loginLink) loginLink.style.display = 'none';
    if (registerLink) registerLink.style.display = 'none';
    if (logoutLink) logoutLink.style.display = 'inline-block';
    if (messagesLink) messagesLink.style.display = 'inline-block';
    if (profileLink) profileLink.style.display = 'inline-block';
    if (userInfo) {
      userInfo.style.display = 'inline-flex';
      userInfo.style.alignItems = 'center';
      userInfo.style.gap = '6px';
      userInfo.style.cursor = 'pointer';
      
      const displayName = user.username || user.fullName || user.email;
      const pic = user.profileImage;
      
      if (pic) {
        userInfo.innerHTML = `<img src="${pic}" style="width:28px; height:28px; border-radius:50%; object-fit:cover; border:2px solid var(--primary);" alt="Profile"> <span>${displayName}</span>`;
      } else {
        userInfo.innerHTML = `<i class="fas fa-user-circle" style="font-size:1.3rem; color:var(--primary);"></i> <span>${displayName}</span>`;
      }
      
      userInfo.onclick = () => { window.location.href = 'profile.html'; };
    }
  } else {
    if (loginLink) loginLink.style.display = 'inline-block';
    if (registerLink) registerLink.style.display = 'inline-block';
    if (logoutLink) logoutLink.style.display = 'none';
    if (messagesLink) messagesLink.style.display = 'none';
    if (profileLink) profileLink.style.display = 'none';
    if (userInfo) {
      userInfo.style.display = 'none';
      userInfo.onclick = null;
    }
  }
}

// --- Initialize ---
document.addEventListener('DOMContentLoaded', () => {
  updateNavbar();

  const page = window.location.pathname.split('/').pop();
  if (page === 'login.html') initLoginPage();
  if (page === 'register.html') initRegisterPage();
});