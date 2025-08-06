/**
 * IndexedDB 儲存服務
 * 負責管理本地資料庫的所有操作
 */

class StorageService {
  constructor() {
    this.dbName = 'AIInstructorDB';
    this.dbVersion = 3;
    this.db = null;
    this.initialized = false;
  }

  /**
   * 初始化資料庫
   * @returns {Promise<void>}
   */
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        reject(new Error('Failed to open database'));
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        this.initialized = true;
        console.log('StorageService initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        this._createObjectStores(db);
      };
    });
  }

  /**
   * 創建對象存儲
   * @param {IDBDatabase} db - 資料庫實例
   */
  _createObjectStores(db) {
    // 會話存儲
    if (!db.objectStoreNames.contains('sessions')) {
      const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
      sessionStore.createIndex('createdAt', 'createdAt', { unique: false });
      sessionStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      sessionStore.createIndex('userId', 'userId', { unique: false });
    }

    // 會話列表存儲（用於快速載入）
    if (!db.objectStoreNames.contains('sessionsList')) {
      db.createObjectStore('sessionsList', { keyPath: 'id' });
    }

    // 設定存儲
    if (!db.objectStoreNames.contains('settings')) {
      db.createObjectStore('settings', { keyPath: 'key' });
    }

    // 用戶偏好設定
    if (!db.objectStoreNames.contains('preferences')) {
      db.createObjectStore('preferences', { keyPath: 'key' });
    }

    // 快取存儲
    if (!db.objectStoreNames.contains('cache')) {
      const cacheStore = db.createObjectStore('cache', { keyPath: 'key' });
      cacheStore.createIndex('expiry', 'expiry', { unique: false });
    }

    // 新增：用戶帳戶存儲（核心用戶資訊）
    if (!db.objectStoreNames.contains('userAccounts')) {
      const userStore = db.createObjectStore('userAccounts', { keyPath: 'id' });
      userStore.createIndex('username', 'username', { unique: true });
      userStore.createIndex('email', 'email', { unique: true });
      userStore.createIndex('role', 'role', { unique: false });
      userStore.createIndex('roles', 'roles', { unique: false, multiEntry: true });
      userStore.createIndex('createdAt', 'createdAt', { unique: false });
      userStore.createIndex('lastLogin', 'lastLogin', { unique: false });
      userStore.createIndex('isActive', 'isActive', { unique: false });
    }

    // 新增：用戶角色關聯存儲（支援多重身份）
    if (!db.objectStoreNames.contains('userRoles')) {
      const userRoleStore = db.createObjectStore('userRoles', { keyPath: 'id', autoIncrement: true });
      userRoleStore.createIndex('userId', 'userId', { unique: false });
      userRoleStore.createIndex('role', 'role', { unique: false });
      userRoleStore.createIndex('userIdRole', ['userId', 'role'], { unique: true });
      userRoleStore.createIndex('isActive', 'isActive', { unique: false });
      userRoleStore.createIndex('createdAt', 'createdAt', { unique: false });
    }

    // 新增：學生帳戶存儲（學生特定資料）
    if (!db.objectStoreNames.contains('studentAccounts')) {
      const studentStore = db.createObjectStore('studentAccounts', { keyPath: 'studentId' });
      studentStore.createIndex('grade', 'grade', { unique: false });
      studentStore.createIndex('class', 'class', { unique: false });
      studentStore.createIndex('parentIds', 'parentIds', { unique: false, multiEntry: true });
      studentStore.createIndex('teacherIds', 'teacherIds', { unique: false, multiEntry: true });
    }

    // 題庫存儲
    if (!db.objectStoreNames.contains('questionBank')) {
      const questionBankStore = db.createObjectStore('questionBank', { keyPath: 'id', autoIncrement: true });
      questionBankStore.createIndex('type', 'type', { unique: false });
      questionBankStore.createIndex('difficulty', 'difficulty', { unique: false });
      questionBankStore.createIndex('topic', 'topic', { unique: false });
      questionBankStore.createIndex('tags', 'tags', { unique: false, multiEntry: true });
      questionBankStore.createIndex('createdAt', 'createdAt', { unique: false });
      questionBankStore.createIndex('sessionId', 'sessionId', { unique: false });
      questionBankStore.createIndex('userId', 'userId', { unique: false });
    } else if (db.version < 3) {
      // 升級現有 questionBank store
      const transaction = db.transaction(['questionBank'], 'versionchange');
      const questionBankStore = transaction.objectStore('questionBank');
      if (!questionBankStore.indexNames.contains('userId')) {
        questionBankStore.createIndex('userId', 'userId', { unique: false });
      }
    }

    // 學習記錄存儲
    if (!db.objectStoreNames.contains('learningRecords')) {
      const learningStore = db.createObjectStore('learningRecords', { keyPath: 'id', autoIncrement: true });
      learningStore.createIndex('timestamp', 'timestamp', { unique: false });
      learningStore.createIndex('sessionId', 'sessionId', { unique: false });
      learningStore.createIndex('questionId', 'questionId', { unique: false });
      learningStore.createIndex('userId', 'userId', { unique: false });
      learningStore.createIndex('correctness', 'correctness', { unique: false });
      learningStore.createIndex('topic', 'topic', { unique: false });
      learningStore.createIndex('difficulty', 'difficulty', { unique: false });
      learningStore.createIndex('userIdTimestamp', ['userId', 'timestamp'], { unique: false });
    } else if (db.version < 3) {
      // 升級現有 learningRecords store
      const transaction = db.transaction(['learningRecords'], 'versionchange');
      const learningStore = transaction.objectStore('learningRecords');
      if (!learningStore.indexNames.contains('userIdTimestamp')) {
        learningStore.createIndex('userIdTimestamp', ['userId', 'timestamp'], { unique: false });
      }
    }

    // 錯誤分析存儲
    if (!db.objectStoreNames.contains('errorAnalysis')) {
      const errorStore = db.createObjectStore('errorAnalysis', { keyPath: 'id', autoIncrement: true });
      errorStore.createIndex('recordId', 'recordId', { unique: false });
      errorStore.createIndex('errorType', 'errorType', { unique: false });
      errorStore.createIndex('topic', 'topic', { unique: false });
      errorStore.createIndex('difficulty', 'difficulty', { unique: false });
      errorStore.createIndex('userId', 'userId', { unique: false });
      errorStore.createIndex('createdAt', 'createdAt', { unique: false });
      errorStore.createIndex('resolved', 'resolved', { unique: false });
    }

    // 成就系統存儲
    if (!db.objectStoreNames.contains('achievements')) {
      const achievementStore = db.createObjectStore('achievements', { keyPath: 'id', autoIncrement: true });
      achievementStore.createIndex('userId', 'userId', { unique: false });
      achievementStore.createIndex('achievementId', 'achievementId', { unique: false });
      achievementStore.createIndex('dateEarned', 'dateEarned', { unique: false });
      achievementStore.createIndex('type', 'type', { unique: false });
      achievementStore.createIndex('category', 'category', { unique: false });
    }

    // 家長帳戶存儲
    if (!db.objectStoreNames.contains('parentAccounts')) {
      const parentStore = db.createObjectStore('parentAccounts', { keyPath: 'parentId' });
      parentStore.createIndex('childUserIds', 'childUserIds', { unique: false, multiEntry: true });
      parentStore.createIndex('createdAt', 'createdAt', { unique: false });
      parentStore.createIndex('lastAccess', 'lastAccess', { unique: false });
    }

    // 教師資料存儲
    if (!db.objectStoreNames.contains('teacherData')) {
      const teacherStore = db.createObjectStore('teacherData', { keyPath: 'teacherId' });
      teacherStore.createIndex('school', 'school', { unique: false });
      teacherStore.createIndex('subject', 'subject', { unique: false });
      teacherStore.createIndex('createdAt', 'createdAt', { unique: false });
      teacherStore.createIndex('classIds', 'classIds', { unique: false, multiEntry: true });
      teacherStore.createIndex('studentIds', 'studentIds', { unique: false, multiEntry: true });
    }

    // 用戶學習統計存儲
    if (!db.objectStoreNames.contains('learningStats')) {
      const statsStore = db.createObjectStore('learningStats', { keyPath: 'id', autoIncrement: true });
      statsStore.createIndex('userId', 'userId', { unique: false });
      statsStore.createIndex('date', 'date', { unique: false });
      statsStore.createIndex('topic', 'topic', { unique: false });
      statsStore.createIndex('statType', 'statType', { unique: false }); // daily, weekly, monthly
    }

    // 練習模式配置存儲
    if (!db.objectStoreNames.contains('practiceConfigs')) {
      const configStore = db.createObjectStore('practiceConfigs', { keyPath: 'id', autoIncrement: true });
      configStore.createIndex('userId', 'userId', { unique: false });
      configStore.createIndex('name', 'name', { unique: false });
      configStore.createIndex('type', 'type', { unique: false }); // adaptive, targeted, review
      configStore.createIndex('createdAt', 'createdAt', { unique: false });
    }

    // 學習報告存儲
    if (!db.objectStoreNames.contains('learningReports')) {
      const reportStore = db.createObjectStore('learningReports', { keyPath: 'id' });
      reportStore.createIndex('userId', 'userId', { unique: false });
      reportStore.createIndex('type', 'type', { unique: false }); // weekly, monthly, custom
      reportStore.createIndex('generatedAt', 'generatedAt', { unique: false });
      reportStore.createIndex('periodStart', 'period.start', { unique: false });
      reportStore.createIndex('periodEnd', 'period.end', { unique: false });
    }
  }

  /**
   * 檢查是否已初始化
   */
  _ensureInitialized() {
    if (!this.initialized || !this.db) {
      throw new Error('StorageService not initialized. Call init() first.');
    }
  }

  /**
   * 保存會話
   * @param {Object} session - 會話物件
   * @returns {Promise<void>}
   */
  async saveSession(session) {
    this._ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['sessions'], 'readwrite');
      const store = transaction.objectStore('sessions');
      
      const request = store.put(session);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to save session'));
    });
  }

  /**
   * 獲取會話
   * @param {string} sessionId - 會話ID
   * @returns {Promise<Object|null>} 會話物件或null
   */
  async getSession(sessionId) {
    this._ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['sessions'], 'readonly');
      const store = transaction.objectStore('sessions');
      
      const request = store.get(sessionId);
      
      request.onsuccess = () => {
        resolve(request.result || null);
      };
      request.onerror = () => reject(new Error('Failed to get session'));
    });
  }

  /**
   * 刪除會話
   * @param {string} sessionId - 會話ID
   * @returns {Promise<void>}
   */
  async deleteSession(sessionId) {
    this._ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['sessions', 'sessionsList'], 'readwrite');
      
      // 刪除會話
      const sessionsStore = transaction.objectStore('sessions');
      const deleteSessionRequest = sessionsStore.delete(sessionId);
      
      // 刪除會話列表項目
      const sessionsListStore = transaction.objectStore('sessionsList');
      const deleteListRequest = sessionsListStore.delete(sessionId);
      
      let completed = 0;
      const total = 2;
      
      const checkCompletion = () => {
        completed++;
        if (completed === total) {
          resolve();
        }
      };
      
      deleteSessionRequest.onsuccess = checkCompletion;
      deleteListRequest.onsuccess = checkCompletion;
      
      deleteSessionRequest.onerror = () => reject(new Error('Failed to delete session'));
      deleteListRequest.onerror = () => reject(new Error('Failed to delete session from list'));
    });
  }

  /**
   * 獲取所有會話
   * @returns {Promise<Array>} 會話陣列
   */
  async getAllSessions() {
    this._ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['sessions'], 'readonly');
      const store = transaction.objectStore('sessions');
      
      const request = store.getAll();
      
      request.onsuccess = () => {
        resolve(request.result || []);
      };
      request.onerror = () => reject(new Error('Failed to get all sessions'));
    });
  }

  /**
   * 保存會話列表
   * @param {Array} sessionsList - 會話摘要陣列
   * @returns {Promise<void>}
   */
  async saveSessionsList(sessionsList) {
    this._ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['sessionsList'], 'readwrite');
      const store = transaction.objectStore('sessionsList');
      
      // 清空現有列表
      const clearRequest = store.clear();
      
      clearRequest.onsuccess = () => {
        // 添加新的會話項目
        let completed = 0;
        const total = sessionsList.length;
        
        if (total === 0) {
          resolve();
          return;
        }
        
        sessionsList.forEach(session => {
          const addRequest = store.add(session);
          
          addRequest.onsuccess = () => {
            completed++;
            if (completed === total) {
              resolve();
            }
          };
          
          addRequest.onerror = () => {
            reject(new Error('Failed to save session list'));
          };
        });
      };
      
      clearRequest.onerror = () => {
        reject(new Error('Failed to clear sessions list'));
      };
    });
  }

  /**
   * 獲取會話列表
   * @returns {Promise<Array>} 會話摘要陣列
   */
  async getSessionsList() {
    this._ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['sessionsList'], 'readonly');
      const store = transaction.objectStore('sessionsList');
      
      const request = store.getAll();
      
      request.onsuccess = () => {
        resolve(request.result || []);
      };
      request.onerror = () => reject(new Error('Failed to get sessions list'));
    });
  }

  /**
   * 保存設定
   * @param {string} key - 設定鍵
   * @param {any} value - 設定值
   * @returns {Promise<void>}
   */
  async saveSetting(key, value) {
    this._ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['settings'], 'readwrite');
      const store = transaction.objectStore('settings');
      
      const request = store.put({ key, value, updatedAt: new Date().toISOString() });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to save setting'));
    });
  }

  /**
   * 獲取設定
   * @param {string} key - 設定鍵
   * @param {any} defaultValue - 預設值
   * @returns {Promise<any>} 設定值
   */
  async getSetting(key, defaultValue = null) {
    this._ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['settings'], 'readonly');
      const store = transaction.objectStore('settings');
      
      const request = store.get(key);
      
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.value : defaultValue);
      };
      request.onerror = () => reject(new Error('Failed to get setting'));
    });
  }

  /**
   * 獲取所有設定
   * @returns {Promise<Object>} 設定物件
   */
  async getAllSettings() {
    this._ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['settings'], 'readonly');
      const store = transaction.objectStore('settings');
      
      const request = store.getAll();
      
      request.onsuccess = () => {
        const results = request.result || [];
        const settings = {};
        
        results.forEach(item => {
          settings[item.key] = item.value;
        });
        
        resolve(settings);
      };
      request.onerror = () => {
        console.error('❌ Failed to get all settings from IndexedDB');
        reject(new Error('Failed to get all settings'));
      };
    });
  }

  /**
   * 保存用戶偏好設定
   * @param {string} key - 偏好鍵
   * @param {any} value - 偏好值
   * @returns {Promise<void>}
   */
  async savePreference(key, value) {
    this._ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['preferences'], 'readwrite');
      const store = transaction.objectStore('preferences');
      
      const request = store.put({ key, value, updatedAt: new Date().toISOString() });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to save preference'));
    });
  }

  /**
   * 獲取用戶偏好設定
   * @param {string} key - 偏好鍵
   * @param {any} defaultValue - 預設值
   * @returns {Promise<any>} 偏好值
   */
  async getPreference(key, defaultValue = null) {
    this._ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['preferences'], 'readonly');
      const store = transaction.objectStore('preferences');
      
      const request = store.get(key);
      
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.value : defaultValue);
      };
      request.onerror = () => reject(new Error('Failed to get preference'));
    });
  }

  /**
   * 保存快取
   * @param {string} key - 快取鍵
   * @param {any} value - 快取值
   * @param {number} ttl - 過期時間（毫秒）
   * @returns {Promise<void>}
   */
  async saveCache(key, value, ttl = 3600000) { // 預設1小時
    this._ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      
      const expiry = new Date(Date.now() + ttl).toISOString();
      const request = store.put({ key, value, expiry, createdAt: new Date().toISOString() });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to save cache'));
    });
  }

  /**
   * 獲取快取
   * @param {string} key - 快取鍵
   * @returns {Promise<any|null>} 快取值或null
   */
  async getCache(key) {
    this._ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['cache'], 'readonly');
      const store = transaction.objectStore('cache');
      
      const request = store.get(key);
      
      request.onsuccess = () => {
        const result = request.result;
        
        if (!result) {
          resolve(null);
          return;
        }
        
        // 檢查是否過期
        const now = new Date();
        const expiry = new Date(result.expiry);
        
        if (now > expiry) {
          // 過期了，刪除快取
          this.deleteCache(key);
          resolve(null);
        } else {
          resolve(result.value);
        }
      };
      request.onerror = () => reject(new Error('Failed to get cache'));
    });
  }

  /**
   * 刪除快取
   * @param {string} key - 快取鍵
   * @returns {Promise<void>}
   */
  async deleteCache(key) {
    this._ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      
      const request = store.delete(key);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to delete cache'));
    });
  }

  /**
   * 清理過期快取
   * @returns {Promise<number>} 清理的快取數量
   */
  async cleanExpiredCache() {
    this._ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const index = store.index('expiry');
      
      const now = new Date().toISOString();
      const range = IDBKeyRange.upperBound(now);
      
      const request = index.openCursor(range);
      let deletedCount = 0;
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          resolve(deletedCount);
        }
      };
      
      request.onerror = () => reject(new Error('Failed to clean expired cache'));
    });
  }

  /**
   * 清空所有資料
   * @returns {Promise<void>}
   */
  async clearAllData() {
    this._ensureInitialized();

    return new Promise((resolve, reject) => {
      const stores = [
        'sessions', 'sessionsList', 'settings', 'preferences', 'cache',
        'questionBank', 'learningRecords', 'errorAnalysis', 'achievements',
        'parentAccounts', 'teacherData', 'learningStats', 'practiceConfigs'
      ];
      
      const transaction = this.db.transaction(stores, 'readwrite');
      
      let completed = 0;
      const total = stores.length;
      
      stores.forEach(storeName => {
        const store = transaction.objectStore(storeName);
        const request = store.clear();
        
        request.onsuccess = () => {
          completed++;
          if (completed === total) {
            resolve();
          }
        };
        
        request.onerror = () => {
          reject(new Error(`Failed to clear ${storeName}`));
        };
      });
    });
  }

  /**
   * 獲取資料庫使用情況統計
   * @returns {Promise<Object>} 統計資訊
   */
  async getStorageStats() {
    this._ensureInitialized();

    const stats = {
      sessions: { count: 0, size: 0 },
      settings: { count: 0, size: 0 },
      preferences: { count: 0, size: 0 },
      cache: { count: 0, size: 0 },
      total: { count: 0, size: 0 }
    };

    const stores = ['sessions', 'settings', 'preferences', 'cache'];
    
    for (const storeName of stores) {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      
      const items = await new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(new Error(`Failed to get ${storeName} stats`));
      });
      
      const size = JSON.stringify(items).length;
      stats[storeName] = { count: items.length, size };
      stats.total.count += items.length;
      stats.total.size += size;
    }

    return stats;
  }

  /**
   * 匯出所有資料
   * @returns {Promise<Object>} 匯出的資料
   */
  async exportData() {
    this._ensureInitialized();

    const data = {
      sessions: [],
      settings: {},
      preferences: {},
      exportedAt: new Date().toISOString(),
      version: this.dbVersion
    };

    // 匯出會話
    data.sessions = await this.getAllSessions();
    
    // 匯出設定
    data.settings = await this.getAllSettings();
    
    // 匯出偏好設定
    const preferences = await new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['preferences'], 'readonly');
      const store = transaction.objectStore('preferences');
      
      const request = store.getAll();
      
      request.onsuccess = () => {
        const results = request.result || [];
        const prefs = {};
        
        results.forEach(item => {
          prefs[item.key] = item.value;
        });
        
        resolve(prefs);
      };
      request.onerror = () => reject(new Error('Failed to export preferences'));
    });
    
    data.preferences = preferences;

    return data;
  }

  /**
   * 匯入資料
   * @param {Object} data - 要匯入的資料
   * @param {boolean} clearFirst - 是否先清空現有資料
   * @returns {Promise<void>}
   */
  async importData(data, clearFirst = false) {
    this._ensureInitialized();

    if (clearFirst) {
      await this.clearAllData();
    }

    // 匯入會話
    if (data.sessions && Array.isArray(data.sessions)) {
      for (const session of data.sessions) {
        await this.saveSession(session);
      }
    }

    // 匯入設定
    if (data.settings && typeof data.settings === 'object') {
      for (const [key, value] of Object.entries(data.settings)) {
        await this.saveSetting(key, value);
      }
    }

    // 匯入偏好設定
    if (data.preferences && typeof data.preferences === 'object') {
      for (const [key, value] of Object.entries(data.preferences)) {
        await this.savePreference(key, value);
      }
    }

    console.log('Data import completed');
  }

  // === 新增的題庫操作方法 ===

  /**
   * 保存題目到題庫
   * @param {Object} question - 題目物件
   * @returns {Promise<number>} 題目ID
   */
  async saveQuestion(question) {
    this._ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['questionBank'], 'readwrite');
      const store = transaction.objectStore('questionBank');
      
      const questionData = {
        ...question,
        createdAt: question.createdAt || new Date().toISOString(),
        tags: Array.isArray(question.tags) ? question.tags : []
      };
      
      const request = store.add(questionData);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Failed to save question'));
    });
  }

  /**
   * 根據條件獲取題目
   * @param {Object} filters - 篩選條件
   * @returns {Promise<Array>} 題目陣列
   */
  async getQuestions(filters = {}) {
    this._ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['questionBank'], 'readonly');
      const store = transaction.objectStore('questionBank');
      
      const request = store.getAll();
      
      request.onsuccess = () => {
        let questions = request.result || [];
        
        // 應用篩選條件
        if (filters.type) {
          questions = questions.filter(q => q.type === filters.type);
        }
        if (filters.difficulty) {
          questions = questions.filter(q => q.difficulty === filters.difficulty);
        }
        if (filters.topic) {
          questions = questions.filter(q => q.topic === filters.topic);
        }
        if (filters.tags && Array.isArray(filters.tags)) {
          questions = questions.filter(q => 
            filters.tags.some(tag => q.tags && q.tags.includes(tag))
          );
        }
        if (filters.sessionId) {
          questions = questions.filter(q => q.sessionId === filters.sessionId);
        }
        
        resolve(questions);
      };
      request.onerror = () => reject(new Error('Failed to get questions'));
    });
  }

  /**
   * 刪除題目
   * @param {number} questionId - 題目ID
   * @returns {Promise<void>}
   */
  async deleteQuestion(questionId) {
    this._ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['questionBank'], 'readwrite');
      const store = transaction.objectStore('questionBank');
      
      const request = store.delete(questionId);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to delete question'));
    });
  }

  // === 學習記錄操作方法 ===

  /**
   * 保存學習記錄
   * @param {Object} record - 學習記錄物件
   * @returns {Promise<number>} 記錄ID
   */
  async saveLearningRecord(record) {
    this._ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['learningRecords'], 'readwrite');
      const store = transaction.objectStore('learningRecords');
      
      const recordData = {
        ...record,
        timestamp: record.timestamp || new Date().toISOString(),
        userId: record.userId || 'default'
      };
      
      const request = store.add(recordData);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Failed to save learning record'));
    });
  }

  /**
   * 獲取學習記錄
   * @param {Object} filters - 篩選條件
   * @returns {Promise<Array>} 學習記錄陣列
   */
  async getLearningRecords(filters = {}) {
    this._ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['learningRecords'], 'readonly');
      const store = transaction.objectStore('learningRecords');
      
      let request;
      
      if (filters.userId) {
        const index = store.index('userId');
        request = index.getAll(filters.userId);
      } else if (filters.sessionId) {
        const index = store.index('sessionId');
        request = index.getAll(filters.sessionId);
      } else {
        request = store.getAll();
      }
      
      request.onsuccess = () => {
        let records = request.result || [];
        
        // 應用額外篩選條件
        if (filters.topic) {
          records = records.filter(r => r.topic === filters.topic);
        }
        if (filters.correctness !== undefined) {
          records = records.filter(r => r.correctness === filters.correctness);
        }
        if (filters.startDate) {
          records = records.filter(r => r.timestamp >= filters.startDate);
        }
        if (filters.endDate) {
          records = records.filter(r => r.timestamp <= filters.endDate);
        }
        
        // 按時間排序（新到舊）
        records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        resolve(records);
      };
      request.onerror = () => reject(new Error('Failed to get learning records'));
    });
  }

  // === 錯誤分析操作方法 ===

  /**
   * 保存錯誤分析
   * @param {Object} analysis - 錯誤分析物件
   * @returns {Promise<number>} 分析ID
   */
  async saveErrorAnalysis(analysis) {
    this._ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['errorAnalysis'], 'readwrite');
      const store = transaction.objectStore('errorAnalysis');
      
      const analysisData = {
        ...analysis,
        createdAt: analysis.createdAt || new Date().toISOString(),
        resolved: analysis.resolved || false,
        userId: analysis.userId || 'default'
      };
      
      const request = store.add(analysisData);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Failed to save error analysis'));
    });
  }

  /**
   * 獲取錯誤分析
   * @param {Object} filters - 篩選條件
   * @returns {Promise<Array>} 錯誤分析陣列
   */
  async getErrorAnalysis(filters = {}) {
    this._ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['errorAnalysis'], 'readonly');
      const store = transaction.objectStore('errorAnalysis');
      
      const request = store.getAll();
      
      request.onsuccess = () => {
        let analyses = request.result || [];
        
        // 應用篩選條件
        if (filters.userId) {
          analyses = analyses.filter(a => a.userId === filters.userId);
        }
        if (filters.errorType) {
          analyses = analyses.filter(a => a.errorType === filters.errorType);
        }
        if (filters.topic) {
          analyses = analyses.filter(a => a.topic === filters.topic);
        }
        if (filters.resolved !== undefined) {
          analyses = analyses.filter(a => a.resolved === filters.resolved);
        }
        
        resolve(analyses);
      };
      request.onerror = () => reject(new Error('Failed to get error analysis'));
    });
  }

  // === 成就系統操作方法 ===

  /**
   * 保存成就
   * @param {Object} achievement - 成就物件
   * @returns {Promise<number>} 成就ID
   */
  async saveAchievement(achievement) {
    this._ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['achievements'], 'readwrite');
      const store = transaction.objectStore('achievements');
      
      const achievementData = {
        ...achievement,
        dateEarned: achievement.dateEarned || new Date().toISOString(),
        userId: achievement.userId || 'default'
      };
      
      const request = store.add(achievementData);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Failed to save achievement'));
    });
  }

  /**
   * 獲取用戶成就
   * @param {string} userId - 用戶ID
   * @returns {Promise<Array>} 成就陣列
   */
  async getUserAchievements(userId = 'default') {
    this._ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['achievements'], 'readonly');
      const store = transaction.objectStore('achievements');
      const index = store.index('userId');
      
      const request = index.getAll(userId);
      
      request.onsuccess = () => {
        const achievements = request.result || [];
        // 按獲得日期排序（新到舊）
        achievements.sort((a, b) => new Date(b.dateEarned) - new Date(a.dateEarned));
        resolve(achievements);
      };
      request.onerror = () => reject(new Error('Failed to get user achievements'));
    });
  }

  // === 學習統計操作方法 ===

  /**
   * 保存學習統計
   * @param {Object} stats - 統計資料
   * @returns {Promise<number>} 統計ID
   */
  async saveLearningStats(stats) {
    this._ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['learningStats'], 'readwrite');
      const store = transaction.objectStore('learningStats');
      
      const statsData = {
        ...stats,
        userId: stats.userId || 'default',
        date: stats.date || new Date().toISOString().split('T')[0] // YYYY-MM-DD
      };
      
      const request = store.add(statsData);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Failed to save learning stats'));
    });
  }

  /**
   * 獲取學習統計
   * @param {Object} filters - 篩選條件
   * @returns {Promise<Array>} 統計陣列
   */
  async getLearningStats(filters = {}) {
    this._ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['learningStats'], 'readonly');
      const store = transaction.objectStore('learningStats');
      
      const request = store.getAll();
      
      request.onsuccess = () => {
        let stats = request.result || [];
        
        // 應用篩選條件
        if (filters.userId) {
          stats = stats.filter(s => s.userId === filters.userId);
        }
        if (filters.statType) {
          stats = stats.filter(s => s.statType === filters.statType);
        }
        if (filters.topic) {
          stats = stats.filter(s => s.topic === filters.topic);
        }
        if (filters.startDate) {
          stats = stats.filter(s => s.date >= filters.startDate);
        }
        if (filters.endDate) {
          stats = stats.filter(s => s.date <= filters.endDate);
        }
        
        resolve(stats);
      };
      request.onerror = () => reject(new Error('Failed to get learning stats'));
    });
  }

  // === 練習配置操作方法 ===

  /**
   * 保存練習配置
   * @param {Object} config - 配置物件
   * @returns {Promise<number>} 配置ID
   */
  async savePracticeConfig(config) {
    this._ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['practiceConfigs'], 'readwrite');
      const store = transaction.objectStore('practiceConfigs');
      
      const configData = {
        ...config,
        createdAt: config.createdAt || new Date().toISOString(),
        userId: config.userId || 'default'
      };
      
      const request = store.add(configData);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Failed to save practice config'));
    });
  }

  /**
   * 獲取用戶練習配置
   * @param {string} userId - 用戶ID
   * @returns {Promise<Array>} 配置陣列
   */
  async getUserPracticeConfigs(userId = 'default') {
    this._ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['practiceConfigs'], 'readonly');
      const store = transaction.objectStore('practiceConfigs');
      const index = store.index('userId');
      
      const request = index.getAll(userId);
      
      request.onsuccess = () => {
        const configs = request.result || [];
        // 按創建時間排序（新到舊）
        configs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        resolve(configs);
      };
      request.onerror = () => reject(new Error('Failed to get user practice configs'));
    });
  }

  // === 學習報告操作方法 ===

  /**
   * 保存學習報告
   * @param {Object} report - 報告物件
   * @returns {Promise<void>}
   */
  async saveReport(report) {
    this._ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['learningReports'], 'readwrite');
      const store = transaction.objectStore('learningReports');
      
      const request = store.put(report);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to save report'));
    });
  }

  /**
   * 獲取報告列表
   * @param {Object} filters - 篩選條件
   * @returns {Promise<Array>} 報告陣列
   */
  async getReports(filters = {}) {
    this._ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['learningReports'], 'readonly');
      const store = transaction.objectStore('learningReports');
      
      const request = store.getAll();
      
      request.onsuccess = () => {
        let reports = request.result || [];
        
        // 應用篩選條件
        if (filters.userId) {
          reports = reports.filter(r => r.userId === filters.userId);
        }
        if (filters.type) {
          reports = reports.filter(r => r.type === filters.type);
        }
        if (filters.startDate) {
          reports = reports.filter(r => r.generatedAt >= filters.startDate);
        }
        if (filters.endDate) {
          reports = reports.filter(r => r.generatedAt <= filters.endDate);
        }
        
        resolve(reports);
      };
      request.onerror = () => reject(new Error('Failed to get reports'));
    });
  }

  /**
   * 獲取特定報告
   * @param {string} reportId - 報告ID
   * @returns {Promise<Object|null>} 報告物件或null
   */
  async getReport(reportId) {
    this._ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['learningReports'], 'readonly');
      const store = transaction.objectStore('learningReports');
      
      const request = store.get(reportId);
      
      request.onsuccess = () => {
        resolve(request.result || null);
      };
      request.onerror = () => reject(new Error('Failed to get report'));
    });
  }

  /**
   * 刪除報告
   * @param {string} reportId - 報告ID
   * @returns {Promise<void>}
   */
  async deleteReport(reportId) {
    this._ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['learningReports'], 'readwrite');
      const store = transaction.objectStore('learningReports');
      
      const request = store.delete(reportId);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to delete report'));
    });
  }

  // ============================================================================
  // 用戶管理相關方法 (User Management Methods)
  // ============================================================================

  /**
   * 儲存用戶帳戶
   * @param {Object} user - 用戶物件
   * @param {string} user.id - 用戶ID
   * @param {string} user.username - 用戶名
   * @param {string} user.email - 電子郵件
   * @param {string} user.role - 角色 ('student', 'parent', 'teacher')
   * @param {string} user.passwordHash - 密碼雜湊（客戶端加密）
   * @param {boolean} user.isActive - 是否啟用
   * @returns {Promise<void>}
   */
  async saveUserAccount(user) {
    this._ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['userAccounts'], 'readwrite');
      const store = transaction.objectStore('userAccounts');
      
      const userData = {
        ...user,
        createdAt: user.createdAt || new Date().toISOString(),
        lastLogin: user.lastLogin || null,
        isActive: user.isActive !== undefined ? user.isActive : true
      };
      
      const request = store.put(userData);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to save user account'));
    });
  }

  /**
   * 獲取用戶帳戶
   * @param {string} userId - 用戶ID
   * @returns {Promise<Object|null>} 用戶物件或null
   */
  async getUserAccount(userId) {
    this._ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['userAccounts'], 'readonly');
      const store = transaction.objectStore('userAccounts');
      
      const request = store.get(userId);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error('Failed to get user account'));
    });
  }

  /**
   * 通過用戶名獲取用戶帳戶
   * @param {string} username - 用戶名
   * @returns {Promise<Object|null>} 用戶物件或null
   */
  async getUserAccountByUsername(username) {
    this._ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['userAccounts'], 'readonly');
      const store = transaction.objectStore('userAccounts');
      const index = store.index('username');
      
      const request = index.get(username);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error('Failed to get user account by username'));
    });
  }

  /**
   * 通過電子郵件獲取用戶帳戶
   * @param {string} email - 電子郵件
   * @returns {Promise<Object|null>} 用戶物件或null
   */
  async getUserAccountByEmail(email) {
    this._ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['userAccounts'], 'readonly');
      const store = transaction.objectStore('userAccounts');
      const index = store.index('email');
      
      const request = index.get(email);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error('Failed to get user account by email'));
    });
  }

  /**
   * 獲取所有指定角色的用戶
   * @param {string} role - 角色 ('student', 'parent', 'teacher')
   * @returns {Promise<Array>} 用戶陣列
   */
  async getUsersByRole(role) {
    this._ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['userAccounts'], 'readonly');
      const store = transaction.objectStore('userAccounts');
      const index = store.index('role');
      
      const request = index.getAll(role);
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(new Error('Failed to get users by role'));
    });
  }

  /**
   * 更新用戶最後登入時間
   * @param {string} userId - 用戶ID
   * @returns {Promise<void>}
   */
  async updateUserLastLogin(userId) {
    this._ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['userAccounts'], 'readwrite');
      const store = transaction.objectStore('userAccounts');
      
      // 先獲取用戶資料
      const getRequest = store.get(userId);
      
      getRequest.onsuccess = () => {
        const user = getRequest.result;
        if (user) {
          user.lastLogin = new Date().toISOString();
          const putRequest = store.put(user);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(new Error('Failed to update last login'));
        } else {
          reject(new Error('User not found'));
        }
      };
      
      getRequest.onerror = () => reject(new Error('Failed to get user for last login update'));
    });
  }

  /**
   * 刪除用戶帳戶
   * @param {string} userId - 用戶ID
   * @returns {Promise<void>}
   */
  async deleteUserAccount(userId) {
    this._ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['userAccounts'], 'readwrite');
      const store = transaction.objectStore('userAccounts');
      
      const request = store.delete(userId);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to delete user account'));
    });
  }

  /**
   * 儲存學生帳戶資料
   * @param {Object} student - 學生資料物件
   * @param {string} student.studentId - 學生ID（對應 userAccounts 的 id）
   * @param {string} student.grade - 年級
   * @param {string} student.class - 班級
   * @param {Array<string>} student.parentIds - 家長ID陣列
   * @param {Array<string>} student.teacherIds - 教師ID陣列
   * @returns {Promise<void>}
   */
  async saveStudentAccount(student) {
    this._ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['studentAccounts'], 'readwrite');
      const store = transaction.objectStore('studentAccounts');
      
      const request = store.put(student);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to save student account'));
    });
  }

  /**
   * 獲取學生帳戶資料
   * @param {string} studentId - 學生ID
   * @returns {Promise<Object|null>} 學生資料物件或null
   */
  async getStudentAccount(studentId) {
    this._ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['studentAccounts'], 'readonly');
      const store = transaction.objectStore('studentAccounts');
      
      const request = store.get(studentId);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error('Failed to get student account'));
    });
  }

  /**
   * 儲存家長帳戶資料
   * @param {Object} parent - 家長資料物件
   * @param {string} parent.parentId - 家長ID（對應 userAccounts 的 id）
   * @param {Array<string>} parent.childUserIds - 子女用戶ID陣列
   * @param {Object} parent.settings - 家長設定
   * @returns {Promise<void>}
   */
  async saveParentAccount(parent) {
    this._ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['parentAccounts'], 'readwrite');
      const store = transaction.objectStore('parentAccounts');
      
      const parentData = {
        ...parent,
        createdAt: parent.createdAt || new Date().toISOString(),
        lastAccess: parent.lastAccess || null
      };
      
      const request = store.put(parentData);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to save parent account'));
    });
  }

  /**
   * 獲取家長帳戶資料
   * @param {string} parentId - 家長ID
   * @returns {Promise<Object|null>} 家長資料物件或null
   */
  async getParentAccount(parentId) {
    this._ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['parentAccounts'], 'readonly');
      const store = transaction.objectStore('parentAccounts');
      
      const request = store.get(parentId);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error('Failed to get parent account'));
    });
  }

  /**
   * 儲存教師資料
   * @param {Object} teacher - 教師資料物件
   * @param {string} teacher.teacherId - 教師ID（對應 userAccounts 的 id）
   * @param {string} teacher.school - 學校
   * @param {string} teacher.subject - 科目
   * @param {Array<string>} teacher.classIds - 班級ID陣列
   * @param {Array<string>} teacher.studentIds - 學生ID陣列
   * @returns {Promise<void>}
   */
  async saveTeacherData(teacher) {
    this._ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['teacherData'], 'readwrite');
      const store = transaction.objectStore('teacherData');
      
      const teacherData = {
        ...teacher,
        createdAt: teacher.createdAt || new Date().toISOString()
      };
      
      const request = store.put(teacherData);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to save teacher data'));
    });
  }

  /**
   * 獲取教師資料
   * @param {string} teacherId - 教師ID
   * @returns {Promise<Object|null>} 教師資料物件或null
   */
  async getTeacherData(teacherId) {
    this._ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['teacherData'], 'readonly');
      const store = transaction.objectStore('teacherData');
      
      const request = store.get(teacherId);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error('Failed to get teacher data'));
    });
  }

  /**
   * 獲取用戶特定的學習記錄
   * @param {string} userId - 用戶ID
   * @param {Object} filters - 額外過濾條件
   * @returns {Promise<Array>} 學習記錄陣列
   */
  async getUserLearningRecords(userId, filters = {}) {
    this._ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['learningRecords'], 'readonly');
      const store = transaction.objectStore('learningRecords');
      const index = store.index('userId');
      
      const request = index.getAll(userId);
      
      request.onsuccess = () => {
        let records = request.result || [];
        
        // 應用額外過濾條件
        if (filters.sessionId) {
          records = records.filter(record => record.sessionId === filters.sessionId);
        }
        if (filters.correctness !== undefined) {
          records = records.filter(record => record.correctness === filters.correctness);
        }
        if (filters.topic) {
          records = records.filter(record => record.topic === filters.topic);
        }
        if (filters.difficulty) {
          records = records.filter(record => record.difficulty === filters.difficulty);
        }
        if (filters.limit) {
          records = records.slice(0, filters.limit);
        }
        
        resolve(records);
      };
      
      request.onerror = () => reject(new Error('Failed to get user learning records'));
    });
  }

  /**
   * 獲取用戶特定的錯誤分析
   * @param {string} userId - 用戶ID
   * @param {Object} filters - 額外過濾條件
   * @returns {Promise<Array>} 錯誤分析陣列
   */
  async getUserErrorAnalysis(userId, filters = {}) {
    this._ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['errorAnalysis'], 'readonly');
      const store = transaction.objectStore('errorAnalysis');
      const index = store.index('userId');
      
      const request = index.getAll(userId);
      
      request.onsuccess = () => {
        let analyses = request.result || [];
        
        // 應用額外過濾條件
        if (filters.errorType) {
          analyses = analyses.filter(analysis => analysis.errorType === filters.errorType);
        }
        if (filters.topic) {
          analyses = analyses.filter(analysis => analysis.topic === filters.topic);
        }
        if (filters.resolved !== undefined) {
          analyses = analyses.filter(analysis => analysis.resolved === filters.resolved);
        }
        
        resolve(analyses);
      };
      
      request.onerror = () => reject(new Error('Failed to get user error analysis'));
    });
  }

  /**
   * 獲取用戶特定的成就
   * @param {string} userId - 用戶ID
   * @returns {Promise<Array>} 成就陣列
   */
  async getUserSpecificAchievements(userId) {
    this._ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['achievements'], 'readonly');
      const store = transaction.objectStore('achievements');
      const index = store.index('userId');
      
      const request = index.getAll(userId);
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(new Error('Failed to get user achievements'));
    });
  }

  // ==================== 用戶角色管理方法 ====================

  /**
   * 添加用戶角色關聯
   * @param {string} userId - 用戶ID
   * @param {string} role - 角色名稱
   * @returns {Promise<void>}
   */
  async addUserRole(userId, role) {
    this._ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['userRoles'], 'readwrite');
      const store = transaction.objectStore('userRoles');
      
      const roleData = {
        userId,
        role,
        isActive: true,
        createdAt: new Date().toISOString()
      };
      
      const request = store.add(roleData);
      
      request.onsuccess = () => resolve();
      request.onerror = (event) => {
        // 檢查是否是重複錯誤
        if (event.target.error.name === 'ConstraintError') {
          resolve(); // 角色已存在，視為成功
        } else {
          reject(new Error('Failed to add user role'));
        }
      };
    });
  }

  /**
   * 獲取用戶的所有角色
   * @param {string} userId - 用戶ID
   * @returns {Promise<Array<string>>} 角色名稱陣列
   */
  async getUserRoles(userId) {
    this._ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['userRoles'], 'readonly');
      const store = transaction.objectStore('userRoles');
      const index = store.index('userId');
      
      const request = index.getAll(userId);
      
      request.onsuccess = () => {
        const roleRecords = request.result || [];
        const activeRoles = roleRecords
          .filter(record => record.isActive)
          .map(record => record.role);
        resolve(activeRoles);
      };
      
      request.onerror = () => reject(new Error('Failed to get user roles'));
    });
  }

  /**
   * 移除用戶角色關聯
   * @param {string} userId - 用戶ID
   * @param {string} role - 角色名稱
   * @returns {Promise<void>}
   */
  async removeUserRole(userId, role) {
    this._ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['userRoles'], 'readwrite');
      const store = transaction.objectStore('userRoles');
      const index = store.index('userIdRole');
      
      const request = index.get([userId, role]);
      
      request.onsuccess = () => {
        const record = request.result;
        if (record) {
          // 軟刪除：設為非活躍狀態
          record.isActive = false;
          record.removedAt = new Date().toISOString();
          
          const updateRequest = store.put(record);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(new Error('Failed to update user role'));
        } else {
          resolve(); // 角色不存在，視為成功
        }
      };
      
      request.onerror = () => reject(new Error('Failed to remove user role'));
    });
  }

  /**
   * 檢查用戶是否擁有特定角色
   * @param {string} userId - 用戶ID
   * @param {string} role - 角色名稱
   * @returns {Promise<boolean>} 是否擁有該角色
   */
  async userHasRole(userId, role) {
    this._ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['userRoles'], 'readonly');
      const store = transaction.objectStore('userRoles');
      const index = store.index('userIdRole');
      
      const request = index.get([userId, role]);
      
      request.onsuccess = () => {
        const record = request.result;
        resolve(record && record.isActive);
      };
      
      request.onerror = () => reject(new Error('Failed to check user role'));
    });
  }

  /**
   * 獲取擁有特定角色的所有用戶
   * @param {string} role - 角色名稱
   * @returns {Promise<Array<string>>} 用戶ID陣列
   */
  async getUsersByRole(role) {
    this._ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['userRoles'], 'readonly');
      const store = transaction.objectStore('userRoles');
      const index = store.index('role');
      
      const request = index.getAll(role);
      
      request.onsuccess = () => {
        const roleRecords = request.result || [];
        const activeUserIds = roleRecords
          .filter(record => record.isActive)
          .map(record => record.userId);
        // 去除重複
        resolve([...new Set(activeUserIds)]);
      };
      
      request.onerror = () => reject(new Error('Failed to get users by role'));
    });
  }

  /**
   * 更新用戶的主要角色（在 userAccounts 中）
   * @param {string} userId - 用戶ID
   * @param {string} primaryRole - 主要角色
   * @param {Array<string>} allRoles - 所有角色陣列
   * @returns {Promise<void>}
   */
  async updateUserPrimaryRole(userId, primaryRole, allRoles = null) {
    this._ensureInitialized();

    return new Promise(async (resolve, reject) => {
      try {
        // 獲取用戶帳戶
        const userAccount = await this.getUserAccount(userId);
        if (!userAccount) {
          reject(new Error('User account not found'));
          return;
        }

        // 如果沒有提供所有角色，則從 userRoles 獲取
        if (!allRoles) {
          allRoles = await this.getUserRoles(userId);
        }

        // 更新用戶帳戶
        const transaction = this.db.transaction(['userAccounts'], 'readwrite');
        const store = transaction.objectStore('userAccounts');
        
        userAccount.role = primaryRole; // 主要角色（保持向後兼容）
        userAccount.roles = allRoles; // 所有角色陣列
        userAccount.updatedAt = new Date().toISOString();
        
        const request = store.put(userAccount);
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(new Error('Failed to update user primary role'));
      } catch (error) {
        reject(error);
      }
    });
  }
}

// 創建全域實例
const storageService = new StorageService();

export default storageService; 