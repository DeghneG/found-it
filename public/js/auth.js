// Auth module
const Auth = {
  currentUser: null,

  async init() {
    try {
      const data = await apiRequest('/api/auth/me');
      if (data.user) {
        this.currentUser = data.user;
        return true;
      }
    } catch (e) {}
    return false;
  },

  async login(email, password) {
    const data = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    this.currentUser = data.user;
    return data;
  },

  async register(name, email, password) {
    const data = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    });
    this.currentUser = data.user;
    return data;
  },

  async logout() {
    await apiRequest('/api/auth/logout', { method: 'POST' });
    this.currentUser = null;
  },

  setupUI() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const showRegister = document.getElementById('show-register');
    const showLogin = document.getElementById('show-login');
    const loginBtn = document.getElementById('login-btn');
    const registerBtn = document.getElementById('register-btn');
    const loginError = document.getElementById('login-error');
    const registerError = document.getElementById('register-error');

    showRegister.addEventListener('click', (e) => {
      e.preventDefault();
      loginForm.classList.add('hidden');
      registerForm.classList.remove('hidden');
    });

    showLogin.addEventListener('click', (e) => {
      e.preventDefault();
      registerForm.classList.add('hidden');
      loginForm.classList.remove('hidden');
    });

    loginBtn.addEventListener('click', async () => {
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      loginError.classList.add('hidden');
      if (!email || !password) {
        loginError.textContent = 'Please fill in all fields';
        loginError.classList.remove('hidden');
        return;
      }
      loginBtn.disabled = true;
      loginBtn.textContent = 'Signing in...';
      try {
        await this.login(email, password);
        App.showApp();
      } catch (err) {
        loginError.textContent = err.message;
        loginError.classList.remove('hidden');
      }
      loginBtn.disabled = false;
      loginBtn.textContent = 'Sign In';
    });

    registerBtn.addEventListener('click', async () => {
      const name = document.getElementById('register-name').value.trim();
      const email = document.getElementById('register-email').value.trim();
      const password = document.getElementById('register-password').value;
      const confirmPassword = document.getElementById('register-confirm-password').value;
      registerError.classList.add('hidden');
      if (!name || !email || !password || !confirmPassword) {
        registerError.textContent = 'Please fill in all fields';
        registerError.classList.remove('hidden');
        return;
      }
      if (password !== confirmPassword) {
        registerError.textContent = 'Passwords do not match';
        registerError.classList.remove('hidden');
        return;
      }
      if (password.length < 6) {
        registerError.textContent = 'Password must be at least 6 characters';
        registerError.classList.remove('hidden');
        return;
      }
      registerBtn.disabled = true;
      registerBtn.textContent = 'Creating account...';
      try {
        await this.register(name, email, password);
        App.showApp();
      } catch (err) {
        registerError.textContent = err.message;
        registerError.classList.remove('hidden');
      }
      registerBtn.disabled = false;
      registerBtn.textContent = 'Create Account';
    });

    // Enter key support
    document.getElementById('login-password').addEventListener('keypress', (e) => { if (e.key === 'Enter') loginBtn.click(); });
    document.getElementById('register-password').addEventListener('keypress', (e) => { if (e.key === 'Enter') registerBtn.click(); });
  }
};
