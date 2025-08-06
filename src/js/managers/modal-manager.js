/**
 * 模態框管理器
 * 負責處理所有模態框的顯示、隱藏和內容管理
 */
import geminiService from "../services/gemini-service.js";
import promptProcessor from "../services/prompt-processor.js";

class ModalManager {
  constructor(app) {
    this.app = app;
    this.initialized = false;
  }

  /**
   * 初始化模態框管理器
   */
  async init() {
    try {
      this.setupEventListeners();
      this.initialized = true;
      console.log('🪟 ModalManager initialized');
    } catch (error) {
      console.error('❌ ModalManager initialization failed:', error);
      throw error;
    }
  }

  /**
   * 設定事件監聽器
   */
  setupEventListeners() {
    // 模態框關閉按鈕
    document.querySelectorAll('.modal-close').forEach(button => {
      button.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal');
        if (modal) {
          this.hideModal(modal.id);
        }
      });
    });

    // API金鑰設定
    document.getElementById('save-api-key')?.addEventListener('click', () => {
      this.app.settingsManager.handleApiKeySetup();
    });

    // 設定保存
    document.getElementById('save-settings')?.addEventListener('click', () => {
      this.app.settingsManager?.handleSettingsUpdate();
    });

    // 預覽設定效果
    document.getElementById('preview-settings-effect')?.addEventListener('click', () => {
      this.previewSettingsEffect();
    });

    // 自定義系統提示詞
    this.app.elements.resetSystemPrompt?.addEventListener('click', () => {
      this.resetSystemPrompt();
    });

    this.app.elements.previewSystemPrompt?.addEventListener('click', () => {
      this.previewSystemPrompt();
    });

    console.log('🪟 Modal event listeners set up');
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
   * 顯示成就模態框
   */
  async showAchievementsModal() {
    const modal = this.app.elements.achievementsModal;
    if (!modal) return;
    
    this.app.uiManager.showModal(modal.id);
    
    const container = modal.querySelector('#achievements-container');
    if (!container) return;

    container.innerHTML = '<div class="loading-achievements">正在載入成就...</div>';

    try {
      const userAchievements = await this.app.achievementService.getUserAchievements();
      
      if (userAchievements && userAchievements.length > 0) {
        container.innerHTML = ''; // 清空載入提示
        const grid = document.createElement('div');
        grid.className = 'achievements-grid';

        userAchievements.forEach(achievement => {
          const achievementElement = document.createElement('div');
          achievementElement.className = 'achievement-item';
          achievementElement.title = `${achievement.description}\n(獲得於: ${new Date(achievement.date).toLocaleString()})`;
          
          achievementElement.innerHTML = `
            <div class="achievement-icon">${achievement.icon}</div>
            <div class="achievement-title">${achievement.title}</div>
          `;
          grid.appendChild(achievementElement);
        });
        container.appendChild(grid);
      } else {
        container.innerHTML = '<div class="no-achievements">目前還沒有獲得任何成就，繼續努力吧！💪</div>';
      }
    } catch (error) {
      console.error('❌ Failed to load achievements:', error);
      container.innerHTML = '<div class="no-achievements error">無法載入成就，請稍後再試。</div>';
    }
  }

  /**
   * 顯示API金鑰設定模態框
   */
  showSetupModal() {
    if (this.app.elements.setupModal) {
      this.app.elements.setupModal.style.display = 'flex';
      if (this.app.elements.apiKeyInput) {
        this.app.elements.apiKeyInput.focus();
      }
    }
  }

  /**
   * 隱藏模態框
   */
  hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      // 隱藏模態框並添加 hidden 類別
      modal.style.display = 'none';
      modal.classList.add('hidden');

      // 如果是匯出模態框，重置狀態
      if (modalId === 'export-modal' && this.app.exportManager) {
        this.app.exportManager.resetExportModalState();
      }
    }
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
    this.app.settingsManager.updateCurrentRoleDisplay();

    // 載入其他設定...
    const streamingEnabled = document.getElementById('streaming-enabled');
    // const adaptiveDifficulty = document.getElementById('adaptive-difficulty');
    // const stepByStep = document.getElementById('step-by-step');

    if (streamingEnabled) streamingEnabled.checked = this.app.appStateManager.get('streamingEnabled') ?? true;
    // if (adaptiveDifficulty) adaptiveDifficulty.checked = this.app.appStateManager.get('adaptiveDifficulty') ?? true;
    // if (stepByStep) stepByStep.checked = this.app.appStateManager.get('stepByStep') ?? true;

    // 載入自定義系統提示詞
    if (this.app.elements.customSystemPrompt) {
      this.app.elements.customSystemPrompt.value = this.app.appStateManager.get('customSystemPrompt') || '';
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
          let displayName = this.app.settingsManager.formatModelName(modelId);

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
   * 重置系統提示詞為預設值
   */
  resetSystemPrompt() {
    if (this.app.elements.customSystemPrompt) {
      this.app.elements.customSystemPrompt.value = '';
      this.app.appStateManager.set('customSystemPrompt', null);
      this.app._showNotification('已重置為預設系統提示詞', 'info');
    }
  }

  /**
   * 預覽系統提示詞
   */
  previewSystemPrompt() {
    const customPrompt = this.app.elements.customSystemPrompt?.value.trim();
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
      previewPrompt = promptProcessor.getEffectiveSystemPrompt();
    }

    // 顯示預覽模態框
    this.showPromptPreview(previewPrompt, customPrompt ? '自定義系統提示詞' : '預設系統提示詞');
  }

  /**
   * 預覽設定效果
   */
  previewSettingsEffect() {
    // 創建臨時設定對象，模擬用戶當前在表單中的設定
    const tempSettings = {
      defaultSubject: document.getElementById('subject-select')?.value || 'mathematics',
      customSystemPrompt: this.app.elements.customSystemPrompt?.value.trim() || null,
      // adaptiveDifficulty: document.getElementById('adaptive-difficulty')?.checked ?? true,
      // stepByStep: document.getElementById('step-by-step')?.checked ?? true,
    };

    // 暫時保存當前設定
    const originalSettings = {
      defaultSubject: this.app.appStateManager.get('defaultSubject'),
      customSystemPrompt: this.app.appStateManager.get('customSystemPrompt'),
      // adaptiveDifficulty: this.app.appStateManager.get('adaptiveDifficulty'),
      // stepByStep: this.app.appStateManager.get('stepByStep'),
    };

    // 臨時應用新設定
    this.app.appStateManager.updateState(tempSettings);

    // 生成預覽提示詞
    const previewPrompt = promptProcessor.getEffectiveSystemPrompt();

    // 恢復原始設定
    this.app.appStateManager.updateState(originalSettings);

    // 顯示預覽
    this.showPromptPreview(previewPrompt, '當前設定效果預覽');
  }

  /**
   * 顯示提示詞預覽模態框
   */
  showPromptPreview(prompt, title) {
    if (!this.app.elements.promptPreviewModal || !this.app.elements.promptPreviewContent) return;

    // 設定內容
    this.app.elements.promptPreviewContent.textContent = prompt;

    // 計算統計信息
    const charCount = prompt.length;
    const tokenCount = this.estimateTokenCount(prompt);

    if (this.app.elements.promptCharCount) {
      this.app.elements.promptCharCount.textContent = charCount.toLocaleString();
    }

    if (this.app.elements.promptTokenCount) {
      this.app.elements.promptTokenCount.textContent = tokenCount.toLocaleString();
    }

    // 更新標題
    const modalTitle = this.app.elements.promptPreviewModal.querySelector('.modal-header h3');
    if (modalTitle) {
      modalTitle.textContent = title;
    }

    // 顯示模態框
    this.app.elements.promptPreviewModal.classList.remove('hidden');
    this.app.elements.promptPreviewModal.style.display = 'flex';
  }

  /**
   * 估算Token數量（簡單估算）
   */
  estimateTokenCount(text) {
    // 簡單的Token估算：中文字符約1.5個token，英文單詞約1個token
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
    const otherChars = text.length - chineseChars - englishWords;

    return Math.ceil(chineseChars * 1.5 + englishWords + otherChars * 0.5);
  }
}

export default ModalManager; 
