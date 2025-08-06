class AppStateManager {
  constructor() {
    // 預設應用程式狀態
    this._state = {
      apiKey: null,
      currentModel: 'gemini-2.5-flash',
      temperature: 0.7,
      streamingEnabled: true,
      adaptiveDifficulty: true,
      stepByStep: true,
      customSystemPrompt: null,
      uploadedImages: [], // 圖片上傳狀態
      deferredPrompt: null, // PWA 安裝提示
      isInstalled: false, // PWA 是否已安裝
      isVoiceInputActive: false, // 語音服務活躍狀態
      currentVoiceLanguage: null, // 當前語音輸入語言
      isPracticeMode: false, // 是否在語音練習模式
      isQuestionMode: false, // 是否在問題模式 (未在原代碼中直接使用，但在此統一管理)
      currentPracticeSession: null, // 當前練習會話 (未在原代碼中直接使用，但在此統一管理)
      selectedRole: null // 當前選定的角色ID
    };
  }

  /**
   * 獲取指定設定值或整個狀態物件的副本。
   * 對於陣列和物件，返回一個副本以防止外部直接修改內部狀態。
   * @param {string} key - 設定的鍵名 (可選)
   * @returns {*} 設定值或整個狀態物件的深度副本
   */
  get(key) {
    if (key) {
      const value = this._state[key];
      // 對於陣列和物件，返回副本
      if (Array.isArray(value)) {
        return [...value];
      }
      if (typeof value === 'object' && value !== null) {
        return { ...value };
      }
      return value;
    }
    // 返回整個狀態物件的深度副本
    return JSON.parse(JSON.stringify(this._state));
  }

  /**
   * 設置單個狀態值。
   * @param {string} key - 狀態鍵
   * @param {*} value - 新值
   */
  set(key, value) {
    if (Object.prototype.hasOwnProperty.call(this._state, key)) {
      this._state[key] = value;
      // console.log(`State key '${key}' updated to:`, value); // 調試日誌
    } else {
      console.warn(`Attempted to set unknown state key: ${key}`);
    }
  }

  /**
   * 更新應用程式狀態，合併新的鍵值對。
   * @param {object} updates - 包含要更新的鍵值對的物件
   */
  updateState(updates) {
    Object.assign(this._state, updates);
    // console.log('App state updated:', this._state); // 調試日誌
  }

  // 特殊處理 uploadedImages 陣列的方法，以確保外部操作不直接修改內部陣列引用
  /**
   * 添加一個圖片到 uploadedImages 列表。
   * @param {object} imageInfo - 圖片信息物件
   */
  addUploadedImage(imageInfo) {
    this._state.uploadedImages.push(imageInfo);
  }

  /**
   * 從 uploadedImages 列表中移除指定索引的圖片。
   * @param {number} index - 要移除的圖片索引
   */
  removeUploadedImage(index) {
    this._state.uploadedImages.splice(index, 1);
  }

  /**
   * 清空 uploadedImages 列表。
   */
  clearUploadedImages() {
    this._state.uploadedImages = [];
  }
}

// 導出一個單例實例，確保整個應用程式共享同一個狀態管理器
const appStateManager = new AppStateManager();
export default appStateManager;
