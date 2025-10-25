// Dashboard Module
class Dashboard {
  constructor() {
    this.charts = {};
    this.init();
  }

  init() {
    this.bindEvents();
    // Apply role-based UI adjustments (non-blocking)
    this.setupRoleUI();
    // Load initial dashboard data
    this.loadDashboardData();
  }

  bindEvents() {
    // Trend period change
    const trendPeriod = document.getElementById('trendPeriod');
    if (trendPeriod) {
      trendPeriod.addEventListener('change', (e) => {
        this.loadSalesTrends(parseInt(e.target.value));
      });
    }
  }

  async loadDashboardData() {
    try {
      Utils.showLoading(document.querySelector('#dashboardPage'));
      
      console.log('Fetching dashboard data...');
      
      // Load stats and trends separately to identify which fails
      console.log('Fetching dashboard stats...');
      const dashboardStats = await API.getDashboardStats();
      console.log('Dashboard stats received:', dashboardStats);
      
      console.log('Fetching sales trends...');
      const salesTrends = await API.getSalesTrends(30);
      console.log('Sales trends received:', salesTrends);
      
      if (dashboardStats && dashboardStats.overview) {
        this.updateOverviewStats(dashboardStats.overview);
      } else {
        console.error('Invalid dashboard stats format:', dashboardStats);
      }
      
      if (dashboardStats && dashboardStats.recentPurchases) {
        this.updateRecentPurchases(dashboardStats.recentPurchases);
      }
      
      if (dashboardStats && dashboardStats.topSellingItems) {
        this.updateTopSellingItems(dashboardStats.topSellingItems);
      }
      
      if (salesTrends) {
        this.createSalesTrendChart(salesTrends);
      }

    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      console.error('Error details:', error.data); // Show validation/server errors
      Utils.showNotification(`Failed to load dashboard data: ${error.message}`, 'error');
    } finally {
      Utils.hideLoading(document.querySelector('#dashboardPage'));
    }
  }

  updateOverviewStats(stats) {
    document.getElementById('totalItems').textContent = Utils.formatNumber(stats.totalItems);
    document.getElementById('lowStockItems').textContent = Utils.formatNumber(stats.lowStockItems);
    document.getElementById('outOfStockItems').textContent = Utils.formatNumber(stats.outOfStockItems);
    document.getElementById('inventoryValue').textContent = Utils.formatCurrency(stats.inventoryValue);
  }

  updateRecentPurchases(purchases) {
    const container = document.getElementById('recentPurchases');
    
    if (!purchases || purchases.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-shopping-cart"></i>
          <p>No recent purchases</p>
        </div>
      `;
      return;
    }

    container.innerHTML = purchases.map(purchase => {
      const supplierName = purchase && purchase.supplier ? (purchase.supplier.name || '') : '';
      return `
      <div class="recent-item">
        <div class="recent-item-icon">
          <i class="fas fa-shopping-cart"></i>
        </div>
        <div class="recent-item-content">
          <div class="recent-item-title">${purchase.purchaseNumber}</div>
          <div class="recent-item-subtitle">${supplierName}</div>
        </div>
        <div class="recent-item-meta">
          <div>${Utils.formatCurrency(purchase.total)}</div>
          <div>${Utils.formatDate(purchase.receivedDate || purchase.orderDate)}</div>
        </div>
      </div>
    `}).join('');
  }

  updateTopSellingItems(items) {
    const container = document.getElementById('topSellingItems');
    
    if (!items || items.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-chart-line"></i>
          <p>No sales data available</p>
        </div>
      `;
      return;
    }

    container.innerHTML = items.map((item, index) => `
      <div class="top-item">
        <div class="top-item-rank ${index < 3 ? 'top-3' : ''}">${index + 1}</div>
        <div class="top-item-content">
          <div class="top-item-name">${item.name}</div>
          <div class="top-item-category">${item.category}</div>
        </div>
        <div class="top-item-stats">
          <div class="top-item-sales">${Utils.formatNumber(item.totalSold)} sold</div>
          <div class="top-item-growth">${Utils.formatCurrency(item.unitPrice)} each</div>
        </div>
      </div>
    `).join('');
  }

  createSalesTrendChart(data) {
    const ctx = document.getElementById('salesTrendChart');
    if (!ctx) return;

    // Destroy existing chart
    if (this.charts.salesTrend) {
      this.charts.salesTrend.destroy();
    }

    const labels = data.map(item => {
      const date = new Date(item._id.year, item._id.month - 1, item._id.day);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    const salesData = data.map(item => item.totalSales);
    const quantityData = data.map(item => item.totalQuantity);

    this.charts.salesTrend = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Sales ($)',
            data: salesData,
            borderColor: '#714B67',
            backgroundColor: 'rgba(113, 75, 103, 0.1)',
            tension: 0.4,
            yAxisID: 'y'
          },
          {
            label: 'Quantity',
            data: quantityData,
            borderColor: '#00A09D',
            backgroundColor: 'rgba(0, 160, 157, 0.1)',
            tension: 0.4,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        scales: {
          x: {
            display: true,
            title: {
              display: true,
              text: 'Date'
            }
          },
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: {
              display: true,
              text: 'Sales ($)'
            },
            ticks: {
              callback: function(value) {
                return Utils.formatCurrency(value);
              }
            }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            title: {
              display: true,
              text: 'Quantity'
            },
            grid: {
              drawOnChartArea: false,
            },
          }
        },
        plugins: {
          legend: {
            position: 'top',
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                if (context.datasetIndex === 0) {
                  return `Sales: ${Utils.formatCurrency(context.parsed.y)}`;
                } else {
                  return `Quantity: ${Utils.formatNumber(context.parsed.y)}`;
                }
              }
            }
          }
        }
      }
    });
  }

  async loadSalesTrends(days) {
    try {
      const data = await API.getSalesTrends(days);
      this.createSalesTrendChart(data);
    } catch (error) {
      console.error('Failed to load sales trends:', error);
      Utils.showNotification('Failed to load sales trends', 'error');
    }
  }

  // Determine current user's role and adjust UI elements accordingly
  async getCurrentRole() {
    // Prefer client-side auth object if available
    try {
      if (window.auth && typeof window.auth.getCurrentUser === 'function') {
        const user = window.auth.getCurrentUser();
        if (user && user.role) return user.role;
      }

      // Fallback: call API to get current user
      const resp = await API.getCurrentUser();
      return resp?.user?.role;
    } catch (err) {
      // Not authenticated or unable to fetch
      return null;
    }
  }

  async setupRoleUI() {
    const role = await this.getCurrentRole();
    if (!role) return; // leave default UI for anonymous / undetermined

    const showIf = (elId, allowedRoles) => {
      const el = document.getElementById(elId);
      if (!el) return;

      // Always show everything to admin
      if (role === 'admin') {
        el.style.display = '';
        return;
      }

      // For other roles, check permissions
      if (!allowedRoles.includes(role)) {
        el.style.display = 'none';
      } else {
        // restore default display if it was hidden
        el.style.display = '';
      }
    };

    // Add/create buttons: available to admin and manager
    showIf('addInventoryBtn', ['manager']);  // admin sees all by default
    showIf('addSupplierBtn', ['manager']);   // admin sees all by default
    showIf('addPurchaseBtn', ['manager']);   // admin sees all by default

    // Financial KPI (inventory value): hide from staff
    const inventoryValueEl = document.getElementById('inventoryValue');
    if (inventoryValueEl) {
      if (role === 'staff') inventoryValueEl.parentElement.style.display = 'none';
      else inventoryValueEl.parentElement.style.display = '';
    }

    // Sales trends chart controls: show only to admin & manager
    showIf('trendPeriod', ['admin', 'manager']);

    // If staff, add a subtle banner that indicates limited access
    // Remove any existing banner when not staff, and add it only for staff
    const existingBanner = document.getElementById('limitedAccessBanner');
    if (role !== 'staff' && existingBanner) {
      existingBanner.remove();
    }

    if (role === 'staff') {
      const header = document.querySelector('.header-left');
      if (header && !document.getElementById('limitedAccessBanner')) {
        const banner = document.createElement('div');
        banner.id = 'limitedAccessBanner';
        banner.className = 'limited-access-banner';
        banner.style.cssText = 'margin-top:8px;padding:8px;border-radius:6px;background:#fff6eb;color:#7a4a00;font-size:13px;';
        banner.textContent = 'Limited dashboard view: contact an administrator for additional permissions.';
        header.appendChild(banner);
      }
    }
  }

  // Method to refresh dashboard data
  async refresh() {
    console.log('Refreshing dashboard data...');
    try {
      await this.loadDashboardData();
      Utils.showNotification('Dashboard data refreshed', 'success');
    } catch (error) {
      console.error('Refresh failed:', error);
      Utils.showNotification('Failed to refresh dashboard', 'error');
    }
  }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.dashboard = new Dashboard();
});
