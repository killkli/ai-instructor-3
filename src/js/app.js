/**
 * AI 教學助理主應用程式
 * 整合所有服務和UI組件
 */

import promptManager from './config/prompt-manager.js';
import ExportManager from './managers/export-manager.js';
import ImageManager from './managers/image-manager.js';
import MessageProcessingManager from './managers/message-processing-manager.js';
import ModalManager from './managers/modal-manager.js';
import NotificationManager from './managers/notification-manager.js';
import PWAManager from './managers/pwa-manager.js';
import RoleSelectionManager from './managers/role-selection-manager.js';
import SessionUIManager from './managers/session-ui-manager.js';
import SettingsManager from './managers/settings-manager.js';
import SpeechManager from './managers/speech-manager.js';
import contentRenderer from './services/content-renderer.js';
import exportService from './services/export-service.js';
import geminiService from './services/gemini-service.js';
import PracticeIntegration from './services/practice-integration.js';
import promptProcessor from './services/prompt-processor.js';
import QuestionBankService from './services/question-bank-service.js';
import sessionManager from './services/session-manager.js';
import speechService from './services/speech-service.js';
import storageService from './services/storage-service.js';
import AchievementService from './services/achievement-service.js';
import { LearningTracker } from './services/learning-tracker.js';
import LearningVisualizationWrapper from './services/learning-visualization-wrapper.js'; // Import the wrapper
import appStateManager from './state/appStateManager.js';
import UIManager from './ui/ui-manager.js';

class AIInstructorApp {
  constructor() {
    this.initialized = false;
    this.currentSessionId = null;
    this.isProcessing = false;

    // UI 管理器
    this.uiManager = new UIManager(this);

    // 應用程式狀態由 appStateManager 管理
    this.appStateManager = appStateManager;

    this.contentRenderer = contentRenderer;
    // 語音管理器
    this.speechManager = null;
    // 語音服務實例（保留以便向後兼容）
    this.speechService = null;
    // 匯出管理器
    this.exportManager = null;
    // PWA管理器
    this.pwaManager = null;
    // 圖片管理器
    this.imageManager = null;
    // 模態框管理器
    this.modalManager = null;
    // 通知管理器
    this.notificationManager = null;
    // 設定管理器
    this.settingsManager = null;
    // 會話UI管理器
    this.sessionUIManager = null;
    // 角色選擇管理器
    this.roleSelectionManager = null;
    // 消息處理管理器
    this.messageProcessingManager = null;
    // 題庫服務實例
    this.questionBankService = null;
    this.practiceIntegration = null;
    // 學習追蹤器
    this.learningTracker = null;
    // 成就系統服務
    this.achievementService = null;
    // 學習視覺化包裝器
    this.learningVisualizationWrapper = null;
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
      await this._handleUrlParams();
      await this._showInitialInterface();

      this._setupEventListeners();
      console.log('✅ AI Instructor App initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize app:', error);
      // 如果通知管理器還未初始化，使用原始方法
      if (this.notificationManager) {
        this.notificationManager.showError('初始化失敗', error.message);
      } else {
        this._showError('初始化失敗', error.message);
      }
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
      await promptProcessor.init();
      await contentRenderer.init();

      // 初始化語音服務
      this.speechService = speechService;

      // 初始化語音管理器
      this.speechManager = new SpeechManager(this);
      await this.speechManager.init();

      // 初始化匯出服務
      exportService.init(sessionManager);

      // 初始化匯出管理器
      this.exportManager = new ExportManager(this);
      await this.exportManager.init();

      // 初始化PWA管理器
      this.pwaManager = new PWAManager(this);
      await this.pwaManager.init();

      // 初始化學習追蹤器
      this.learningTracker = new LearningTracker(storageService);

      // 初始化學習視覺化包裝器
      this.learningVisualizationWrapper = new LearningVisualizationWrapper();
      await this.learningVisualizationWrapper.init();

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

      // 初始化成就系統服務
      this.achievementService = new AchievementService(storageService, this.learningTracker);

      // 初始化練習整合功能（傳遞成就服務）
      this.practiceIntegration = new PracticeIntegration(this, this.questionBankService, storageService, this.achievementService);

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
    // 初始化UI管理器
    await this.uiManager.init();

    // 設定匯出管理器的事件監聽器（現在 UI 元素已經可用了）
    if (this.exportManager) {
      this.exportManager.setupEvents();
    }

    // 初始化圖片管理器（現在 UI 元素已經可用了）
    this.imageManager = new ImageManager(this);
    await this.imageManager.init();

    // 初始化模態框管理器（現在 UI 元素已經可用了）
    this.modalManager = new ModalManager(this);
    await this.modalManager.init();

    // 初始化通知管理器（現在 UI 元素已經可用了）
    this.notificationManager = new NotificationManager(this);
    await this.notificationManager.init();

    // 初始化設定管理器（現在其他管理器已經初始化了）
    this.settingsManager = new SettingsManager(this);
    await this.settingsManager.init();

    // 初始化會話UI管理器
    this.sessionUIManager = new SessionUIManager(this);
    await this.sessionUIManager.init();

    // 初始化角色選擇管理器
    this.roleSelectionManager = new RoleSelectionManager(this);
    await this.roleSelectionManager.init();

    // 初始化消息處理管理器
    this.messageProcessingManager = new MessageProcessingManager(this);
    await this.messageProcessingManager.init();

    console.log('🎨 UI elements initialized');
  }

  /**
   * 獲取UI元素的便利方法
   */
  get elements() {
    return this.uiManager.elements;
  }

  /**
   * 載入用戶設定
   */
  async _loadSettings() {
    await this.settingsManager.loadSettings();
  }

  /**
   * 設定事件監聽器
   */
  _setupEventListeners() {
    // 發送訊息
    this.elements.sendButton?.addEventListener('click', () => this.messageProcessingManager.handleSendMessage());
    this.elements.messageInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.messageProcessingManager.handleSendMessage();
      }
    });

    // 監聽輸入變化以更新發送按鈕狀態
    this.elements.messageInput?.addEventListener('input', () => {
      this._updateSendButtonState();
    });

    // 新聊天
    this.elements.newChatButton?.addEventListener('click', () => this._handleNewChat());

    // 角色選擇
    this.elements.roleSelectionCancel?.addEventListener('click', () => this.roleSelectionManager.hideRoleSelection());
    this.elements.roleSelectionConfirm?.addEventListener('click', () => this.roleSelectionManager.confirmRoleSelection());

    // 設定
    this.elements.settingsButton?.addEventListener('click', async () => {
      await this.settingsManager.showSettingsModal();
    });

    // 練習題功能
    this.elements.practiceButton?.addEventListener('click', () => {
      this.practiceIntegration.handlePracticeRequest();
    });

    // 語音功能
    this.elements.voiceInputChineseBtn?.addEventListener('click', () => {
      this.speechManager?.handleVoiceInput('zh-TW');
    });

    this.elements.voiceInputEnglishBtn?.addEventListener('click', () => {
      this.speechManager?.handleVoiceInput('en-US');
    });

    this.elements.voiceStopBtn?.addEventListener('click', () => {
      this.speechManager?.stopVoiceInput();
    });

    // API 金鑰更新
    this.elements.updateApiKeyButton?.addEventListener('click', () => {
      this.settingsManager.handleApiKeyUpdate();
    });

    // 分享功能
    this.elements.generateShareLinkButton?.addEventListener('click', () => {
      this.settingsManager.generateShareLink();
    });

    this.elements.copyShareLinkButton?.addEventListener('click', () => {
      this.settingsManager.copyShareLink();
    });

    // 溫度滑桿
    this.elements.temperatureSlider?.addEventListener('input', (e) => {
      if (this.elements.temperatureValue) {
        this.elements.temperatureValue.textContent = e.target.value;
      }
    });

    // 響應式處理
    window.addEventListener('resize', () => this._handleResize());

    // 離開前保存
    window.addEventListener('beforeunload', () => this._handleBeforeUnload());

    console.log('🎧 Event listeners set up');
  }

  /**
   * 處理URL參數
   */
  async _handleUrlParams() {
    const params = new URLSearchParams(window.location.search);

    // 處理會話ID
    const sessionId = params.get('session');
    if (sessionId) {
      this.sessionUIManager.loadSession(sessionId);
      return; // 如果有sessionId，直接載入會話
    }

    // 處理角色參數（PWA快捷方式）
    const roleId = params.get('role');
    if (roleId && promptManager.hasRole(roleId)) {
      // 延遲執行，確保所有服務都已初始化
      setTimeout(async () => {
        try {
          this.appStateManager.set('selectedRole', roleId); // 使用狀態管理器
          await this.roleSelectionManager.confirmRoleSelection();
        } catch (error) {
          console.error('Failed to auto-select role:', error);
          // 如果自動選擇失敗，顯示角色選擇界面
          await this.roleSelectionManager.showRoleSelection();
        }
      }, 500);
      return;
    }

    // 處理API金鑰
    const apiKey = params.get('key') || params.get('apikey') || params.get('api_key');
    if (apiKey) {
      console.log('從 URL 參數載入 API Key');
      this.appStateManager.set('apiKey', apiKey); // 使用狀態管理器
      await this.settingsManager.saveApiKey(apiKey);

      // 初始化 Gemini 服務
      try {
        geminiService.init(apiKey, this.appStateManager.get('currentModel')); // 使用狀態管理器
        this.notificationManager.showSuccess('API Key 已從 URL 載入');

        // 清除 URL 中的 API Key（安全考量）
        this.settingsManager.clearApiKeyFromUrl();
      } catch (error) {
        console.error('Failed to initialize Gemini service with URL API key:', error);
        this.notificationManager.showError('載入失敗', 'API Key 載入失敗');
      }
    }
  }

  /**
   * 顯示初始界面
   */
  async _showInitialInterface() {
    // 更完整的API Key檢查
    const hasValidApiKey = this.appStateManager.get('apiKey') && // 使用狀態管理器
      typeof this.appStateManager.get('apiKey') === 'string' &&
      this.appStateManager.get('apiKey').trim().length > 0;

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
      this.modalManager.showSetupModal();
    } else {
      // 隱藏設定模態框
      this.modalManager.hideModal('setup-modal');

      // 確保聊天界面可見
      if (this.elements.messagesContainer) {
        this.elements.messagesContainer.classList.remove('hidden');
      }
      if (this.elements.inputArea) {
        this.elements.inputArea.classList.remove('hidden');
      }

      await this.sessionUIManager.loadSessionsList();

      // 如果沒有當前會話，創建新會話
      const currentSession = sessionManager.getCurrentSession();
      if (!currentSession) {
        await this._handleNewChat();
      } else {
        this.sessionUIManager.loadSessionMessages(currentSession);
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
   * 處理新聊天
   */
  async _handleNewChat() {
    try {
      // 顯示角色選擇界面
      await this.roleSelectionManager.showRoleSelection();
    } catch (error) {
      this._showNotification(`創建新會話失敗: ${error.message}`, 'error');
    }
  }

  _updateSendButton(enabled) {
    if (this.elements.sendButton) {
      this.elements.sendButton.disabled = !enabled;
    }
  }

  /**
   * 顯示打字指示器
   */
  _showTypingIndicator() {
    this.uiManager.showTypingIndicator();
  }

  /**
   * 隱藏打字指示器
   */
  _hideTypingIndicator() {
    this.uiManager.hideTypingIndicator();
  }

  /**
   * 顯示載入指示器
   */
  _showLoading(message = '載入中...') {
    this.uiManager.showLoading(message);
  }

  /**
   * 隱藏載入指示器
   */
  _hideLoading() {
    this.uiManager.hideLoading();
  }

  /**
   * 顯示通知
   */
  _showNotification(message, type = 'info') {
    this.uiManager.showNotification(message, type);
  }

  /**
   * 顯示錯誤
   */
  _showError(title, message) {
    this.uiManager.showError(title, message);
  }

  /**
   * 切換側邊欄
   */
  _toggleSidebar() {
    this.uiManager.toggleSidebar();
  }

  /**
   * 打開側邊欄
   */
  _openSidebar() {
    this.uiManager.openSidebar();
  }

  /**
   * 關閉側邊欄
   */
  _closeSidebar() {
    this.uiManager.closeSidebar();
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
    this.uiManager.scrollToBottom();
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
   * 更新發送按鈕狀態
   */
  _updateSendButtonState() {
    const hasText = this.elements.messageInput?.value.trim();
    const hasImages = this.imageManager.hasUploadedImages();
    const canSend = (hasText || hasImages) && !this.isProcessing;

    if (this.elements.sendButton) {
      this.elements.sendButton.disabled = !canSend;
    }
  }

  /**
   * 更新模型信息顯示
   */
  _updateModelInfo() {
    if (this.elements.modelInfo) {
      const modelName = this.settingsManager.formatModelName(this.appStateManager.get('currentModel')); // 使用狀態管理器
      this.elements.modelInfo.innerHTML = `<small>模型：${modelName}</small>`;
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
