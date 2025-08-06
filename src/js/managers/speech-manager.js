/**
 * 語音管理器
 * 負責處理所有語音相關功能，包括語音輸入、播放和練習
 */

import speechService from '../services/speech-service.js';

class SpeechManager {
  constructor(app) {
    this.app = app;
    this.speechService = speechService;
    this.isVoiceInputActive = false;
    this.currentVoiceLanguage = null;
    this.isPracticeMode = false;
    this.isInitialized = true;
  }

  /**
   * 初始化語音管理器
   */
  async init() {
    try {
      this._setupSpeechEvents();
      this._updateVoiceButtonState();
      console.log('🎤 Speech Manager initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Speech Manager:', error);
      // 確保即使初始化失敗，應用程式也能繼續運行
      this.isInitialized = false;
      throw error;
    }
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
  async handleVoiceInput(language = 'zh-TW') {
    if (!this.speechService) {
      this.app._showNotification('語音服務未初始化', 'error');
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
      this.stopVoiceInput();
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
        this.app._showNotification('語音輸入啟動失敗：' + error.message, 'error');
      }
    }
  }

  /**
   * 停止語音輸入
   */
  stopVoiceInput() {
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
      this.app.elements.voiceInputEnglishBtn : 
      this.app.elements.voiceInputChineseBtn;

    if (activeButton) {
      activeButton.classList.add('listening');
      activeButton.title = '點擊停止語音輸入';
    }

    // 顯示語音狀態指示器
    if (this.app.elements.voiceStatus) {
      this.app.elements.voiceStatus.style.display = 'block';
    }

    const languageText = this.currentVoiceLanguage === 'en-US' ? 
      '正在聆聽英文...' : '正在聆聽中文...';

    if (this.app.elements.voiceStatusMessage) {
      this.app.elements.voiceStatusMessage.textContent = languageText;
    }
  }

  /**
   * 語音識別結果處理
   */
  _onVoiceRecognitionResult(detail) {
    const { transcript, isFinal, confidence } = detail;

    if (transcript) {
      // 更新狀態消息
      if (this.app.elements.voiceStatusMessage) {
        this.app.elements.voiceStatusMessage.textContent = isFinal ?
          `識別完成: ${transcript}` :
          `識別中: ${transcript}`;
      }

      // 如果是最終結果且不是練習模式，插入到輸入框
      if (isFinal && !this.isPracticeMode && this.app.elements.messageInput) {
        const currentText = this.app.elements.messageInput.value;
        const newText = currentText ? `${currentText} ${transcript}` : transcript;
        this.app.elements.messageInput.value = newText;

        // 更新發送按鈕狀態
        this.app._updateSendButtonState();

        // 聚焦到輸入框
        this.app.elements.messageInput.focus();

        // 顯示成功通知
        this.app._showNotification(`語音識別成功！信心度: ${Math.round(confidence * 100)}%`, 'success');
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

    this.app._showNotification(errorMessage, 'error');
  }

  /**
   * 語音識別結束處理
   */
  _onVoiceRecognitionEnd() {
    this.isVoiceInputActive = false;

    // 更新按鈕狀態
    const activeButton = this.currentVoiceLanguage === 'en-US' ? 
      this.app.elements.voiceInputEnglishBtn : 
      this.app.elements.voiceInputChineseBtn;

    if (activeButton) {
      activeButton.classList.remove('listening', 'processing');
      const buttonTitle = this.currentVoiceLanguage === 'en-US' ? 
        '英文語音輸入 (練習口說)' : '中文語音輸入';
      activeButton.title = buttonTitle;
    }

    // 隱藏語音狀態指示器
    if (this.app.elements.voiceStatus) {
      setTimeout(() => {
        this.app.elements.voiceStatus.style.display = 'none';
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
    const inputArea = this.app.elements.inputArea;
    if (inputArea) {
      inputArea.parentNode.insertBefore(promptDiv, inputArea);
    }

    // 添加事件監聽器
    const retryBtn = promptDiv.querySelector('.retry-btn');
    const dismissBtn = promptDiv.querySelector('.dismiss-btn');

    retryBtn?.addEventListener('click', () => {
      promptDiv.remove();
      this.handleVoiceInput();
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
  addSpeechButtonsToMessage(messageElement) {
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
        const playButtonHtml = `<button class="speech-button inline-speech-button"
                              title="播放英文: ${this.app._escapeHtml(speakMatch.content.length > 50 ? speakMatch.content.substring(0, 50) + '...' : speakMatch.content)}"
                              data-text="${this.app._escapeHtml(speakMatch.content)}"
                              data-index="${index}">🔊</button>`;

        const practiceButtonHtml = `<button class="speech-button inline-speech-button practice-button"
                              title="練習發音: ${this.app._escapeHtml(speakMatch.content.length > 50 ? speakMatch.content.substring(0, 50) + '...' : speakMatch.content)}"
                              data-text="${this.app._escapeHtml(speakMatch.content)}"
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
        const playButtonHtml = `<button class="speech-button inline-speech-button"
                              title="播放英文: ${this.app._escapeHtml(englishText.length > 50 ? englishText.substring(0, 50) + '...' : englishText)}"
                              data-text="${this.app._escapeHtml(englishText)}"
                              data-index="${index}">🔊</button>`;

        const practiceButtonHtml = `<button class="speech-button inline-speech-button practice-button"
                              title="練習發音: ${this.app._escapeHtml(englishText.length > 50 ? englishText.substring(0, 50) + '...' : englishText)}"
                              data-text="${this.app._escapeHtml(englishText)}"
                              data-index="${index}">🎤</button>`;

        // 使用更安全的方式查找英文內容位置
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;
        const currentText = tempDiv.textContent || '';

        // 找到英文內容在純文本中的位置
        const englishIndex = currentText.indexOf(englishText);
        if (englishIndex !== -1) {
          // 在HTML中找到對應位置並插入按鈕
          const escapedEnglishText = this._escapeRegExp(englishText);
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
            await this.handleSpeechPlayback(button, englishText);
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
            await this.handleSpeechPractice(button, englishText);
          });
          button.setAttribute('data-listener-added', 'true');
        }
      });
    }
  }

  /**
   * 處理語音播放
   */
  async handleSpeechPlayback(button, text) {
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
      this.app._showNotification('語音播放失敗：' + error.message, 'error');
    } finally {
      // 恢復按鈕狀態
      button.classList.remove('playing');
      button.innerHTML = '🔊';
    }
  }

  /**
   * 處理語音練習
   * @param {HTMLElement} button - 練習按鈕
   * @param {string} targetText - 目標英文文本
   */
  async handleSpeechPractice(button, targetText) {
    if (!this.speechService) return;

    // 檢查瀏覽器支援
    const support = this.speechService.getSupport();
    if (!support.recognition) {
      this.app._showNotification('您的瀏覽器不支援語音識別功能', 'error');
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

        this.app._showNotification(errorMessage, 'error');
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
        this.app._showNotification('需要麥克風權限才能使用語音練習功能', 'error');
      } else {
        this.app._showNotification('語音練習啟動失敗：' + error.message, 'error');
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
    this.app._showNotification(`${icon} ${message} 準確度：${accuracy}%`, level === 'excellent' || level === 'good' ? 'success' : 'warning');
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

        this.app._showNotification(errorMessage, 'error');
      };

      window.addEventListener('recognition-result', handlePracticeResult);
      window.addEventListener('recognition-error', handlePracticeError);

      // 開始語音辨識
      await this.speechService.startRecognition();

    } catch (error) {
      console.error('Failed to restart speech recognition:', error);
      this.isPracticeMode = false;
      this.app._showNotification('重新開始練習失敗：' + error.message, 'error');
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
      this.app._showNotification('播放標準發音失敗：' + error.message, 'error');
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
   * 轉義正則表達式特殊字符
   */
  _escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 檢查語音功能支援狀態
   */
  checkVoiceSupport() {
    if (!this.speechService) return null;
    return this.speechService.getSupport();
  }

  /**
   * 更新語音按鈕狀態
   */
  _updateVoiceButtonState() {
    if (!this.app.elements.voiceInputBtn) return;

    const support = this.checkVoiceSupport();

    if (!support || !support.recognition) {
      this.app.elements.voiceInputBtn.classList.add('disabled');
      this.app.elements.voiceInputBtn.title = '您的瀏覽器不支援語音識別';
    } else if (this.isVoiceInputActive) {
      this.app.elements.voiceInputBtn.classList.add('listening');
      this.app.elements.voiceInputBtn.title = '點擊停止語音輸入';
    } else {
      this.app.elements.voiceInputBtn.classList.remove('disabled', 'listening');
      this.app.elements.voiceInputBtn.title = '語音輸入 (中文辨識)';
    }
  }

  /**
   * 獲取語音輸入狀態
   */
  getVoiceInputState() {
    return {
      isActive: this.isVoiceInputActive,
      language: this.currentVoiceLanguage,
      isPracticeMode: this.isPracticeMode
    };
  }

  /**
   * 獲取完整的語音管理器狀態
   */
  getState() {
    return {
      ...this.getVoiceInputState(),
      isInitialized: this.isInitialized || false,
      isSupported: this.checkVoiceSupport()?.speechRecognition || false,
      ttsSupported: this.checkVoiceSupport()?.speechSynthesis || false
    };
  }

  /**
   * 重置所有語音狀態
   */
  reset() {
    this.stopVoiceInput();
    this._stopCurrentSpeechPractice();
    this.isVoiceInputActive = false;
    this.currentVoiceLanguage = null;
    this.isPracticeMode = false;
  }
}

export default SpeechManager; 