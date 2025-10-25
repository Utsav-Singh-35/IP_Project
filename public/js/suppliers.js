// Supplier Management Module
class Suppliers {
  constructor() {
    this.currentPage = 1;
    this.itemsPerPage = 10;
    this.currentFilter = {};
    this.role = null;
    this.init();
    this.initRole();
  }

  updateHeaderCount(total) {
    const header = document.querySelector('#suppliersPage .page-header');
    if (!header) return;
    let badge = document.getElementById('supplierCountBadge');
    if (!badge) {
      // Create a compact badge and place it in the header actions area
      const actions = header.querySelector('.page-actions') || header;
      badge = document.createElement('span');
      badge.id = 'supplierCountBadge';
      badge.style.cssText = 'margin-left:12px;padding:6px 10px;border-radius:14px;background:#eef2ff;color:#3b47a1;font-weight:600;font-size:12px;display:inline-block;';
      actions.appendChild(badge);
    }
    badge.textContent = `Total suppliers: ${total}`;
  }

  init() {
    this.bindEvents();
  }

  bindEvents() {
    // Add supplier button
    document.getElementById('addSupplierBtn').addEventListener('click', () => {
      this.showAddSupplierModal();
    });

    // Filters
    document.getElementById('supplierStatusFilter').addEventListener('change', (e) => {
      this.currentFilter.status = e.target.value;
      this.loadSuppliersData();
    });

    document.getElementById('supplierSearch').addEventListener('input', 
      Utils.debounce((e) => {
        this.currentFilter.search = e.target.value;
        this.loadSuppliersData();
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
    const addBtn = document.getElementById('addSupplierBtn');
    if (addBtn && !['admin', 'manager'].includes(this.role)) {
      addBtn.style.display = 'none';
    }
  }

  async loadSuppliersData() {
    try {
      Utils.showLoading(document.querySelector('#suppliersPage'));
      
      const params = {
        page: this.currentPage,
        limit: this.itemsPerPage,
        ...this.currentFilter
      };

      // First request to get pagination info
      let response = await API.getSuppliers(params);
      // If there are more pages, fetch all in one go to display the complete list
      if (response && response.pagination && response.pagination.total > response.suppliers.length) {
        const allParams = { ...this.currentFilter, page: 1, limit: response.pagination.total };
        response = await API.getSuppliers(allParams);
      }
      // Console log as requested
      const totalCount = response?.pagination?.total ?? (response?.suppliers?.length || 0);
      console.log('[Suppliers] Total:', totalCount);
      if (Array.isArray(response?.suppliers)) {
        console.table(response.suppliers.map(s => ({ id: s._id, name: s.name, contact: s.contactPerson, email: s.email, status: s.status })));
      } else {
        console.log('[Suppliers] Response (raw):', response);
      }

      // Update UI with visible total count
      this.updateHeaderCount(totalCount);

      this.updateSuppliersTable(response.suppliers);
      this.updatePagination(response.pagination);

    } catch (error) {
      console.error('Failed to load suppliers data:', error);
      Utils.showNotification('Failed to load suppliers data', 'error');
    } finally {
      Utils.hideLoading(document.querySelector('#suppliersPage'));
    }
  }

  updateSuppliersTable(suppliers) {
    const tbody = document.querySelector('#suppliersTable tbody');
    
    if (!suppliers || suppliers.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center">
            <div class="empty-state">
              <i class="fas fa-truck"></i>
              <p>No suppliers found</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = suppliers.map(supplier => {
      const canEdit = ['admin', 'manager'].includes(this.role);
      const canDelete = ['admin'].includes(this.role);

      return `
      <tr>
        <td>
          <div class="supplier-info">
            <div class="supplier-name">${supplier.name}</div>
            <div class="supplier-contact">${supplier.contactPerson}</div>
          </div>
        </td>
        <td>${supplier.contactPerson}</td>
        <td>
          <a href="mailto:${supplier.email}" class="supplier-email">${supplier.email}</a>
        </td>
        <td>${supplier.phone}</td>
        <td>
          <div class="supplier-rating">
            <div class="rating-stars">
              ${this.renderStars(supplier.rating)}
            </div>
            <div class="rating-value">${supplier.rating}</div>
          </div>
        </td>
        <td>
          <div class="supplier-status">
            <div class="status-indicator ${supplier.status}"></div>
            <span class="status-badge ${supplier.status}">${supplier.status}</span>
          </div>
        </td>
        <td>
          <div class="inventory-actions">
            ${canEdit ? `<button class="btn btn-sm btn-secondary" onclick="suppliers.editSupplier('${supplier._id}')">
              <i class="fas fa-edit"></i>
            </button>` : ''}
            ${canDelete ? `<button class="btn btn-sm btn-error" onclick="suppliers.deleteSupplier('${supplier._id}')">
              <i class="fas fa-trash"></i>
            </button>` : ''}
          </div>
        </td>
      </tr>
    `}).join('');
  }

  renderStars(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
    let stars = '';

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars += '<i class="fas fa-star rating-star"></i>';
      } else if (i === fullStars && hasHalfStar) {
        stars += '<i class="fas fa-star-half-alt rating-star"></i>';
      } else {
        stars += '<i class="fas fa-star rating-star empty"></i>';
      }
    }

    return stars;
  }

  updatePagination(pagination) {
    // Simple pagination - in a real app, you'd want more sophisticated pagination
    console.log('Pagination:', pagination);
  }

  showAddSupplierModal() {
    const modal = window.app.showModal(
      'Add Supplier',
      this.getSupplierFormHTML(),
      [
        {
          text: 'Cancel',
          class: 'btn-secondary',
          action: 'cancel'
        },
        {
          text: 'Save Supplier',
          class: 'btn-primary',
          action: 'save',
          handler: () => this.saveSupplier()
        }
      ]
    );
  }

  getSupplierFormHTML() {
    return `
      <form id="supplierForm" class="supplier-form">
        <div class="form-section">
          <div class="form-section-title">Basic Information</div>
          <div class="form-group full-width">
            <label for="supplierName">Supplier Name *</label>
            <input type="text" id="supplierName" name="name" required>
          </div>
          <div class="form-group">
            <label for="supplierContactPerson">Contact Person *</label>
            <input type="text" id="supplierContactPerson" name="contactPerson" required>
          </div>
          <div class="form-group">
            <label for="supplierEmail">Email *</label>
            <input type="email" id="supplierEmail" name="email" required>
          </div>
          <div class="form-group">
            <label for="supplierPhone">Phone *</label>
            <input type="tel" id="supplierPhone" name="phone" required>
          </div>
          <div class="form-group">
            <label for="supplierWebsite">Website</label>
            <input type="url" id="supplierWebsite" name="website">
          </div>
          <div class="form-group">
            <label for="supplierTaxId">Tax ID</label>
            <input type="text" id="supplierTaxId" name="taxId">
          </div>
        </div>

        <div class="form-section">
          <div class="form-section-title">Address</div>
          <div class="address-group">
            <div class="form-group">
              <label for="supplierStreet">Street</label>
              <input type="text" id="supplierStreet" name="address.street">
            </div>
            <div class="form-group">
              <label for="supplierCity">City</label>
              <input type="text" id="supplierCity" name="address.city">
            </div>
            <div class="form-group">
              <label for="supplierState">State</label>
              <input type="text" id="supplierState" name="address.state">
            </div>
            <div class="form-group">
              <label for="supplierZipCode">ZIP Code</label>
              <input type="text" id="supplierZipCode" name="address.zipCode">
            </div>
            <div class="form-group">
              <label for="supplierCountry">Country</label>
              <input type="text" id="supplierCountry" name="address.country">
            </div>
          </div>
        </div>

        <div class="form-section">
          <div class="form-section-title">Business Terms</div>
          <div class="form-group">
            <label for="supplierPaymentTerms">Payment Terms</label>
            <select id="supplierPaymentTerms" name="paymentTerms">
              <option value="net_15">Net 15</option>
              <option value="net_30" selected>Net 30</option>
              <option value="net_45">Net 45</option>
              <option value="net_60">Net 60</option>
              <option value="cod">COD</option>
              <option value="prepaid">Prepaid</option>
            </select>
          </div>
          <div class="lead-time-group">
            <div class="form-group">
              <label for="supplierLeadTime">Lead Time (days) *</label>
              <input type="number" id="supplierLeadTime" name="leadTime" min="0" value="7" required>
            </div>
          </div>
          <div class="form-group">
            <label for="supplierMinimumOrder">Minimum Order Value</label>
            <input type="number" id="supplierMinimumOrder" name="minimumOrder" step="0.01" min="0">
          </div>
          <div class="rating-input">
            <label for="supplierRating">Rating</label>
            <div class="stars" id="ratingStars">
              <i class="fas fa-star star" data-rating="1"></i>
              <i class="fas fa-star star" data-rating="2"></i>
              <i class="fas fa-star star" data-rating="3"></i>
              <i class="fas fa-star star" data-rating="4"></i>
              <i class="fas fa-star star" data-rating="5"></i>
            </div>
            <span class="value" id="ratingValue">3</span>
            <input type="hidden" id="supplierRating" name="rating" value="3">
          </div>
        </div>

        <div class="form-section">
          <div class="form-section-title">Additional Information</div>
          <div class="form-group">
            <label for="supplierStatus">Status</label>
            <select id="supplierStatus" name="status">
              <option value="active" selected>Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
          <div class="form-group full-width">
            <label for="supplierNotes">Notes</label>
            <textarea id="supplierNotes" name="notes" rows="3"></textarea>
          </div>
        </div>
      </form>
    `;
  }

  bindFormEvents() {
    // Rating stars
    const stars = document.querySelectorAll('#ratingStars .star');
    const ratingValue = document.getElementById('ratingValue');
    const ratingInput = document.getElementById('supplierRating');

    stars.forEach((star, index) => {
      star.addEventListener('click', () => {
        const rating = index + 1;
        this.setRating(rating);
      });

      star.addEventListener('mouseenter', () => {
        this.highlightStars(index + 1);
      });
    });

    document.getElementById('ratingStars').addEventListener('mouseleave', () => {
      const currentRating = parseInt(ratingInput.value);
      this.highlightStars(currentRating);
    });
  }

  setRating(rating) {
    const ratingInput = document.getElementById('supplierRating');
    const ratingValue = document.getElementById('ratingValue');
    
    ratingInput.value = rating;
    ratingValue.textContent = rating;
    this.highlightStars(rating);
  }

  highlightStars(rating) {
    const stars = document.querySelectorAll('#ratingStars .star');
    stars.forEach((star, index) => {
      if (index < rating) {
        star.classList.add('active');
      } else {
        star.classList.remove('active');
      }
    });
  }

  async saveSupplier() {
    const form = document.getElementById('supplierForm');
    const formData = new FormData(form);
    const supplierData = this.processFormData(formData);

    try {
      await API.createSupplier(supplierData);
      Utils.showNotification('Supplier created successfully', 'success');
      window.app.hideModal();
      this.loadSuppliersData();
    } catch (error) {
      Utils.showNotification(error.message || 'Failed to create supplier', 'error');
    }
  }

  processFormData(formData) {
    const data = {};
    
    for (let [key, value] of formData.entries()) {
      if (key.startsWith('address.')) {
        if (!data.address) data.address = {};
        data.address[key.replace('address.', '')] = value;
      } else {
        data[key] = value;
      }
    }

    // Convert numeric fields
    data.leadTime = parseInt(data.leadTime);
    data.minimumOrder = parseFloat(data.minimumOrder) || 0;
    data.rating = parseInt(data.rating);

    return data;
  }

  async editSupplier(id) {
    try {
      const supplier = await API.getSupplier(id);
      this.showEditSupplierModal(supplier);
    } catch (error) {
      Utils.showNotification('Failed to load supplier details', 'error');
    }
  }

  showEditSupplierModal(supplier) {
    const modal = window.app.showModal(
      'Edit Supplier',
      this.getSupplierFormHTML(),
      [
        {
          text: 'Cancel',
          class: 'btn-secondary',
          action: 'cancel'
        },
        {
          text: 'Update Supplier',
          class: 'btn-primary',
          action: 'update',
          handler: () => this.updateSupplier(supplier._id)
        }
      ]
    );

    this.populateSupplierForm(supplier);
    this.bindFormEvents();
  }

  populateSupplierForm(supplier) {
    // Populate basic fields
    Object.keys(supplier).forEach(key => {
      if (key !== 'address' && key !== '_id' && key !== 'createdAt' && key !== 'updatedAt') {
        const input = document.getElementById(`supplier${key.charAt(0).toUpperCase() + key.slice(1)}`);
        if (input) {
          input.value = supplier[key];
        }
      }
    });

    // Populate address fields
    if (supplier.address) {
      Object.keys(supplier.address).forEach(key => {
        const input = document.getElementById(`supplier${key.charAt(0).toUpperCase() + key.slice(1)}`);
        if (input) {
          input.value = supplier.address[key];
        }
      });
    }

    // Set rating
    this.setRating(supplier.rating);
  }

  async updateSupplier(id) {
    const form = document.getElementById('supplierForm');
    const formData = new FormData(form);
    const supplierData = this.processFormData(formData);

    try {
      await API.updateSupplier(id, supplierData);
      Utils.showNotification('Supplier updated successfully', 'success');
      window.app.hideModal();
      this.loadSuppliersData();
    } catch (error) {
      Utils.showNotification(error.message || 'Failed to update supplier', 'error');
    }
  }

  async deleteSupplier(id) {
    const confirmed = await Utils.confirmDialog(
      'Are you sure you want to delete this supplier? This action cannot be undone.',
      'Delete Supplier'
    );

    if (confirmed) {
      try {
        await API.deleteSupplier(id);
        Utils.showNotification('Supplier deleted successfully', 'success');
        this.loadSuppliersData();
      } catch (error) {
        Utils.showNotification(error.message || 'Failed to delete supplier', 'error');
      }
    }
  }
}

// Initialize suppliers when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.suppliers = new Suppliers();
});
