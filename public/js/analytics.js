// Analytics & Reports Module
class Analytics {
  constructor() {
    this.charts = {};
    this.init();
  }

  init() {
    this.bindEvents();
  }

  bindEvents() {
    // Add any analytics-specific event listeners here
  }

  async loadAnalyticsData() {
    try {
      Utils.showLoading(document.querySelector('#analyticsPage'));
      
      const [
        inventoryTurnover,
        categoryAnalysis,
        supplierPerformance,
        alerts
      ] = await Promise.all([
        API.getInventoryTurnover(),
        API.getCategoryAnalysis(),
        API.getSupplierPerformance(),
        API.getAlerts()
      ]);

      this.createTurnoverChart(inventoryTurnover);
      this.createCategoryChart(categoryAnalysis);
      this.createSupplierChart(supplierPerformance);
      this.updateAlertsList(alerts);

    } catch (error) {
      console.error('Failed to load analytics data:', error);
      Utils.showNotification('Failed to load analytics data', 'error');
    } finally {
      Utils.hideLoading(document.querySelector('#analyticsPage'));
    }
  }

  createTurnoverChart(data) {
    const ctx = document.getElementById('turnoverChart');
    if (!ctx) return;

    // Destroy existing chart
    if (this.charts.turnover) {
      this.charts.turnover.destroy();
    }

    const labels = data.slice(0, 10).map(item => item.name);
    const turnoverRates = data.slice(0, 10).map(item => item.turnoverRate);

    this.charts.turnover = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Turnover Rate',
          data: turnoverRates,
          backgroundColor: 'rgba(113, 75, 103, 0.8)',
          borderColor: '#714B67',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            display: true,
            title: {
              display: true,
              text: 'Items'
            }
          },
          y: {
            display: true,
            title: {
              display: true,
              text: 'Turnover Rate'
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return `Turnover Rate: ${context.parsed.y.toFixed(2)}`;
              }
            }
          }
        }
      }
    });
  }

  createCategoryChart(data) {
    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;

    // Destroy existing chart
    if (this.charts.category) {
      this.charts.category.destroy();
    }

    const labels = data.map(item => item._id);
    const values = data.map(item => item.totalValue);
    const colors = this.generateColors(data.length);

    this.charts.category = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: '#FFFFFF'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 20,
              usePointStyle: true
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const value = context.parsed;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = ((value / total) * 100).toFixed(1);
                return `${context.label}: ${Utils.formatCurrency(value)} (${percentage}%)`;
              }
            }
          }
        }
      }
    });
  }

  createSupplierChart(data) {
    const ctx = document.getElementById('supplierChart');
    if (!ctx) return;

    // Destroy existing chart
    if (this.charts.supplier) {
      this.charts.supplier.destroy();
    }

    const labels = data.map(item => item.name);
    const ratings = data.map(item => item.rating);
    const orderValues = data.map(item => item.totalValue);

    this.charts.supplier = new Chart(ctx, {
      type: 'scatter',
      data: {
        labels: labels,
        datasets: [{
          label: 'Supplier Performance',
          data: data.map(item => ({
            x: item.totalValue,
            y: item.rating
          })),
          backgroundColor: 'rgba(0, 160, 157, 0.8)',
          borderColor: '#00A09D',
          borderWidth: 2,
          pointRadius: 8,
          pointHoverRadius: 10
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            display: true,
            title: {
              display: true,
              text: 'Total Order Value ($)'
            },
            ticks: {
              callback: function(value) {
                return Utils.formatCurrency(value);
              }
            }
          },
          y: {
            display: true,
            title: {
              display: true,
              text: 'Rating'
            },
            min: 0,
            max: 5
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              title: function(context) {
                return context[0].raw.label || '';
              },
              label: function(context) {
                const data = context.raw;
                return [
                  `Total Value: ${Utils.formatCurrency(data.x)}`,
                  `Rating: ${data.y}/5`
                ];
              }
            }
          }
        }
      }
    });
  }

  updateAlertsList(alerts) {
    const container = document.getElementById('alertsList');
    
    if (!alerts || alerts.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-check-circle"></i>
          <p>No alerts at this time</p>
        </div>
      `;
      return;
    }

    container.innerHTML = alerts.map(alert => {
      const supplierName = alert && alert.supplier ? (alert.supplier.name || '') : '';
      const urgency = alert && alert.urgency ? alert.urgency : 'info';
      return `
      <div class="alert-item">
        <div class="alert-icon ${urgency}">
          <i class="fas fa-${this.getAlertIcon(urgency)}"></i>
        </div>
        <div class="alert-content">
          <div class="alert-title">${alert.name}</div>
          <div class="alert-description">
            Current stock: ${alert.currentStock} | 
            Reorder point: ${alert.reorderPoint} | 
            Supplier: ${supplierName}
          </div>
          <div class="alert-meta">
            <span class="alert-urgency ${urgency}">${urgency}</span>
            <span>Days until out of stock: ${alert.daysUntilOutOfStock}</span>
          </div>
          <div class="alert-actions">
            <button class="btn btn-sm btn-primary" onclick="analytics.createReorder('${alert._id}')">
              <i class="fas fa-plus"></i>
              Create Reorder
            </button>
            <button class="btn btn-sm btn-secondary" onclick="analytics.viewItem('${alert._id}')">
              <i class="fas fa-eye"></i>
              View Item
            </button>
          </div>
        </div>
      </div>
    `}).join('');
  }

  getAlertIcon(urgency) {
    const icons = {
      critical: 'exclamation-triangle',
      warning: 'exclamation-circle',
      info: 'info-circle'
    };
    return icons[urgency] || 'info-circle';
  }

  generateColors(count) {
    const baseColors = [
      '#714B67', '#00A09D', '#9C7BA6', '#33B9B5',
      '#28A745', '#FFC107', '#E74C3C', '#17A2B8'
    ];
    
    const colors = [];
    for (let i = 0; i < count; i++) {
      colors.push(baseColors[i % baseColors.length]);
    }
    return colors;
  }

  async createReorder(itemId) {
    try {
      // This would create a reorder for the specific item
      Utils.showNotification('Reorder created successfully', 'success');
    } catch (error) {
      Utils.showNotification('Failed to create reorder', 'error');
    }
  }

  async viewItem(itemId) {
    try {
      // This would navigate to the inventory item details
      window.app.navigateToPage('inventory');
      // You could also highlight the specific item in the inventory table
    } catch (error) {
      Utils.showNotification('Failed to load item details', 'error');
    }
  }

  // Method to refresh analytics data
  async refresh() {
    await this.loadAnalyticsData();
  }

  // Export functionality
  async exportAnalytics(format = 'csv') {
    try {
      const [turnover, categories, suppliers, alerts] = await Promise.all([
        API.getInventoryTurnover(),
        API.getCategoryAnalysis(),
        API.getSupplierPerformance(),
        API.getAlerts()
      ]);

      const data = {
        turnover,
        categories,
        suppliers,
        alerts
      };

      if (format === 'csv') {
        this.exportToCSV(data);
      } else if (format === 'json') {
        this.exportToJSON(data);
      }

      Utils.showNotification('Analytics exported successfully', 'success');
    } catch (error) {
      Utils.showNotification('Failed to export analytics', 'error');
    }
  }

  exportToCSV(data) {
    const csvContent = this.convertToCSV(data);
    this.downloadFile(csvContent, 'analytics-report.csv', 'text/csv');
  }

  exportToJSON(data) {
    const jsonContent = JSON.stringify(data, null, 2);
    this.downloadFile(jsonContent, 'analytics-report.json', 'application/json');
  }

  convertToCSV(data) {
    let csv = 'Analytics Report\n\n';
    
    // Inventory Turnover
    csv += 'Inventory Turnover\n';
    csv += 'Item Name,Turnover Rate,Total Sold,Current Stock\n';
    data.turnover.forEach(item => {
      csv += `"${item.name}",${item.turnoverRate.toFixed(2)},${item.totalSold},${item.currentStock}\n`;
    });
    
    csv += '\n';
    
    // Category Analysis
    csv += 'Category Analysis\n';
    csv += 'Category,Total Items,Total Value,Total Sold\n';
    data.categories.forEach(category => {
      csv += `"${category._id}",${category.totalItems},${category.totalValue},${category.totalSold}\n`;
    });
    
    csv += '\n';
    
    // Supplier Performance
    csv += 'Supplier Performance\n';
    csv += 'Supplier Name,Rating,Total Orders,Total Value\n';
    data.suppliers.forEach(supplier => {
      csv += `"${supplier.name}",${supplier.rating},${supplier.totalOrders},${supplier.totalValue}\n`;
    });
    
    csv += '\n';
    
    // Alerts
    csv += 'Low Stock Alerts\n';
    csv += 'Item Name,Current Stock,Reorder Point,Urgency,Supplier\n';
    data.alerts.forEach(alert => {
      csv += `"${alert.name}",${alert.currentStock},${alert.reorderPoint},${alert.urgency},"${alert.supplier.name}"\n`;
    });
    
    return csv;
  }

  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  }
}

// Initialize analytics when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.analytics = new Analytics();
});
