/**
 * PWA 管理器
 * 處理Progressive Web App相關功能
 */

class PWAManager {
  constructor(app) {
    this.app = app;
    this.initialized = false;
    this.deferredPrompt = null;
    this.isInstalled = false;
  }

  /**
   * 初始化 PWA 管理器
   */
  async init() {
    try {
      this._setupPWAEvents();
      this._checkInstallationStatus();
      this._handleShortcutParams();

      this.initialized = true;
      console.log('📱 PWA Manager initialized');
    } catch (error) {
      console.error('❌ PWA Manager initialization failed:', error);
      throw error;
    }
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
      this.app.appStateManager.set('deferredPrompt', e);
      this._showInstallButton();
    });

    // 監聽 appinstalled 事件
    window.addEventListener('appinstalled', () => {
      console.log('PWA was installed');
      this.isInstalled = true;
      this.app.appStateManager.set('isInstalled', true);
      this._hideInstallButton();
      this.app._showNotification('AI教學助理已成功安裝到您的設備！', 'success');
    });

    // 檢查是否已安裝
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
      this.isInstalled = true;
      this.app.appStateManager.set('isInstalled', true);
      console.log('PWA is running in standalone mode');
    }
  }

  /**
   * 檢查安裝狀態
   */
  _checkInstallationStatus() {
    // 檢查是否在獨立模式下運行
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
      this.isInstalled = true;
      return;
    }

    // 檢查是否為移動端Safari的添加到主屏幕
    if (window.navigator && window.navigator.standalone === true) {
      this.isInstalled = true;
      return;
    }

    // 其他檢查方法...
    this.isInstalled = false;
  }

  /**
   * 顯示安裝按鈕
   */
  _showInstallButton() {
    if (this.isInstalled) return;

    // 檢查按鈕是否已存在
    if (document.getElementById('pwa-install-button')) return;

    // 創建安裝按鈕
    const installButton = document.createElement('button');
    installButton.id = 'pwa-install-button';
    installButton.className = 'icon-button install-button';
    installButton.title = '安裝應用程式';
    installButton.innerHTML = '<span>📱</span>';

    // 添加到標題欄
    const headerActions = document.querySelector('.header-actions');
    if (headerActions) {
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

    // 檢查提示是否已存在
    if (document.getElementById('pwa-install-prompt')) return;

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

    if (installBtn) {
      installBtn.addEventListener('click', () => {
        this._handleInstallClick();
        this._hideInstallPrompt();
      });
    }

    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => {
        this._hideInstallPrompt();
        localStorage.setItem('pwa-install-prompt-shown', 'true');
      });
    }

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
        this.app._showNotification('正在安裝應用程式...', 'info');
      } else {
        console.log('User dismissed the install prompt');
      }

      // 清除 deferred prompt
      this.deferredPrompt = null;
      this.app.appStateManager.set('deferredPrompt', null);
      this._hideInstallButton();

    } catch (error) {
      console.error('Install prompt failed:', error);
      this.app._showNotification('安裝失敗，請稍後再試', 'error');
    }
  }

  /**
   * 處理快捷方式參數
   */
  _handleShortcutParams() {
    const urlParams = new URLSearchParams(window.location.search);

    // 處理動作參數
    if (urlParams.has('action')) {
      const action = urlParams.get('action');
      switch (action) {
        case 'new':
          setTimeout(() => this.app._handleNewChat(), 1000);
          break;
      }
    }

    // 處理學科參數
    if (urlParams.has('subject')) {
      const subject = urlParams.get('subject');
      setTimeout(() => {
        this.app._handleNewChat().then(() => {
          if (subject === 'mathematics') {
            this.app.elements.messageInput.value = '我想學習數學';
            this.app.messageProcessingManager.handleSendMessage();
          }
        });
      }, 1000);
    }

    // 處理模式參數
    if (urlParams.has('mode')) {
      const mode = urlParams.get('mode');
      if (mode === 'qa') {
        setTimeout(() => {
          this.app._handleNewChat().then(() => {
            this.app.elements.messageInput.value = '我有問題想問';
            this.app.messageProcessingManager.handleSendMessage();
          });
        }, 1000);
      }
    }
  }

  /**
   * 手動觸發安裝提示（供外部調用）
   */
  showInstallPrompt() {
    if (!this.isInstalled && this.deferredPrompt) {
      this._handleInstallClick();
    }
  }

  /**
   * 檢查是否可以安裝
   */
  canInstall() {
    return !this.isInstalled && this.deferredPrompt !== null;
  }

  /**
   * 獲取安裝狀態
   */
  getInstallationStatus() {
    return {
      isInstalled: this.isInstalled,
      canInstall: this.canInstall(),
      hasPrompt: this.deferredPrompt !== null
    };
  }

  /**
   * 重置安裝提示狀態（清除localStorage標記）
   */
  resetPromptState() {
    localStorage.removeItem('pwa-install-prompt-shown');
    console.log('PWA install prompt state reset');
  }

  /**
   * 清理資源
   */
  destroy() {
    this._hideInstallButton();
    this._hideInstallPrompt();
    this.deferredPrompt = null;
    this.initialized = false;
    console.log('🗑️ PWA Manager destroyed');
  }
}

export default PWAManager; 