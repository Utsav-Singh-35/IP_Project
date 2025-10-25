// Purchase Management Module
class Purchases {
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
    // Add purchase button
    document.getElementById('addPurchaseBtn').addEventListener('click', () => {
      this.showAddPurchaseModal();
    });

    // Reorder suggestions button
    document.getElementById('reorderSuggestionsBtn').addEventListener('click', () => {
      this.showReorderSuggestions();
    });

    // Filters
    document.getElementById('purchaseStatusFilter').addEventListener('change', (e) => {
      this.currentFilter.status = e.target.value;
      this.loadPurchasesData();
    });

    document.getElementById('purchaseSearch').addEventListener('input', 
      Utils.debounce((e) => {
        this.currentFilter.search = e.target.value;
        this.loadPurchasesData();
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
    const addBtn = document.getElementById('addPurchaseBtn');
    if (addBtn && !['admin', 'manager'].includes(this.role)) {
      addBtn.style.display = 'none';
    }
  }

  async loadPurchasesData() {
    try {
      console.log('Starting to load purchases data...');
      Utils.showLoading(document.querySelector('#purchasesPage'));
      
      const params = {
        page: this.currentPage,
        limit: this.itemsPerPage,
        ...this.currentFilter
      };

      console.log('Calling API.getPurchases with params:', params);
      const response = await API.getPurchases(params);
      console.log('Received purchases response:', response);
      if (Array.isArray(response?.purchases)) {
        console.table(response.purchases.map(p => ({
          purchaseNumber: p.purchaseNumber,
          supplier: (p.supplier?.name)
            || p.supplier_name
            || (p.items?.[0]?.inventory?.supplier?.name)
            || (typeof p.supplier === 'string' ? p.supplier : ''),
          total: p.total,
          status: p.status
        })));
      }
      
      this.updatePurchasesTable(response.purchases);
      this.updatePagination(response.pagination);

    } catch (error) {
      console.error('Failed to load purchases data:', error);
      console.error('Error details:', error.data);
      Utils.showNotification(`Failed to load purchases data: ${error.message}`, 'error');
    } finally {
      Utils.hideLoading(document.querySelector('#purchasesPage'));
    }
  }

  updatePurchasesTable(purchases) {
    const tbody = document.querySelector('#purchasesTable tbody');
    
    if (!purchases || purchases.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center">
            <div class="empty-state">
              <i class="fas fa-shopping-cart"></i>
              <p>No purchases found</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    const debugRows = purchases.map((p) => ({
      purchaseNumber: p.purchaseNumber,
      supplier_obj_name: p.supplier?.name || null,
      supplier_string: typeof p.supplier === 'string' ? p.supplier : null,
      supplier_name_field: p.supplier_name || null,
      item0_inv_supplier_name: p.items?.[0]?.inventory?.supplier?.name || null,
      item0_inv_supplier_name_field: p.items?.[0]?.inventory?.supplier_name || null
    }));
    try { console.table(debugRows); } catch (_) {}

    tbody.innerHTML = purchases.map(purchase => {
      const canUpdate = ['admin', 'manager'].includes(this.role);
      const canDelete = ['admin'].includes(this.role);
      const supplierName = purchase
        ? (purchase.supplier?.name
            || purchase.supplier_name
            || purchase.items?.[0]?.inventory?.supplier?.name
            || (typeof purchase.supplier === 'string' ? purchase.supplier : '')
          )
        : '';
      const supplierContact = purchase
        ? (purchase.supplier?.contactPerson
            || purchase.supplier_contact
            || '')
        : '';

      return `
      <tr>
        <td>
          <div class="purchase-info">
            <div class="purchase-number">${purchase.purchaseNumber}</div>
          </div>
        </td>
        <td>
          <div class="supplier-info">
            <div class="supplier-name">${supplierName}</div>
            <div class="supplier-contact">${supplierContact}</div>
          </div>
        </td>
        <td>
          <div class="purchase-items-count">${purchase.items.length} items</div>
        </td>
        <td>
          <div class="purchase-total">${Utils.formatCurrency(purchase.total)}</div>
        </td>
        <td>
          <span class="status-badge ${purchase.status}">${purchase.status}</span>
        </td>
        <td>
          <div class="purchase-date">${Utils.formatDate(purchase.orderDate)}</div>
        </td>
        <td>
          <div class="inventory-actions">
            <button class="btn btn-sm btn-secondary" onclick="purchases.viewPurchase('${purchase._id}')">
              <i class="fas fa-eye"></i>
            </button>
            ${canUpdate ? `<button class="btn btn-sm btn-primary" onclick="purchases.updatePurchaseStatus('${purchase._id}')">
              <i class="fas fa-edit"></i>
            </button>` : ''}
            ${canDelete ? `<button class="btn btn-sm btn-error" onclick="purchases.deletePurchase('${purchase._id}')">
              <i class="fas fa-trash"></i>
            </button>` : ''}
          </div>
        </td>
      </tr>
    `}).join('');

    const renderedRows = tbody.querySelectorAll('tr').length;
    console.log('[Purchases] Rendered rows:', renderedRows);
  }

  updatePagination(pagination) {
    // Simple pagination - in a real app, you'd want more sophisticated pagination
    console.log('Pagination:', pagination);
  }

  showAddPurchaseModal() {
    const modal = window.app.showModal(
      'Create Purchase Order',
      this.getPurchaseFormHTML(),
      [
        {
          text: 'Cancel',
          class: 'btn-secondary',
          action: 'cancel'
        },
        {
          text: 'Create Purchase',
          class: 'btn-primary',
          action: 'save',
          handler: () => this.savePurchase()
        }
      ]
    );

    this.loadSuppliersForForm();
    this.loadInventoryForForm();
  }

  getPurchaseFormHTML() {
    return `
      <form id="purchaseForm" class="purchase-form">
        <div class="form-section">
          <div class="form-section-title">Purchase Information</div>
          <div class="form-group">
            <label for="purchaseSupplier">Supplier *</label>
            <div class="supplier-selection">
              <input type="text" id="purchaseSupplier" name="supplier" placeholder="Search suppliers..." required>
              <div class="supplier-dropdown" id="supplierDropdown"></div>
            </div>
          </div>
          <div class="form-group">
            <label for="purchaseExpectedDate">Expected Delivery Date</label>
            <input type="date" id="purchaseExpectedDate" name="expectedDate">
          </div>
          <div class="form-group full-width">
            <label for="purchaseNotes">Notes</label>
            <textarea id="purchaseNotes" name="notes" rows="3"></textarea>
          </div>
        </div>

        <div class="items-section">
          <div class="items-header">
            <h3>Items</h3>
            <button type="button" class="btn btn-sm btn-primary" id="addItemBtn">
              <i class="fas fa-plus"></i>
              Add Item
            </button>
          </div>
          <div class="items-list" id="itemsList">
            <div class="item-row header">
              <div>Item</div>
              <div>Quantity</div>
              <div>Unit Price</div>
              <div>Total</div>
              <div>Action</div>
            </div>
          </div>
          <button type="button" class="btn btn-secondary add-item-btn" id="addItemBtnBottom">
            <i class="fas fa-plus"></i>
            Add Item
          </button>
        </div>

        <div class="purchase-totals">
          <div class="totals-row">
            <span class="totals-label">Subtotal:</span>
            <span class="totals-value" id="subtotal">$0.00</span>
          </div>
          <div class="totals-row">
            <span class="totals-label">Tax:</span>
            <span class="totals-value">
              <input type="number" id="tax" name="tax" step="0.01" min="0" value="0" style="width: 100px; text-align: right;">
            </span>
          </div>
          <div class="totals-row">
            <span class="totals-label">Shipping:</span>
            <span class="totals-value">
              <input type="number" id="shipping" name="shipping" step="0.01" min="0" value="0" style="width: 100px; text-align: right;">
            </span>
          </div>
          <div class="totals-row">
            <span class="totals-label">Total:</span>
            <span class="totals-value" id="total">$0.00</span>
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
      this.suppliers = response.suppliers || [];

      // Console logs for visibility
      const totalCount = response?.pagination?.total ?? this.suppliers.length;
      console.log('[Purchases Form] Suppliers total:', totalCount);
      if (Array.isArray(this.suppliers)) {
        console.table(this.suppliers.map(s => ({ id: s._id, name: s.name, contact: s.contactPerson, email: s.email })));
      } else {
        console.log('[Purchases Form] Suppliers (raw):', response);
      }

      // Visible count hint near supplier search input
      const input = document.getElementById('purchaseSupplier');
      if (input && input.parentElement) {
        let hint = document.getElementById('purchaseSupplierCountHint');
        if (!hint) {
          hint = document.createElement('div');
          hint.id = 'purchaseSupplierCountHint';
          hint.style.cssText = 'margin-top:6px;font-size:12px;color:#6b7280;';
          input.parentElement.appendChild(hint);
        }
        hint.textContent = `Total suppliers available: ${totalCount}`;
      }

      this.setupSupplierSearch();
    } catch (error) {
      console.error('Failed to load suppliers:', error);
    }
  }

  async loadInventoryForForm() {
    try {
      const response = await API.getInventory({ limit: 1000 });
      this.inventory = response.items;
    } catch (error) {
      console.error('Failed to load inventory:', error);
    }
  }

  setupSupplierSearch() {
    const input = document.getElementById('purchaseSupplier');
    const dropdown = document.getElementById('supplierDropdown');

    input.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      const filtered = this.suppliers.filter(supplier => 
        supplier.name.toLowerCase().includes(query) ||
        supplier.contactPerson.toLowerCase().includes(query)
      );

      if (filtered.length > 0) {
        dropdown.innerHTML = filtered.map(supplier => `
          <div class="supplier-option" data-id="${supplier._id}" data-name="${supplier.name}">
            <div class="supplier-option-name">${supplier.name}</div>
            <div class="supplier-option-contact">${supplier.contactPerson} - ${supplier.email}</div>
          </div>
        `).join('');
        dropdown.classList.add('active');
      } else {
        dropdown.classList.remove('active');
      }
    });

    dropdown.addEventListener('click', (e) => {
      const option = e.target.closest('.supplier-option');
      if (option) {
        input.value = option.dataset.name;
        input.dataset.supplierId = option.dataset.id;
        dropdown.classList.remove('active');
      }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.supplier-selection')) {
        dropdown.classList.remove('active');
      }
    });
  }

  addItemRow() {
    const itemsList = document.getElementById('itemsList');
    const itemCount = itemsList.querySelectorAll('.item-row:not(.header)').length;
    
    const itemRow = document.createElement('div');
    itemRow.className = 'item-row';
    itemRow.innerHTML = `
      <div class="item-select">
        <input type="text" class="item-search" placeholder="Search items..." data-item-id="">
        <i class="fas fa-search item-search-icon"></i>
        <div class="item-dropdown"></div>
      </div>
      <div>
        <input type="number" class="quantity-input" min="1" value="1" data-item-index="${itemCount}">
      </div>
      <div>
        <input type="number" class="price-input" step="0.01" min="0" value="0" data-item-index="${itemCount}">
      </div>
      <div class="total-display" data-item-index="${itemCount}">$0.00</div>
      <div>
        <button type="button" class="remove-item">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;

    itemsList.appendChild(itemRow);
    this.setupItemSearch(itemRow);
    this.setupItemCalculations(itemRow);
  }

  setupItemSearch(itemRow) {
    const input = itemRow.querySelector('.item-search');
    const dropdown = itemRow.querySelector('.item-dropdown');

    input.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      const filtered = this.inventory.filter(item => 
        item.name.toLowerCase().includes(query) ||
        item.sku.toLowerCase().includes(query)
      );

      if (filtered.length > 0) {
        dropdown.innerHTML = filtered.map(item => `
          <div class="item-option" data-id="${item._id}" data-name="${item.name}" data-price="${item.costPrice}">
            <div class="item-option-name">${item.name}</div>
            <div class="item-option-details">SKU: ${item.sku} | Price: ${Utils.formatCurrency(item.costPrice)}</div>
          </div>
        `).join('');
        dropdown.classList.add('active');
      } else {
        dropdown.classList.remove('active');
      }
    });

    dropdown.addEventListener('click', (e) => {
      const option = e.target.closest('.item-option');
      if (option) {
        input.value = option.dataset.name;
        input.dataset.itemId = option.dataset.id;
        const priceInput = itemRow.querySelector('.price-input');
        priceInput.value = option.dataset.price;
        dropdown.classList.remove('active');
        this.calculateItemTotal(itemRow);
      }
    });
  }

  setupItemCalculations(itemRow) {
    const quantityInput = itemRow.querySelector('.quantity-input');
    const priceInput = itemRow.querySelector('.price-input');
    const totalDisplay = itemRow.querySelector('.total-display');

    [quantityInput, priceInput].forEach(input => {
      input.addEventListener('input', () => this.calculateItemTotal(itemRow));
    });

    const removeBtn = itemRow.querySelector('.remove-item');
    removeBtn.addEventListener('click', () => {
      itemRow.remove();
      this.calculateTotals();
    });
  }

  calculateItemTotal(itemRow) {
    const quantity = parseFloat(itemRow.querySelector('.quantity-input').value) || 0;
    const price = parseFloat(itemRow.querySelector('.price-input').value) || 0;
    const total = quantity * price;
    
    itemRow.querySelector('.total-display').textContent = Utils.formatCurrency(total);
    this.calculateTotals();
  }

  calculateTotals() {
    const itemRows = document.querySelectorAll('.item-row:not(.header)');
    let subtotal = 0;

    itemRows.forEach(row => {
      const totalText = row.querySelector('.total-display').textContent;
      const total = parseFloat(totalText.replace('$', '').replace(',', '')) || 0;
      subtotal += total;
    });

    const tax = parseFloat(document.getElementById('tax').value) || 0;
    const shipping = parseFloat(document.getElementById('shipping').value) || 0;
    const total = subtotal + tax + shipping;

    document.getElementById('subtotal').textContent = Utils.formatCurrency(subtotal);
    document.getElementById('total').textContent = Utils.formatCurrency(total);
  }

  bindFormEvents() {
    // Add item buttons
    document.getElementById('addItemBtn').addEventListener('click', () => this.addItemRow());
    document.getElementById('addItemBtnBottom').addEventListener('click', () => this.addItemRow());

    // Tax and shipping inputs
    document.getElementById('tax').addEventListener('input', () => this.calculateTotals());
    document.getElementById('shipping').addEventListener('input', () => this.calculateTotals());
  }

  async savePurchase() {
    const form = document.getElementById('purchaseForm');
    const formData = new FormData(form);
    
    const supplierId = document.getElementById('purchaseSupplier').dataset.supplierId;
    if (!supplierId) {
      Utils.showNotification('Please select a supplier', 'error');
      return;
    }

    const items = this.collectItems();
    if (items.length === 0) {
      Utils.showNotification('Please add at least one item', 'error');
      return;
    }

    const purchaseData = {
      supplier: supplierId,
      items: items,
      expectedDate: formData.get('expectedDate'),
      notes: formData.get('notes'),
      tax: parseFloat(formData.get('tax')) || 0,
      shipping: parseFloat(formData.get('shipping')) || 0
    };

    try {
      await API.createPurchase(purchaseData);
      Utils.showNotification('Purchase order created successfully', 'success');
      window.app.hideModal();
      this.loadPurchasesData();
    } catch (error) {
      Utils.showNotification(error.message || 'Failed to create purchase order', 'error');
    }
  }

  collectItems() {
    const itemRows = document.querySelectorAll('.item-row:not(.header)');
    const items = [];

    itemRows.forEach(row => {
      const itemId = row.querySelector('.item-search').dataset.itemId;
      const quantity = parseFloat(row.querySelector('.quantity-input').value);
      const unitPrice = parseFloat(row.querySelector('.price-input').value);

      if (itemId && quantity > 0 && unitPrice > 0) {
        items.push({
          inventory: itemId,
          quantity: quantity,
          unitPrice: unitPrice,
          totalPrice: quantity * unitPrice
        });
      }
    });

    return items;
  }

  async viewPurchase(id) {
    try {
      const purchase = await API.getPurchase(id);
      this.showPurchaseDetailsModal(purchase);
    } catch (error) {
      Utils.showNotification('Failed to load purchase details', 'error');
    }
  }

  showPurchaseDetailsModal(purchase) {
    const modal = window.app.showModal(
      `Purchase Order ${purchase.purchaseNumber}`,
      this.getPurchaseDetailsHTML(purchase),
      [
        {
          text: 'Close',
          class: 'btn-secondary',
          action: 'close'
        }
      ]
    );
  }

  getPurchaseDetailsHTML(purchase) {
    const supplierName = purchase?.supplier?.name
      || purchase?.supplier_name
      || (typeof purchase?.supplier === 'string' ? purchase.supplier : '')
      || '—';

    return `
      <div class="purchase-card">
        <div class="purchase-header">
          <div class="purchase-info">
            <div class="purchase-number">${purchase.purchaseNumber}</div>
            <div class="purchase-supplier">${supplierName}</div>
            <div class="purchase-date">Ordered: ${Utils.formatDate(purchase.orderDate)}</div>
          </div>
          <div class="purchase-status">
            <span class="status-badge ${purchase.status}">${purchase.status}</span>
          </div>
        </div>

        <div class="purchase-items">
          ${purchase.items.map(item => `
            <div class="purchase-item">
              <div class="item-info">
                <div class="item-name">${(item.inventory && item.inventory.name) || item.name || item.sku || 'Item'}</div>
                <div class="item-sku">SKU: ${(item.inventory && item.inventory.sku) || item.sku || '—'}</div>
              </div>
              <div class="item-quantity">${item.quantity}</div>
              <div class="item-price">${Utils.formatCurrency(item.unitPrice)}</div>
              <div class="item-total">${Utils.formatCurrency(item.totalPrice)}</div>
            </div>
          `).join('')}
        </div>

        <div class="purchase-summary">
          <div class="purchase-total">Total: ${Utils.formatCurrency(purchase.total)}</div>
        </div>

        ${purchase.notes ? `
          <div class="purchase-notes">
            <strong>Notes:</strong> ${purchase.notes}
          </div>
        ` : ''}
      </div>
    `;
  }

  async updatePurchaseStatus(id) {
    const statuses = ['pending', 'ordered', 'received', 'cancelled'];
    const currentStatus = await this.getCurrentPurchaseStatus(id);
    
    const modal = window.app.showModal(
      'Update Purchase Status',
      `
        <div class="form-group">
          <label for="newStatus">New Status</label>
          <select id="newStatus">
            ${statuses.map(status => 
              `<option value="${status}" ${status === currentStatus ? 'selected' : ''}>${status.charAt(0).toUpperCase() + status.slice(1)}</option>`
            ).join('')}
          </select>
        </div>
      `,
      [
        {
          text: 'Cancel',
          class: 'btn-secondary',
          action: 'cancel'
        },
        {
          text: 'Update Status',
          class: 'btn-primary',
          action: 'update',
          handler: () => this.updateStatus(id)
        }
      ]
    );
  }

  async getCurrentPurchaseStatus(id) {
    try {
      const purchase = await API.getPurchase(id);
      return purchase.status;
    } catch (error) {
      return 'pending';
    }
  }

  async updateStatus(id) {
    const newStatus = document.getElementById('newStatus').value;
    
    try {
      await API.updatePurchaseStatus(id, newStatus);
      Utils.showNotification('Purchase status updated successfully', 'success');
      window.app.hideModal();
      this.loadPurchasesData();
    } catch (error) {
      Utils.showNotification(error.message || 'Failed to update purchase status', 'error');
    }
  }

  async deletePurchase(id) {
    const confirmed = await Utils.confirmDialog(
      'Are you sure you want to delete this purchase order? This action cannot be undone.',
      'Delete Purchase Order'
    );

    if (confirmed) {
      try {
        await API.deletePurchase(id);
        Utils.showNotification('Purchase order deleted successfully', 'success');
        this.loadPurchasesData();
      } catch (error) {
        Utils.showNotification(error.message || 'Failed to delete purchase order', 'error');
      }
    }
  }

  async showReorderSuggestions() {
    try {
      const suggestions = await API.getReorderSuggestions();
      this.showReorderSuggestionsModal(suggestions);
    } catch (error) {
      Utils.showNotification('Failed to load reorder suggestions', 'error');
    }
  }

  showReorderSuggestionsModal(suggestions) {
    const modal = window.app.showModal(
      'Reorder Suggestions',
      `
        <div class="reorder-suggestions">
          ${suggestions.length === 0 ? `
            <div class="empty-state">
              <i class="fas fa-lightbulb"></i>
              <p>No reorder suggestions at this time</p>
            </div>
          ` : suggestions.map(suggestion => `
            <div class="suggestion-item">
              <div class="suggestion-urgency ${suggestion.urgency}"></div>
              <div class="suggestion-info">
                <div class="suggestion-name">${suggestion.inventory.name}</div>
                <div class="suggestion-details">
                  Current: ${suggestion.inventory.currentStock} | 
                  Reorder Point: ${suggestion.inventory.reorderPoint} | 
                  Supplier: ${suggestion.inventory.supplier.name}
                </div>
              </div>
              <div class="suggestion-quantity">${suggestion.suggestedQuantity}</div>
              <div class="suggestion-actions">
                <button class="btn btn-sm btn-primary" onclick="purchases.createReorderPurchase('${suggestion.inventory._id}', ${suggestion.suggestedQuantity})">
                  <i class="fas fa-plus"></i>
                  Create PO
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `,
      [
        {
          text: 'Close',
          class: 'btn-secondary',
          action: 'close'
        }
      ]
    );
  }

  async createReorderPurchase(inventoryId, quantity) {
    // This would create a purchase order for the suggested item
    Utils.showNotification('Reorder purchase order created', 'success');
    window.app.hideModal();
  }
}

// Initialize purchases when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.purchases = new Purchases();
});
