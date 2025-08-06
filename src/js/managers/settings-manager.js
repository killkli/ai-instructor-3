/**
 * 設定管理器
 * 負責處理應用程式的所有設定相關功能
 */

import geminiService from '../services/gemini-service.js';
import storageService from '../services/storage-service.js';
import sessionManager from '../services/session-manager.js';
import promptManager from '../config/prompt-manager.js';

class SettingsManager {
  constructor(app) {
    this.app = app;
    this.initialized = false;
  }

  /**
   * 初始化設定管理器
   */
  async init() {
    if (this.initialized) return;
    
    this.initialized = true;
    console.log('⚙️ Settings Manager initialized');
  }

  /**
   * 載入用戶設定
   */
  async loadSettings() {
    try {
      const settings = await storageService.getAllSettings();

      // 使用 appStateManager 更新狀態
      this.app.appStateManager.updateState(settings);

      // 如果有API金鑰，初始化Gemini服務
      if (this.app.appStateManager.get('apiKey')) {
        geminiService.init(
          this.app.appStateManager.get('apiKey'), 
          this.app.appStateManager.get('currentModel')
        );
      }

      // 更新模型信息顯示
      this.updateModelInfo();

      console.log('⚙️ Settings loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load settings:', error);
    }
  }

  /**
   * 顯示設定模態框
   */
  async showSettingsModal() {
    if (this.app.elements.settingsModal) {
      // 載入當前設定到表單
      await this.loadSettingsToForm();

      // 移除 hidden 類別並顯示模態框
      this.app.elements.settingsModal.classList.remove('hidden');
      this.app.elements.settingsModal.style.display = 'flex';

      // 載入可用模型列表
      await this.loadAvailableModels();
    }
  }

  /**
   * 載入可用模型列表
   */
  async loadAvailableModels() {
    const modelSelect = this.app.elements.modelSelect;
    const helpText = document.getElementById('model-help-text');

    if (!modelSelect) return;

    try {
      // 檢查是否有 API Key
      if (!this.app.appStateManager.get('apiKey')) {
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
          let displayName = this.formatModelName(modelId);

          // 標記推薦模型
          if (modelId.includes('2.5-flash') || modelId.includes('2.0-flash')) {
            displayName += ' (推薦)';
          }

          option.textContent = displayName;
          modelSelect.appendChild(option);
        });

        // 設定當前選中的模型
        if (this.app.appStateManager.get('currentModel')) {
          modelSelect.value = this.app.appStateManager.get('currentModel');
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
      if (this.app.appStateManager.get('currentModel')) {
        modelSelect.value = this.app.appStateManager.get('currentModel');
      }

      if (helpText) helpText.textContent = '載入失敗，顯示預設模型列表';
    }
  }

  /**
   * 格式化模型名稱為友好顯示
   */
  formatModelName(modelId) {
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
   * 載入設定到表單
   */
  async loadSettingsToForm() {
    if (this.app.elements.modelSelect) {
      this.app.elements.modelSelect.value = this.app.appStateManager.get('currentModel');
    }

    if (this.app.elements.temperatureSlider) {
      this.app.elements.temperatureSlider.value = this.app.appStateManager.get('temperature') || 0.7;
      if (this.app.elements.temperatureValue) {
        this.app.elements.temperatureValue.textContent = this.app.appStateManager.get('temperature') || 0.7;
      }
    }

    // 顯示當前角色
    this.updateCurrentRoleDisplay();

    // 載入其他設定...
    // const adaptiveDifficulty = document.getElementById('adaptive-difficulty');
    // const stepByStep = document.getElementById('step-by-step');
    const streamingEnabled = document.getElementById('streaming-enabled');

    // if (adaptiveDifficulty) adaptiveDifficulty.checked = this.app.appStateManager.get('adaptiveDifficulty') ?? true;
    // if (stepByStep) stepByStep.checked = this.app.appStateManager.get('stepByStep') ?? true;
    if (streamingEnabled) streamingEnabled.checked = this.app.appStateManager.get('streamingEnabled') ?? true;

    // 載入自定義系統提示詞
    if (this.app.elements.customSystemPrompt) {
      this.app.elements.customSystemPrompt.value = this.app.appStateManager.get('customSystemPrompt') || '';
    }
  }

  /**
   * 更新當前角色顯示
   */
  updateCurrentRoleDisplay() {
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
  async handleApiKeySetup() {
    const apiKey = this.app.elements.apiKeyInput?.value.trim();

    console.log('API Key input element:', this.app.elements.apiKeyInput);
    console.log('API Key value:', apiKey);
    console.log('API Key length:', apiKey?.length);

    if (!apiKey) {
      this.app.notificationManager?.showError('請輸入有效的API金鑰');
      return;
    }

    try {
      this.app.uiManager?.showLoading('驗證API金鑰...');

      // 驗證API金鑰
      const validation = await geminiService.validateApiKey(apiKey);

      if (!validation.valid) {
        throw new Error(validation.error || '無效的API金鑰');
      }

      // 保存API金鑰
      await this.saveApiKey(apiKey);

      // 初始化Gemini服務
      geminiService.init(apiKey, this.app.appStateManager.get('currentModel'));

      this.app.uiManager?.hideLoading();
      this.app.modalManager?.hideModal('setup-modal');
      this.app.notificationManager?.showSuccess('API金鑰設定成功！');

      // 顯示聊天界面
      if (this.app.elements.messagesContainer) {
        this.app.elements.messagesContainer.classList.remove('hidden');
      }
      if (this.app.elements.inputArea) {
        this.app.elements.inputArea.classList.remove('hidden');
      }

      // 載入初始界面
      await this.app.sessionUIManager.loadSessionsList();
      await this.app._handleNewChat();

    } catch (error) {
      this.app.uiManager?.hideLoading();
      this.app.notificationManager?.showError(`API金鑰驗證失敗: ${error.message}`);
    }
  }

  /**
   * 保存API金鑰
   */
  async saveApiKey(apiKey) {
    this.app.appStateManager.set('apiKey', apiKey);
    await storageService.saveSetting('apiKey', apiKey);
  }

  /**
   * 處理API金鑰更新
   */
  async handleApiKeyUpdate() {
    const newApiKey = this.app.elements.currentApiKeyInput?.value.trim();

    if (!newApiKey) {
      this.app.notificationManager?.showError('請輸入新的API金鑰');
      return;
    }

    try {
      this.app.uiManager?.showLoading('驗證新的API金鑰...');

      // 驗證新的API金鑰
      const validation = await geminiService.validateApiKey(newApiKey);

      if (!validation.valid) {
        throw new Error(validation.error || '無效的API金鑰');
      }

      // 保存新的API金鑰
      await this.saveApiKey(newApiKey);

      // 重新初始化Gemini服務
      geminiService.init(newApiKey, this.app.appStateManager.get('currentModel'));

      // 清空輸入框
      if (this.app.elements.currentApiKeyInput) {
        this.app.elements.currentApiKeyInput.value = '';
      }

      this.app.uiManager?.hideLoading();
      this.app.notificationManager?.showSuccess('API金鑰更新成功！');

    } catch (error) {
      this.app.uiManager?.hideLoading();
      this.app.notificationManager?.showError(`API金鑰更新失敗: ${error.message}`);
    }
  }

  /**
   * 生成分享連結
   */
  generateShareLink() {
    try {
      if (!this.app.appStateManager.get('apiKey')) {
        this.app.notificationManager?.showWarning('請先設定 API Key');
        return;
      }

      // 獲取當前 URL 的基礎部分
      const baseUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}`;

      // 創建包含 API Key 的 URL
      const shareUrl = new URL(baseUrl);
      shareUrl.searchParams.set('key', this.app.appStateManager.get('apiKey'));

      // 如果有選擇的角色，也加入 URL
      if (this.app.appStateManager.get('selectedRole')) {
        shareUrl.searchParams.set('role', this.app.appStateManager.get('selectedRole'));
      }

      // 顯示分享連結
      const shareLinkInput = this.app.elements.shareLinkInput;
      if (shareLinkInput) {
        shareLinkInput.value = shareUrl.toString();
        shareLinkInput.style.display = 'block';
        shareLinkInput.classList.add('show', 'has-content');

        // 啟用複製按鈕
        if (this.app.elements.copyShareLinkButton) {
          this.app.elements.copyShareLinkButton.disabled = false;
        }

        this.app.notificationManager?.showSuccess('分享連結已生成');

        // 自動選中連結文字
        setTimeout(() => {
          shareLinkInput.select();
          shareLinkInput.focus();
        }, 100);
      }

    } catch (error) {
      console.error('Failed to generate share link:', error);
      this.app.notificationManager?.showError('生成分享連結失敗');
    }
  }

  /**
   * 複製分享連結
   */
  async copyShareLink() {
    try {
      const shareLinkInput = this.app.elements.shareLinkInput;
      if (!shareLinkInput || !shareLinkInput.value) {
        this.app.notificationManager?.showWarning('請先生成分享連結');
        return;
      }

      // 使用現代 Clipboard API
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareLinkInput.value);
        this.app.notificationManager?.showSuccess('分享連結已複製到剪貼簿');
      } else {
        // 降級方案：使用傳統方法
        shareLinkInput.select();
        shareLinkInput.setSelectionRange(0, 99999); // 移動端支援

        const successful = document.execCommand('copy');
        if (successful) {
          this.app.notificationManager?.showSuccess('分享連結已複製到剪貼簿');
        } else {
          throw new Error('Copy command failed');
        }
      }

      // 視覺反饋
      const copyButton = this.app.elements.copyShareLinkButton;
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
      this.app.notificationManager?.showError('複製失敗，請手動複製連結');

      // 如果複製失敗，至少選中文字讓用戶手動複製
      if (this.app.elements.shareLinkInput) {
        this.app.elements.shareLinkInput.select();
        this.app.elements.shareLinkInput.focus();
      }
    }
  }

  /**
   * 處理設定更新
   */
  async handleSettingsUpdate() {
    try {
      const newSettings = {
        currentModel: this.app.elements.modelSelect?.value || this.app.appStateManager.get('currentModel'),
        temperature: parseFloat(this.app.elements.temperatureSlider?.value) || 0.7,
        defaultSubject: document.getElementById('subject-select')?.value || 'mathematics',
        streamingEnabled: document.getElementById('streaming-enabled')?.checked ?? true,
        customSystemPrompt: this.app.elements.customSystemPrompt?.value.trim() || null,
        // adaptiveDifficulty: document.getElementById('adaptive-difficulty')?.checked ?? true,
        // stepByStep: document.getElementById('step-by-step')?.checked ?? true,
      };

      // 檢查模型是否真的有改變
      const modelChanged = newSettings.currentModel !== this.app.appStateManager.get('currentModel');

      // 更新應用狀態
      this.app.appStateManager.updateState(newSettings);

      // 保存到儲存
      for (const [key, value] of Object.entries(newSettings)) {
        await storageService.saveSetting(key, value);
      }

      // 如果模型改變且 Gemini 服務已初始化，更新模型
      if (modelChanged && geminiService.initialized) {
        geminiService.setModel(newSettings.currentModel);
      }

      this.app.modalManager?.hideModal('settings-modal');
      this.app.notificationManager?.showSuccess('設定已保存');

      // 更新會話列表
      await this.app.sessionUIManager.updateSessionsList();

      // 更新模型信息顯示
      this.updateModelInfo();

    } catch (error) {
      console.error('Save settings error:', error);
      this.app.notificationManager?.showError(`保存設定失敗: ${error.message}`);
    }
  }

  /**
   * 更新模型信息顯示
   */
  updateModelInfo() {
    if (this.app.elements.modelInfo) {
      const modelName = this.formatModelName(this.app.appStateManager.get('currentModel'));
      this.app.elements.modelInfo.innerHTML = `<small>模型：${modelName}</small>`;
    }
  }

  /**
   * 清除 URL 中的 API Key（安全考量）
   */
  clearApiKeyFromUrl() {
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
}

export default SettingsManager; 
