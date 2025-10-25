// Users Management (Admin only)
class UsersPage {
  constructor() {
    this.currentFilter = {};
    this.bindEvents();
  }

  bindEvents() {
    document.addEventListener('click', (e) => {
      if (e.target && e.target.matches('#addUserBtn')) {
        this.showUserModal();
      }
    });

    const search = document.getElementById('userSearch');
    if (search) {
      search.addEventListener('input', Utils.debounce((ev) => {
        this.currentFilter.search = ev.target.value;
        this.loadUsers();
      }, 300));
    }
  }

  async ensureAdmin() {
    try {
      const me = await API.getCurrentUser();
      return me?.user?.role === 'admin';
    } catch (e) { return false; }
  }

  async loadUsers() {
    // Only proceed if admin
    const isAdmin = await this.ensureAdmin();
    if (!isAdmin) return;

    try {
      Utils.showLoading(document.querySelector('#usersPage'));
      const resp = await API.getUsers({ ...this.currentFilter, limit: 100 });
      const tbody = document.querySelector('#usersTable tbody');
      const users = resp?.users || [];
      tbody.innerHTML = users.map(u => `
        <tr>
          <td>${u.firstName} ${u.lastName}</td>
          <td>${u.username}</td>
          <td>${u.email}</td>
          <td>${u.role}</td>
          <td>${u.isActive ? 'Active' : 'Inactive'}</td>
          <td>
            <button class="btn btn-sm btn-secondary" data-action="edit" data-id="${u._id}"><i class="fas fa-edit"></i></button>
            <button class="btn btn-sm btn-error" data-action="delete" data-id="${u._id}"><i class="fas fa-trash"></i></button>
          </td>
        </tr>
      `).join('');

      tbody.querySelectorAll('button[data-action="edit"]').forEach(btn => btn.addEventListener('click', () => this.editUser(btn.dataset.id, users.find(x => x._id === btn.dataset.id))));
      tbody.querySelectorAll('button[data-action="delete"]').forEach(btn => btn.addEventListener('click', () => this.deleteUser(btn.dataset.id)));
    } catch (err) {
      Utils.showNotification('Failed to load users', 'error');
    } finally {
      Utils.hideLoading(document.querySelector('#usersPage'));
    }
  }

  userFormHTML(user = {}) {
    const role = user.role || 'staff';
    return `
      <div class="user-edit-grid" style="gap:16px;align-items:start;">
        <form id="userForm" class="inventory-form" style="grid-template-columns:1fr;">
          <div class="form-section" style="margin:0;">
            <div class="form-row">
              <div class="form-group">
                <label for="uFirstName">First Name</label>
                <input type="text" id="uFirstName" name="firstName" value="${user.firstName || ''}" required>
              </div>
              <div class="form-group">
                <label for="uLastName">Last Name</label>
                <input type="text" id="uLastName" name="lastName" value="${user.lastName || ''}" required>
              </div>
            </div>
            <div class="form-group">
              <label for="uUsername">Username</label>
              <input type="text" id="uUsername" name="username" value="${user.username || ''}" required>
            </div>
            <div class="form-group">
              <label for="uEmail">Email</label>
              <input type="email" id="uEmail" name="email" value="${user.email || ''}" required>
            </div>
            <div class="form-group">
              <label for="uRole">Role</label>
              <select id="uRole" name="role" required>
                ${['admin','manager','staff'].map(r => `<option value="${r}" ${role === r ? 'selected' : ''}>${r.charAt(0).toUpperCase()+r.slice(1)}</option>`).join('')}
              </select>
            </div>
            ${user._id ? '' : `
            <div class="form-group">
              <label for="uPassword">Password</label>
              <input type="password" id="uPassword" name="password" required>
            </div>`}
            <div class="form-group">
              <label for="uActive">Active</label>
              <select id="uActive" name="isActive">
                <option value="true" ${user.isActive !== false ? 'selected' : ''}>Active</option>
                <option value="false" ${user.isActive === false ? 'selected' : ''}>Inactive</option>
              </select>
            </div>
          </div>
        </form>
        <div id="roleAccessContent"></div>
      </div>
    `;
  }

  showUserModal() {
    const modal = window.app.showModal('Add User', this.userFormHTML(), [
      { text: 'Cancel', class: 'btn-secondary', action: 'cancel' },
      { text: 'Create', class: 'btn-primary', action: 'create', handler: () => this.createUser() }
    ]);
    this.initRolePanel();
  }

  async createUser() {
    const form = document.getElementById('userForm');
    const data = Object.fromEntries(new FormData(form).entries());
    data.isActive = String(data.isActive) === 'true';
    try {
      await API.createUser(data);
      Utils.showNotification('User created', 'success');
      window.app.hideModal();
      this.loadUsers();
    } catch (e) {
      Utils.showNotification(e?.message || 'Failed to create user', 'error');
    }
  }

  editUser(id, user) {
    const modal = window.app.showModal('Edit User', this.userFormHTML(user), [
      { text: 'Cancel', class: 'btn-secondary', action: 'cancel' },
      { text: 'Update', class: 'btn-primary', action: 'update', handler: () => this.updateUser(id) }
    ]);
    this.initRolePanel(user?.role || 'staff');
  }

  initRolePanel(initialRole) {
    const select = document.getElementById('uRole');
    const role = initialRole || (select ? select.value : 'staff');
    this.renderRoleAccess(role);
    if (select) {
      select.addEventListener('change', (e) => this.renderRoleAccess(e.target.value));
    }
  }

  renderRoleAccess(role) {
    const el = document.getElementById('roleAccessContent');
    if (!el) return;
    const roles = ['admin','manager','staff'];
    const card = (r) => {
      const items = this.getRoleAccess(r).map(item => `<li>${item}</li>`).join('');
      const title = `${r.charAt(0).toUpperCase()+r.slice(1)} Permissions`;
      const active = r === role;
      const border = active ? 'var(--o-light-accent)' : 'var(--o-light-border)';
      return `
        <div class="dashboard-card" style="padding:0;border:1px solid ${border};border-radius:8px;">
          <div class="card-header" style="margin:0;padding:8px 10px;border-bottom:1px solid var(--o-light-border);${active ? 'color:var(--o-light-accent);' : ''}">
            <h4 style="margin:0;font-size:13px;">${title}</h4>
          </div>
          <div class="card-content" style="padding:8px 10px;">
            <ul style="padding-left:18px;margin:0;">
              ${items}
            </ul>
          </div>
        </div>`;
    };
    el.style.cssText = 'display:flex;flex-direction:column;gap:8px;margin:0;padding:0;max-height:none;overflow:visible;';
    el.innerHTML = roles.map(card).join('');
  }

  getRoleAccess(role) {
    const map = {
      admin: [
        'Full access to all modules',
        'Create/Update/Delete users',
        'Inventory, Suppliers, Purchases (CRUD)',
        'View Analytics and configure settings'
      ],
      manager: [
        'Inventory, Suppliers, Purchases (CRUD)',
        'View Analytics',
        'Cannot manage users'
      ],
      staff: [
        'View Inventory and Suppliers',
        'Create purchase requests',
        'Limited editing as assigned'
      ]
    };
    return map[role] || map.staff;
  }

  async updateUser(id) {
    const form = document.getElementById('userForm');
    const data = Object.fromEntries(new FormData(form).entries());
    data.isActive = String(data.isActive) === 'true';
    if (!data.password) delete data.password;
    try {
      await API.updateUser(id, data);
      Utils.showNotification('User updated', 'success');
      window.app.hideModal();
      this.loadUsers();
    } catch (e) {
      Utils.showNotification(e?.message || 'Failed to update user', 'error');
    }
  }

  async deleteUser(id) {
    const ok = await Utils.confirmDialog('Delete this user?', 'Delete User');
    if (!ok) return;
    try {
      await API.deleteUser(id);
      Utils.showNotification('User deleted', 'success');
      this.loadUsers();
    } catch (e) {
      Utils.showNotification(e?.message || 'Failed to delete user', 'error');
    }
  }
}

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.usersPage = new UsersPage();
});
