// Main Application Module
class App {
  constructor() {
    this.currentPage = 'dashboard';
    this.init();
  }

  init() {
    this.bindEvents();
    this.setupRouting();
    this.initializeApp();
  }

  bindEvents() {
    // Sidebar toggle
    document.getElementById('sidebarToggle').addEventListener('click', () => {
      this.toggleSidebar();
    });

    // Menu navigation
    document.querySelectorAll('.menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        // Enforce role-based access for menu items with data-roles
        const rolesAttr = (item.getAttribute('data-roles') || '').split(',').map(s => s.trim()).filter(Boolean);
        if (rolesAttr.length) {
          const allowed = window.auth && window.auth.hasAnyRole ? window.auth.hasAnyRole(rolesAttr) : false;
          if (!allowed) {
            Utils.showNotification('Access denied. Insufficient permissions.', 'error');
            return;
          }
        }
        const page = item.dataset.page;
        this.navigateToPage(page);
      });
    });

    // Global search
    const globalSearch = document.getElementById('globalSearch');
    if (globalSearch) {
      globalSearch.addEventListener('input', Utils.debounce((e) => {
        this.handleGlobalSearch(e.target.value);
      }, 300));
    }

    // Notification button
    document.getElementById('notificationBtn').addEventListener('click', () => {
      this.showNotifications();
    });

    // Window resize
    window.addEventListener('resize', () => {
      this.handleResize();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      this.handleKeyboardShortcuts(e);
    });
  }

  setupRouting() {
    // Handle browser back/forward
    window.addEventListener('popstate', (e) => {
      const page = e.state?.page || 'dashboard';
      this.navigateToPage(page, false);
    });

    // Set initial state
    history.replaceState({ page: this.currentPage }, '', '#dashboard');
  }

  async initializeApp() {
    // Wait for auth to be ready
    if (!window.auth || !window.auth.isAuthenticated()) {
      return;
    }

    try {
      // Initialize dashboard
      if (window.dashboard) {
        await window.dashboard.loadDashboardData();
      }

      // Load initial page
      this.navigateToPage(this.currentPage);
    } catch (error) {
      console.error('App initialization failed:', error);
      Utils.showNotification('Failed to initialize application', 'error');
    }
  }

  navigateToPage(page, updateHistory = true) {
    // Page-level guard (e.g., users -> admin only)
    const pageRoles = {
      users: ['admin']
    };
    if (pageRoles[page]) {
      const allowed = window.auth && window.auth.hasAnyRole && window.auth.hasAnyRole(pageRoles[page]);
      if (!allowed) {
        Utils.showNotification('Access denied. Insufficient permissions.', 'error');
        page = 'dashboard';
      }
    }
    // Update current page
    this.currentPage = page;

    // Update active menu item
    document.querySelectorAll('.menu-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === page);
    });

    // Update page title and breadcrumb
    this.updatePageHeader(page);

    // Show/hide pages
    document.querySelectorAll('.page').forEach(pageElement => {
      pageElement.classList.toggle('active', pageElement.id === `${page}Page`);
    });

    // Update URL
    if (updateHistory) {
      history.pushState({ page }, '', `#${page}`);
    }

    // Load page-specific data
    this.loadPageData(page);

    // Close sidebar on mobile
    if (window.innerWidth <= 768) {
      this.closeSidebar();
    }
  }

  updatePageHeader(page) {
    const titles = {
      dashboard: 'Dashboard',
      inventory: 'Inventory Management',
      suppliers: 'Supplier Management',
      purchases: 'Purchase Orders',
      analytics: 'Analytics & Reports'
    };

    const breadcrumbs = {
      dashboard: ['Home', 'Dashboard'],
      inventory: ['Home', 'Inventory'],
      suppliers: ['Home', 'Suppliers'],
      purchases: ['Home', 'Purchases'],
      analytics: ['Home', 'Analytics']
    };

    document.getElementById('pageTitle').textContent = titles[page] || 'Dashboard';
    
    const breadcrumb = document.getElementById('breadcrumb');
    const breadcrumbItems = breadcrumbs[page] || ['Home', 'Dashboard'];
    breadcrumb.innerHTML = breadcrumbItems.map((item, index) => 
      index === breadcrumbItems.length - 1 
        ? `<span>${item}</span>`
        : `<span>${item}</span><i class="fas fa-chevron-right"></i>`
    ).join('');
  }

  async loadPageData(page) {
    try {
      switch (page) {
        case 'dashboard':
          if (window.dashboard) {
            await window.dashboard.loadDashboardData();
          }
          break;
        case 'inventory':
          if (window.inventory) {
            await window.inventory.loadInventoryData();
          }
          break;
        case 'suppliers':
          if (window.suppliers) {
            await window.suppliers.loadSuppliersData();
          }
          break;
        case 'purchases':
          if (window.purchases) {
            await window.purchases.loadPurchasesData();
          }
          break;
        case 'analytics':
          if (window.analytics) {
            await window.analytics.loadAnalyticsData();
          }
          break;
        case 'users':
          if (window.usersPage) {
            await window.usersPage.loadUsers();
          }
          break;
      }
    } catch (error) {
      console.error(`Failed to load ${page} data:`, error);
      Utils.showNotification(`Failed to load ${page} data`, 'error');
    }
  }

  toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    
    sidebar.classList.toggle('collapsed');
    mainContent.classList.toggle('expanded');
  }

  closeSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    
    sidebar.classList.add('collapsed');
    mainContent.classList.add('expanded');
  }

  handleGlobalSearch(query) {
    if (!query.trim()) return;

    // For now, just show a notification
    // In a real app, this would search across all modules
    Utils.showNotification(`Searching for "${query}"...`, 'info');
  }

  showNotifications() {
    // For now, just show a placeholder
    Utils.showNotification('No new notifications', 'info');
  }

  handleResize() {
    // Close sidebar on mobile when resizing to desktop
    if (window.innerWidth > 768) {
      const sidebar = document.querySelector('.sidebar');
      const mainContent = document.querySelector('.main-content');
      
      sidebar.classList.remove('collapsed');
      mainContent.classList.remove('expanded');
    }
  }

  handleKeyboardShortcuts(e) {
    // Ctrl/Cmd + K for search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      document.getElementById('globalSearch').focus();
    }

    // Escape to close modals
    if (e.key === 'Escape') {
      const modal = document.querySelector('.modal-overlay.active');
      if (modal) {
        modal.classList.remove('active');
      }
    }

    // Number keys for quick navigation
    if (e.altKey && e.key >= '1' && e.key <= '5') {
      e.preventDefault();
      const pages = ['dashboard', 'inventory', 'suppliers', 'purchases', 'analytics'];
      const pageIndex = parseInt(e.key) - 1;
      if (pages[pageIndex]) {
        this.navigateToPage(pages[pageIndex]);
      }
    }
  }

  // Utility methods
  showModal(title, content, actions = []) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3 class="modal-title">${title}</h3>
          <button class="modal-close">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          ${content}
        </div>
        <div class="modal-footer">
          ${actions.map(action => 
            `<button class="btn ${action.class || 'btn-secondary'}" data-action="${action.action}">
              ${action.text}
            </button>`
          ).join('')}
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Close button
    modal.querySelector('.modal-close').addEventListener('click', () => {
      modal.remove();
    });

    // Overlay click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });

    // Action buttons
    modal.querySelectorAll('[data-action]').forEach(button => {
      button.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        const actionHandler = actions.find(a => a.action === action);
        if (actionHandler && actionHandler.handler) {
          actionHandler.handler();
        }
        modal.remove();
      });
    });

    return modal;
  }

  hideModal() {
    const modal = document.querySelector('.modal-overlay.active');
    if (modal) {
      modal.remove();
    }
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
