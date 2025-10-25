// API Configuration
const API_BASE_URL = window.location.origin + '/api';

// API Helper Functions
class API {
  static async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = localStorage.getItem('token');
    
    console.log(`Making API request to: ${url}`);
    console.log('Token available:', !!token);
    
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      }
    };

    const config = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers
      }
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('API Error Response:', errorData);
        // Attach parsed error data to the Error object so callers can access validation details
        const err = new Error(errorData.message || `HTTP error! status: ${response.status}`);
        err.data = errorData;
        throw err;
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Auth endpoints
  static async login(credentials) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
  }

  static async register(userData) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  }

  static async getCurrentUser() {
    return this.request('/auth/me');
  }

  // Inventory endpoints
  static async getInventory(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/inventory?${queryString}`);
  }

  static async getInventoryItem(id) {
    return this.request(`/inventory/${id}`);
  }

  static async createInventoryItem(itemData) {
    return this.request('/inventory', {
      method: 'POST',
      body: JSON.stringify(itemData)
    });
  }

  static async updateInventoryItem(id, itemData) {
    return this.request(`/inventory/${id}`, {
      method: 'PUT',
      body: JSON.stringify(itemData)
    });
  }

  static async deleteInventoryItem(id) {
    return this.request(`/inventory/${id}`, {
      method: 'DELETE'
    });
  }

  static async getLowStockItems() {
    return this.request('/inventory/alerts/low-stock');
  }

  static async getCategories() {
    return this.request('/inventory/data/categories');
  }

  // Supplier endpoints
  static async getSuppliers(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/suppliers?${queryString}`);
  }

  static async getSupplier(id) {
    return this.request(`/suppliers/${id}`);
  }

  static async createSupplier(supplierData) {
    return this.request('/suppliers', {
      method: 'POST',
      body: JSON.stringify(supplierData)
    });
  }

  static async updateSupplier(id, supplierData) {
    return this.request(`/suppliers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(supplierData)
    });
  }

  static async deleteSupplier(id) {
    return this.request(`/suppliers/${id}`, {
      method: 'DELETE'
    });
  }

  static async getSupplierStats(id) {
    return this.request(`/suppliers/${id}/stats`);
  }

  // Purchase endpoints
  static async getPurchases(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/purchases?${queryString}`);
  }

  static async getPurchase(id) {
    return this.request(`/purchases/${id}`);
  }

  static async createPurchase(purchaseData) {
    return this.request('/purchases', {
      method: 'POST',
      body: JSON.stringify(purchaseData)
    });
  }

  static async updatePurchaseStatus(id, status) {
    return this.request(`/purchases/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  }

  static async deletePurchase(id) {
    return this.request(`/purchases/${id}`, {
      method: 'DELETE'
    });
  }

  static async getReorderSuggestions() {
    return this.request('/purchases/suggestions/reorder');
  }

  // Analytics endpoints
  static async getDashboardStats() {
    return this.request('/analytics/dashboard');
  }

  static async getSalesTrends(days = 30) {
    return this.request(`/analytics/sales-trends?days=${days}`);
  }

  static async getInventoryTurnover() {
    return this.request('/analytics/inventory-turnover');
  }

  static async getSupplierPerformance() {
    return this.request('/analytics/supplier-performance');
  }

  static async getCategoryAnalysis() {
    return this.request('/analytics/category-analysis');
  }

  static async getAlerts() {
    return this.request('/analytics/alerts');
  }
}

// Admin User Management
API.getUsers = async function(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return API.request(`/auth/users?${qs}`);
};

API.createUser = async function(user) {
  return API.request('/auth/users', { method: 'POST', body: JSON.stringify(user) });
};

API.updateUser = async function(id, update) {
  return API.request(`/auth/users/${id}`, { method: 'PUT', body: JSON.stringify(update) });
};

API.deleteUser = async function(id) {
  return API.request(`/auth/users/${id}`, { method: 'DELETE' });
};

// Utility Functions
class Utils {
  static formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount || 0);
  }

  static formatDate(date) {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(new Date(date));
  }

  static formatDateTime(date) {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  }

  static formatNumber(number) {
    return new Intl.NumberFormat('en-US').format(number);
  }

  static debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  static showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <i class="fas fa-${this.getNotificationIcon(type)}"></i>
        <span>${message}</span>
      </div>
      <button class="notification-close">
        <i class="fas fa-times"></i>
      </button>
    `;

    // Add to page
    document.body.appendChild(notification);

    // Show notification
    setTimeout(() => notification.classList.add('show'), 100);

    // Auto remove after 5 seconds
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 5000);

    // Close button functionality
    notification.querySelector('.notification-close').addEventListener('click', () => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    });
  }

  static getNotificationIcon(type) {
    const icons = {
      success: 'check-circle',
      error: 'exclamation-circle',
      warning: 'exclamation-triangle',
      info: 'info-circle'
    };
    return icons[type] || 'info-circle';
  }

  static showLoading(element) {
    element.classList.add('loading');
  }

  static hideLoading(element) {
    element.classList.remove('loading');
  }

  static confirmDialog(message, title = 'Confirm') {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'modal-overlay active';
      modal.innerHTML = `
        <div class="modal" style="max-width: 400px;">
          <div class="modal-header">
            <h3 class="modal-title">${title}</h3>
          </div>
          <div class="modal-body">
            <p>${message}</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="cancelBtn">Cancel</button>
            <button class="btn btn-error" id="confirmBtn">Confirm</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      modal.querySelector('#cancelBtn').addEventListener('click', () => {
        modal.remove();
        resolve(false);
      });

      modal.querySelector('#confirmBtn').addEventListener('click', () => {
        modal.remove();
        resolve(true);
      });

      // Close on overlay click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.remove();
          resolve(false);
        }
      });
    });
  }
}

// Add notification styles
const notificationStyles = `
  .notification {
    position: fixed;
    top: 20px;
    right: 20px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    padding: 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 300px;
    transform: translateX(100%);
    transition: transform 0.3s ease;
    z-index: 3000;
  }

  .notification.show {
    transform: translateX(0);
  }

  .notification-success {
    border-left: 4px solid var(--o-light-success);
  }

  .notification-error {
    border-left: 4px solid var(--o-light-error);
  }

  .notification-warning {
    border-left: 4px solid var(--o-light-warning);
  }

  .notification-info {
    border-left: 4px solid var(--o-light-info);
  }

  .notification-content {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
  }

  .notification-content i {
    color: var(--o-light-accent);
  }

  .notification-close {
    background: none;
    border: none;
    color: var(--o-light-text-secondary);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: background-color 0.2s;
  }

  .notification-close:hover {
    background-color: var(--o-light-bg-secondary);
  }
`;

// Inject notification styles
const styleSheet = document.createElement('style');
styleSheet.textContent = notificationStyles;
document.head.appendChild(styleSheet);
