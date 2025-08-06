/**
 * 用戶界面管理器
 * 負責處理用戶相關的 UI 組件和交互
 */

class UserUIManager {
  constructor() {
    this.userManager = null;
    this.initialized = false;
    this.currentUserWidget = null;
    this.roleSwitchModal = null;
    
    // 綁定事件處理器
    this.handleRoleSwitch = this.handleRoleSwitch.bind(this);
    this.handleLogin = this.handleLogin.bind(this);
    this.handleLogout = this.handleLogout.bind(this);
  }

  /**
   * 初始化用戶界面管理器
   * @param {UserManager} userManager - 用戶管理器實例
   */
  async init(userManager) {
    this.userManager = userManager;
    
    // 監聽用戶管理器事件
    this.userManager.addEventListener('userLogin', this.handleLogin);
    this.userManager.addEventListener('userLogout', this.handleLogout);
    this.userManager.addEventListener('roleSwitch', this.handleRoleSwitch);
    
    // 創建用戶狀態顯示組件
    this.createUserStatusWidget();
    
    // 如果用戶已登入，更新 UI
    if (this.userManager.isLoggedIn()) {
      this.updateUserStatusWidget();
    }
    
    this.initialized = true;
    console.log('UserUIManager initialized');
  }

  /**
   * 創建用戶狀態顯示組件
   */
  createUserStatusWidget() {
    // 創建用戶狀態容器
    const userStatusContainer = document.createElement('div');
    userStatusContainer.id = 'user-status-container';
    userStatusContainer.className = 'user-status-container';
    userStatusContainer.innerHTML = `
      <div class="user-status-widget" id="user-status-widget">
        <div class="user-info" id="user-info" style="display: none;">
          <div class="user-avatar" id="user-avatar">
            <span class="avatar-icon">👤</span>
          </div>
          <div class="user-details">
            <div class="user-name" id="user-name">未登入</div>
            <div class="user-role" id="user-role">無角色</div>
          </div>
          <div class="user-actions">
            <button class="role-switch-btn" id="role-switch-btn" style="display: none;">
              切換角色
            </button>
            <button class="logout-btn" id="logout-btn">
              登出
            </button>
          </div>
        </div>
        <div class="login-prompt" id="login-prompt">
          <button class="login-btn" id="login-btn">登入</button>
        </div>
      </div>
    `;

    // 將用戶狀態組件添加到頁面頂部
    const headerContainer = document.querySelector('.header') || document.querySelector('.container');
    if (headerContainer) {
      headerContainer.insertBefore(userStatusContainer, headerContainer.firstChild);
    } else {
      document.body.insertBefore(userStatusContainer, document.body.firstChild);
    }

    // 綁定事件
    this.bindUserStatusEvents();
  }

  /**
   * 綁定用戶狀態組件的事件
   */
  bindUserStatusEvents() {
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const roleSwitchBtn = document.getElementById('role-switch-btn');

    if (loginBtn) {
      loginBtn.addEventListener('click', () => this.showLoginModal());
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.handleLogoutClick());
    }

    if (roleSwitchBtn) {
      roleSwitchBtn.addEventListener('click', () => this.showRoleSwitchModal());
    }
  }

  /**
   * 更新用戶狀態顯示
   */
  updateUserStatusWidget() {
    const userInfo = document.getElementById('user-info');
    const loginPrompt = document.getElementById('login-prompt');
    const userName = document.getElementById('user-name');
    const userRole = document.getElementById('user-role');
    const userAvatar = document.getElementById('user-avatar');
    const roleSwitchBtn = document.getElementById('role-switch-btn');

    if (!this.userManager.isLoggedIn()) {
      // 未登入狀態
      if (userInfo) userInfo.style.display = 'none';
      if (loginPrompt) loginPrompt.style.display = 'block';
      return;
    }

    // 已登入狀態
    const currentUser = this.userManager.getCurrentUser();
    const currentRole = this.userManager.getCurrentRole();
    const hasMultipleRoles = this.userManager.hasMultipleRoles();

    if (userInfo) userInfo.style.display = 'flex';
    if (loginPrompt) loginPrompt.style.display = 'none';

    // 更新用戶名稱
    if (userName) {
      userName.textContent = currentUser.username || '用戶';
    }

    // 更新角色顯示
    if (userRole) {
      const roleLabels = {
        'student': '學生',
        'parent': '家長',
        'teacher': '教師'
      };
      userRole.textContent = roleLabels[currentRole] || currentRole;
    }

    // 更新頭像
    if (userAvatar) {
      const roleIcons = {
        'student': '🎓',
        'parent': '👨‍👩‍👧‍👦',
        'teacher': '👨‍🏫'
      };
      const avatarIcon = userAvatar.querySelector('.avatar-icon');
      if (avatarIcon) {
        avatarIcon.textContent = roleIcons[currentRole] || '👤';
      }
    }

    // 顯示/隱藏角色切換按鈕
    if (roleSwitchBtn) {
      roleSwitchBtn.style.display = hasMultipleRoles ? 'block' : 'none';
    }
  }

  /**
   * 顯示角色切換模態框
   */
  showRoleSwitchModal() {
    if (!this.userManager.isLoggedIn()) {
      console.warn('用戶未登入，無法切換角色');
      return;
    }

    const availableRoles = this.userManager.getAllRoles();
    const currentRole = this.userManager.getCurrentRole();

    if (availableRoles.length <= 1) {
      console.warn('用戶只有一個角色，無需切換');
      return;
    }

    this.createRoleSwitchModal(availableRoles, currentRole);
  }

  /**
   * 創建角色切換模態框
   * @param {Array<string>} availableRoles - 可用角色列表
   * @param {string} currentRole - 當前角色
   */
  createRoleSwitchModal(availableRoles, currentRole) {
    // 移除現有的模態框
    if (this.roleSwitchModal) {
      this.roleSwitchModal.remove();
    }

    const roleLabels = {
      'student': { label: '學生', icon: '🎓', description: '查看學習進度和練習' },
      'parent': { label: '家長', icon: '👨‍👩‍👧‍👦', description: '監督孩子的學習狀況' },
      'teacher': { label: '教師', icon: '👨‍🏫', description: '管理學生和課程' }
    };

    const modalHTML = `
      <div class="modal" id="role-switch-modal">
        <div class="modal-content">
          <div class="modal-header">
            <h3>切換角色</h3>
            <button class="close-button" type="button">&times;</button>
          </div>
          <div class="modal-body">
            <div class="role-grid">
              ${availableRoles.map(role => {
                const roleInfo = roleLabels[role] || { label: role, icon: '👤', description: '' };
                const isActive = role === currentRole;
                return `
                  <div class="role-card ${isActive ? 'selected' : ''}" data-role="${role}">
                    <div class="role-icon">${roleInfo.icon}</div>
                    <div class="role-name">${roleInfo.label}</div>
                    <div class="role-description">${roleInfo.description}</div>
                    ${isActive ? '<div class="current-role-badge">目前角色</div>' : ''}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="secondary-button" id="cancel-role-switch">取消</button>
            <button type="button" class="primary-button" id="confirm-role-switch" disabled>切換角色</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.roleSwitchModal = document.getElementById('role-switch-modal');

    // 綁定事件
    this.bindRoleSwitchModalEvents();
  }

  /**
   * 綁定角色切換模態框事件
   */
  bindRoleSwitchModalEvents() {
    if (!this.roleSwitchModal) return;

    const closeBtn = this.roleSwitchModal.querySelector('.close-button');
    const cancelBtn = this.roleSwitchModal.querySelector('#cancel-role-switch');
    const confirmBtn = this.roleSwitchModal.querySelector('#confirm-role-switch');
    const roleCards = this.roleSwitchModal.querySelectorAll('.role-card');

    let selectedRole = null;

    // 關閉模態框
    const closeModal = () => {
      if (this.roleSwitchModal) {
        this.roleSwitchModal.remove();
        this.roleSwitchModal = null;
      }
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    // 點擊模態框外部關閉
    this.roleSwitchModal.addEventListener('click', (e) => {
      if (e.target === this.roleSwitchModal) {
        closeModal();
      }
    });

    // 角色卡片選擇
    roleCards.forEach(card => {
      card.addEventListener('click', () => {
        const role = card.dataset.role;
        const currentRole = this.userManager.getCurrentRole();
        
        // 不允許選擇當前角色
        if (role === currentRole) return;

        // 移除其他卡片的選中狀態
        roleCards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');

        selectedRole = role;
        
        // 啟用確認按鈕
        if (confirmBtn) {
          confirmBtn.disabled = false;
          confirmBtn.textContent = `切換到${this.getRoleLabel(role)}`;
        }
      });
    });

    // 確認切換角色
    if (confirmBtn) {
      confirmBtn.addEventListener('click', async () => {
        if (!selectedRole) return;

        try {
          confirmBtn.disabled = true;
          confirmBtn.textContent = '切換中...';

          await this.userManager.switchRole(selectedRole);
          closeModal();
          
          // 顯示成功通知
          this.showNotification(`已切換到${this.getRoleLabel(selectedRole)}角色`, 'success');
          
        } catch (error) {
          console.error('角色切換失敗:', error);
          this.showNotification(`角色切換失敗: ${error.message}`, 'error');
          
          confirmBtn.disabled = false;
          confirmBtn.textContent = '切換角色';
        }
      });
    }
  }

  /**
   * 獲取角色標籤
   * @param {string} role - 角色
   * @returns {string} 角色標籤
   */
  getRoleLabel(role) {
    const labels = {
      'student': '學生',
      'parent': '家長',
      'teacher': '教師'
    };
    return labels[role] || role;
  }

  /**
   * 顯示登入模態框
   */
  showLoginModal() {
    // 這裡可以整合現有的登入界面或創建新的
    console.log('顯示登入模態框');
    this.showNotification('登入功能開發中...', 'info');
  }

  /**
   * 處理登出點擊
   */
  async handleLogoutClick() {
    try {
      await this.userManager.logout();
      this.showNotification('已成功登出', 'success');
    } catch (error) {
      console.error('登出失敗:', error);
      this.showNotification(`登出失敗: ${error.message}`, 'error');
    }
  }

  /**
   * 處理用戶登入事件
   * @param {Object} data - 登入事件數據
   */
  handleLogin(data) {
    console.log('用戶登入事件:', data);
    this.updateUserStatusWidget();
    this.showNotification(`歡迎回來，${data.user.username}！`, 'success');
  }

  /**
   * 處理用戶登出事件
   * @param {Object} data - 登出事件數據
   */
  handleLogout(data) {
    console.log('用戶登出事件:', data);
    this.updateUserStatusWidget();
  }

  /**
   * 處理角色切換事件
   * @param {Object} data - 角色切換事件數據
   */
  handleRoleSwitch(data) {
    console.log('角色切換事件:', data);
    this.updateUserStatusWidget();
  }

  /**
   * 顯示通知
   * @param {string} message - 通知消息
   * @param {string} type - 通知類型 ('success', 'error', 'info', 'warning')
   */
  showNotification(message, type = 'info') {
    // 檢查是否有現有的通知系統
    if (window.notificationManager && typeof window.notificationManager.show === 'function') {
      window.notificationManager.show(message, type);
    } else {
      // 簡單的 console 輸出作為後備
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  /**
   * 銷毀組件
   */
  destroy() {
    // 移除事件監聽器
    if (this.userManager) {
      this.userManager.removeEventListener('userLogin', this.handleLogin);
      this.userManager.removeEventListener('userLogout', this.handleLogout);
      this.userManager.removeEventListener('roleSwitch', this.handleRoleSwitch);
    }

    // 移除 DOM 元素
    const userStatusContainer = document.getElementById('user-status-container');
    if (userStatusContainer) {
      userStatusContainer.remove();
    }

    if (this.roleSwitchModal) {
      this.roleSwitchModal.remove();
    }

    this.initialized = false;
  }
}

// 導出類別
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UserUIManager;
} 