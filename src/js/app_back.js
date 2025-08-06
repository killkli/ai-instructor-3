/**
 * AI 教學助理主應用程式
 * 整合所有服務和UI組件
 */

import geminiService from './services/gemini-service.js';
import sessionManager from './services/session-manager.js';
import storageService from './services/storage-service.js';
import promptManager from './config/prompt-manager.js';
import contentRenderer from './services/content-renderer.js';
import speechService from './services/speech-service.js';
import exportService from './services/export-service.js';
import QuestionBankService from './services/question-bank-service.js';
import PracticeIntegration from './services/practice-integration.js';

class AIInstructorApp {
  constructor() {
    this.initialized = false;
    this.currentSessionId = null;
    this.isProcessing = false;
    
    // UI 元素
    this.elements = {};
    
    // 狀態
    this.appState = {
      apiKey: null,
      currentModel: 'gemini-2.0-flash',
      temperature: 0.7,
      streamingEnabled: true,
      soundEnabled: true,
      adaptiveDifficulty: true,
      stepByStep: true,
      customSystemPrompt: null
    };
    
    // 圖片上傳狀態
    this.uploadedImages = [];
    
    // PWA 安裝提示
    this.deferredPrompt = null;
    this.isInstalled = false;
    
    // 語音服務
    this.speechService = null;
    this.isVoiceInputActive = false;
    this.currentVoiceLanguage = null;
    this.isPracticeMode = false;
    
    // 題庫服務
    this.questionBankService = null;
    this.practiceIntegration = null;
    this.isQuestionMode = false;
    this.currentPracticeSession = null;
  }

  /**
   * 初始化應用程式
   */
  async init() {
    try {
      console.log('🚀 Starting AI Instructor App...');
      
      await this._initializeBasicServices();
      await this._initializeUI();
      await this._loadSettings();
      await this._initializeAIServices();
      
      this._setupEventListeners();
      await this._handleUrlParams();
      
      await this._showInitialInterface();
      
      console.log('✅ AI Instructor App initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize app:', error);
      this._showError('初始化失敗', error.message);
    }
  }

  /**
   * 初始化基礎服務（不需要API金鑰的服務）
   */
  async _initializeBasicServices() {
    try {
      await storageService.init();
      await sessionManager.init(storageService);
      await promptManager.init();
      await contentRenderer.init();
      
      // 初始化語音服務
      this.speechService = speechService;
      
      // 初始化匯出服務
      exportService.init(sessionManager);
      
      console.log('📦 Basic services initialized');
    } catch (error) {
      console.error('Basic service initialization failed:', error);
      throw error;
    }
  }

  /**
   * 初始化AI相關服務（需要API金鑰的服務）
   */
  async _initializeAIServices() {
    try {
      // 初始化題庫服務（這時候geminiService已經有API金鑰了）
      this.questionBankService = new QuestionBankService(geminiService, storageService);
      
      // 初始化練習整合功能
      this.practiceIntegration = new PracticeIntegration(this, this.questionBankService, storageService);
      
      console.log('🤖 AI services initialized');
    } catch (error) {
      console.error('AI service initialization failed:', error);
      throw error;
    }
  }

  /**
   * 初始化UI元素
   */
  async _initializeUI() {
    // 獲取主要UI元素
    this.elements = {
      // 主要容器
      app: document.getElementById('app'),
      sidebar: document.getElementById('sidebar'),
      chatContainer: document.getElementById('chat-container'),
      
      // 聊天相關
      messagesContainer: document.getElementById('messages'),
      messageInput: document.getElementById('message-input'),
      sendButton: document.getElementById('send-button'),
      inputArea: document.getElementById('input-area'),
      
      // 圖片上傳
      imageUploadBtn: document.getElementById('image-upload-btn'),
      imageUpload: document.getElementById('image-upload'),
      imagePreview: document.getElementById('image-preview'),
      
      // 語音相關
      voiceInputChineseBtn: document.getElementById('voice-input-chinese-btn'),
      voiceInputEnglishBtn: document.getElementById('voice-input-english-btn'),
      voiceStatus: document.getElementById('voice-status'),
      voiceStatusMessage: document.getElementById('voice-status-message'),
      voiceStopBtn: document.getElementById('voice-stop-btn'),
      
      // 側邊欄
      sidebar: document.getElementById('sidebar'),
      sidebarToggle: document.getElementById('sidebar-toggle'),
      sidebarOverlay: document.getElementById('sidebar-overlay'),
      newChatButton: document.getElementById('new-chat-button'),
      sessionsList: document.getElementById('sessions-list'),
      settingsButton: document.getElementById('settings-button'),
      modelInfo: document.getElementById('model-info'),
      
      // 模態框
      setupModal: document.getElementById('setup-modal'),
      settingsModal: document.getElementById('settings-modal'),
      roleSelectionModal: document.getElementById('role-selection-modal'),
      
      // 角色選擇相關
      roleGrid: document.getElementById('role-grid'),
      roleSelectionCancel: document.getElementById('role-selection-cancel'),
      roleSelectionConfirm: document.getElementById('role-selection-confirm'),
      
      // 設定表單
      apiKeyInput: document.getElementById('api-key-input'),
      currentApiKeyInput: document.getElementById('current-api-key'),
      updateApiKeyButton: document.getElementById('update-api-key'),
      
      // 分享功能
      generateShareLinkButton: document.getElementById('generate-share-link'),
      copyShareLinkButton: document.getElementById('copy-share-link'),
      shareLinkInput: document.getElementById('share-link-input'),
      modelSelect: document.getElementById('model-select'),
      temperatureSlider: document.getElementById('temperature-slider'),
      temperatureValue: document.getElementById('temperature-value'),
      customSystemPrompt: document.getElementById('custom-system-prompt'),
      resetSystemPrompt: document.getElementById('reset-system-prompt'),
      previewSystemPrompt: document.getElementById('preview-system-prompt'),
      
      // 提示詞預覽模態框
      promptPreviewModal: document.getElementById('prompt-preview-modal'),
      promptPreviewContent: document.getElementById('prompt-preview-content'),
      promptCharCount: document.getElementById('prompt-char-count'),
      promptTokenCount: document.getElementById('prompt-token-count'),
      
      // 匯出相關元素
      exportCurrentSessionBtn: document.getElementById('export-current-session'),
      exportAllSessionsBtn: document.getElementById('export-all-sessions'),
      exportSettingsBtn: document.getElementById('export-settings-btn'),
      // 移除 exportStatsBtn（已合併功能）
      exportModal: document.getElementById('export-modal'),
      
      // 匯出模態框內的元素
      totalSessionsSpan: document.getElementById('total-sessions'),
      totalMessagesSpan: document.getElementById('total-messages'),
      estimatedCharsSpan: document.getElementById('estimated-chars'),
      sessionCheckboxes: document.getElementById('session-checkboxes'),
      sessionSelection: document.getElementById('session-selection'),
      filterOptions: document.getElementById('filter-options'),
      formatGrid: document.getElementById('format-grid'),
      previewContent: document.getElementById('preview-content'),
      generatePreviewBtn: document.getElementById('generate-preview'),
      copyPreviewBtn: document.getElementById('copy-preview'),
      downloadExportBtn: document.getElementById('download-export'),
      applyFilterBtn: document.getElementById('apply-filter'),
      
      // 通知
      notifications: document.getElementById('notifications'),
      
      // 載入指示器
      loadingIndicator: document.getElementById('loading-indicator'),
      typingIndicator: document.getElementById('typing-indicator')
    };
    
    // 檢查必要元素
    const requiredElements = ['app', 'messagesContainer', 'messageInput', 'sendButton'];
    for (const elementId of requiredElements) {
      if (!this.elements[elementId]) {
        throw new Error(`Required element not found: ${elementId}`);
      }
    }
    
    console.log('🎨 UI elements initialized');
  }

  /**
   * 載入用戶設定
   */
  async _loadSettings() {
    try {
      const settings = await storageService.getAllSettings();
      
      this.appState = {
        ...this.appState,
        ...settings
      };
      
      // 如果有API金鑰，初始化Gemini服務
      if (this.appState.apiKey) {
        geminiService.init(this.appState.apiKey, this.appState.currentModel);
      }
      
      // 更新模型信息顯示
      this._updateModelInfo();
      
      console.log('⚙️ Settings loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load settings:', error);
    }
  }

  /**
   * 設定事件監聽器
   */
  _setupEventListeners() {
    // 發送訊息
    this.elements.sendButton?.addEventListener('click', () => this._handleSendMessage());
    this.elements.messageInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this._handleSendMessage();
      }
    });
    
    // 監聽輸入變化以更新發送按鈕狀態
    this.elements.messageInput?.addEventListener('input', () => {
      this._updateSendButtonState();
    });
    
    // 新聊天
    this.elements.newChatButton?.addEventListener('click', () => this._handleNewChat());
    
    // 角色選擇
    this.elements.roleSelectionCancel?.addEventListener('click', () => this._hideRoleSelection());
    this.elements.roleSelectionConfirm?.addEventListener('click', () => this._confirmRoleSelection());
    
    // 設定
    this.elements.settingsButton?.addEventListener('click', async () => {
      await this._showSettingsModal();
    });
    
    // 側邊欄切換
    this.elements.sidebarToggle?.addEventListener('click', () => {
      this._toggleSidebar();
    });
    
    // 側邊欄覆蓋層點擊關閉
    this.elements.sidebarOverlay?.addEventListener('click', () => {
      this._closeSidebar();
    });
    
    // ESC鍵關閉側邊欄
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.elements.sidebar?.classList.contains('open')) {
        this._closeSidebar();
      }
    });
    
    // 圖片上傳
    this.elements.imageUploadBtn?.addEventListener('click', () => {
      this.elements.imageUpload?.click();
    });
    
    this.elements.imageUpload?.addEventListener('change', (e) => {
      this._handleImageUpload(e);
    });
    
    // 語音功能
    this.elements.voiceInputChineseBtn?.addEventListener('click', () => {
      this._handleVoiceInput('zh-TW');
    });
    
    this.elements.voiceInputEnglishBtn?.addEventListener('click', () => {
      this._handleVoiceInput('en-US');
    });
    
    this.elements.voiceStopBtn?.addEventListener('click', () => {
      this._stopVoiceInput();
    });
    
    // API 金鑰更新
    this.elements.updateApiKeyButton?.addEventListener('click', () => {
      this._handleApiKeyUpdate();
    });
    
    // 分享功能
    this.elements.generateShareLinkButton?.addEventListener('click', () => {
      this._generateShareLink();
    });
    
    this.elements.copyShareLinkButton?.addEventListener('click', () => {
      this._copyShareLink();
    });
    
    // 模態框關閉
    document.querySelectorAll('.modal-close').forEach(button => {
      button.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal');
        if (modal) {
          this._hideModal(modal.id);
        }
      });
    });
    
    // API金鑰設定
    document.getElementById('save-api-key')?.addEventListener('click', () => {
      this._handleApiKeySetup();
    });
    
    // 設定保存
    document.getElementById('save-settings')?.addEventListener('click', () => {
      this._handleSettingsUpdate();
    });
    
    // 預覽設定效果
    document.getElementById('preview-settings-effect')?.addEventListener('click', () => {
      this._previewSettingsEffect();
    });
    
    // 溫度滑桿
    this.elements.temperatureSlider?.addEventListener('input', (e) => {
      if (this.elements.temperatureValue) {
        this.elements.temperatureValue.textContent = e.target.value;
      }
    });
    
    // 自定義系統提示詞
    this.elements.resetSystemPrompt?.addEventListener('click', () => {
      this._resetSystemPrompt();
    });
    
    this.elements.previewSystemPrompt?.addEventListener('click', () => {
      this._previewSystemPrompt();
    });
    
    // 響應式處理
    window.addEventListener('resize', () => this._handleResize());
    
    // 離開前保存
    window.addEventListener('beforeunload', () => this._handleBeforeUnload());
    
    // PWA 安裝事件
    this._setupPWAEvents();
    
    // 語音服務事件監聽
    this._setupSpeechEvents();
    
    // 匯出功能事件監聽
    this._setupExportEvents();
    
    console.log('🎧 Event listeners set up');
  }

  /**
   * 設定PWA相關事件
   */
  _setupPWAEvents() {
    // 監聽 beforeinstallprompt 事件
    window.addEventListener('beforeinstallprompt', (e) => {
      console.log('PWA install prompt available');
      e.preventDefault();
      this.deferredPrompt = e;
      this._showInstallButton();
    });
    
    // 監聽 appinstalled 事件
    window.addEventListener('appinstalled', () => {
      console.log('PWA was installed');
      this.isInstalled = true;
      this._hideInstallButton();
      this._showNotification('AI教學助理已成功安裝到您的設備！', 'success');
    });
    
    // 檢查是否已安裝
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
      this.isInstalled = true;
      console.log('PWA is running in standalone mode');
    }
    
    // 處理快捷方式參數
    this._handleShortcutParams();
  }

  /**
   * 顯示安裝按鈕
   */
  _showInstallButton() {
    if (this.isInstalled) return;
    
    // 創建安裝按鈕
    const installButton = document.createElement('button');
    installButton.id = 'pwa-install-button';
    installButton.className = 'icon-button install-button';
    installButton.title = '安裝應用程式';
    installButton.innerHTML = '<span>📱</span>';
    
    // 添加到標題欄
    const headerActions = document.querySelector('.header-actions');
    if (headerActions && !document.getElementById('pwa-install-button')) {
      headerActions.insertBefore(installButton, headerActions.firstChild);
      
      // 添加點擊事件
      installButton.addEventListener('click', () => {
        this._handleInstallClick();
      });
    }
    
    // 延遲顯示安裝提示
    setTimeout(() => {
      this._showInstallPrompt();
    }, 5000);
  }

  /**
   * 顯示安裝提示
   */
  _showInstallPrompt() {
    if (this.isInstalled || !this.deferredPrompt) return;
    
    // 檢查是否已經顯示過提示
    const hasShownPrompt = localStorage.getItem('pwa-install-prompt-shown');
    if (hasShownPrompt) return;
    
    // 創建安裝提示
    const promptDiv = document.createElement('div');
    promptDiv.id = 'pwa-install-prompt';
    promptDiv.className = 'pwa-install-prompt';
    promptDiv.innerHTML = `
      <div class="pwa-install-prompt-content">
        <h4>📱 安裝AI教學助理</h4>
        <p>安裝到您的設備以獲得更好的體驗</p>
      </div>
      <div class="pwa-install-prompt-actions">
        <button class="install-btn">安裝</button>
        <button class="dismiss-btn">稍後</button>
      </div>
    `;
    
    // 添加到頁面
    document.body.appendChild(promptDiv);
    
    // 添加事件監聽器
    const installBtn = promptDiv.querySelector('.install-btn');
    const dismissBtn = promptDiv.querySelector('.dismiss-btn');
    
    installBtn.addEventListener('click', () => {
      this._handleInstallClick();
      this._hideInstallPrompt();
    });
    
    dismissBtn.addEventListener('click', () => {
      this._hideInstallPrompt();
      localStorage.setItem('pwa-install-prompt-shown', 'true');
    });
    
    // 10秒後自動隱藏
    setTimeout(() => {
      if (document.getElementById('pwa-install-prompt')) {
        this._hideInstallPrompt();
      }
    }, 10000);
  }

  /**
   * 隱藏安裝提示
   */
  _hideInstallPrompt() {
    const prompt = document.getElementById('pwa-install-prompt');
    if (prompt) {
      prompt.remove();
    }
  }

  /**
   * 隱藏安裝按鈕
   */
  _hideInstallButton() {
    const installButton = document.getElementById('pwa-install-button');
    if (installButton) {
      installButton.remove();
    }
  }

  /**
   * 處理安裝按鈕點擊
   */
  async _handleInstallClick() {
    if (!this.deferredPrompt) return;
    
    try {
      // 顯示安裝提示
      this.deferredPrompt.prompt();
      
      // 等待用戶選擇
      const { outcome } = await this.deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
        this._showNotification('正在安裝應用程式...', 'info');
      } else {
        console.log('User dismissed the install prompt');
      }
      
      // 清除 deferred prompt
      this.deferredPrompt = null;
      this._hideInstallButton();
      
    } catch (error) {
      console.error('Install prompt failed:', error);
      this._showNotification('安裝失敗，請稍後再試', 'error');
    }
  }

  /**
   * 處理快捷方式參數
   */
  _handleShortcutParams() {
    const urlParams = new URLSearchParams(window.location.search);
    
    if (urlParams.has('action')) {
      const action = urlParams.get('action');
      switch (action) {
        case 'new':
          setTimeout(() => this._handleNewChat(), 1000);
          break;
      }
    }
    
    if (urlParams.has('subject')) {
      const subject = urlParams.get('subject');
      setTimeout(() => {
        this._handleNewChat().then(() => {
          if (subject === 'mathematics') {
            this.elements.messageInput.value = '我想學習數學';
            this._handleSendMessage();
          }
        });
      }, 1000);
    }
    
    if (urlParams.has('mode')) {
      const mode = urlParams.get('mode');
      if (mode === 'qa') {
        setTimeout(() => {
          this._handleNewChat().then(() => {
            this.elements.messageInput.value = '我有問題想問';
            this._handleSendMessage();
          });
        }, 1000);
      }
    }
  }

  /**
   * 處理URL參數
   */
  async _handleUrlParams() {
    const params = new URLSearchParams(window.location.search);
    
    // 處理會話ID
    const sessionId = params.get('session');
    if (sessionId) {
      this._loadSession(sessionId);
      return; // 如果有sessionId，直接載入會話
    }
    
    // 處理角色參數（PWA快捷方式）
    const roleId = params.get('role');
    if (roleId && promptManager.hasRole(roleId)) {
      // 延遲執行，確保所有服務都已初始化
      setTimeout(async () => {
        try {
          this.selectedRole = roleId;
          await this._confirmRoleSelection();
        } catch (error) {
          console.error('Failed to auto-select role:', error);
          // 如果自動選擇失敗，顯示角色選擇界面
          await this._showRoleSelection();
        }
      }, 500);
      return;
    }
    
    // 處理API金鑰
    const apiKey = params.get('key') || params.get('apikey') || params.get('api_key');
    if (apiKey) {
      console.log('從 URL 參數載入 API Key');
      this.appState.apiKey = apiKey;
      await this._saveApiKey(apiKey);
      
      // 初始化 Gemini 服務
      try {
        geminiService.init(apiKey, this.appState.currentModel);
        this._showNotification('API Key 已從 URL 載入', 'success');
        
        // 清除 URL 中的 API Key（安全考量）
        this._clearApiKeyFromUrl();
      } catch (error) {
        console.error('Failed to initialize Gemini service with URL API key:', error);
        this._showNotification('API Key 載入失敗', 'error');
      }
    }
  }

  /**
   * 清除 URL 中的 API Key（安全考量）
   */
  _clearApiKeyFromUrl() {
    const url = new URL(window.location);
    const params = url.searchParams;
    
    // 移除所有可能的 API Key 參數
    params.delete('key');
    params.delete('apikey');
    params.delete('api_key');
    
    // 更新 URL 但不重新載入頁面
    const newUrl = params.toString() ? `${url.pathname}?${params.toString()}` : url.pathname;
    window.history.replaceState({}, '', newUrl);
    
    console.log('已從 URL 中清除 API Key 參數');
  }

  /**
   * 顯示初始界面
   */
  async _showInitialInterface() {
    // 更完整的API Key檢查
    const hasValidApiKey = this.appState.apiKey && 
                          typeof this.appState.apiKey === 'string' && 
                          this.appState.apiKey.trim().length > 0;
    
    // 隱藏載入畫面
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      loadingScreen.style.display = 'none';
    }
    
    // 顯示主應用界面
    if (this.elements.app) {
      this.elements.app.classList.remove('hidden');
    }
    
    if (!hasValidApiKey) {
      this._showSetupModal();
    } else {
      // 隱藏設定模態框
      this._hideModal('setup-modal');
      
      // 確保聊天界面可見
      if (this.elements.messagesContainer) {
        this.elements.messagesContainer.classList.remove('hidden');
      }
      if (this.elements.inputArea) {
        this.elements.inputArea.classList.remove('hidden');
      }
      
      await this._loadSessionsList();
      
      // 更新語音按鈕狀態
      this._updateVoiceButtonState();
      
      // 如果沒有當前會話，創建新會話
      const currentSession = sessionManager.getCurrentSession();
      if (!currentSession) {
        await this._handleNewChat();
      } else {
        this._loadSessionMessages(currentSession);
      }
    }
  }

  /**
   * 顯示API金鑰設定模態框
   */
  _showSetupModal() {
    if (this.elements.setupModal) {
      this.elements.setupModal.style.display = 'flex';
      this.elements.apiKeyInput?.focus();
    }
  }

  /**
   * 顯示設定模態框
   */
  async _showSettingsModal() {
    if (this.elements.settingsModal) {
      // 載入當前設定到表單
      await this._loadSettingsToForm();
      
      // 移除 hidden 類別並顯示模態框
      this.elements.settingsModal.classList.remove('hidden');
      this.elements.settingsModal.style.display = 'flex';
      
      // 載入可用模型列表
      await this._loadAvailableModels();
    }
  }

  /**
   * 載入可用模型列表
   */
  async _loadAvailableModels() {
    const modelSelect = this.elements.modelSelect;
    const helpText = document.getElementById('model-help-text');
    
    if (!modelSelect) return;
    
    try {
      // 檢查是否有 API Key
      if (!this.appState.apiKey) {
        modelSelect.innerHTML = '<option value="">請先設定 API 金鑰</option>';
        if (helpText) helpText.textContent = '需要有效的 API 金鑰才能獲取模型列表';
        return;
      }
      
      // 顯示載入狀態
      modelSelect.innerHTML = '<option value="">載入中...</option>';
      if (helpText) helpText.textContent = '正在獲取可用模型列表...';
      
      // 獲取可用模型
      const models = await geminiService.getAvailableModels();
      
      if (models && models.length > 0) {
        // 清空現有選項
        modelSelect.innerHTML = '';
        
        // 篩選出 Gemini 模型並排序
        const geminiModels = models
          .filter(model => model.name && model.name.includes('gemini'))
          .sort((a, b) => {
            // 優先顯示 flash 模型
            if (a.name.includes('flash') && !b.name.includes('flash')) return -1;
            if (!a.name.includes('flash') && b.name.includes('flash')) return 1;
            return a.name.localeCompare(b.name);
          });
        
        // 添加模型選項
        geminiModels.forEach(model => {
          const option = document.createElement('option');
          const modelId = model.name.replace('models/', '');
          option.value = modelId;
          
          // 創建友好的顯示名稱
          let displayName = this._formatModelName(modelId);
          
          // 標記推薦模型
          if (modelId.includes('2.5-flash') || modelId.includes('2.0-flash')) {
            displayName += ' (推薦)';
          }
          
          option.textContent = displayName;
          modelSelect.appendChild(option);
        });
        
        // 設定當前選中的模型
        if (this.appState.currentModel) {
          modelSelect.value = this.appState.currentModel;
        }
        
        if (helpText) helpText.textContent = `找到 ${geminiModels.length} 個可用模型`;
        
      } else {
        modelSelect.innerHTML = '<option value="">無可用模型</option>';
        if (helpText) helpText.textContent = '未找到可用的模型';
      }
      
    } catch (error) {
      console.error('Failed to load available models:', error);
      
      // 載入失敗時使用預設模型列表
      const defaultModels = [
        { id: 'gemini-2.5-flash-preview-05-20', name: 'Gemini 2.5 Flash (推薦)' },
        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
        { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite' }
      ];
      
      modelSelect.innerHTML = '';
      defaultModels.forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = model.name;
        modelSelect.appendChild(option);
      });
      
      // 設定當前選中的模型
      if (this.appState.currentModel) {
        modelSelect.value = this.appState.currentModel;
      }
      
      if (helpText) helpText.textContent = '載入失敗，顯示預設模型列表';
    }
  }

  /**
   * 格式化模型名稱為友好顯示
   */
  _formatModelName(modelId) {
    // 移除 'models/' 前綴
    let name = modelId.replace('models/', '');
    
    // 轉換常見的格式
    name = name.replace(/^gemini-/, 'Gemini ');
    name = name.replace(/-/g, ' ');
    name = name.replace(/\b\w/g, l => l.toUpperCase());
    
    // 特殊處理
    name = name.replace(/Flash/g, 'Flash');
    name = name.replace(/Exp/g, 'Experimental');
    name = name.replace(/Preview/g, 'Preview');
    
    return name;
  }

  /**
   * 隱藏模態框
   */
  _hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      // 隱藏模態框並添加 hidden 類別
      modal.style.display = 'none';
      modal.classList.add('hidden');
      
      // 如果是匯出模態框，重置狀態
      if (modalId === 'export-modal') {
        this._resetExportModalState();
      }
    }
  }

  /**
   * 載入設定到表單
   */
  async _loadSettingsToForm() {
    if (this.elements.modelSelect) {
      this.elements.modelSelect.value = this.appState.currentModel;
    }
    
    if (this.elements.temperatureSlider) {
      this.elements.temperatureSlider.value = this.appState.temperature || 0.7;
      if (this.elements.temperatureValue) {
        this.elements.temperatureValue.textContent = this.appState.temperature || 0.7;
      }
    }
    
    // 顯示當前角色
    this._updateCurrentRoleDisplay();
    
    // 載入其他設定...
    const adaptiveDifficulty = document.getElementById('adaptive-difficulty');
    const stepByStep = document.getElementById('step-by-step');
    const streamingEnabled = document.getElementById('streaming-enabled');
    const soundEnabled = document.getElementById('sound-enabled');
    
    if (adaptiveDifficulty) adaptiveDifficulty.checked = this.appState.adaptiveDifficulty ?? true;
    if (stepByStep) stepByStep.checked = this.appState.stepByStep ?? true;
    if (streamingEnabled) streamingEnabled.checked = this.appState.streamingEnabled ?? true;
    if (soundEnabled) soundEnabled.checked = this.appState.soundEnabled ?? true;
    
    // 載入自定義系統提示詞
    if (this.elements.customSystemPrompt) {
      this.elements.customSystemPrompt.value = this.appState.customSystemPrompt || '';
    }
  }

  /**
   * 更新當前角色顯示
   */
  _updateCurrentRoleDisplay() {
    const currentRoleDisplay = document.getElementById('current-role-display');
    const currentRoleIcon = document.getElementById('current-role-icon');
    const currentRoleName = document.getElementById('current-role-name');
    
    if (!currentRoleDisplay || !currentRoleIcon || !currentRoleName) return;
    
    try {
      const currentSession = sessionManager.getCurrentSession();
      if (currentSession && currentSession.metadata && currentSession.metadata.roleId) {
        const roleProfile = promptManager.getRoleProfile(currentSession.metadata.roleId);
        if (roleProfile) {
          currentRoleIcon.textContent = roleProfile.icon;
          currentRoleName.textContent = roleProfile.name;
          currentRoleDisplay.style.display = 'block';
          return;
        }
      }
    } catch (error) {
      console.log('無法獲取當前會話角色信息');
    }
    
    // 如果沒有當前會話或角色，隱藏顯示區域
    currentRoleDisplay.style.display = 'none';
  }

  /**
   * 處理API金鑰設定
   */
  async _handleApiKeySetup() {
    const apiKey = this.elements.apiKeyInput?.value.trim();
    
    console.log('API Key input element:', this.elements.apiKeyInput);
    console.log('API Key value:', apiKey);
    console.log('API Key length:', apiKey?.length);
    
    if (!apiKey) {
      this._showNotification('請輸入有效的API金鑰', 'error');
      return;
    }
    
    try {
      this._showLoading('驗證API金鑰...');
      
      // 驗證API金鑰
      const validation = await geminiService.validateApiKey(apiKey);
      
      if (!validation.valid) {
        throw new Error(validation.error || '無效的API金鑰');
      }
      
      // 保存API金鑰
      await this._saveApiKey(apiKey);
      
      // 初始化Gemini服務
      geminiService.init(apiKey, this.appState.currentModel);
      
      this._hideLoading();
      this._hideModal('setup-modal');
      this._showNotification('API金鑰設定成功！', 'success');
      
      // 顯示聊天界面
      if (this.elements.messagesContainer) {
        this.elements.messagesContainer.classList.remove('hidden');
      }
      if (this.elements.inputArea) {
        this.elements.inputArea.classList.remove('hidden');
      }
      
      // 載入初始界面
      await this._loadSessionsList();
      await this._handleNewChat();
      
    } catch (error) {
      this._hideLoading();
      this._showNotification(`API金鑰驗證失敗: ${error.message}`, 'error');
    }
  }

  /**
   * 保存API金鑰
   */
  async _saveApiKey(apiKey) {
    this.appState.apiKey = apiKey;
    await storageService.saveSetting('apiKey', apiKey);
  }

  /**
   * 處理API金鑰更新
   */
  async _handleApiKeyUpdate() {
    const newApiKey = this.elements.currentApiKeyInput?.value.trim();
    
    if (!newApiKey) {
      this._showNotification('請輸入新的API金鑰', 'error');
      return;
    }
    
    try {
      this._showLoading('驗證新的API金鑰...');
      
      // 驗證新的API金鑰
      const validation = await geminiService.validateApiKey(newApiKey);
      
      if (!validation.valid) {
        throw new Error(validation.error || '無效的API金鑰');
      }
      
      // 保存新的API金鑰
      await this._saveApiKey(newApiKey);
      
      // 重新初始化Gemini服務
      geminiService.init(newApiKey, this.appState.currentModel);
      
      // 清空輸入框
      if (this.elements.currentApiKeyInput) {
        this.elements.currentApiKeyInput.value = '';
      }
      
      this._hideLoading();
      this._showNotification('API金鑰更新成功！', 'success');
      
    } catch (error) {
      this._hideLoading();
      this._showNotification(`API金鑰更新失敗: ${error.message}`, 'error');
    }
  }

  /**
   * 生成分享連結
   */
  _generateShareLink() {
    try {
      if (!this.appState.apiKey) {
        this._showNotification('請先設定 API Key', 'warning');
        return;
      }
      
      // 獲取當前 URL 的基礎部分
      const baseUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}`;
      
      // 創建包含 API Key 的 URL
      const shareUrl = new URL(baseUrl);
      shareUrl.searchParams.set('key', this.appState.apiKey);
      
      // 如果有選擇的角色，也加入 URL
      if (this.selectedRole) {
        shareUrl.searchParams.set('role', this.selectedRole);
      }
      
      // 顯示分享連結
      const shareLinkInput = this.elements.shareLinkInput;
      if (shareLinkInput) {
        shareLinkInput.value = shareUrl.toString();
        shareLinkInput.style.display = 'block';
        shareLinkInput.classList.add('show', 'has-content');
        
        // 啟用複製按鈕
        if (this.elements.copyShareLinkButton) {
          this.elements.copyShareLinkButton.disabled = false;
        }
        
        this._showNotification('分享連結已生成', 'success');
        
        // 自動選中連結文字
        setTimeout(() => {
          shareLinkInput.select();
          shareLinkInput.focus();
        }, 100);
      }
      
    } catch (error) {
      console.error('Failed to generate share link:', error);
      this._showNotification('生成分享連結失敗', 'error');
    }
  }

  /**
   * 複製分享連結
   */
  async _copyShareLink() {
    try {
      const shareLinkInput = this.elements.shareLinkInput;
      if (!shareLinkInput || !shareLinkInput.value) {
        this._showNotification('請先生成分享連結', 'warning');
        return;
      }
      
      // 使用現代 Clipboard API
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareLinkInput.value);
        this._showNotification('分享連結已複製到剪貼簿', 'success');
      } else {
        // 降級方案：使用傳統方法
        shareLinkInput.select();
        shareLinkInput.setSelectionRange(0, 99999); // 移動端支援
        
        const successful = document.execCommand('copy');
        if (successful) {
          this._showNotification('分享連結已複製到剪貼簿', 'success');
        } else {
          throw new Error('Copy command failed');
        }
      }
      
      // 視覺反饋
      const copyButton = this.elements.copyShareLinkButton;
      if (copyButton) {
        const originalText = copyButton.textContent;
        copyButton.textContent = '✅ 已複製';
        copyButton.disabled = true;
        
        setTimeout(() => {
          copyButton.textContent = originalText;
          copyButton.disabled = false;
        }, 2000);
      }
      
    } catch (error) {
      console.error('Failed to copy share link:', error);
      this._showNotification('複製失敗，請手動複製連結', 'error');
      
      // 如果複製失敗，至少選中文字讓用戶手動複製
      if (this.elements.shareLinkInput) {
        this.elements.shareLinkInput.select();
        this.elements.shareLinkInput.focus();
      }
    }
  }

  /**
   * 處理設定更新
   */
  async _handleSettingsUpdate() {
    try {
      const newSettings = {
        currentModel: this.elements.modelSelect?.value || this.appState.currentModel,
        temperature: parseFloat(this.elements.temperatureSlider?.value) || 0.7,
        defaultSubject: document.getElementById('subject-select')?.value || 'mathematics',
        adaptiveDifficulty: document.getElementById('adaptive-difficulty')?.checked ?? true,
        stepByStep: document.getElementById('step-by-step')?.checked ?? true,
        streamingEnabled: document.getElementById('streaming-enabled')?.checked ?? true,
        soundEnabled: document.getElementById('sound-enabled')?.checked ?? true,
        customSystemPrompt: this.elements.customSystemPrompt?.value.trim() || null
      };
      
      // 檢查模型是否真的有改變
      const modelChanged = newSettings.currentModel !== this.appState.currentModel;
      
      // 更新應用狀態
      Object.assign(this.appState, newSettings);
      
      // 保存到儲存
      for (const [key, value] of Object.entries(newSettings)) {
        await storageService.saveSetting(key, value);
      }
      
      // 如果模型改變且 Gemini 服務已初始化，更新模型
      if (modelChanged && geminiService.initialized) {
        geminiService.setModel(newSettings.currentModel);
      }
      
      this._hideModal('settings-modal');
      this._showNotification('設定已保存', 'success');
      
      // 更新會話列表
      await this._updateSessionsList();
      
      // 更新模型信息顯示
      this._updateModelInfo();
      
    } catch (error) {
      console.error('Save settings error:', error);
      this._showNotification(`保存設定失敗: ${error.message}`, 'error');
    }
  }

  /**
   * 處理發送訊息
   */
  async _handleSendMessage() {
    if (this.isProcessing) return;
    
    const messageText = this.elements.messageInput?.value.trim();
    if (!messageText && this.uploadedImages.length === 0) return;
    
    try {
      this.isProcessing = true;
      this._updateSendButton(false);
      
      // 構建多模態訊息
      const multimodalMessage = this._buildMultimodalMessage(messageText);
      
      // 清空輸入框
      if (this.elements.messageInput) {
        this.elements.messageInput.value = '';
      }
      
      // 添加用戶訊息到UI（包含圖片）
      this._addMessageToUI('user', messageText, this.uploadedImages);
      
      // 清空已上傳的圖片
      this._clearUploadedImages();
      
      // 檢查是否是指令
      if (messageText.startsWith('/')) {
        // 指令處理完後再保存到會話歷史
        await this._handleCommand(messageText);
        await sessionManager.addMessage('user', messageText);
      } else {
        // 發送到AI，在AI回應成功後再保存用戶訊息
        await this._sendToAI(multimodalMessage);
      }
      
    } catch (error) {
      console.error('Send message error:', error);
      this._showNotification(`發送訊息失敗: ${error.message}`, 'error');
    } finally {
      this.isProcessing = false;
      this._updateSendButton(true);
      this._hideTypingIndicator();
    }
  }

  /**
   * 發送訊息到AI
   */
  async _sendToAI(message) {
    // 創建思考中的AI訊息氣泡
    const thinkingMessageId = this._addThinkingMessage();
    
    try {
      // 獲取對話歷史（不包含當前訊息）
      const history = sessionManager.getSessionHistory(null, 20);
      
      // 獲取系統提示詞（優先使用自定義提示詞）
      let systemPrompt = this._getEffectiveSystemPrompt();
      
      // 獲取隱藏的練習分析並加入系統提示詞
      systemPrompt = this._addPracticeAnalysisToSystemPrompt(systemPrompt, history);
      
      // 配置選項
      const options = {
        temperature: this.appState.temperature || 0.7,
        maxTokens: 8192
      };
      
      if (this.appState.streamingEnabled) {
        // 串流模式
        await this._handleStreamingResponse(message, history, systemPrompt, options, thinkingMessageId);
      } else {
        // 一般模式
        const response = await geminiService.sendMessage(message, history, systemPrompt, options);
        
        // 更新思考氣泡為實際回應
        this._updateMessageContent(thinkingMessageId, response.text);
        
        // 一般模式完成後，語音按鈕會由 _updateMessageContent 自動處理
        
        // AI回應成功後，保存用戶訊息和助理回應
        await sessionManager.addMessage('user', message);
        await sessionManager.addMessage('assistant', response.text, {
          model: this.appState.currentModel,
          finishReason: response.finishReason,
          usage: response.usage
        });
      }
      
      // 更新會話列表
      await this._updateSessionsList();
      
    } catch (error) {
      console.error('AI request failed:', error);
      
      // 更新思考氣泡為錯誤狀態
      this._updateMessageToError(thinkingMessageId, error.message, () => {
        this._sendToAI(message); // 重試函數
      });
    }
  }

  /**
   * 處理串流回應
   */
  async _handleStreamingResponse(message, history, systemPrompt, options, thinkingMessageId) {
    let fullResponse = '';
    
    try {
      await geminiService.sendMessageStream(
        message,
        history,
        systemPrompt,
        (chunk, fullText) => {
          fullResponse = fullText;
          // 更新思考氣泡的內容
          this._updateMessageContent(thinkingMessageId, fullText);
        },
        options
      );
      
      // 串流回應完成後，語音按鈕會由 _updateMessageContent 自動處理
      
      // 串流回應完成後，保存用戶訊息和助理回應
      await sessionManager.addMessage('user', message);
      await sessionManager.addMessage('assistant', fullResponse, {
        model: this.appState.currentModel,
        streaming: true
      });
      
    } catch (error) {
      // 更新思考氣泡為錯誤狀態
      this._updateMessageToError(thinkingMessageId, error.message, () => {
        this._sendToAI(message); // 重試函數
      });
      throw error;
    }
  }

  /**
   * 處理指令
   */
  async _handleCommand(command) {
    const [cmd, ...args] = command.split(' ');
    
    switch (cmd.toLowerCase()) {
      case '/new':
        await this._handleNewChat();
        break;
        
      case '/current':
        this._showCurrentSessionInfo();
        break;
        
      case '/summary':
        await this._showSessionSummary();
        break;
        
      case '/question':
        if (args.length > 0) {
          await this._sendToAI(args.join(' '));
        } else {
          this._showNotification('請在 /question 後面輸入您的問題', 'info');
        }
        break;
        
      case '/practice':
        await this.practiceIntegration.handlePracticeRequest(args);
        break;
        
      default:
        this._showNotification(`未知指令: ${cmd}`, 'warning');
    }
  }

  /**
   * 處理新聊天
   */
  async _handleNewChat() {
    try {
      // 顯示角色選擇界面
      await this._showRoleSelection();
    } catch (error) {
      this._showNotification(`創建新會話失敗: ${error.message}`, 'error');
    }
  }

  /**
   * 顯示角色選擇界面
   */
  async _showRoleSelection() {
    try {
      // 載入角色配置
      const roleProfiles = promptManager.getRoleProfiles();
      
      // 生成角色卡片
      this._generateRoleCards(roleProfiles);
      
      // 顯示模態框
      this.elements.roleSelectionModal?.classList.remove('hidden');
      
      // 重置選擇狀態
      this.selectedRole = null;
      this.elements.roleSelectionConfirm.disabled = true;
      
    } catch (error) {
      console.error('Failed to show role selection:', error);
      this._showNotification('載入角色選擇失敗', 'error');
    }
  }

  /**
   * 生成角色卡片
   */
  _generateRoleCards(roleProfiles) {
    if (!this.elements.roleGrid) return;
    
    this.elements.roleGrid.innerHTML = '';
    
    Object.entries(roleProfiles).forEach(([roleId, profile]) => {
      const card = document.createElement('div');
      card.className = 'role-card';
      card.dataset.roleId = roleId;
      card.style.setProperty('--role-color', profile.color);
      
      card.innerHTML = `
        <div class="role-icon">${profile.icon}</div>
        <div class="role-name">${profile.name}</div>
        <div class="role-description">${profile.description}</div>
        <div class="role-audience">${profile.targetAudience}</div>
      `;
      
      // 添加點擊事件
      card.addEventListener('click', () => this._selectRole(roleId));
      
      this.elements.roleGrid.appendChild(card);
    });
  }

  /**
   * 選擇角色
   */
  _selectRole(roleId) {
    // 移除其他卡片的選中狀態
    this.elements.roleGrid.querySelectorAll('.role-card').forEach(card => {
      card.classList.remove('selected');
    });
    
    // 設定當前選中的角色
    const selectedCard = this.elements.roleGrid.querySelector(`[data-role-id="${roleId}"]`);
    if (selectedCard) {
      selectedCard.classList.add('selected');
      this.selectedRole = roleId;
      this.elements.roleSelectionConfirm.disabled = false;
    }
  }

  /**
   * 確認角色選擇
   */
  async _confirmRoleSelection() {
    if (!this.selectedRole) return;
    
    try {
      this._showLoading('創建新會話...');
      
      // 創建新會話，並設定選擇的角色
      const newSession = await sessionManager.createNewSession({
        roleId: this.selectedRole,
        roleName: promptManager.getRoleProfile(this.selectedRole)?.name
      });
      
      this.currentSessionId = newSession.id;
      
      // 清空聊天區域
      this._clearMessages();
      
      // 更新會話列表
      await this._updateSessionsList();
      
      // 顯示角色相關的歡迎訊息
      this._addRoleWelcomeMessage(this.selectedRole);
      
      // 隱藏角色選擇界面
      this._hideRoleSelection();
      
      this._hideLoading();
      this._showNotification('新會話已創建', 'success');
      
    } catch (error) {
      this._hideLoading();
      this._showNotification(`創建新會話失敗: ${error.message}`, 'error');
    }
  }

  /**
   * 隱藏角色選擇界面
   */
  _hideRoleSelection() {
    this.elements.roleSelectionModal?.classList.add('hidden');
    this.selectedRole = null;
    this.elements.roleSelectionConfirm.disabled = true;
  }

  /**
   * 添加角色歡迎訊息
   */
  _addRoleWelcomeMessage(roleId) {
    if (!this.elements.messagesContainer) return;
    
    const roleProfile = promptManager.getRoleProfile(roleId);
    if (!roleProfile) {
      this._addWelcomeMessage();
      return;
    }
    
    const welcomeMessage = promptManager.getRoleWelcomeMessage(roleId);
    
    const messageWrapper = document.createElement('div');
    messageWrapper.className = 'message-wrapper assistant welcome-message';
    
    // 創建頭像
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar assistant';
    avatar.textContent = roleProfile.icon;
    
    // 創建訊息氣泡
    const messageBubble = document.createElement('div');
    messageBubble.className = 'message-bubble assistant';
    messageBubble.style.borderLeftColor = roleProfile.color;
    
    // 創建內容
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.innerHTML = `
      <h3>${welcomeMessage}</h3>
      <p>我是專精<strong>${roleProfile.name.replace('助理', '')}</strong>的AI助理，讓我們一起開始學習之旅吧！</p>
      <div class="quick-actions">
        <button class="quick-action" data-message="我想開始學習">🚀 開始學習</button>
        <button class="quick-action" data-message="我有問題想問">❓ 問題解答</button>
        <button class="quick-action" data-message="介紹一下你的教學方式">📖 教學方式</button>
      </div>
    `;
    
    // 組裝結構
    messageBubble.appendChild(messageContent);
    messageWrapper.appendChild(avatar);
    messageWrapper.appendChild(messageBubble);
    
    this.elements.messagesContainer.appendChild(messageWrapper);
    
    // 添加快速操作事件
    messageContent.querySelectorAll('.quick-action').forEach(button => {
      button.addEventListener('click', () => {
        this.elements.messageInput.value = button.dataset.message;
        this._handleSendMessage();
      });
    });
    
    this._scrollToBottom();
  }

  /**
   * 載入會話列表
   */
  async _loadSessionsList() {
    try {
      const sessions = sessionManager.getSessionsList();
      this._updateSessionsListUI(sessions);
    } catch (error) {
      console.error('Failed to load sessions list:', error);
    }
  }

  /**
   * 更新會話列表
   */
  async _updateSessionsList() {
    await this._loadSessionsList();
  }

  /**
   * 更新會話列表UI
   */
  _updateSessionsListUI(sessions) {
    if (!this.elements.sessionsList) return;
    
    this.elements.sessionsList.innerHTML = '';
    
    sessions.forEach(session => {
      const sessionElement = this._createSessionElement(session);
      this.elements.sessionsList.appendChild(sessionElement);
    });
  }

  /**
   * 創建會話元素
   */
  _createSessionElement(session) {
    const element = document.createElement('div');
    element.className = `session-item ${session.isActive ? 'active' : ''}`;
    element.dataset.sessionId = session.id;
    
    // 獲取角色信息
    const roleProfile = session.metadata?.roleId ? 
      promptManager.getRoleProfile(session.metadata.roleId) : null;
    const roleIcon = roleProfile?.icon || '🤖';
    const roleColor = roleProfile?.color || '#6b7280';
    
    element.innerHTML = `
      <div class="session-header">
        <span class="session-role-icon" style="color: ${roleColor}">${roleIcon}</span>
        <div class="session-title">${this._escapeHtml(session.title)}</div>
      </div>
      <div class="session-meta">
        <span class="session-date">${this._formatDate(session.updatedAt)}</span>
        <span class="session-count">${session.messageCount || session.metadata?.messageCount || 0} 訊息</span>
      </div>
      <button class="session-delete" data-session-id="${session.id}">🗑️</button>
    `;
    
    // 添加點擊事件
    element.addEventListener('click', (e) => {
      if (!e.target.classList.contains('session-delete')) {
        this._loadSession(session.id);
        // 在移動端選擇會話後關閉側邊欄
        if (window.innerWidth <= 768) {
          this._closeSidebar();
        }
      }
    });
    
    // 添加刪除事件
    element.querySelector('.session-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      this._deleteSession(session.id);
    });
    
    return element;
  }

  /**
   * 載入會話
   */
  async _loadSession(sessionId) {
    try {
      this._showLoading('載入會話...');
      
      const session = await sessionManager.switchToSession(sessionId);
      this.currentSessionId = sessionId;
      
      this._loadSessionMessages(session);
      await this._updateSessionsList();
      
      // 更新當前角色顯示（如果設定頁面是打開的）
      this._updateCurrentRoleDisplay();
      
      this._hideLoading();
      
    } catch (error) {
      this._hideLoading();
      this._showNotification(`載入會話失敗: ${error.message}`, 'error');
    }
  }

  /**
   * 載入會話訊息
   */
  _loadSessionMessages(session) {
    this._clearMessages();
    
    if (session.messages.length === 0) {
      this._addWelcomeMessage();
    } else {
      session.messages.forEach(message => {
        this._addMessageToUI(message.role, message.content, message.images);
      });
    }
    
    this._scrollToBottom();
  }

  /**
   * 刪除會話
   */
  async _deleteSession(sessionId) {
    if (!confirm('確定要刪除這個會話嗎？')) return;
    
    try {
      await sessionManager.deleteSession(sessionId);
      await this._updateSessionsList();
      
      // 如果刪除的是當前會話，創建新會話
      if (this.currentSessionId === sessionId) {
        await this._handleNewChat();
      }
      
      this._showNotification('會話已刪除', 'success');
      
    } catch (error) {
      this._showNotification(`刪除會話失敗: ${error.message}`, 'error');
    }
  }

  /**
   * 添加思考中的AI訊息氣泡
   */
  _addThinkingMessage() {
    if (!this.elements.messagesContainer) return null;
    
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const messageWrapper = document.createElement('div');
    messageWrapper.className = 'message-wrapper assistant thinking';
    messageWrapper.dataset.messageId = messageId;
    
    // 創建頭像
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar assistant';
    avatar.textContent = '🤖';
    
    // 創建訊息氣泡
    const messageBubble = document.createElement('div');
    messageBubble.className = 'message-bubble assistant thinking';
    
    // 創建思考動畫
    const thinkingContent = document.createElement('div');
    thinkingContent.className = 'thinking-content';
    thinkingContent.innerHTML = `
      <div class="thinking-dots">
        <span class="thinking-dot"></span>
        <span class="thinking-dot"></span>
        <span class="thinking-dot"></span>
      </div>
      <span class="thinking-text">AI正在思考中...</span>
    `;
    
    // 組裝結構
    messageBubble.appendChild(thinkingContent);
    messageWrapper.appendChild(avatar);
    messageWrapper.appendChild(messageBubble);
    
    this.elements.messagesContainer.appendChild(messageWrapper);
    this._scrollToBottom();
    
    return messageId;
  }

  /**
   * 更新訊息內容
   */
  _updateMessageContent(messageId, content) {
    const messageWrapper = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageWrapper) return;
    
    const messageBubble = messageWrapper.querySelector('.message-bubble');
    if (!messageBubble) return;
    
    // 移除思考狀態
    messageBubble.classList.remove('thinking');
    messageWrapper.classList.remove('thinking');
    
    // 渲染內容（支援 Markdown、語法高亮和數學公式）
    const renderedContent = contentRenderer.render(content);
    
    // 更新內容
    messageBubble.innerHTML = `
      <div class="message-content">${renderedContent}</div>
      <div class="message-time">${this._formatTime(new Date())}</div>
    `;
    
    // 應用語法高亮到代碼塊
    const messageContent = messageBubble.querySelector('.message-content');
    if (messageContent) {
      contentRenderer.highlightCodeBlocks(messageContent);
      contentRenderer.renderMathInElement(messageContent);
    }
    
    // 如果是 AI 回應，添加語音按鈕
    if (messageWrapper.classList.contains('assistant')) {
      this._addSpeechButtonsToMessage(messageWrapper);
    }
    
    this._scrollToBottom();
  }

  /**
   * 更新訊息為錯誤狀態
   */
  _updateMessageToError(messageId, errorMessage, retryCallback) {
    const messageWrapper = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageWrapper) return;
    
    const messageBubble = messageWrapper.querySelector('.message-bubble');
    if (!messageBubble) return;
    
    // 移除思考狀態，添加錯誤狀態
    messageBubble.classList.remove('thinking');
    messageBubble.classList.add('error');
    messageWrapper.classList.remove('thinking');
    messageWrapper.classList.add('error');
    
    // 創建錯誤內容
    const errorContent = document.createElement('div');
    errorContent.className = 'error-content';
    errorContent.innerHTML = `
      <div class="error-message">
        <span class="error-icon">⚠️</span>
        <span class="error-text">發送失敗：${this._escapeHtml(errorMessage)}</span>
      </div>
      <div class="error-actions">
        <button class="retry-button" data-action="retry">🔄 重試</button>
        <button class="dismiss-button" data-action="dismiss">✖️ 關閉</button>
      </div>
      <div class="message-time">${this._formatTime(new Date())}</div>
    `;
    
    // 添加事件監聽器
    const retryButton = errorContent.querySelector('.retry-button');
    const dismissButton = errorContent.querySelector('.dismiss-button');
    
    if (retryButton) {
      retryButton.addEventListener('click', () => {
        // 移除錯誤訊息
        messageWrapper.remove();
        // 執行重試
        retryCallback();
      });
    }
    
    if (dismissButton) {
      dismissButton.addEventListener('click', () => {
        messageWrapper.remove();
      });
    }
    
    // 更新內容
    messageBubble.innerHTML = '';
    messageBubble.appendChild(errorContent);
    
    this._scrollToBottom();
  }

  /**
   * 添加訊息到UI
   */
  _addMessageToUI(role, content, images = null) {
    if (!this.elements.messagesContainer) return null;
    
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const messageWrapper = document.createElement('div');
    messageWrapper.className = `message-wrapper ${role}`;
    messageWrapper.dataset.messageId = messageId;
    
    // 創建頭像
    const avatar = document.createElement('div');
    avatar.className = `message-avatar ${role}`;
    avatar.textContent = role === 'user' ? '👤' : '🤖';
    
    // 創建訊息氣泡
    const messageBubble = document.createElement('div');
    messageBubble.className = `message-bubble ${role}`;
    
    // 創建訊息內容容器
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    // 添加圖片（如果有）
    if (images && images.length > 0) {
      const imagesContainer = document.createElement('div');
      imagesContainer.className = images.length === 1 ? 'message-images' : 'message-image-grid';
      
      images.forEach(image => {
        const img = document.createElement('img');
        img.className = 'message-image';
        img.src = `data:${image.mimeType};base64,${image.data}`;
        img.alt = image.name || '上傳的圖片';
        img.title = image.name || '上傳的圖片';
        
        // 添加點擊放大功能
        img.addEventListener('click', () => {
          this._showImageLightbox(img.src);
        });
        
        imagesContainer.appendChild(img);
      });
      
      messageContent.appendChild(imagesContainer);
    }
    
    // 添加文字內容（如果有）
    if (content && content.trim()) {
      const textContent = document.createElement('div');
      
      // 渲染內容（對AI訊息使用Markdown渲染，用戶訊息使用純文字）
      const renderedContent = role === 'assistant' 
        ? contentRenderer.render(content)
        : this._escapeHtml(content);
      
      textContent.innerHTML = renderedContent;
      messageContent.appendChild(textContent);
    }
    
    // 創建時間戳
    const messageTime = document.createElement('div');
    messageTime.className = 'message-time';
    messageTime.textContent = this._formatTime(new Date());
    
    // 組裝結構
    messageBubble.appendChild(messageContent);
    messageBubble.appendChild(messageTime);
    
    if (role === 'user') {
      messageWrapper.appendChild(messageBubble);
      messageWrapper.appendChild(avatar);
    } else {
      messageWrapper.appendChild(avatar);
      messageWrapper.appendChild(messageBubble);
    }
    
    this.elements.messagesContainer.appendChild(messageWrapper);
    
    // 對AI訊息應用語法高亮和數學渲染
    if (role === 'assistant') {
      contentRenderer.highlightCodeBlocks(messageContent);
      contentRenderer.renderMathInElement(messageContent);
      
      // 為助理回應添加語音播放按鈕
      this._addSpeechButtonsToMessage(messageWrapper);
    }
    
    this._scrollToBottom();
    
    return messageId;
  }

  /**
   * 添加歡迎訊息
   */
  _addWelcomeMessage() {
    const welcomeMessage = promptManager.getUIMessage('welcome');
    this._addMessageToUI('assistant', welcomeMessage);
  }

  /**
   * 清空訊息
   */
  _clearMessages() {
    if (this.elements.messagesContainer) {
      this.elements.messagesContainer.innerHTML = '';
    }
  }

  /**
   * 顯示當前會話資訊
   */
  _showCurrentSessionInfo() {
    const session = sessionManager.getCurrentSession();
    if (session) {
      const info = `
當前會話: ${session.title}
創建時間: ${this._formatDate(session.createdAt)}
訊息數量: ${session.messages.length}
會話ID: ${session.id}
      `.trim();
      
      this._addMessageToUI('assistant', info);
    } else {
      this._addMessageToUI('assistant', '目前沒有活動會話');
    }
  }

  /**
   * 顯示會話摘要
   */
  async _showSessionSummary() {
    try {
      this._showTypingIndicator();
      
      const summary = await sessionManager.generateSessionSummary();
      
      this._hideTypingIndicator();
      this._addMessageToUI('assistant', summary);
      
    } catch (error) {
      this._hideTypingIndicator();
      this._showNotification(`生成摘要失敗: ${error.message}`, 'error');
    }
  }

  /**
   * 更新發送按鈕狀態（處理中狀態）
   */
  _updateSendButton(enabled) {
    if (this.elements.sendButton) {
      this.elements.sendButton.disabled = !enabled;
      // 發送按鈕使用圖標，不需要改變文字
    }
  }

  /**
   * 顯示打字指示器
   */
  _showTypingIndicator() {
    if (this.elements.typingIndicator) {
      this.elements.typingIndicator.style.display = 'block';
    }
  }

  /**
   * 隱藏打字指示器
   */
  _hideTypingIndicator() {
    if (this.elements.typingIndicator) {
      this.elements.typingIndicator.style.display = 'none';
    }
  }

  /**
   * 顯示載入指示器
   */
  _showLoading(message = '載入中...') {
    if (this.elements.loadingIndicator) {
      this.elements.loadingIndicator.textContent = message;
      this.elements.loadingIndicator.style.display = 'block';
    }
  }

  /**
   * 隱藏載入指示器
   */
  _hideLoading() {
    if (this.elements.loadingIndicator) {
      this.elements.loadingIndicator.style.display = 'none';
    }
  }

  /**
   * 顯示通知
   */
  _showNotification(message, type = 'info') {
    if (!this.elements.notifications) return;
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    // 創建通知內容
    const messageSpan = document.createElement('span');
    messageSpan.className = 'notification-message';
    messageSpan.textContent = message;
    
    // 創建關閉按鈕
    const closeButton = document.createElement('button');
    closeButton.className = 'notification-close';
    closeButton.innerHTML = '✖';
    closeButton.title = '關閉通知';
    
    // 組裝通知
    notification.appendChild(messageSpan);
    notification.appendChild(closeButton);
    
    this.elements.notifications.appendChild(notification);
    
    // 關閉按鈕事件
    const removeNotification = () => {
      if (notification.parentNode) {
        notification.classList.add('notification-removing');
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 300);
      }
    };
    
    closeButton.addEventListener('click', removeNotification);
    
    // 點擊通知本身也可以關閉
    notification.addEventListener('click', removeNotification);
    
    // 自動移除
    const autoRemoveTimer = setTimeout(removeNotification, 5000);
    
    // 如果手動關閉，清除自動移除計時器
    closeButton.addEventListener('click', () => {
      clearTimeout(autoRemoveTimer);
    });
  }

  /**
   * 顯示錯誤
   */
  _showError(title, message) {
    console.error(`${title}:`, message);
    this._showNotification(`${title}: ${message}`, 'error');
  }

  /**
   * 切換側邊欄
   */
  _toggleSidebar() {
    if (this.elements.sidebar) {
      const isOpen = this.elements.sidebar.classList.contains('open');
      
      if (isOpen) {
        this._closeSidebar();
      } else {
        this._openSidebar();
      }
    }
  }

  /**
   * 打開側邊欄
   */
  _openSidebar() {
    if (this.elements.sidebar) {
      this.elements.sidebar.classList.add('open');
    }
    if (this.elements.sidebarOverlay) {
      this.elements.sidebarOverlay.classList.add('active');
    }
  }

  /**
   * 關閉側邊欄
   */
  _closeSidebar() {
    if (this.elements.sidebar) {
      this.elements.sidebar.classList.remove('open');
    }
    if (this.elements.sidebarOverlay) {
      this.elements.sidebarOverlay.classList.remove('active');
    }
  }

  /**
   * 處理視窗大小變化
   */
  _handleResize() {
    // 響應式處理邏輯
    this._scrollToBottom();
  }

  /**
   * 處理離開前保存
   */
  _handleBeforeUnload() {
    // 保存當前狀態
    if (this.elements.messageInput?.value) {
      sessionStorage.setItem('draft-message', this.elements.messageInput.value);
    }
  }

  /**
   * 滾動到底部
   */
  _scrollToBottom() {
    if (this.elements.messagesContainer) {
      this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight;
    }
  }

  /**
   * HTML 轉義
   */
  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 格式化日期
   */
  _formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * 格式化時間
   */
  _formatTime(date) {
    return date.toLocaleTimeString('zh-TW', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * 處理圖片上傳
   */
  async _handleImageUpload(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    
    // 檢查文件類型和大小
    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        this._showNotification(`文件 ${file.name} 不是有效的圖片格式`, 'warning');
        return false;
      }
      
      if (file.size > 10 * 1024 * 1024) { // 10MB限制
        this._showNotification(`文件 ${file.name} 大小超過10MB限制`, 'warning');
        return false;
      }
      
      return true;
    });
    
    if (validFiles.length === 0) return;
    
    try {
      // 處理每個文件
      for (const file of validFiles) {
        const imageData = await this._fileToBase64(file);
        const imageInfo = {
          name: file.name,
          size: file.size,
          mimeType: file.type,
          data: imageData
        };
        
        this.uploadedImages.push(imageInfo);
      }
      
      // 更新預覽
      this._updateImagePreview();
      
      // 更新發送按鈕狀態
      this._updateSendButtonState();
      
    } catch (error) {
      console.error('圖片上傳處理失敗:', error);
      this._showNotification('圖片處理失敗: ' + error.message, 'error');
    }
    
    // 清空文件輸入
    event.target.value = '';
  }

  /**
   * 將文件轉換為base64
   */
  _fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // 移除 data:image/xxx;base64, 前綴
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('文件讀取失敗'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * 更新圖片預覽
   */
  _updateImagePreview() {
    if (!this.elements.imagePreview) return;
    
    if (this.uploadedImages.length === 0) {
      this.elements.imagePreview.style.display = 'none';
      return;
    }
    
    this.elements.imagePreview.style.display = 'block';
    this.elements.imagePreview.innerHTML = '';
    
    this.uploadedImages.forEach((image, index) => {
      const previewItem = document.createElement('div');
      previewItem.className = 'image-preview-item';
      
      const thumbnail = document.createElement('img');
      thumbnail.className = 'image-preview-thumbnail';
      thumbnail.src = `data:${image.mimeType};base64,${image.data}`;
      thumbnail.alt = image.name;
      
      const infoDiv = document.createElement('div');
      infoDiv.className = 'image-preview-info';
      
      const nameDiv = document.createElement('div');
      nameDiv.className = 'image-preview-name';
      nameDiv.textContent = image.name;
      
      const sizeDiv = document.createElement('div');
      sizeDiv.className = 'image-preview-size';
      sizeDiv.textContent = this._formatFileSize(image.size);
      
      infoDiv.appendChild(nameDiv);
      infoDiv.appendChild(sizeDiv);
      
      const removeBtn = document.createElement('button');
      removeBtn.className = 'image-preview-remove';
      removeBtn.innerHTML = '×';
      removeBtn.title = '移除圖片';
      removeBtn.addEventListener('click', () => {
        this._removeUploadedImage(index);
      });
      
      previewItem.appendChild(thumbnail);
      previewItem.appendChild(infoDiv);
      previewItem.appendChild(removeBtn);
      
      this.elements.imagePreview.appendChild(previewItem);
    });
  }

  /**
   * 移除已上傳的圖片
   */
  _removeUploadedImage(index) {
    this.uploadedImages.splice(index, 1);
    this._updateImagePreview();
    this._updateSendButtonState();
  }

  /**
   * 清空已上傳的圖片
   */
  _clearUploadedImages() {
    this.uploadedImages = [];
    this._updateImagePreview();
    this._updateSendButtonState();
  }

  /**
   * 構建多模態訊息
   */
  _buildMultimodalMessage(text) {
    if (this.uploadedImages.length === 0) {
      return text;
    }
    
    return {
      text: text || '',
      images: this.uploadedImages.map(img => ({
        mimeType: img.mimeType,
        data: img.data
      }))
    };
  }

  /**
   * 更新發送按鈕狀態
   */
  _updateSendButtonState() {
    const hasText = this.elements.messageInput?.value.trim();
    const hasImages = this.uploadedImages.length > 0;
    const canSend = (hasText || hasImages) && !this.isProcessing;
    
    if (this.elements.sendButton) {
      this.elements.sendButton.disabled = !canSend;
    }
  }

  /**
   * 顯示圖片燈箱
   */
  _showImageLightbox(imageSrc) {
    const lightbox = document.createElement('div');
    lightbox.className = 'image-lightbox';
    
    const img = document.createElement('img');
    img.src = imageSrc;
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'image-lightbox-close';
    closeBtn.innerHTML = '×';
    closeBtn.title = '關閉';
    
    lightbox.appendChild(img);
    lightbox.appendChild(closeBtn);
    
    // 點擊背景或關閉按鈕關閉燈箱
    const closeLightbox = () => {
      document.body.removeChild(lightbox);
    };
    
    lightbox.addEventListener('click', closeLightbox);
    closeBtn.addEventListener('click', closeLightbox);
    
    // 防止點擊圖片時關閉燈箱
    img.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    
    // ESC鍵關閉燈箱
    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        closeLightbox();
        document.removeEventListener('keydown', handleKeydown);
      }
    };
    document.addEventListener('keydown', handleKeydown);
    
    document.body.appendChild(lightbox);
  }

  /**
   * 格式化文件大小
   */
  _formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 更新模型信息顯示
   */
  _updateModelInfo() {
    if (this.elements.modelInfo) {
      const modelName = this._formatModelName(this.appState.currentModel);
      this.elements.modelInfo.innerHTML = `<small>模型：${modelName}</small>`;
    }
  }

  /**
   * 獲取有效的系統提示詞
   */
  _getEffectiveSystemPrompt() {
    // 如果有自定義系統提示詞，優先使用
    if (this.appState.customSystemPrompt && this.appState.customSystemPrompt.trim()) {
      let customPrompt = this.appState.customSystemPrompt;
      
      // 替換時間變數
      const currentTime = new Date().toLocaleString('zh-TW', {
        timeZone: 'Asia/Taipei',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      customPrompt = customPrompt.replace('{current_datetime}', currentTime);
      
      return customPrompt;
    }
    
    // 獲取當前會話的角色信息
    const currentSession = sessionManager.getCurrentSession();
    const roleId = currentSession?.metadata?.roleId;
    
    // 如果會話有指定角色，使用角色專屬的系統提示詞
    if (roleId && promptManager.hasRole(roleId)) {
      return promptManager.getRoleSystemPrompt(roleId);
    }
    
    // 否則使用預設的系統提示詞
    return this._generateDynamicSystemPrompt();
  }

  /**
   * 根據用戶設定動態生成系統提示詞
   */
  _generateDynamicSystemPrompt() {
    // 獲取基礎提示詞
    let basePrompt = promptManager.getSystemPrompt();
    
    // 替換時間變數
    const currentTime = new Date().toLocaleString('zh-TW', {
      timeZone: 'Asia/Taipei',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    basePrompt = basePrompt.replace('{current_datetime}', currentTime);
    
    // 根據設定添加額外的指導原則
    const additionalGuidelines = [];
    
    // 分步驟教學設定
    if (this.appState.stepByStep !== false) {
      additionalGuidelines.push(`
## 📚 分步驟教學模式
- 將複雜概念分解為小步驟，每次只教一個重點
- 每個步驟結束後，等待學生確認理解再繼續
- 使用「你明白了嗎？」、「我們繼續下一步好嗎？」等互動語句
- 如果學生表示不理解，立即停下來重新解釋當前步驟`);
    }
    
    // 自動調整難度設定
    if (this.appState.adaptiveDifficulty !== false) {
      additionalGuidelines.push(`
## 🎯 自動難度調整
- 根據學生的回應調整教學難度和節奏
- 如果學生回答正確且快速，可以適當提高挑戰性
- 如果學生多次出錯或表示困惑，立即降低難度，提供更多基礎解釋
- 觀察學生的語言表達能力，調整自己的用詞複雜度
- 記住學生之前的學習表現，持續優化教學策略`);
    }
    
    // 預設科目特殊指導
    if (this.appState.defaultSubject) {
      switch (this.appState.defaultSubject) {
        case 'mathematics':
          additionalGuidelines.push(`
## 🔢 數學教學專項指導
- 優先使用 CPA 教學法（具體→圖像→抽象）
- 多用生活實例和視覺化說明
- 鼓勵學生動手操作和畫圖理解
- 特別注意常見的數學迷思概念`);
          break;
        case 'science':
          additionalGuidelines.push(`
## 🔬 科學教學專項指導
- 採用探究式學習方法
- 鼓勵學生提出假設和進行思考實驗
- 連結科學概念與日常生活現象
- 培養科學思維和批判性思考`);
          break;
        case 'language':
          additionalGuidelines.push(`
## 📝 語言學習專項指導
- 採用互動式教學方法
- 鼓勵學生多說多練習
- 提供豐富的語言情境和例句
- 注重語言的實用性和溝通功能`);
          break;
      }
    }
    
    // 音效提示設定（影響回應風格）
    if (this.appState.soundEnabled !== false) {
      additionalGuidelines.push(`
## 🔊 互動回饋增強
- 在適當時機使用表情符號和視覺元素增強互動體驗
- 對學生的正確回答給予明確的正面回饋
- 使用鼓勵性的語言和符號（如 ✅、🎉、👏 等）`);
    }
    
    // 組合最終的系統提示詞
    if (additionalGuidelines.length > 0) {
      basePrompt += '\n\n' + '# 🎛️ 個人化教學設定\n' + 
                    '根據用戶的偏好設定，請特別注意以下教學指導原則：' + 
                    additionalGuidelines.join('\n');
      
      basePrompt += `\n\n## ⚙️ 當前設定摘要
- 分步驟教學：${this.appState.stepByStep !== false ? '✅ 啟用' : '❌ 停用'}
- 自動調整難度：${this.appState.adaptiveDifficulty !== false ? '✅ 啟用' : '❌ 停用'}
- 預設科目：${this._getSubjectDisplayName(this.appState.defaultSubject)}
- 互動增強：${this.appState.soundEnabled !== false ? '✅ 啟用' : '❌ 停用'}

請根據這些設定調整你的教學方式，提供最適合學生的個人化學習體驗。`;
    }
    
    return basePrompt;
  }

  /**
   * 獲取科目顯示名稱
   */
  _getSubjectDisplayName(subject) {
    const subjectNames = {
      'mathematics': '數學',
      'science': '自然科學', 
      'language': '語言學習',
      'general': '通用'
    };
    return subjectNames[subject] || '通用';
  }

  /**
   * 將練習分析加入系統提示詞
   */
  _addPracticeAnalysisToSystemPrompt(systemPrompt, history) {
    try {
      // 從歷史訊息中提取隱藏的練習分析
      const practiceAnalyses = history
        .filter(msg => msg.role === 'system' && 
                msg.metadata?.type === 'practice_analysis' && 
                msg.metadata?.hidden === true)
        .map(msg => msg.content)
        .slice(-5); // 只取最近5個分析
      
      if (practiceAnalyses.length === 0) {
        return systemPrompt;
      }
      
      // 建構學習分析上下文
      const analysisContext = `

## 📊 學習者背景分析
基於最近的練習表現，以下是學習者的狀況分析：

${practiceAnalyses.join('\n\n')}

請在回答時參考這些分析，提供更有針對性的教學建議和回饋。如果學習者在某個主題上有困難，請特別加強相關說明；如果表現良好，可以適當提高挑戰性。`;

      console.log('📋 已加入練習分析到系統提示詞:', practiceAnalyses.length, '項分析');
      
      return systemPrompt + analysisContext;
      
    } catch (error) {
      console.error('❌ 處理練習分析失敗:', error);
      return systemPrompt;
    }
  }

  /**
   * 重置系統提示詞為預設值
   */
  _resetSystemPrompt() {
    if (this.elements.customSystemPrompt) {
      this.elements.customSystemPrompt.value = '';
      this._showNotification('已重置為預設系統提示詞', 'info');
    }
  }

  /**
   * 預覽系統提示詞
   */
  _previewSystemPrompt() {
    const customPrompt = this.elements.customSystemPrompt?.value.trim();
    let previewPrompt;
    
    if (customPrompt) {
      // 預覽自定義提示詞
      previewPrompt = customPrompt;
      
      // 替換變數以顯示實際效果
      const currentTime = new Date().toLocaleString('zh-TW', {
        timeZone: 'Asia/Taipei',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      previewPrompt = previewPrompt.replace('{current_datetime}', currentTime);
    } else {
      // 預覽預設提示詞
      previewPrompt = promptManager.getSystemPrompt();
    }
    
    // 顯示預覽模態框
    this._showPromptPreview(previewPrompt, customPrompt ? '自定義系統提示詞' : '預設系統提示詞');
  }

  /**
   * 預覽設定效果
   */
  _previewSettingsEffect() {
    // 創建臨時設定對象，模擬用戶當前在表單中的設定
    const tempSettings = {
      defaultSubject: document.getElementById('subject-select')?.value || 'mathematics',
      adaptiveDifficulty: document.getElementById('adaptive-difficulty')?.checked ?? true,
      stepByStep: document.getElementById('step-by-step')?.checked ?? true,
      soundEnabled: document.getElementById('sound-enabled')?.checked ?? true,
      customSystemPrompt: this.elements.customSystemPrompt?.value.trim() || null
    };
    
    // 暫時保存當前設定
    const originalSettings = {
      defaultSubject: this.appState.defaultSubject,
      adaptiveDifficulty: this.appState.adaptiveDifficulty,
      stepByStep: this.appState.stepByStep,
      soundEnabled: this.appState.soundEnabled,
      customSystemPrompt: this.appState.customSystemPrompt
    };
    
    // 臨時應用新設定
    Object.assign(this.appState, tempSettings);
    
    // 生成預覽提示詞
    const previewPrompt = this._getEffectiveSystemPrompt();
    
    // 恢復原始設定
    Object.assign(this.appState, originalSettings);
    
    // 顯示預覽
    this._showPromptPreview(previewPrompt, '當前設定效果預覽');
  }

  /**
   * 顯示提示詞預覽模態框
   */
  _showPromptPreview(prompt, title) {
    if (!this.elements.promptPreviewModal || !this.elements.promptPreviewContent) return;
    
    // 設定內容
    this.elements.promptPreviewContent.textContent = prompt;
    
    // 計算統計信息
    const charCount = prompt.length;
    const tokenCount = this._estimateTokenCount(prompt);
    
    if (this.elements.promptCharCount) {
      this.elements.promptCharCount.textContent = charCount.toLocaleString();
    }
    
    if (this.elements.promptTokenCount) {
      this.elements.promptTokenCount.textContent = tokenCount.toLocaleString();
    }
    
    // 更新標題
    const modalTitle = this.elements.promptPreviewModal.querySelector('.modal-header h3');
    if (modalTitle) {
      modalTitle.textContent = title;
    }
    
    // 顯示模態框
    this.elements.promptPreviewModal.classList.remove('hidden');
    this.elements.promptPreviewModal.style.display = 'flex';
  }

  /**
   * 估算Token數量（簡單估算）
   */
  _estimateTokenCount(text) {
    // 簡單的Token估算：中文字符約1.5個token，英文單詞約1個token
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
    const otherChars = text.length - chineseChars - englishWords;
    
    return Math.ceil(chineseChars * 1.5 + englishWords + otherChars * 0.5);
  }

  /**
   * 設置語音服務事件監聽器
   */
  _setupSpeechEvents() {
    if (!this.speechService) return;
    
    // 語音識別開始
    window.addEventListener('recognition-start', () => {
      console.log('Voice recognition started');
      this._onVoiceRecognitionStart();
    });
    
    // 語音識別結果
    window.addEventListener('recognition-result', (event) => {
      console.log('Voice recognition result:', event.detail);
      this._onVoiceRecognitionResult(event.detail);
    });
    
    // 語音識別錯誤
    window.addEventListener('recognition-error', (event) => {
      console.error('Voice recognition error:', event.detail);
      this._onVoiceRecognitionError(event.detail);
    });
    
    // 語音識別結束
    window.addEventListener('recognition-end', () => {
      console.log('Voice recognition ended');
      this._onVoiceRecognitionEnd();
    });
  }

  /**
   * 處理語音輸入按鈕點擊
   * @param {string} language - 語言代碼 ('zh-TW' 或 'en-US')
   */
  async _handleVoiceInput(language = 'zh-TW') {
    if (!this.speechService) {
      this._showNotification('語音服務未初始化', 'error');
      return;
    }
    
    // 檢查瀏覽器支援
    const support = this.speechService.getSupport();
    if (!support.recognition) {
      this._showVoicePermissionPrompt('您的瀏覽器不支援語音識別功能');
      return;
    }
    
    // 如果正在進行語音輸入，則停止
    if (this.isVoiceInputActive) {
      this._stopVoiceInput();
      return;
    }
    
    // 設定語音識別語言
    this.currentVoiceLanguage = language;
    this.speechService.setRecognitionLanguage(language);
    
    try {
      await this.speechService.startRecognition();
    } catch (error) {
      console.error('Failed to start voice input:', error);
      
      if (error.message.includes('denied')) {
        this._showVoicePermissionPrompt('需要麥克風權限才能使用語音輸入功能');
      } else {
        this._showNotification('語音輸入啟動失敗：' + error.message, 'error');
      }
    }
  }

  /**
   * 停止語音輸入
   */
  _stopVoiceInput() {
    if (this.speechService) {
      this.speechService.stopRecognition();
    }
  }

  /**
   * 語音識別開始時的處理
   */
  _onVoiceRecognitionStart() {
    this.isVoiceInputActive = true;
    
    // 更新按鈕狀態
    const activeButton = this.currentVoiceLanguage === 'en-US' ? 
      this.elements.voiceInputEnglishBtn : 
      this.elements.voiceInputChineseBtn;
    
    if (activeButton) {
      activeButton.classList.add('listening');
      activeButton.title = '點擊停止語音輸入';
    }
    
    // 顯示語音狀態指示器
    if (this.elements.voiceStatus) {
      this.elements.voiceStatus.style.display = 'block';
    }
    
    const languageText = this.currentVoiceLanguage === 'en-US' ? 
      '正在聆聽英文...' : '正在聆聽中文...';
    
    if (this.elements.voiceStatusMessage) {
      this.elements.voiceStatusMessage.textContent = languageText;
    }
  }

  /**
   * 語音識別結果處理
   */
  _onVoiceRecognitionResult(detail) {
    const { transcript, isFinal, confidence } = detail;
    
    if (transcript) {
      // 更新狀態消息
      if (this.elements.voiceStatusMessage) {
        this.elements.voiceStatusMessage.textContent = isFinal ? 
          `識別完成: ${transcript}` : 
          `識別中: ${transcript}`;
      }
      
      // 如果是最終結果且不是練習模式，插入到輸入框
      if (isFinal && !this.isPracticeMode && this.elements.messageInput) {
        const currentText = this.elements.messageInput.value;
        const newText = currentText ? `${currentText} ${transcript}` : transcript;
        this.elements.messageInput.value = newText;
        
        // 更新發送按鈕狀態
        this._updateSendButtonState();
        
        // 聚焦到輸入框
        this.elements.messageInput.focus();
        
        // 顯示成功通知
        this._showNotification(`語音識別成功！信心度: ${Math.round(confidence * 100)}%`, 'success');
      }
    }
  }

  /**
   * 語音識別錯誤處理
   */
  _onVoiceRecognitionError(detail) {
    const { error } = detail;
    let errorMessage = '語音識別發生錯誤';
    
    switch (error) {
      case 'no-speech':
        errorMessage = '沒有檢測到語音，請重試';
        break;
      case 'audio-capture':
        errorMessage = '無法訪問麥克風，請檢查設備設定';
        break;
      case 'not-allowed':
        errorMessage = '麥克風權限被拒絕，請在瀏覽器設定中允許';
        break;
      case 'network':
        errorMessage = '網路連接問題，請檢查網路狀態';
        break;
      case 'aborted':
        errorMessage = '語音識別被中斷';
        break;
      default:
        errorMessage = `語音識別錯誤: ${error}`;
    }
    
    this._showNotification(errorMessage, 'error');
  }

  /**
   * 語音識別結束處理
   */
  _onVoiceRecognitionEnd() {
    this.isVoiceInputActive = false;
    
    // 更新按鈕狀態
    const activeButton = this.currentVoiceLanguage === 'en-US' ? 
      this.elements.voiceInputEnglishBtn : 
      this.elements.voiceInputChineseBtn;
    
    if (activeButton) {
      activeButton.classList.remove('listening', 'processing');
      const buttonTitle = this.currentVoiceLanguage === 'en-US' ? 
        '英文語音輸入 (練習口說)' : '中文語音輸入';
      activeButton.title = buttonTitle;
    }
    
    // 隱藏語音狀態指示器
    if (this.elements.voiceStatus) {
      setTimeout(() => {
        this.elements.voiceStatus.style.display = 'none';
      }, 1000);
    }
    
    // 清除當前語言標記
    this.currentVoiceLanguage = null;
  }

  /**
   * 顯示語音權限提示
   */
  _showVoicePermissionPrompt(message) {
    // 檢查是否已有提示
    const existingPrompt = document.getElementById('voice-permission-prompt');
    if (existingPrompt) {
      existingPrompt.remove();
    }
    
    const promptDiv = document.createElement('div');
    promptDiv.id = 'voice-permission-prompt';
    promptDiv.className = 'voice-permission-prompt';
    promptDiv.innerHTML = `
      <div class="icon">🎤</div>
      <div class="content">
        <div class="title">語音輸入功能</div>
        <div class="description">${message}</div>
      </div>
      <div class="actions">
        <button class="retry-btn">重試</button>
        <button class="dismiss-btn">關閉</button>
      </div>
    `;
    
    // 插入到輸入區域之前
    const inputArea = this.elements.inputArea;
    if (inputArea) {
      inputArea.parentNode.insertBefore(promptDiv, inputArea);
    }
    
    // 添加事件監聽器
    const retryBtn = promptDiv.querySelector('.retry-btn');
    const dismissBtn = promptDiv.querySelector('.dismiss-btn');
    
    retryBtn?.addEventListener('click', () => {
      promptDiv.remove();
      this._handleVoiceInput();
    });
    
    dismissBtn?.addEventListener('click', () => {
      promptDiv.remove();
    });
    
    // 5秒後自動移除
    setTimeout(() => {
      if (promptDiv.parentNode) {
        promptDiv.remove();
      }
    }, 5000);
  }

  /**
   * 為訊息中的英文內容添加語音播放按鈕
   */
  _addSpeechButtonsToMessage(messageElement) {
    if (!this.speechService) return;
    
    const support = this.speechService.getSupport();
    if (!support.synthesis) return;
    
    // 找到訊息內容
    const messageContent = messageElement.querySelector('.message-content');
    if (!messageContent) return;
    
    // 先檢查是否已經添加過按鈕，避免重複添加
    if (messageContent.querySelector('.speech-button')) {
      return;
    }
    
    // 獲取HTML內容進行處理
    let htmlContent = messageContent.innerHTML;
    
    // 優先處理 [SPEAK] 標記
    const speakTagPattern = /\[SPEAK\](.*?)\[\/SPEAK\]/gi;
    const speakMatches = [];
    let match;
    
    // 提取所有標記的內容
    while ((match = speakTagPattern.exec(htmlContent)) !== null) {
      speakMatches.push({
        fullMatch: match[0],
        content: match[1].trim(),
        index: match.index
      });
    }
    
    if (speakMatches.length > 0) {
      // 處理標記的內容
      speakMatches.forEach((speakMatch, index) => {
        const buttonId = `speech-btn-${Date.now()}-${index}`;
        const playButtonHtml = `<button class="speech-button inline-speech-button" 
                              title="播放英文: ${this._escapeHtml(speakMatch.content.length > 50 ? speakMatch.content.substring(0, 50) + '...' : speakMatch.content)}"
                              data-text="${this._escapeHtml(speakMatch.content)}"
                              data-index="${index}">🔊</button>`;
        
        const practiceButtonHtml = `<button class="speech-button inline-speech-button practice-button" 
                              title="練習發音: ${this._escapeHtml(speakMatch.content.length > 50 ? speakMatch.content.substring(0, 50) + '...' : speakMatch.content)}"
                              data-text="${this._escapeHtml(speakMatch.content)}"
                              data-index="${index}">🎤</button>`;
        
        // 將 [SPEAK]內容[/SPEAK] 替換為 內容 🔊 🎤
        htmlContent = htmlContent.replace(speakMatch.fullMatch, `${speakMatch.content} ${playButtonHtml} ${practiceButtonHtml}`);
      });
    } else {
      // 如果沒有標記，回退到原來的英文檢測邏輯
      const text = messageContent.textContent || '';
      const englishParts = this.speechService.extractEnglish(text);
      
      if (englishParts.length === 0) return;
      
      // 為每個英文段落添加按鈕
      englishParts.forEach((englishText, index) => {
        // 創建按鈕HTML
        const buttonId = `speech-btn-${Date.now()}-${index}`;
        const playButtonHtml = `<button class="speech-button inline-speech-button" 
                              title="播放英文: ${this._escapeHtml(englishText.length > 50 ? englishText.substring(0, 50) + '...' : englishText)}"
                              data-text="${this._escapeHtml(englishText)}"
                              data-index="${index}">🔊</button>`;
        
        const practiceButtonHtml = `<button class="speech-button inline-speech-button practice-button" 
                              title="練習發音: ${this._escapeHtml(englishText.length > 50 ? englishText.substring(0, 50) + '...' : englishText)}"
                              data-text="${this._escapeHtml(englishText)}"
                              data-index="${index}">🎤</button>`;
        
        // 使用更安全的方式查找英文內容位置
        // 先將HTML轉換為純文本來找位置，然後在HTML中插入
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;
        const currentText = tempDiv.textContent || '';
        
        // 找到英文內容在純文本中的位置
        const englishIndex = currentText.indexOf(englishText);
        if (englishIndex !== -1) {
          // 在HTML中找到對應位置並插入按鈕
          // 使用更精確的方式：直接匹配完整的英文片段
          const escapedEnglishText = this._escapeRegExp(englishText);
          // 創建正則表達式來匹配完整的英文內容（包括撇號）
          const regex = new RegExp(`(${escapedEnglishText})(?=\\s|[^A-Za-z']|$|<)`, 'g');
            
          // 跟蹤已替換的次數，確保只替換對應的實例
          let replaceCount = 0;
          const targetIndex = englishParts.slice(0, index).filter(part => 
            part === englishText
          ).length;
          
          htmlContent = htmlContent.replace(regex, (match, p1, offset, string) => {
            // 檢查是否在HTML標籤內
            const beforeMatch = string.substring(0, offset);
            const openTags = (beforeMatch.match(/</g) || []).length;
            const closeTags = (beforeMatch.match(/>/g) || []).length;
            const insideTag = openTags > closeTags;
            
            if (insideTag) {
              return match; // 如果在標籤內，不替換
            }
            
            if (replaceCount === targetIndex) {
              replaceCount++;
              return `${p1} ${playButtonHtml} ${practiceButtonHtml}`;
            }
            replaceCount++;
            return match;
          });
        }
      });
    }
    
    // 更新DOM
    const newContent = htmlContent;
    if (newContent !== messageContent.innerHTML) {
      messageContent.innerHTML = newContent;
      
      // 為新添加的按鈕添加事件監聽器
      const playButtons = messageContent.querySelectorAll('.speech-button:not(.practice-button)[data-text]');
      playButtons.forEach(button => {
        if (!button.hasAttribute('data-listener-added')) {
          const englishText = button.getAttribute('data-text');
          button.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await this._handleSpeechPlayback(button, englishText);
          });
          button.setAttribute('data-listener-added', 'true');
        }
      });
      
      // 為練習按鈕添加事件監聽器
      const practiceButtons = messageContent.querySelectorAll('.speech-button.practice-button[data-text]');
      practiceButtons.forEach(button => {
        if (!button.hasAttribute('data-listener-added')) {
          const englishText = button.getAttribute('data-text');
          button.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await this._handleSpeechPractice(button, englishText);
          });
          button.setAttribute('data-listener-added', 'true');
        }
      });
    }
  }

  /**
   * 轉義正則表達式特殊字符
   */
  _escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 處理語音播放
   */
  async _handleSpeechPlayback(button, text) {
    if (!this.speechService) return;
    
    // 如果正在播放，停止播放
    if (button.classList.contains('playing')) {
      this.speechService.stopSpeaking();
      return;
    }
    
    try {
      // 停止其他正在播放的語音
      document.querySelectorAll('.speech-button.playing').forEach(btn => {
        btn.classList.remove('playing');
        btn.innerHTML = '🔊';
      });
      
      // 更新按鈕狀態
      button.classList.add('playing');
      button.innerHTML = '⏸️';
      
      // 播放語音
      await this.speechService.speak(text, 'english');
      
    } catch (error) {
      console.error('Speech playback failed:', error);
      this._showNotification('語音播放失敗：' + error.message, 'error');
    } finally {
      // 恢復按鈕狀態
      button.classList.remove('playing');
      button.innerHTML = '🔊';
    }
  }

  /**
   * 檢查語音功能支援狀態
   */
  _checkVoiceSupport() {
    if (!this.speechService) return null;
    
    return this.speechService.getSupport();
  }

  /**
   * 更新語音按鈕狀態
   */
  _updateVoiceButtonState() {
    if (!this.elements.voiceInputBtn) return;
    
    const support = this._checkVoiceSupport();
    
    if (!support || !support.recognition) {
      this.elements.voiceInputBtn.classList.add('disabled');
      this.elements.voiceInputBtn.title = '您的瀏覽器不支援語音識別';
    } else if (this.isVoiceInputActive) {
      this.elements.voiceInputBtn.classList.add('listening');
      this.elements.voiceInputBtn.title = '點擊停止語音輸入';
    } else {
      this.elements.voiceInputBtn.classList.remove('disabled', 'listening');
      this.elements.voiceInputBtn.title = '語音輸入 (中文辨識)';
    }
  }

  /**
   * 處理語音練習
   * @param {HTMLElement} button - 練習按鈕
   * @param {string} targetText - 目標英文文本
   */
  async _handleSpeechPractice(button, targetText) {
    if (!this.speechService) return;
    
    // 檢查瀏覽器支援
    const support = this.speechService.getSupport();
    if (!support.recognition) {
      this._showNotification('您的瀏覽器不支援語音識別功能', 'error');
      return;
    }
    
    // 如果正在練習，停止練習
    if (button.classList.contains('practicing')) {
      this._stopSpeechPractice(button);
      return;
    }
    
    try {
      // 設定英文語音辨識
      this.speechService.setRecognitionLanguage('en-US');
      
      // 設置練習模式
      this.isPracticeMode = true;
      
      // 更新按鈕狀態
      button.classList.add('practicing');
      button.innerHTML = '⏹️';
      button.title = '點擊停止練習';
      
      // 顯示練習Modal
      this._showPracticeModal(targetText);
      
      // 設定一次性事件監聽器來接收語音辨識結果
      const handlePracticeResult = (event) => {
        const { transcript, isFinal } = event.detail;
        
        if (isFinal) {
          // 移除事件監聽器
          window.removeEventListener('recognition-result', handlePracticeResult);
          
          // 停止練習
          this._stopSpeechPractice(button);
          
          // 比對結果並給出回饋
          this._evaluatePronunciationInModal(targetText, transcript);
        }
      };
      
      const handlePracticeError = (event) => {
        window.removeEventListener('recognition-result', handlePracticeResult);
        window.removeEventListener('recognition-error', handlePracticeError);
        window.removeEventListener('recognition-end', handlePracticeEnd);
        this.isPracticeMode = false;
        this._stopSpeechPractice(button);
        this._hidePracticeModal();
        
        const { error } = event.detail;
        let errorMessage = '語音辨識發生錯誤';
        
        switch (error) {
          case 'no-speech':
            errorMessage = '沒有檢測到語音，請重試';
            break;
          case 'not-allowed':
            errorMessage = '需要麥克風權限才能使用語音練習功能';
            break;
          default:
            errorMessage = `語音辨識錯誤: ${error}`;
        }
        
        this._showNotification(errorMessage, 'error');
      };
      
      const handlePracticeEnd = () => {
        window.removeEventListener('recognition-result', handlePracticeResult);
        window.removeEventListener('recognition-error', handlePracticeError);
        window.removeEventListener('recognition-end', handlePracticeEnd);
        this.isPracticeMode = false;
        this._stopSpeechPractice(button);
        
        // 檢查是否已經顯示了回饋，如果沒有則顯示"沒有檢測到語音"的提示
        const modal = document.getElementById('speech-practice-modal');
        if (modal) {
          const feedbackSection = modal.querySelector('.practice-feedback-section');
          const isShowingFeedback = feedbackSection && feedbackSection.style.display !== 'none';
          
          if (!isShowingFeedback) {
            // 顯示沒有檢測到語音的回饋
            this._showNoSpeechFeedbackInModal(targetText);
          }
        }
      };
      
      // 添加事件監聽器
      window.addEventListener('recognition-result', handlePracticeResult);
      window.addEventListener('recognition-error', handlePracticeError);
      window.addEventListener('recognition-end', handlePracticeEnd);
      
      // 開始語音辨識
      await this.speechService.startRecognition();
      
    } catch (error) {
      console.error('Speech practice failed:', error);
      this.isPracticeMode = false;
      this._stopSpeechPractice(button);
      this._hidePracticeModal();
      
      if (error.message.includes('denied')) {
        this._showNotification('需要麥克風權限才能使用語音練習功能', 'error');
      } else {
        this._showNotification('語音練習啟動失敗：' + error.message, 'error');
      }
    }
  }

  /**
   * 停止語音練習
   * @param {HTMLElement} button - 練習按鈕
   */
  _stopSpeechPractice(button) {
    if (this.speechService) {
      this.speechService.stopRecognition();
    }
    
    // 清除練習模式
    this.isPracticeMode = false;
    
    // 恢復按鈕狀態
    button.classList.remove('practicing');
    button.innerHTML = '🎤';
    button.title = button.getAttribute('title').replace('點擊停止練習', '練習發音');
  }

  /**
   * 顯示練習Modal
   * @param {string} targetText - 目標文本
   */
  _showPracticeModal(targetText) {
    // 移除現有Modal
    this._hidePracticeModal();
    
    const modalDiv = document.createElement('div');
    modalDiv.id = 'speech-practice-modal';
    modalDiv.className = 'modal speech-practice-modal';
    modalDiv.innerHTML = `
      <div class="modal-content practice-modal-content">
        <div class="modal-header practice-modal-header">
          <h3>🎤 語音練習</h3>
          <button class="close-button modal-close practice-modal-close">✖</button>
        </div>
        
        <div class="modal-body practice-modal-body">
          <div class="practice-target-section">
            <label>請朗讀以下句子：</label>
            <div class="practice-target-text">"${targetText}"</div>
          </div>
          
          <div class="practice-status-section">
            <div class="practice-status-icon">
              <div class="recording-indicator">🎤</div>
            </div>
            <div class="practice-status-text">
              <div class="practice-status-title">正在聆聽您的發音...</div>
              <div class="practice-status-subtitle">請清楚地朗讀上面的句子</div>
            </div>
          </div>
          
          <div class="practice-controls">
            <button class="practice-stop-btn">停止練習</button>
          </div>
          
          <div class="practice-feedback-section" style="display: none;">
            <!-- 回饋內容將在這裡動態插入 -->
          </div>
        </div>
      </div>
    `;
    
    // 添加到頁面
    document.body.appendChild(modalDiv);
    
    // 添加事件監聽器
    const closeBtn = modalDiv.querySelector('.practice-modal-close');
    const stopBtn = modalDiv.querySelector('.practice-stop-btn');
    
    closeBtn?.addEventListener('click', () => {
      this._stopCurrentSpeechPractice();
      this._hidePracticeModal();
    });
    
    stopBtn?.addEventListener('click', () => {
      this._stopCurrentSpeechPractice();
      this._hidePracticeModal();
    });
    
    // ESC鍵關閉
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        this._stopCurrentSpeechPractice();
        this._hidePracticeModal();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
    
    // 儲存目標文字到modal中以便後續使用
    modalDiv.dataset.targetText = targetText;
  }

  /**
   * 隱藏練習Modal
   */
  _hidePracticeModal() {
    const existingModal = document.getElementById('speech-practice-modal');
    if (existingModal) {
      existingModal.remove();
    }
  }

  /**
   * 停止當前的語音練習（不包含UI更新，因為可能是從modal中調用）
   */
  _stopCurrentSpeechPractice() {
    if (this.speechService) {
      this.speechService.stopRecognition();
    }
    this.isPracticeMode = false;
  }

  /**
   * 評估發音準確度
   * @param {string} targetText - 目標文本
   * @param {string} recognizedText - 辨識到的文本
   * @param {HTMLElement} button - 練習按鈕
   */
  _evaluatePronunciation(targetText, recognizedText, button) {
    const similarity = this._calculateSimilarity(targetText.toLowerCase(), recognizedText.toLowerCase());
    const accuracy = Math.round(similarity * 100);
    
    let message, level;
    
    if (accuracy >= 90) {
      message = `🎉 發音優秀！準確度：${accuracy}%`;
      level = 'success';
    } else if (accuracy >= 75) {
      message = `👍 發音良好！準確度：${accuracy}%`;
      level = 'success';
    } else if (accuracy >= 60) {
      message = `📝 發音不錯，可以再練習。準確度：${accuracy}%`;
      level = 'warning';
    } else {
      message = `💪 繼續練習，您會越來越好！準確度：${accuracy}%`;
      level = 'warning';
    }
    
    // 顯示詳細回饋
    this._showPronunciationFeedback(targetText, recognizedText, accuracy, button);
    
    // 顯示簡短通知
    this._showNotification(message, level);
  }

  /**
   * 顯示發音回饋詳情
   * @param {string} targetText - 目標文本
   * @param {string} recognizedText - 辨識到的文本
   * @param {number} accuracy - 準確度
   * @param {HTMLElement} button - 練習按鈕
   */
  _showPronunciationFeedback(targetText, recognizedText, accuracy, button) {
    // 移除現有回饋
    const existingFeedback = document.getElementById('pronunciation-feedback');
    if (existingFeedback) {
      existingFeedback.remove();
    }
    
    const feedbackDiv = document.createElement('div');
    feedbackDiv.id = 'pronunciation-feedback';
    feedbackDiv.className = 'pronunciation-feedback';
    
    const accuracyClass = accuracy >= 75 ? 'good' : accuracy >= 60 ? 'fair' : 'needs-improvement';
    
    feedbackDiv.innerHTML = `
      <div class="feedback-content ${accuracyClass}">
        <div class="feedback-header">
          <span class="feedback-icon">${accuracy >= 75 ? '🎯' : '📝'}</span>
          <span class="feedback-title">發音評估結果</span>
          <button class="feedback-close">✖</button>
        </div>
        <div class="feedback-body">
          <div class="feedback-accuracy">
            <span>準確度：</span>
            <span class="accuracy-score">${accuracy}%</span>
          </div>
          <div class="feedback-comparison">
            <div class="target-text">
              <label>目標句子：</label>
              <span>"${targetText}"</span>
            </div>
            <div class="recognized-text">
              <label>您的發音辨識為：</label>
              <span>"${recognizedText}"</span>
            </div>
          </div>
          <div class="feedback-actions">
            <button class="retry-practice-btn">再練習一次</button>
            <button class="play-target-btn">播放標準發音</button>
          </div>
        </div>
      </div>
    `;
    
    // 插入到按鈕附近，而不是訊息的最底部
    // 找到最接近的文字節點或按鈕容器
    const targetPosition = this._findOptimalFeedbackPosition(button);
    if (targetPosition) {
      targetPosition.insertAdjacentElement('afterend', feedbackDiv);
    } else {
      // 降級方案：插入到訊息元素中
      const messageElement = button.closest('.message-wrapper');
      if (messageElement) {
        messageElement.appendChild(feedbackDiv);
      }
    }
    
    // 添加事件監聽器
    const closeBtn = feedbackDiv.querySelector('.feedback-close');
    const retryBtn = feedbackDiv.querySelector('.retry-practice-btn');
    const playBtn = feedbackDiv.querySelector('.play-target-btn');
    
    closeBtn?.addEventListener('click', () => {
      feedbackDiv.remove();
    });
    
    retryBtn?.addEventListener('click', () => {
      feedbackDiv.remove();
      this._handleSpeechPractice(button, targetText);
    });
    
    playBtn?.addEventListener('click', async () => {
      const playButton = button.parentElement.querySelector('.speech-button:not(.practice-button)');
      if (playButton) {
        await this._handleSpeechPlayback(playButton, targetText);
      }
    });
    
    // 不再自動隱藏，讓用戶手動關閉
  }

  /**
   * 計算兩個字符串的相似度（使用編輯距離算法）
   * @param {string} str1 - 第一個字符串
   * @param {string} str2 - 第二個字符串
   * @returns {number} 相似度 (0-1)
   */
  _calculateSimilarity(str1, str2) {
    // 預處理：移除標點符號，統一空格
    const clean1 = str1.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
    const clean2 = str2.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
    
    if (clean1 === clean2) return 1.0;
    if (clean1.length === 0 && clean2.length === 0) return 1.0;
    if (clean1.length === 0 || clean2.length === 0) return 0.0;
    
    // 使用 Levenshtein 距離算法
    const matrix = [];
    const len1 = clean1.length;
    const len2 = clean2.length;
    
    // 初始化矩陣
    for (let i = 0; i <= len2; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len1; j++) {
      matrix[0][j] = j;
    }
    
    // 填充矩陣
    for (let i = 1; i <= len2; i++) {
      for (let j = 1; j <= len1; j++) {
        if (clean2.charAt(i - 1) === clean1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // 替換
            matrix[i][j - 1] + 1,     // 插入
            matrix[i - 1][j] + 1      // 刪除
          );
        }
      }
    }
    
    const distance = matrix[len2][len1];
    const maxLength = Math.max(len1, len2);
    
    return maxLength === 0 ? 1.0 : (maxLength - distance) / maxLength;
  }

  /**
   * 找到回饋訊息的最佳插入位置
   * @param {HTMLElement} button - 練習按鈕
   * @returns {HTMLElement|null} 最佳插入位置
   */
  _findOptimalFeedbackPosition(button) {
    try {
      // 方法1：找到包含練習按鈕的最近段落或句子
      let currentElement = button.parentElement;
      
      // 向上查找，直到找到包含文字內容的段落級元素
      while (currentElement && !currentElement.classList.contains('message-content')) {
        if (currentElement.tagName === 'P' || 
            currentElement.tagName === 'DIV' || 
            currentElement.tagName === 'SPAN') {
          // 檢查是否包含足夠的文字內容
          const textContent = currentElement.textContent || '';
          if (textContent.trim().length > 10) {
            return currentElement;
          }
        }
        currentElement = currentElement.parentElement;
      }
      
      // 方法2：如果找不到合適的段落，找到按鈕的直接父容器
      let buttonContainer = button.parentElement;
      
      // 查找包含該練習按鈕的文字節點
      const walker = document.createTreeWalker(
        buttonContainer,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );
      
      let textNode;
      
      // 遍歷文字節點，找到練習按鈕附近的文字
      while ((textNode = walker.nextNode())) {
        const nextSibling = textNode.nextSibling;
        
        // 檢查這個文字節點後面是否跟著我們的按鈕
        if (nextSibling && 
            (nextSibling === button || 
             (nextSibling.contains && nextSibling.contains(button)))) {
          // 找到了包含目標文字的節點
          return textNode.parentElement || textNode;
        }
        
        // 或者檢查前一個兄弟節點
        const prevSibling = textNode.previousSibling;
        if (prevSibling && 
            (prevSibling === button || 
             (prevSibling.contains && prevSibling.contains(button)))) {
          return textNode.parentElement || textNode;
        }
      }
      
      // 方法3：降級方案 - 返回按鈕的父元素
      return button.parentElement;
      
    } catch (error) {
      console.error('Error finding optimal feedback position:', error);
      return null;
    }
  }

  /**
   * 在Modal中評估發音準確度
   * @param {string} targetText - 目標文本
   * @param {string} recognizedText - 辨識到的文本
   */
  _evaluatePronunciationInModal(targetText, recognizedText) {
    const similarity = this._calculateSimilarity(targetText.toLowerCase(), recognizedText.toLowerCase());
    const accuracy = Math.round(similarity * 100);
    
    let message, level, icon;
    
    if (accuracy >= 90) {
      message = '發音優秀！';
      level = 'excellent';
      icon = '🎉';
    } else if (accuracy >= 75) {
      message = '發音良好！';
      level = 'good';
      icon = '👍';
    } else if (accuracy >= 60) {
      message = '發音不錯，可以再練習';
      level = 'fair';
      icon = '📝';
    } else {
      message = '繼續練習，您會越來越好！';
      level = 'needs-improvement';
      icon = '💪';
    }
    
    // 在modal中顯示回饋
    this._showFeedbackInModal(targetText, recognizedText, accuracy, message, level, icon);
    
    // 顯示簡短通知
    this._showNotification(`${icon} ${message} 準確度：${accuracy}%`, level === 'excellent' || level === 'good' ? 'success' : 'warning');
  }

  /**
   * 在Modal中顯示發音回饋
   * @param {string} targetText - 目標文本
   * @param {string} recognizedText - 辨識到的文本
   * @param {number} accuracy - 準確度
   * @param {string} message - 評價訊息
   * @param {string} level - 評價等級
   * @param {string} icon - 圖標
   */
  _showFeedbackInModal(targetText, recognizedText, accuracy, message, level, icon) {
    const modal = document.getElementById('speech-practice-modal');
    if (!modal) return;
    
    // 隱藏狀態區域，顯示回饋區域
    const statusSection = modal.querySelector('.practice-status-section');
    const feedbackSection = modal.querySelector('.practice-feedback-section');
    
    if (statusSection) statusSection.style.display = 'none';
    if (feedbackSection) {
      feedbackSection.style.display = 'block';
      
      feedbackSection.innerHTML = `
        <div class="practice-feedback-content ${level}">
          <div class="feedback-result">
            <div class="feedback-icon-large">${icon}</div>
            <div class="feedback-message">${message}</div>
            <div class="feedback-accuracy">準確度：<span class="accuracy-score">${accuracy}%</span></div>
          </div>
          
          <div class="feedback-comparison">
            <div class="comparison-item target">
              <label>目標句子：</label>
              <div class="sentence">"${targetText}"</div>
            </div>
            <div class="comparison-item recognized">
              <label>辨識結果：</label>
              <div class="sentence">"${recognizedText}"</div>
            </div>
          </div>
          
          <div class="feedback-actions">
            <button class="action-btn retry-btn">再練習一次</button>
            <button class="action-btn listen-btn">聽標準發音</button>
            <button class="action-btn close-btn">完成練習</button>
          </div>
        </div>
      `;
      
      // 添加按鈕事件監聽器
      const retryBtn = feedbackSection.querySelector('.retry-btn');
      const listenBtn = feedbackSection.querySelector('.listen-btn');
      const closeBtn = feedbackSection.querySelector('.close-btn');
      
      retryBtn?.addEventListener('click', () => {
        this._retryPracticeInModal();
      });
      
      listenBtn?.addEventListener('click', () => {
        this._playTargetTextInModal(targetText);
      });
      
      closeBtn?.addEventListener('click', () => {
        this._hidePracticeModal();
      });
    }
  }

  /**
   * 在Modal中重新開始練習
   */
  _retryPracticeInModal() {
    const modal = document.getElementById('speech-practice-modal');
    if (!modal) return;
    
    const targetText = modal.dataset.targetText;
    if (!targetText) return;
    
    // 重新顯示狀態區域，隱藏回饋區域
    const statusSection = modal.querySelector('.practice-status-section');
    const feedbackSection = modal.querySelector('.practice-feedback-section');
    
    if (statusSection) statusSection.style.display = 'flex';
    if (feedbackSection) feedbackSection.style.display = 'none';
    
    // 重新開始語音辨識
    this._restartSpeechRecognitionInModal(targetText);
  }

  /**
   * 在Modal中重新開始語音辨識
   * @param {string} targetText - 目標文本
   */
  async _restartSpeechRecognitionInModal(targetText) {
    try {
      // 設定練習模式和語言
      this.isPracticeMode = true;
      this.speechService.setRecognitionLanguage('en-US');
      
      // 設定事件監聽器（重複之前的邏輯）
      const handlePracticeResult = (event) => {
        const { transcript, isFinal } = event.detail;
        
        if (isFinal) {
          window.removeEventListener('recognition-result', handlePracticeResult);
          this._evaluatePronunciationInModal(targetText, transcript);
        }
      };
      
      const handlePracticeError = (event) => {
        window.removeEventListener('recognition-result', handlePracticeResult);
        window.removeEventListener('recognition-error', handlePracticeError);
        this.isPracticeMode = false;
        
        const { error } = event.detail;
        let errorMessage = '語音辨識發生錯誤';
        
        switch (error) {
          case 'no-speech':
            errorMessage = '沒有檢測到語音，請重試';
            break;
          case 'not-allowed':
            errorMessage = '需要麥克風權限才能使用語音練習功能';
            break;
          default:
            errorMessage = `語音辨識錯誤: ${error}`;
        }
        
        this._showNotification(errorMessage, 'error');
      };
      
      window.addEventListener('recognition-result', handlePracticeResult);
      window.addEventListener('recognition-error', handlePracticeError);
      
      // 開始語音辨識
      await this.speechService.startRecognition();
      
    } catch (error) {
      console.error('Failed to restart speech recognition:', error);
      this.isPracticeMode = false;
      this._showNotification('重新開始練習失敗：' + error.message, 'error');
    }
  }

  /**
   * 在Modal中播放目標文字
   * @param {string} targetText - 目標文本
   */
  async _playTargetTextInModal(targetText) {
    try {
      await this.speechService.speak(targetText, 'english');
    } catch (error) {
      console.error('Failed to play target text:', error);
      this._showNotification('播放標準發音失敗：' + error.message, 'error');
    }
  }

  /**
   * 在Modal中顯示沒有檢測到語音的回饋
   * @param {string} targetText - 目標文本
   */
  _showNoSpeechFeedbackInModal(targetText) {
    const modal = document.getElementById('speech-practice-modal');
    if (!modal) return;
    
    // 隱藏狀態區域，顯示回饋區域
    const statusSection = modal.querySelector('.practice-status-section');
    const feedbackSection = modal.querySelector('.practice-feedback-section');
    
    if (statusSection) statusSection.style.display = 'none';
    if (feedbackSection) {
      feedbackSection.style.display = 'block';
      
      feedbackSection.innerHTML = `
        <div class="practice-feedback-content no-speech">
          <div class="feedback-result">
            <div class="feedback-icon-large">🤔</div>
            <div class="feedback-message">沒有檢測到清楚的語音</div>
            <div class="feedback-subtitle">請確保麥克風正常工作，並嘗試大聲清楚地朗讀</div>
          </div>
          
          <div class="feedback-comparison">
            <div class="comparison-item target">
              <label>目標句子：</label>
              <div class="sentence">"${targetText}"</div>
            </div>
            <div class="comparison-item tip">
              <label>練習小貼士：</label>
              <div class="tip-content">
                • 請靠近麥克風說話<br>
                • 說話要清楚且有適當音量<br>
                • 確保環境安靜<br>
                • 可以先聽一遍標準發音
              </div>
            </div>
          </div>
          
          <div class="feedback-actions">
            <button class="action-btn retry-btn">再試一次</button>
            <button class="action-btn listen-btn">聽標準發音</button>
            <button class="action-btn close-btn">結束練習</button>
          </div>
        </div>
      `;
      
      // 添加按鈕事件監聽器
      const retryBtn = feedbackSection.querySelector('.retry-btn');
      const listenBtn = feedbackSection.querySelector('.listen-btn');
      const closeBtn = feedbackSection.querySelector('.close-btn');
      
      retryBtn?.addEventListener('click', () => {
        this._retryPracticeInModal();
      });
      
      listenBtn?.addEventListener('click', () => {
        this._playTargetTextInModal(targetText);
      });
      
      closeBtn?.addEventListener('click', () => {
        this._hidePracticeModal();
      });
    }
  }

  /**
   * 設定匯出功能事件監聽器
   */
  _setupExportEvents() {
    // 側欄快速匯出按鈕
    this.elements.exportCurrentSessionBtn?.addEventListener('click', () => {
      this._handleExportCurrentSession();
    });

    this.elements.exportAllSessionsBtn?.addEventListener('click', () => {
      this._handleExportAllSessions();
    });

    // 設定中的匯出按鈕
    this.elements.exportSettingsBtn?.addEventListener('click', () => {
      this._showExportModal();
    });

    // 移除統計按鈕事件監聽器（已合併到匯出對話功能中）

    // 匯出模態框內的事件
    this._setupExportModalEvents();
  }

  /**
   * 設定匯出模態框內的事件監聽器
   */
  _setupExportModalEvents() {
    // 匯出範圍選擇變化
    document.querySelectorAll('input[name="export-scope"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this._handleExportScopeChange(e.target.value);
      });
    });

    // 篩選條件套用
    const applyFilterBtn = document.getElementById('apply-filter');
    applyFilterBtn?.addEventListener('click', () => {
      this._applyExportFilter();
    });

    // 預覽生成
    const generatePreviewBtn = document.getElementById('generate-preview');
    generatePreviewBtn?.addEventListener('click', () => {
      this._generateExportPreview();
    });

    // 複製預覽內容
    const copyPreviewBtn = document.getElementById('copy-preview');
    copyPreviewBtn?.addEventListener('click', () => {
      this._copyPreviewContent();
    });

    // 下載檔案
    const downloadExportBtn = document.getElementById('download-export');
    downloadExportBtn?.addEventListener('click', () => {
      this._downloadExportFile();
    });
  }

  /**
   * 處理當前會話匯出
   */
  async _handleExportCurrentSession() {
    try {
      const currentSession = sessionManager.getCurrentSession();
      if (!currentSession) {
        this._showNotification('沒有可匯出的會話', 'warning');
        return;
      }

      const result = await exportService.exportAndDownloadSession(currentSession.id, 'json');
      this._showNotification(`已匯出會話：${result.fileName}`, 'success');
    } catch (error) {
      console.error('Export current session failed:', error);
      this._showNotification('匯出失敗：' + error.message, 'error');
    }
  }

  /**
   * 處理所有會話匯出
   */
  async _handleExportAllSessions() {
    try {
      const result = await exportService.exportAndDownloadAllSessions('json');
      this._showNotification(`已匯出 ${result.totalSessions} 個會話：${result.fileName}`, 'success');
    } catch (error) {
      console.error('Export all sessions failed:', error);
      this._showNotification('匯出失敗：' + error.message, 'error');
    }
  }

  /**
   * 顯示匯出模態框
   */
  async _showExportModal() {
    try {
      // 重置模態框狀態
      this._resetExportModalState();
      
      // 載入統計資訊
      await this._loadExportStatistics();
      
      // 載入會話列表
      this._loadSessionsForExport();
      
      // 載入可用格式
      this._loadExportFormats();
      
      // 載入角色選項
      this._loadRoleOptionsForFilter();
      
      // 顯示模態框
      this.elements.exportModal?.classList.remove('hidden');
      
    } catch (error) {
      console.error('Failed to show export modal:', error);
      this._showNotification('無法開啟匯出功能', 'error');
    }
  }

  // 移除 _showExportStatsOnly 方法（已合併到匯出對話功能中）

  /**
   * 顯示所有匯出選項
   */
  _showAllExportOptions() {
    const exportOptions = document.querySelector('.export-options');
    if (exportOptions) {
      exportOptions.style.display = 'block';
    }
    
    // 確保所有子元素也被顯示
    const exportTypeSelection = document.querySelector('.export-type-selection');
    const sessionSelection = document.querySelector('.session-selection');
    const filterOptions = document.querySelector('.filter-options');
    const formatSelection = document.querySelector('.format-selection');
    const exportPreview = document.querySelector('.export-preview');
    
    [exportTypeSelection, sessionSelection, filterOptions, formatSelection, exportPreview].forEach(element => {
      if (element) {
        element.style.display = 'block';
      }
    });
  }

  // 移除 _hideAllExportOptions 方法（不再需要隱藏選項）

  /**
   * 更新匯出模態框標題
   */
  _updateExportModalTitle(title) {
    const modalTitle = document.querySelector('#export-modal .modal-header h3');
    if (modalTitle) {
      modalTitle.textContent = title;
    }
  }

  /**
   * 重置匯出模態框狀態
   */
  _resetExportModalState() {
    // 恢復默認標題
    this._updateExportModalTitle('📤 匯出對話');
    
    // 顯示所有匯出選項
    this._showAllExportOptions();
    
    // 重置表單
    this._resetExportForm();
  }

  /**
   * 載入匯出統計資訊
   */
  async _loadExportStatistics() {
    try {
      const stats = await exportService.getExportStatistics();
      console.log('Loading export statistics to UI:', stats); // 調試信息
      
      const totalSessionsSpan = document.getElementById('total-sessions');
      const totalMessagesSpan = document.getElementById('total-messages');
      const estimatedCharsSpan = document.getElementById('estimated-chars');
      
      console.log('Found UI elements:', {
        totalSessionsSpan,
        totalMessagesSpan,
        estimatedCharsSpan
      }); // 調試信息
      
      if (totalSessionsSpan) {
        totalSessionsSpan.textContent = stats.totalSessions.toLocaleString();
        console.log('Updated totalSessions:', stats.totalSessions);
      } else {
        console.error('Element #total-sessions not found');
      }
      
      if (totalMessagesSpan) {
        totalMessagesSpan.textContent = stats.totalMessages.toLocaleString();
        console.log('Updated totalMessages:', stats.totalMessages);
      } else {
        console.error('Element #total-messages not found');
      }
      
      if (estimatedCharsSpan) {
        estimatedCharsSpan.textContent = this._formatNumber(stats.estimatedCharacters);
        console.log('Updated estimatedChars:', stats.estimatedCharacters);
      } else {
        console.error('Element #estimated-chars not found');
      }
      
    } catch (error) {
      console.error('Failed to load export statistics:', error);
    }
  }

  /**
   * 載入會話列表供選擇
   */
  _loadSessionsForExport() {
    const sessions = sessionManager.getSessionsList();
    
    const sessionCheckboxes = document.getElementById('session-checkboxes');
    if (sessionCheckboxes) {
      sessionCheckboxes.innerHTML = '';
      
      sessions.forEach(session => {
        const item = document.createElement('div');
        item.className = 'session-checkbox-item';
        
        item.innerHTML = `
          <input type="checkbox" value="${session.id}" id="session-${session.id}">
          <label for="session-${session.id}" class="session-checkbox-label">
            ${this._escapeHtml(session.title)}
          </label>
          <span class="session-checkbox-meta">
            ${this._formatDate(session.createdAt)} | ${session.messageCount || 0} 則訊息
          </span>
        `;
        
        sessionCheckboxes.appendChild(item);
      });
    }
  }

  /**
   * 載入匯出格式選項
   */
  _loadExportFormats() {
    const formats = exportService.getAvailableFormats();
    
    const formatGrid = document.getElementById('format-grid');
    if (formatGrid) {
      formatGrid.innerHTML = '';
      
      formats.forEach(format => {
        const option = document.createElement('div');
        option.className = 'format-option';
        option.dataset.format = format.id;
        
        // 格式圖示
        const formatIcons = {
          json: '📋',
          txt: '📄',
          md: '📝',
          html: '🌐'
        };
        
        option.innerHTML = `
          <div class="format-icon">${formatIcons[format.id] || '📄'}</div>
          <div class="format-name">${format.name}</div>
          <div class="format-description">${format.description}</div>
        `;
        
        option.addEventListener('click', () => {
          // 移除其他選中狀態
          formatGrid.querySelectorAll('.format-option').forEach(opt => {
            opt.classList.remove('selected');
          });
          
          // 選中當前格式
          option.classList.add('selected');
          
          // 啟用預覽按鈕
          const generatePreviewBtn = document.getElementById('generate-preview');
          if (generatePreviewBtn) {
            generatePreviewBtn.disabled = false;
          }
        });
        
        formatGrid.appendChild(option);
      });
      
      // 預設選中 JSON 格式
      const jsonOption = formatGrid.querySelector('[data-format="json"]');
      if (jsonOption) {
        jsonOption.click();
      }
    }
  }

  /**
   * 載入角色選項供篩選使用
   */
  _loadRoleOptionsForFilter() {
    const sessions = sessionManager.getSessionsList();
    const roles = new Set();
    
    sessions.forEach(session => {
      // 確保 session 和 session.metadata 存在，然後檢查 roleName
      if (session && session.metadata && session.metadata.roleName) {
        roles.add(session.metadata.roleName);
      }
    });
    
    const filterRoleSelect = document.getElementById('filter-role');
    if (filterRoleSelect) {
      // 清空現有選項（保留第一個"全部角色"選項）
      while (filterRoleSelect.children.length > 1) {
        filterRoleSelect.removeChild(filterRoleSelect.lastChild);
      }
      
      // 添加角色選項
      Array.from(roles).sort().forEach(roleName => {
        const option = document.createElement('option');
        option.value = roleName;
        option.textContent = roleName;
        filterRoleSelect.appendChild(option);
      });
    }
  }

  /**
   * 處理匯出範圍變化
   */
  _handleExportScopeChange(scope) {
    // 隱藏所有選項區域
    const sessionSelection = document.getElementById('session-selection');
    const filterOptions = document.getElementById('filter-options');
    
    if (sessionSelection) {
      sessionSelection.style.display = 'none';
    }
    if (filterOptions) {
      filterOptions.style.display = 'none';
    }
    
    // 根據選擇顯示對應區域
    switch (scope) {
      case 'selected':
        if (sessionSelection) {
          sessionSelection.style.display = 'block';
        }
        break;
      case 'filtered':
        if (filterOptions) {
          filterOptions.style.display = 'block';
        }
        break;
    }
  }

  /**
   * 套用匯出篩選條件
   */
  _applyExportFilter() {
    const criteria = {
      dateFrom: document.getElementById('filter-date-from')?.value || null,
      dateTo: document.getElementById('filter-date-to')?.value || null,
      roleName: document.getElementById('filter-role')?.value || null,
      minMessages: parseInt(document.getElementById('filter-min-messages')?.value) || null,
      maxMessages: parseInt(document.getElementById('filter-max-messages')?.value) || null,
      titleKeyword: document.getElementById('filter-keyword')?.value?.trim() || null
    };
    
    const result = exportService.selectSessionsByCriteria(criteria);
    
    this._showNotification(`篩選結果：找到 ${result.totalCount} 個符合條件的會話`, 'info');
  }

  /**
   * 格式化數字（添加千分位分隔符）
   */
  _formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toLocaleString();
  }

  /**
   * 重置匯出表單
   */
  _resetExportForm() {
    // 重置匯出範圍選擇
    const currentRadio = document.querySelector('input[name="export-scope"][value="current"]');
    if (currentRadio) {
      currentRadio.checked = true;
      this._handleExportScopeChange('current');
    }

    // 重置篩選表單
    const filterForm = document.getElementById('export-filter-form');
    if (filterForm) {
      filterForm.reset();
    }

    // 清空預覽區域
    const exportPreview = document.getElementById('preview-content');
    if (exportPreview) {
      exportPreview.innerHTML = '';
    }

    // 禁用預覽和下載按鈕
    const generatePreviewBtn = document.getElementById('generate-preview');
    const downloadExportBtn = document.getElementById('download-export');
    const copyPreviewBtn = document.getElementById('copy-preview');
    if (generatePreviewBtn) {
      generatePreviewBtn.disabled = false;
    }
    if (downloadExportBtn) {
      downloadExportBtn.disabled = true;
    }
    if (copyPreviewBtn) {
      copyPreviewBtn.disabled = true;
    }
  }

  /**
   * 生成匯出預覽
   */
  async _generateExportPreview() {
    try {
      const selectedFormat = document.querySelector('.format-option.selected')?.dataset.format;
      if (!selectedFormat) {
        this._showNotification('請選擇匯出格式', 'warning');
        return;
      }

      const exportScope = document.querySelector('input[name="export-scope"]:checked')?.value;
      let preview = '';

      switch (exportScope) {
        case 'current':
          const currentSession = sessionManager.getCurrentSession();
          if (currentSession) {
            const previewResult = await exportService.getExportPreview(currentSession.id, selectedFormat);
            preview = previewResult.content;
          }
          break;
        
        case 'selected':
          const selectedIds = Array.from(document.querySelectorAll('#session-checkboxes input:checked'))
            .map(cb => cb.value);
          if (selectedIds.length === 0) {
            this._showNotification('請選擇要匯出的會話', 'warning');
            return;
          }
          // 對於多個會話，顯示第一個會話的預覽
          const previewResult = await exportService.getExportPreview(selectedIds[0], selectedFormat);
          preview = previewResult.content;
          if (selectedIds.length > 1) {
            preview = `[預覽第一個會話，共選擇 ${selectedIds.length} 個會話]\n\n` + preview;
          }
          break;
        
        case 'all':
          const allSessions = sessionManager.getSessionsList();
          if (allSessions.length > 0) {
            const allPreviewResult = await exportService.getExportPreview(allSessions[0].id, selectedFormat);
            preview = `[預覽第一個會話，共 ${allSessions.length} 個會話]\n\n` + allPreviewResult.content;
          }
          break;
        
        case 'filtered':
          // 這裡需要根據篩選條件獲取會話
          this._showNotification('篩選預覽功能開發中', 'info');
          return;
      }

      const exportPreview = document.getElementById('preview-content');
      if (exportPreview) {
        exportPreview.innerHTML = `<pre>${this._escapeHtml(preview)}</pre>`;
      }

      // 啟用下載按鈕
      const downloadExportBtn = document.getElementById('download-export');
      const copyPreviewBtn = document.getElementById('copy-preview');
      if (downloadExportBtn) {
        downloadExportBtn.disabled = false;
      }
      if (copyPreviewBtn) {
        copyPreviewBtn.disabled = false;
      }

    } catch (error) {
      console.error('Failed to generate preview:', error);
      this._showNotification('預覽生成失敗：' + error.message, 'error');
    }
  }

  /**
   * 複製預覽內容到剪貼簿
   */
  async _copyPreviewContent() {
    const exportPreview = document.getElementById('preview-content');
    const previewText = exportPreview?.textContent;
    if (!previewText) {
      this._showNotification('沒有可複製的內容', 'warning');
      return;
    }

    try {
      const success = await exportService.copyToClipboard(previewText);
      if (success) {
        this._showNotification('內容已複製到剪貼簿', 'success');
      } else {
        this._showNotification('複製失敗', 'error');
      }
    } catch (error) {
      console.error('Copy failed:', error);
      this._showNotification('複製失敗：' + error.message, 'error');
    }
  }

  /**
   * 下載匯出檔案
   */
  async _downloadExportFile() {
    try {
      const selectedFormat = document.querySelector('.format-option.selected')?.dataset.format;
      if (!selectedFormat) {
        this._showNotification('請選擇匯出格式', 'warning');
        return;
      }

      const exportScope = document.querySelector('input[name="export-scope"]:checked')?.value;
      let result;

      this._showLoading('正在準備匯出檔案...');

      switch (exportScope) {
        case 'current':
          const currentSession = sessionManager.getCurrentSession();
          if (currentSession) {
            result = await exportService.exportAndDownloadSession(currentSession.id, selectedFormat);
            this._showNotification(`已匯出會話：${result.fileName}`, 'success');
          } else {
            this._showNotification('沒有可匯出的當前會話', 'warning');
          }
          break;
        
        case 'selected':
          const selectedIds = Array.from(document.querySelectorAll('#session-checkboxes input:checked'))
            .map(cb => cb.value);
          if (selectedIds.length === 0) {
            this._showNotification('請選擇要匯出的會話', 'warning');
            break;
          }
          result = await exportService.exportAndDownloadMultipleSessions(selectedIds, selectedFormat);
          this._showNotification(`已匯出 ${selectedIds.length} 個會話：${result.fileName}`, 'success');
          break;
        
        case 'all':
          result = await exportService.exportAndDownloadAllSessions(selectedFormat);
          this._showNotification(`已匯出所有會話：${result.fileName}`, 'success');
          break;
        
        case 'filtered':
          this._showNotification('篩選匯出功能開發中', 'info');
          break;
      }

      // 關閉模態框
      this._hideModal('export-modal');

    } catch (error) {
      console.error('Download failed:', error);
      this._showNotification('下載失敗：' + error.message, 'error');
    } finally {
      this._hideLoading();
    }
  }
}

// 創建全域應用實例
const app = new AIInstructorApp();

// 當DOM載入完成時初始化應用
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});

// 匯出給全域使用
window.AIInstructorApp = app;

export default app; 