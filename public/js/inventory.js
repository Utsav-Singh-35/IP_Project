// Inventory Management Module
class Inventory {
  constructor() {
    this.currentPage = 1;
    this.itemsPerPage = 10;
    this.currentFilter = {};
    this.role = null;
    this.init();
    this.initRole();
  }

  init() {
    this.bindEvents();
  }

  bindEvents() {
    // Add inventory button
    document.getElementById('addInventoryBtn').addEventListener('click', () => {
      this.showAddInventoryModal();
    });

    // Export button
    document.getElementById('exportInventoryBtn').addEventListener('click', () => {
      this.exportInventory();
    });

    // Filters
    document.getElementById('categoryFilter').addEventListener('change', (e) => {
      this.currentFilter.category = e.target.value;
      this.loadInventoryData();
    });

    document.getElementById('statusFilter').addEventListener('change', (e) => {
      this.currentFilter.status = e.target.value;
      this.loadInventoryData();
    });

    document.getElementById('inventorySearch').addEventListener('input', 
      Utils.debounce((e) => {
        this.currentFilter.search = e.target.value;
        this.loadInventoryData();
      }, 300)
    );
  }

  async getCurrentRole() {
    try {
      if (window.auth && typeof window.auth.getCurrentUser === 'function') {
        const user = window.auth.getCurrentUser();
        if (user && user.role) return user.role;
      }
      const resp = await API.getCurrentUser();
      return resp?.user?.role;
    } catch (err) {
      return null;
    }
  }

  async initRole() {
    this.role = await this.getCurrentRole();
    // Hide add button if role is not admin/manager
    const addBtn = document.getElementById('addInventoryBtn');
    if (addBtn && !['admin', 'manager'].includes(this.role)) {
      addBtn.style.display = 'none';
    }
  }

  async loadInventoryData() {
    try {
      Utils.showLoading(document.querySelector('#inventoryPage'));
      
      const params = {
        page: this.currentPage,
        limit: this.itemsPerPage,
        ...this.currentFilter
      };

      const response = await API.getInventory(params);
      this.updateInventoryTable(response.items);
      this.updatePagination(response.pagination);

    } catch (error) {
      console.error('Failed to load inventory data:', error);
      Utils.showNotification('Failed to load inventory data', 'error');
    } finally {
      Utils.hideLoading(document.querySelector('#inventoryPage'));
    }
  }

  updateInventoryTable(items) {
    const tbody = document.querySelector('#inventoryTable tbody');
    
    if (!items || items.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center">
            <div class="empty-state">
              <i class="fas fa-boxes"></i>
              <p>No inventory items found</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = items.map(item => {
      // Derive stock status if backend didn't include virtuals
      const derivedStatus = (item && typeof item.currentStock === 'number')
        ? (item.currentStock <= 0
            ? 'out_of_stock'
            : (item.currentStock <= (item.reorderPoint ?? 0)
                ? 'low_stock'
                : (item.currentStock <= (item.minStock ?? 0)
                    ? 'critical'
                    : 'in_stock')))
        : 'in_stock';
      const stockStatus = (item && item.stockStatus) ? item.stockStatus : derivedStatus;
      const supplierName = item && (item.supplier?.name || item.supplier_name || '');
      const supplierContact = item
        ? (
            (item.supplier && (item.supplier.contactPerson || item.supplier.email))
            || item.supplier_contact
            || item.supplier_email
            || ''
          )
        : '';
      const canEdit = ['admin', 'manager'].includes(this.role);
      const canDelete = ['admin'].includes(this.role);

      return `
      <tr>
        <td>
          <div class="inventory-item-details">
            <div class="inventory-item-sku">${item.sku}</div>
          </div>
        </td>
        <td>
          <div class="inventory-item-details">
            <div class="inventory-item-name">${item.name}</div>
            <div class="inventory-item-category">${item.category}</div>
          </div>
        </td>
        <td>${item.category}</td>
        <td>
          <div class="stock-info">
            <div class="current-stock">${Utils.formatNumber(item.currentStock)}</div>
            <div class="reorder-point">Reorder: ${Utils.formatNumber(item.reorderPoint)}</div>
          </div>
        </td>
        <td>
          <div class="price-info">
            <div class="current-price">${Utils.formatCurrency(item.unitPrice)}</div>
            <div class="cost-price">Cost: ${Utils.formatCurrency(item.costPrice)}</div>
          </div>
        </td>
        <td>
          <div class="supplier-info">
            <div class="supplier-name">${supplierName}</div>
            <div class="supplier-contact">${supplierContact}</div>
          </div>
        </td>
        <td>
          <span class="stock-status ${stockStatus}">${String(stockStatus).replace('_', ' ')}</span>
        </td>
        <td>
          <div class="inventory-actions">
            ${canEdit ? `<button class="btn btn-sm btn-secondary" onclick="inventory.editItem('${item._id}')">
              <i class="fas fa-edit"></i>
            </button>` : ''}
            ${canDelete ? `<button class="btn btn-sm btn-error" onclick="inventory.deleteItem('${item._id}')">
              <i class="fas fa-trash"></i>
            </button>` : ''}
          </div>
        </td>
      </tr>
    `}).join('');
  }

  updatePagination(pagination) {
    // Simple pagination - in a real app, you'd want more sophisticated pagination
    console.log('Pagination:', pagination);
  }

  showAddInventoryModal() {
    const modal = window.app.showModal(
      'Add Inventory Item',
      this.getInventoryFormHTML(),
      [
        {
          text: 'Cancel',
          class: 'btn-secondary',
          action: 'cancel'
        },
        {
          text: 'Save Item',
          class: 'btn-primary',
          action: 'save',
          handler: () => this.saveInventoryItem()
        }
      ]
    );

    this.loadSuppliersForForm();
    this.loadCategoriesForForm();
  }

  getInventoryFormHTML() {
    return `
      <form id="inventoryForm" class="inventory-form">
        <div class="form-section">
          <div class="form-section-title">Basic Information</div>
          <div class="form-group full-width">
            <label for="itemSku">SKU *</label>
            <input type="text" id="itemSku" name="sku" required>
          </div>
          <div class="form-group full-width">
            <label for="itemName">Name *</label>
            <input type="text" id="itemName" name="name" required>
          </div>
          <div class="form-group">
            <label for="itemCategory">Category *</label>
            <input type="text" id="itemCategory" name="category" required>
          </div>
          <div class="form-group">
            <label for="itemLocation">Location</label>
            <input type="text" id="itemLocation" name="location" value="Main Warehouse">
          </div>
          <div class="form-group full-width">
            <label for="itemDescription">Description</label>
            <textarea id="itemDescription" name="description" rows="3"></textarea>
          </div>
        </div>

        <div class="form-section">
          <div class="form-section-title">Pricing & Stock</div>
          <div class="form-group">
            <label for="itemUnitPrice">Unit Price *</label>
            <input type="number" id="itemUnitPrice" name="unitPrice" step="0.01" min="0" required>
          </div>
          <div class="form-group">
            <label for="itemCostPrice">Cost Price *</label>
            <input type="number" id="itemCostPrice" name="costPrice" step="0.01" min="0" required>
          </div>
          <div class="form-group">
            <label for="itemCurrentStock">Current Stock *</label>
            <input type="number" id="itemCurrentStock" name="currentStock" min="0" required>
          </div>
          <div class="form-group">
            <label for="itemMinStock">Minimum Stock</label>
            <input type="number" id="itemMinStock" name="minStock" min="0" value="10">
          </div>
          <div class="form-group">
            <label for="itemMaxStock">Maximum Stock</label>
            <input type="number" id="itemMaxStock" name="maxStock" min="0" value="100">
          </div>
          <div class="form-group">
            <label for="itemReorderPoint">Reorder Point</label>
            <input type="number" id="itemReorderPoint" name="reorderPoint" min="0" value="20">
          </div>
        </div>

        <div class="form-section">
          <div class="form-section-title">Supplier & Status</div>
          <div class="form-group">
            <label for="itemSupplier">Supplier *</label>
            <select id="itemSupplier" name="supplier" required>
              <option value="">Select a supplier</option>
            </select>
          </div>
          <div class="form-group">
            <label for="itemStatus">Status</label>
            <select id="itemStatus" name="status">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="discontinued">Discontinued</option>
            </select>
          </div>
        </div>
      </form>
    `;
  }

  async loadSuppliersForForm() {
    try {
      // Initial fetch to determine total
      let response = await API.getSuppliers({ page: 1, limit: 50 });
      if (response && response.pagination && response.pagination.total > response.suppliers.length) {
        response = await API.getSuppliers({ page: 1, limit: response.pagination.total });
      }

      const select = document.getElementById('itemSupplier');

      // Console log as requested
      const totalCount = response?.pagination?.total ?? (response?.suppliers?.length || 0);
      console.log('[Inventory Form] Suppliers total:', totalCount);
      if (Array.isArray(response?.suppliers)) {
        console.table(response.suppliers.map(s => ({ id: s._id, name: s.name, contact: s.contactPerson, email: s.email })));
      } else {
        console.log('[Inventory Form] Suppliers (raw):', response);
      }

      // Populate select
      select.innerHTML = '<option value="">Select a supplier</option>' +
        response.suppliers.map(supplier =>
          `<option value="${supplier._id}">${supplier.name}</option>`
        ).join('');

      // Visible count near the supplier field
      let hint = document.getElementById('supplierCountHint');
      if (!hint && select && select.parentElement) {
        hint = document.createElement('div');
        hint.id = 'supplierCountHint';
        hint.style.cssText = 'margin-top:6px;font-size:12px;color:#6b7280;';
        select.parentElement.appendChild(hint);
      }
      if (hint) hint.textContent = `Total suppliers available: ${totalCount}`;
    } catch (error) {
      console.error('Failed to load suppliers:', error);
    }
  }

  async loadCategoriesForForm() {
    try {
      const categories = await API.getCategories();
      const input = document.getElementById('itemCategory');
      
      // You could implement autocomplete here
      console.log('Available categories:', categories);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  }

  async saveInventoryItem() {
    const form = document.getElementById('inventoryForm');
    const formData = new FormData(form);
    const itemData = Object.fromEntries(formData.entries());

    // Convert numeric fields
    itemData.unitPrice = parseFloat(itemData.unitPrice);
    itemData.costPrice = parseFloat(itemData.costPrice);
    itemData.currentStock = parseInt(itemData.currentStock);
    itemData.minStock = parseInt(itemData.minStock);
    itemData.maxStock = parseInt(itemData.maxStock);
    itemData.reorderPoint = parseInt(itemData.reorderPoint);

    try {
      await API.createInventoryItem(itemData);
      Utils.showNotification('Inventory item created successfully', 'success');
      window.app.hideModal();
      this.loadInventoryData();
    } catch (error) {
      Utils.showNotification(error.message || 'Failed to create inventory item', 'error');
    }
  }

  async editItem(id) {
    try {
      const item = await API.getInventoryItem(id);
      this.showEditInventoryModal(item);
    } catch (error) {
      Utils.showNotification('Failed to load item details', 'error');
    }
  }

  showEditInventoryModal(item) {
    const modal = window.app.showModal(
      'Edit Inventory Item',
      this.getInventoryFormHTML(item),
      [
        {
          text: 'Cancel',
          class: 'btn-secondary',
          action: 'cancel'
        },
        {
          text: 'Update Item',
          class: 'btn-primary',
          action: 'update',
          handler: () => this.updateInventoryItem(item._id)
        }
      ]
    );

    this.populateForm(item);
    this.loadSuppliersForForm();
  }

  populateForm(item) {
    Object.keys(item).forEach(key => {
      const input = document.getElementById(`item${key.charAt(0).toUpperCase() + key.slice(1)}`);
      if (input) {
        input.value = item[key];
      }
    });
  }

  async updateInventoryItem(id) {
    const form = document.getElementById('inventoryForm');
    const formData = new FormData(form);
    const itemData = Object.fromEntries(formData.entries());

    // Convert numeric fields
    itemData.unitPrice = parseFloat(itemData.unitPrice);
    itemData.costPrice = parseFloat(itemData.costPrice);
    itemData.currentStock = parseInt(itemData.currentStock);
    itemData.minStock = parseInt(itemData.minStock);
    itemData.maxStock = parseInt(itemData.maxStock);
    itemData.reorderPoint = parseInt(itemData.reorderPoint);

    try {
      await API.updateInventoryItem(id, itemData);
      Utils.showNotification('Inventory item updated successfully', 'success');
      window.app.hideModal();
      this.loadInventoryData();
    } catch (error) {
      Utils.showNotification(error.message || 'Failed to update inventory item', 'error');
    }
  }

  async deleteItem(id) {
    const confirmed = await Utils.confirmDialog(
      'Are you sure you want to delete this inventory item? This action cannot be undone.',
      'Delete Item'
    );

    if (confirmed) {
      try {
        await API.deleteInventoryItem(id);
        Utils.showNotification('Inventory item deleted successfully', 'success');
        this.loadInventoryData();
      } catch (error) {
        Utils.showNotification(error.message || 'Failed to delete inventory item', 'error');
      }
    }
  }

  async exportInventory() {
    try {
      // Fetch with current filters; first call to get total
      let params = { page: 1, limit: this.itemsPerPage, ...this.currentFilter };
      let resp = await API.getInventory(params);
      const total = resp?.pagination?.total ?? (resp?.items?.length || 0);
      if (total > resp.items.length) {
        resp = await API.getInventory({ page: 1, limit: total, ...this.currentFilter });
      }
      const date = new Date().toISOString().slice(0,10);
      this.downloadCSV(resp.items || [], `inventory-${date}.csv`);
      Utils.showNotification('Inventory exported successfully', 'success');
    } catch (error) {
      Utils.showNotification('Failed to export inventory', 'error');
    }
  }

  downloadCSV(data, filename) {
    const headers = ['SKU', 'Name', 'Category', 'Current Stock', 'Unit Price (₹)', 'Cost Price (₹)', 'Supplier', 'Status'];
    const esc = (val) => {
      if (val === null || val === undefined) return '';
      const s = String(val).replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const rows = data.map(item => {
      const supplierName = item?.supplier?.name || item?.supplier_name || '';
      return [
        esc(item.sku),
        esc(item.name),
        esc(item.category),
        esc(item.currentStock),
        esc(item.unitPrice),
        esc(item.costPrice),
        esc(supplierName),
        esc(item.status)
      ].join(',');
    });
    const csvContent = [headers.join(','), ...rows].join('\n');

    // Prepend BOM for Excel compatibility
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  }
}

// Initialize inventory when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.inventory = new Inventory();
});
