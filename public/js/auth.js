// Authentication Module
class Auth {
  constructor() {
    this.currentUser = null;
    this.init();
  }

  init() {
    this.bindEvents();
    this.checkAuthStatus();
  }

  bindEvents() {
    // Login form
    document.getElementById('loginForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleLogin();
    });

    // Register form
    document.getElementById('registerForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleRegister();
    });

    // Toggle between login and register
    document.getElementById('registerLink').addEventListener('click', (e) => {
      e.preventDefault();
      this.showRegister();
    });

    document.getElementById('loginLink').addEventListener('click', (e) => {
      e.preventDefault();
      this.showLogin();
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
      this.logout();
    });
  }

  async checkAuthStatus() {
    const token = localStorage.getItem('token');
    if (!token) {
      this.showLogin();
      return;
    }

    try {
      const response = await API.getCurrentUser();
      this.currentUser = response.user;
      this.showMainApp();
      this.updateUserInfo();
    } catch (error) {
      console.error('Auth check failed:', error);
      this.logout();
    }
  }

  async handleLogin() {
    const form = document.getElementById('loginForm');
    const formData = new FormData(form);
    const credentials = {
      email: formData.get('email'),
      password: formData.get('password')
    };

    try {
      Utils.showLoading(form.querySelector('button[type="submit"]'));
      
      const response = await API.login(credentials);
      
      console.log('Login response received:', response);
      localStorage.setItem('token', response.token);
      console.log('Token stored in localStorage:', !!localStorage.getItem('token'));
      this.currentUser = response.user;
      
      Utils.showNotification('Login successful!', 'success');
      this.showMainApp();
      this.updateUserInfo();
      
    } catch (error) {
      // If server returned validation errors, prefer those messages
      let msg = error.message || 'Login failed';
      if (error.data) {
        if (Array.isArray(error.data.errors) && error.data.errors.length) {
          msg = error.data.errors.map(e => e.msg || e.message || `${e.param} invalid`).join('; ');
        } else if (error.data.message) {
          msg = error.data.message;
        }
      }
      Utils.showNotification(msg, 'error');
    } finally {
      Utils.hideLoading(form.querySelector('button[type="submit"]'));
    }
  }

  async handleRegister() {
    const form = document.getElementById('registerForm');
    const formData = new FormData(form);
    const userData = {
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      username: formData.get('username'),
      email: formData.get('email'),
      password: formData.get('password')
    };

    try {
      Utils.showLoading(form.querySelector('button[type="submit"]'));
      
      const response = await API.register(userData);
      
      localStorage.setItem('token', response.token);
      this.currentUser = response.user;
      
      Utils.showNotification('Account created successfully!', 'success');
      this.showMainApp();
      this.updateUserInfo();
      
    } catch (error) {
      // If server returned validation errors, prefer those messages
      let msg = error.message || 'Registration failed';
      if (error.data) {
        if (Array.isArray(error.data.errors) && error.data.errors.length) {
          msg = error.data.errors.map(e => e.msg || e.message || `${e.param} invalid`).join('; ');
        } else if (error.data.message) {
          msg = error.data.message;
        }
      }
      Utils.showNotification(msg, 'error');
    } finally {
      Utils.hideLoading(form.querySelector('button[type="submit"]'));
    }
  }

  logout() {
    localStorage.removeItem('token');
    this.currentUser = null;
    this.showLogin();
    Utils.showNotification('Logged out successfully', 'info');
  }

  showLogin() {
    document.getElementById('loginScreen').style.display = 'block';
    document.getElementById('registerScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'none';
  }

  showRegister() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('registerScreen').style.display = 'block';
    document.getElementById('mainApp').style.display = 'none';
  }

  showMainApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('registerScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    this.applyRoleVisibility();
    if (window.innerWidth <= 768) {
      const sidebar = document.querySelector('.sidebar');
      if (sidebar && !sidebar.classList.contains('open')) {
        sidebar.classList.add('open');
        if (!document.getElementById('sidebarBackdrop')) {
          const backdrop = document.createElement('div');
          backdrop.id = 'sidebarBackdrop';
          backdrop.className = 'sidebar-backdrop';
          backdrop.addEventListener('click', () => {
            sidebar.classList.remove('open');
            backdrop.remove();
            document.body.classList.remove('no-scroll');
          });
          document.body.appendChild(backdrop);
          document.body.classList.add('no-scroll');
        }
      }
    }
  }

  updateUserInfo() {
    if (this.currentUser) {
      document.getElementById('userName').textContent = 
        `${this.currentUser.firstName} ${this.currentUser.lastName}`;
      document.getElementById('userRole').textContent = 
        this.currentUser.role.charAt(0).toUpperCase() + this.currentUser.role.slice(1);
      this.applyRoleVisibility();
    }
  }

  applyRoleVisibility() {
    const role = this.currentUser?.role;
    if (!role) return;
    document.querySelectorAll('[data-roles]').forEach(el => {
      const allowed = (el.getAttribute('data-roles') || '').split(',').map(s => s.trim()).filter(Boolean);
      if (allowed.length && !allowed.includes(role)) {
        el.style.display = 'none';
      } else {
        // preserve default display for allowed elements
      }
    });
  }

  isAuthenticated() {
    return !!localStorage.getItem('token');
  }

  getCurrentUser() {
    return this.currentUser;
  }

  hasRole(role) {
    return this.currentUser && this.currentUser.role === role;
  }

  hasAnyRole(roles) {
    return this.currentUser && roles.includes(this.currentUser.role);
  }
}

// Initialize auth when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.auth = new Auth();
});
