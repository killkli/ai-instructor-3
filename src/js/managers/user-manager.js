/**
 * 用戶管理器
 * 負責處理多用戶系統的核心功能，包括註冊、登入、角色管理等
 */

class UserManager {
  constructor() {
    this.currentUser = null;
    this.currentRole = null;
    this.userRoles = []; // 用戶擁有的所有角色
    this.storageService = null;
    this.sessionManager = null;
    this.initialized = false;
    
    // 用戶 session 保持（記憶體中）
    this.sessionToken = null;
    this.sessionExpiry = null;
    
    // 事件監聽器
    this.eventListeners = {
      userLogin: [],
      userLogout: [],
      roleSwitch: []
    };
  }

  /**
   * 初始化用戶管理器
   * @param {Object} storageService - 儲存服務實例
   * @param {Object} sessionManager - 會話管理器實例
   */
  async init(storageService, sessionManager) {
    this.storageService = storageService;
    this.sessionManager = sessionManager;
    
    // 嘗試恢復上次的 session
    await this._restoreSession();
    
    this.initialized = true;
    console.log('UserManager initialized');
  }

  /**
   * 檢查是否已初始化
   */
  _ensureInitialized() {
    if (!this.initialized) {
      throw new Error('UserManager not initialized. Call init() first.');
    }
  }

  /**
   * 生成安全的用戶ID
   * @param {string} prefix - ID前綴
   * @returns {string} 唯一用戶ID
   */
  _generateUserId(prefix = 'user') {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}-${timestamp}-${random}`;
  }

  /**
   * 簡單的密碼雜湊（客戶端基本安全）
   * @param {string} password - 原始密碼
   * @param {string} salt - 鹽值
   * @returns {Promise<string>} 雜湊後的密碼
   */
  async _hashPassword(password, salt = '') {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * 生成會話令牌
   * @param {string} userId - 用戶ID
   * @returns {string} 會話令牌
   */
  _generateSessionToken(userId) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return btoa(`${userId}:${timestamp}:${random}`);
  }

  /**
   * 驗證會話是否有效
   * @returns {boolean} 會話是否有效
   */
  _isSessionValid() {
    return this.sessionToken && this.sessionExpiry && Date.now() < this.sessionExpiry;
  }

  /**
   * 用戶註冊
   * @param {Object} userData - 用戶註冊資料
   * @param {string} userData.username - 用戶名
   * @param {string} userData.email - 電子郵件
   * @param {string} userData.password - 密碼
   * @param {string} userData.role - 角色 ('student', 'parent', 'teacher')
   * @param {Object} userData.profile - 角色特定資料
   * @returns {Promise<Object>} 註冊結果
   */
  async registerUser(userData) {
    this._ensureInitialized();

    const { username, email, password, role, profile = {} } = userData;

    // 驗證輸入
    if (!username || !email || !password || !role) {
      throw new Error('所有必填欄位都必須提供');
    }

    if (!['student', 'parent', 'teacher'].includes(role)) {
      throw new Error('無效的用戶角色');
    }

    // 檢查用戶名和郵箱是否已存在
    const existingUserByUsername = await this.storageService.getUserAccountByUsername(username);
    if (existingUserByUsername) {
      throw new Error('用戶名已存在');
    }

    const existingUserByEmail = await this.storageService.getUserAccountByEmail(email);
    if (existingUserByEmail) {
      throw new Error('電子郵件已註冊');
    }

    try {
      // 生成用戶ID和雜湊密碼
      const userId = this._generateUserId(role);
      const salt = username + email; // 簡單的鹽值生成
      const passwordHash = await this._hashPassword(password, salt);

      // 創建主用戶帳戶
      const userAccount = {
        id: userId,
        username,
        email,
        role, // 主要角色（保持向後兼容）
        roles: [role], // 角色陣列（支援多重角色）
        passwordHash,
        salt,
        isActive: true,
        createdAt: new Date().toISOString(),
        lastLogin: null
      };

      await this.storageService.saveUserAccount(userAccount);

      // 創建用戶角色關聯
      await this.storageService.addUserRole(userId, role);

      // 根據角色創建特定資料
      await this._createRoleSpecificAccount(userId, role, profile);

      console.log(`User registered successfully: ${username} (${role})`);
      
      return {
        success: true,
        userId,
        username,
        role,
        message: '用戶註冊成功'
      };

    } catch (error) {
      console.error('User registration failed:', error);
      throw new Error(`註冊失敗: ${error.message}`);
    }
  }

  /**
   * 創建角色特定帳戶資料
   * @param {string} userId - 用戶ID
   * @param {string} role - 用戶角色
   * @param {Object} profile - 角色特定資料
   */
  async _createRoleSpecificAccount(userId, role, profile) {
    switch (role) {
      case 'student':
        await this.storageService.saveStudentAccount({
          studentId: userId,
          grade: profile.grade || '',
          class: profile.class || '',
          parentIds: profile.parentIds || [],
          teacherIds: profile.teacherIds || []
        });
        break;

      case 'parent':
        await this.storageService.saveParentAccount({
          parentId: userId,
          childUserIds: profile.childUserIds || [],
          settings: profile.settings || {}
        });
        break;

      case 'teacher':
        await this.storageService.saveTeacherData({
          teacherId: userId,
          school: profile.school || '',
          subject: profile.subject || '',
          classIds: profile.classIds || [],
          studentIds: profile.studentIds || []
        });
        break;
    }
  }

  /**
   * 用戶登入
   * @param {string} identifier - 用戶名或電子郵件
   * @param {string} password - 密碼
   * @returns {Promise<Object>} 登入結果
   */
  async login(identifier, password) {
    this._ensureInitialized();

    if (!identifier || !password) {
      throw new Error('用戶名/郵箱和密碼都必須提供');
    }

    try {
      // 查找用戶（支援用戶名或郵箱登入）
      let user = await this.storageService.getUserAccountByUsername(identifier);
      if (!user) {
        user = await this.storageService.getUserAccountByEmail(identifier);
      }

      if (!user) {
        throw new Error('用戶不存在');
      }

      if (!user.isActive) {
        throw new Error('用戶帳戶已被停用');
      }

      // 驗證密碼
      const passwordHash = await this._hashPassword(password, user.salt);
      if (passwordHash !== user.passwordHash) {
        throw new Error('密碼錯誤');
      }

      // 載入用戶的所有角色
      const userRoles = await this.storageService.getUserRoles(user.id);
      if (userRoles.length === 0) {
        throw new Error('用戶沒有可用角色');
      }

      // 建立會話
      await this._establishSession(user, userRoles);

      // 更新最後登入時間
      await this.storageService.updateUserLastLogin(user.id);

      // 載入角色特定資料
      await this._loadRoleSpecificData();

      // 觸發登入事件
      this._triggerEvent('userLogin', { 
        user: this.currentUser, 
        role: this.currentRole,
        availableRoles: this.userRoles 
      });

      console.log(`User logged in: ${user.username} (${this.currentRole}), Available roles: ${this.userRoles.join(', ')}`);

      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: this.currentRole,
          availableRoles: this.userRoles
        },
        message: '登入成功'
      };

    } catch (error) {
      console.error('Login failed:', error);
      throw new Error(`登入失敗: ${error.message}`);
    }
  }

  /**
   * 建立用戶會話
   * @param {Object} user - 用戶物件
   * @param {Array<string>} userRoles - 用戶擁有的所有角色
   */
  async _establishSession(user, userRoles) {
    this.currentUser = user;
    this.userRoles = userRoles;
    this.currentRole = user.role || userRoles[0]; // 使用主要角色或第一個角色
    this.sessionToken = this._generateSessionToken(user.id);
    this.sessionExpiry = Date.now() + (24 * 60 * 60 * 1000); // 24小時後過期

    // 儲存到 sessionStorage 以便頁面刷新後恢復
    sessionStorage.setItem('userSession', JSON.stringify({
      userId: user.id,
      currentRole: this.currentRole,
      availableRoles: this.userRoles,
      sessionToken: this.sessionToken,
      sessionExpiry: this.sessionExpiry
    }));
  }

  /**
   * 載入角色特定資料
   */
  async _loadRoleSpecificData() {
    if (!this.currentUser || !this.currentRole) return;

    const userId = this.currentUser.id;
    const role = this.currentRole; // 使用當前活躍角色

    try {
      // 清除之前的角色資料
      delete this.currentUser.studentData;
      delete this.currentUser.parentData;
      delete this.currentUser.teacherData;
      delete this.currentUser.children;
      delete this.currentUser.students;

      switch (role) {
        case 'student':
          this.currentUser.studentData = await this.storageService.getStudentAccount(userId);
          break;

        case 'parent':
          this.currentUser.parentData = await this.storageService.getParentAccount(userId);
          // 載入子女資料
          if (this.currentUser.parentData?.childUserIds) {
            this.currentUser.children = [];
            for (const childId of this.currentUser.parentData.childUserIds) {
              const child = await this.storageService.getUserAccount(childId);
              if (child) {
                this.currentUser.children.push(child);
              }
            }
          }
          break;

        case 'teacher':
          this.currentUser.teacherData = await this.storageService.getTeacherData(userId);
          // 載入學生資料
          if (this.currentUser.teacherData?.studentIds) {
            this.currentUser.students = [];
            for (const studentId of this.currentUser.teacherData.studentIds) {
              const student = await this.storageService.getUserAccount(studentId);
              if (student) {
                this.currentUser.students.push(student);
              }
            }
          }
          break;
      }
    } catch (error) {
      console.error('Failed to load role-specific data:', error);
    }
  }

  /**
   * 更新會話存儲
   * @private
   */
  _updateSessionStorage() {
    if (this.currentUser && this.sessionToken) {
      sessionStorage.setItem('userSession', JSON.stringify({
        userId: this.currentUser.id,
        currentRole: this.currentRole,
        availableRoles: this.userRoles,
        sessionToken: this.sessionToken,
        sessionExpiry: this.sessionExpiry
      }));
    }
  }

  /**
   * 用戶登出
   */
  async logout() {
    this._ensureInitialized();

    const previousUser = this.currentUser;

    // 清除會話資料
    this.currentUser = null;
    this.currentRole = null;
    this.userRoles = [];
    this.sessionToken = null;
    this.sessionExpiry = null;

    // 清除儲存的會話
    sessionStorage.removeItem('userSession');

    // 觸發登出事件
    this._triggerEvent('userLogout', { previousUser });

    console.log('User logged out');

    return { success: true, message: '登出成功' };
  }

  /**
   * 恢復會話（頁面刷新後）
   */
  async _restoreSession() {
    try {
      const sessionData = sessionStorage.getItem('userSession');
      if (!sessionData) return;

      const { userId, sessionToken, sessionExpiry } = JSON.parse(sessionData);

      // 檢查會話是否過期
      if (Date.now() >= sessionExpiry) {
        sessionStorage.removeItem('userSession');
        return;
      }

      // 載入用戶資料
      const user = await this.storageService.getUserAccount(userId);
      if (!user || !user.isActive) {
        sessionStorage.removeItem('userSession');
        return;
      }

      // 載入用戶的所有角色
      const userRoles = await this.storageService.getUserRoles(userId);
      if (userRoles.length === 0) {
        console.warn('User has no active roles');
        sessionStorage.removeItem('userSession');
        return;
      }

      // 恢復會話
      this.currentUser = user;
      this.userRoles = userRoles;
      this.currentRole = sessionData.currentRole || userRoles[0]; // 使用保存的角色或第一個角色
      this.sessionToken = sessionToken;
      this.sessionExpiry = sessionExpiry;

      // 載入角色特定資料
      await this._loadRoleSpecificData();

      console.log(`Session restored for user: ${user.username}`);

    } catch (error) {
      console.error('Failed to restore session:', error);
      sessionStorage.removeItem('userSession');
    }
  }

  /**
   * 切換角色（如果用戶有多個角色）
   * @param {string} newRole - 新角色
   * @returns {Promise<Object>} 切換結果
   */
  async switchRole(newRole) {
    this._ensureInitialized();

    if (!this.currentUser) {
      throw new Error('用戶未登入');
    }

    // 檢查用戶是否擁有該角色
    if (!this.userRoles.includes(newRole)) {
      throw new Error(`用戶沒有 ${newRole} 角色權限`);
    }

    // 如果已經是當前角色，無需切換
    if (this.currentRole === newRole) {
      return { success: true, message: `已經是 ${newRole} 角色` };
    }

    const previousRole = this.currentRole;
    this.currentRole = newRole;

    // 重新載入角色特定資料
    await this._loadRoleSpecificData();

    // 更新會話存儲
    this._updateSessionStorage();

    // 觸發角色切換事件
    this._triggerEvent('roleSwitch', { 
      previousRole, 
      newRole, 
      user: this.currentUser,
      availableRoles: this.userRoles
    });

    console.log(`Role switched from ${previousRole} to ${newRole}`);

    return { 
      success: true, 
      message: `已切換到 ${newRole} 角色`,
      previousRole,
      newRole,
      availableRoles: this.userRoles
    };
  }

  /**
   * 獲取當前用戶資訊
   * @returns {Object|null} 當前用戶物件
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * 獲取當前用戶角色
   * @returns {string|null} 當前角色
   */
  getCurrentRole() {
    return this.currentRole;
  }

  /**
   * 檢查用戶是否已登入
   * @returns {boolean} 是否已登入
   */
  isLoggedIn() {
    return this.currentUser && this._isSessionValid();
  }

  /**
   * 檢查當前用戶是否有指定角色
   * @param {string} role - 要檢查的角色
   * @returns {boolean} 是否有該角色
   */
  hasRole(role) {
    return this.userRoles.includes(role);
  }

  /**
   * 檢查當前活躍角色是否為指定角色
   * @param {string} role - 要檢查的角色
   * @returns {boolean} 當前活躍角色是否為指定角色
   */
  isCurrentRole(role) {
    return this.currentRole === role;
  }

  /**
   * 獲取用戶的所有角色
   * @returns {Array<string>} 角色陣列
   */
  getAllRoles() {
    return [...this.userRoles];
  }

  /**
   * 檢查用戶是否有多個角色
   * @returns {boolean} 是否有多個角色
   */
  hasMultipleRoles() {
    return this.userRoles.length > 1;
  }

  /**
   * 添加新角色給當前用戶
   * @param {string} newRole - 新角色
   * @returns {Promise<Object>} 添加結果
   */
  async addRole(newRole) {
    this._ensureInitialized();

    if (!this.currentUser) {
      throw new Error('用戶未登入');
    }

    if (!['student', 'parent', 'teacher'].includes(newRole)) {
      throw new Error('無效的角色類型');
    }

    if (this.userRoles.includes(newRole)) {
      return { success: true, message: '用戶已擁有該角色' };
    }

    try {
      // 添加角色關聯
      await this.storageService.addUserRole(this.currentUser.id, newRole);

      // 創建角色特定資料
      await this._createRoleSpecificAccount(this.currentUser.id, newRole, {});

      // 更新本地狀態
      this.userRoles.push(newRole);

      // 更新用戶帳戶的角色陣列
      await this.storageService.updateUserPrimaryRole(
        this.currentUser.id, 
        this.currentRole, 
        this.userRoles
      );

      // 更新會話存儲
      this._updateSessionStorage();

      console.log(`Role ${newRole} added to user ${this.currentUser.username}`);

      return { 
        success: true, 
        message: `已添加 ${newRole} 角色`,
        availableRoles: this.userRoles
      };

    } catch (error) {
      console.error('Failed to add role:', error);
      throw new Error(`添加角色失敗: ${error.message}`);
    }
  }

  /**
   * 獲取用戶的子女列表（限家長）
   * @returns {Array} 子女列表
   */
  getChildren() {
    if (!this.currentUser || this.currentRole !== 'parent') {
      return [];
    }
    return this.currentUser.children || [];
  }

  /**
   * 獲取用戶的學生列表（限教師）
   * @returns {Array} 學生列表
   */
  getStudents() {
    if (!this.currentUser || this.currentRole !== 'teacher') {
      return [];
    }
    return this.currentUser.students || [];
  }

  /**
   * 添加事件監聽器
   * @param {string} event - 事件名稱
   * @param {Function} callback - 回調函數
   */
  addEventListener(event, callback) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].push(callback);
    }
  }

  /**
   * 移除事件監聽器
   * @param {string} event - 事件名稱
   * @param {Function} callback - 回調函數
   */
  removeEventListener(event, callback) {
    if (this.eventListeners[event]) {
      const index = this.eventListeners[event].indexOf(callback);
      if (index > -1) {
        this.eventListeners[event].splice(index, 1);
      }
    }
  }

  /**
   * 觸發事件
   * @param {string} event - 事件名稱
   * @param {Object} data - 事件資料
   */
  _triggerEvent(event, data) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} event listener:`, error);
        }
      });
    }
  }
}

// 導出類別
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UserManager;
} else if (typeof window !== 'undefined') {
  window.UserManager = UserManager;
} 