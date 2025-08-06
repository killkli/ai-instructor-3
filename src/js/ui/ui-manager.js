/**
 * UI 管理器
 * 負責處理所有UI相關的操作，包括元素初始化、事件監聽、模態框、通知等
 */

import contentRenderer from '../services/content-renderer.js';

class UIManager {
  constructor(app) {
    this.app = app;
    this.elements = {};
    this.initialized = false;
  }

  /**
   * 初始化UI元素
   */
  async init() {
    await this._initializeElements();
    this._setupBasicEventListeners();
    this.initialized = true;
    console.log('🎨 UIManager initialized');
  }

  /**
   * 初始化UI元素
   */
  async _initializeElements() {
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

      // 練習題按鈕
      practiceButton: document.getElementById('practice-btn'),

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
      achievementsButton: document.getElementById('achievements-button'),
      modelInfo: document.getElementById('model-info'),

      // 模態框
      setupModal: document.getElementById('setup-modal'),
      settingsModal: document.getElementById('settings-modal'),
      achievementsModal: document.getElementById('achievements-modal'),
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
  }

  /**
   * 設定基礎事件監聽器
   */
  _setupBasicEventListeners() {
    // 成就按鈕
    this.elements.achievementsButton?.addEventListener('click', () => {
      this.app.modalManager.showAchievementsModal();
    });

    // 側邊欄切換
    this.elements.sidebarToggle?.addEventListener('click', () => {
      this.toggleSidebar();
    });

    // 側邊欄覆蓋層點擊關閉
    this.elements.sidebarOverlay?.addEventListener('click', () => {
      this.closeSidebar();
    });

    // ESC鍵關閉側邊欄
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.elements.sidebar?.classList.contains('open')) {
        this.closeSidebar();
      }
    });

    // 模態框關閉
    document.querySelectorAll('.modal-close').forEach(button => {
      button.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal');
        if (modal) {
          this.app.modalManager?.hideModal(modal.id);
        }
      });
    });

    // 響應式處理
    window.addEventListener('resize', () => this._handleResize());

    // 離開前保存
    window.addEventListener('beforeunload', () => this._handleBeforeUnload());
  }

  /**
   * 顯示通知
   */
  showNotification(message, type = 'info') {
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
  showError(title, message) {
    console.error(`${title}:`, message);
    this.showNotification(`${title}: ${message}`, 'error');
  }

  /**
   * 顯示載入指示器
   */
  showLoading(message = '載入中...') {
    if (this.elements.loadingIndicator) {
      this.elements.loadingIndicator.textContent = message;
      this.elements.loadingIndicator.style.display = 'block';
    }
  }

  /**
   * 隱藏載入指示器
   */
  hideLoading() {
    if (this.elements.loadingIndicator) {
      this.elements.loadingIndicator.style.display = 'none';
    }
  }

  /**
   * 顯示打字指示器
   */
  showTypingIndicator() {
    if (this.elements.typingIndicator) {
      this.elements.typingIndicator.style.display = 'block';
    }
  }

  /**
   * 隱藏打字指示器
   */
  hideTypingIndicator() {
    if (this.elements.typingIndicator) {
      this.elements.typingIndicator.style.display = 'none';
    }
  }

  /**
   * 切換側邊欄
   */
  toggleSidebar() {
    if (this.elements.sidebar) {
      const isOpen = this.elements.sidebar.classList.contains('open');

      console.log(isOpen)
      if (isOpen) {
        this.closeSidebar();
      } else {
        this.openSidebar();
      }
    }
  }

  /**
   * 打開側邊欄
   */
  openSidebar() {
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
  closeSidebar() {
    if (this.elements.sidebar) {
      this.elements.sidebar.classList.remove('open');
    }
    if (this.elements.sidebarOverlay) {
      this.elements.sidebarOverlay.classList.remove('active');
    }
  }

  /**
   * 顯示模態框
   */
  showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('hidden');
      modal.style.display = 'flex';
    }
  }

  /**
   * 顯示API金鑰設定模態框
   */
  showSetupModal() {
    if (this.elements.setupModal) {
      this.elements.setupModal.style.display = 'flex';
      this.elements.apiKeyInput?.focus();
    }
  }

  /**
   * 顯示設定模態框
   */
  async showSettingsModal() {
    if (this.elements.settingsModal) {
      // 載入當前設定到表單
      await this.app._loadSettingsToForm();

      // 移除 hidden 類別並顯示模態框
      this.elements.settingsModal.classList.remove('hidden');
      this.elements.settingsModal.style.display = 'flex';

      // 載入可用模型列表
      await this.app._loadAvailableModels();
    }
  }

  /**
   * 清空訊息
   */
  clearMessages() {
    if (this.elements.messagesContainer) {
      this.elements.messagesContainer.innerHTML = '';
    }
  }

  /**
   * 滾動到底部
   */
  scrollToBottom() {
    if (this.elements.messagesContainer) {
      this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight;
    }
  }

  /**
   * 更新發送按鈕狀態
   */
  updateSendButtonState(enabled) {
    if (this.elements.sendButton) {
      this.elements.sendButton.disabled = !enabled;
    }
  }

  /**
   * 更新模型信息顯示
   */
  updateModelInfo(modelName) {
    if (this.elements.modelInfo) {
      this.elements.modelInfo.innerHTML = `<small>模型：${modelName}</small>`;
    }
  }

  /**
   * 顯示圖片燈箱
   */
  showImageLightbox(imageSrc) {
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
   * 更新圖片預覽
   */
  updateImagePreview(uploadedImages) {
    if (!this.elements.imagePreview) return;

    if (uploadedImages.length === 0) {
      this.elements.imagePreview.style.display = 'none';
      return;
    }

    this.elements.imagePreview.style.display = 'block';
    this.elements.imagePreview.innerHTML = '';

    uploadedImages.forEach((image, index) => {
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
        if (this.app._removeUploadedImage) {
          this.app._removeUploadedImage(index);
        }
      });

      previewItem.appendChild(thumbnail);
      previewItem.appendChild(infoDiv);
      previewItem.appendChild(removeBtn);

      this.elements.imagePreview.appendChild(previewItem);
    });
  }

  /**
   * 處理視窗大小變化
   */
  _handleResize() {
    // 響應式處理邏輯
    this.scrollToBottom();
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
   * HTML 轉義
   */
  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
   * 獲取UI元素
   */
  getElement(elementName) {
    return this.elements[elementName];
  }

  /**
   * 獲取所有UI元素
   */
  getAllElements() {
    return this.elements;
  }
}

export default UIManager; 