// practice-ui-error-analysis.js
// 錯誤分析 UI 模塊 - 處理錯誤分析顯示、補強建議和用戶交互

export class PracticeUIErrorAnalysis {
  constructor(app, practiceSession) {
    this.app = app;
    this.practiceSession = practiceSession;
    this.storageService = app.storageService;
    this.questionBankService = app.questionBankService;
  }

  /**
   * 獲取並顯示錯誤分析
   * @param {string} questionId - 題目ID
   * @param {Object} questionData - 題目數據
   * @param {string} userAnswer - 用戶答案
   * @param {number} responseTime - 回答時間
   */
  async showErrorAnalysis(questionId, questionData, userAnswer, responseTime) {
    try {
      // 顯示載入狀態
      this._showLoadingState();
      
      // 獲取或生成錯誤分析
      let analysis = await this._getOrGenerateErrorAnalysis(questionId, questionData, userAnswer, responseTime);
      
      // 顯示錯誤分析 UI
      this._displayErrorAnalysis(analysis, questionData, userAnswer);
      
    } catch (error) {
      console.error('顯示錯誤分析失敗:', error);
      this._showErrorState(error.message);
    }
  }

  /**
   * 獲取現有的錯誤分析或生成新的分析
   */
  async _getOrGenerateErrorAnalysis(questionId, questionData, userAnswer, responseTime) {
    // 首先嘗試從存儲中獲取現有的錯誤分析
    const existingAnalyses = await this.storageService.getErrorAnalysis({
      questionId: questionId
    });
    
    // 如果存在現有分析，返回最新的一個
    if (existingAnalyses && existingAnalyses.length > 0) {
      const latestAnalysis = existingAnalyses.sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
      )[0];
      return latestAnalysis.analysis;
    }
    
    // 如果沒有現有分析，生成新的分析
    return await this.questionBankService.analyzeError(questionData, userAnswer, responseTime);
  }

  /**
   * 顯示載入狀態
   */
  _showLoadingState() {
    const container = this._getErrorAnalysisContainer();
    container.innerHTML = `
      <div class="error-analysis-loading">
        <div class="loading-spinner"></div>
        <p>正在分析錯誤，請稍候...</p>
      </div>
    `;
    container.style.display = 'block';
  }

  /**
   * 顯示錯誤狀態
   */
  _showErrorState(message) {
    const container = this._getErrorAnalysisContainer();
    container.innerHTML = `
      <div class="error-analysis-error">
        <div class="error-icon">⚠️</div>
        <h4>分析失敗</h4>
        <p>${message}</p>
        <button class="btn-primary retry-analysis">重新分析</button>
      </div>
    `;
    
    // 添加重試事件監聽器
    const retryBtn = container.querySelector('.retry-analysis');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        // 重新觸發分析（需要從外部傳入參數）
        this._showLoadingState();
      });
    }
  }

  /**
   * 顯示錯誤分析結果
   */
  _displayErrorAnalysis(analysis, questionData, userAnswer) {
    const container = this._getErrorAnalysisContainer();
    container.innerHTML = this._generateErrorAnalysisHTML(analysis, questionData, userAnswer);
    
    // 設置事件監聽器
    this._setupErrorAnalysisEventListeners(container, analysis);
    
    container.style.display = 'block';
  }

  /**
   * 生成錯誤分析 HTML
   */
  _generateErrorAnalysisHTML(analysis, questionData, userAnswer) {
    const severityClass = this._getSeverityClass(analysis.severity);
    const errorTypeIcon = this._getErrorTypeIcon(analysis.errorType);
    
    return `
      <div class="error-analysis-container">
        <div class="error-analysis-header">
          <div class="error-type ${severityClass}">
            <span class="error-icon">${errorTypeIcon}</span>
            <div class="error-info">
              <h4 class="error-title">${analysis.errorType}</h4>
              <span class="error-severity">${this._getSeverityText(analysis.severity)}</span>
            </div>
          </div>
          <div class="confidence-indicator">
            <span class="confidence-label">分析信心度</span>
            <div class="confidence-bar">
              <div class="confidence-fill" style="width: ${(analysis.confidence * 100)}%"></div>
            </div>
            <span class="confidence-value">${Math.round(analysis.confidence * 100)}%</span>
          </div>
        </div>

        <div class="error-analysis-content">
          <div class="root-cause-section">
            <h5>🔍 錯誤原因分析</h5>
            <div class="root-cause-content">
              <p>${analysis.rootCause}</p>
            </div>
          </div>

          <div class="suggestions-section">
            <h5>💡 改進建議</h5>
            <ul class="suggestions-list">
              ${analysis.suggestions.map(suggestion => `
                <li class="suggestion-item">
                  <span class="suggestion-icon">✓</span>
                  <span class="suggestion-text">${suggestion}</span>
                </li>
              `).join('')}
            </ul>
          </div>

          ${analysis.relatedConcepts && analysis.relatedConcepts.length > 0 ? `
            <div class="related-concepts-section">
              <h5>📚 相關概念加強</h5>
              <div class="concepts-tags">
                ${analysis.relatedConcepts.map(concept => `
                  <span class="concept-tag">${concept}</span>
                `).join('')}
              </div>
            </div>
          ` : ''}

          ${analysis.recommendedPractice && analysis.recommendedPractice.length > 0 ? `
            <div class="recommended-practice-section">
              <h5>🎯 建議練習</h5>
              <div class="practice-recommendations">
                ${analysis.recommendedPractice.map((practice, index) => `
                  <div class="practice-card" data-practice-index="${index}">
                    <div class="practice-header">
                      <h6>${practice.topic}</h6>
                      <span class="practice-difficulty ${practice.difficulty}">${this._getDifficultyText(practice.difficulty)}</span>
                    </div>
                    <div class="practice-details">
                      <span class="practice-count">建議題數: ${practice.count}</span>
                      <span class="practice-focus">重點: ${practice.focus}</span>
                    </div>
                    <button class="btn-primary start-practice" data-practice-index="${index}">
                      開始練習
                    </button>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          ${analysis.remediationContent && analysis.remediationContent.length > 0 ? `
            <div class="remediation-content-section">
              <h5>💡 補強學習內容</h5>
              <div class="remediation-content-list">
                ${analysis.remediationContent.map((content, index) => this._generateRemediationContentHTML(content, index)).join('')}
              </div>
            </div>
          ` : ''}

          ${analysis.learningStrategy ? `
            <div class="learning-strategy-section">
              <h5>📈 學習策略建議</h5>
              <div class="strategy-content">
                <p>${analysis.learningStrategy}</p>
              </div>
            </div>
          ` : ''}

          ${analysis.timeAnalysis ? `
            <div class="time-analysis-section">
              <h5>⏱️ 答題時間分析</h5>
              <div class="time-analysis-content">
                <p>${analysis.timeAnalysis}</p>
              </div>
            </div>
          ` : ''}

          ${analysis.nextSteps ? `
            <div class="next-steps-section">
              <h5>🚀 下一步行動</h5>
              <div class="next-steps-content">
                <p>${analysis.nextSteps}</p>
              </div>
            </div>
          ` : ''}
        </div>

        <div class="error-analysis-actions">
          <button class="btn-secondary mark-resolved">標記為已解決</button>
          <button class="btn-primary close-analysis">關閉分析</button>
        </div>
      </div>
    `;
  }

  /**
   * 設置錯誤分析事件監聽器
   */
  _setupErrorAnalysisEventListeners(container, analysis) {
    // 開始練習按鈕
    const startPracticeButtons = container.querySelectorAll('.start-practice');
    startPracticeButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const practiceIndex = parseInt(e.target.dataset.practiceIndex);
        const practice = analysis.recommendedPractice[practiceIndex];
        this._startRecommendedPractice(practice);
      });
    });

    // 外部連結按鈕
    const externalLinkButtons = container.querySelectorAll('.external-link-btn');
    externalLinkButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const url = e.target.dataset.url;
        this._openExternalLink(url);
      });
    });

    // 對話片段展開按鈕
    const conversationToggleButtons = container.querySelectorAll('.conversation-toggle');
    conversationToggleButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const contentIndex = e.target.dataset.contentIndex;
        this._toggleConversationContent(contentIndex);
      });
    });

    // 標記為已解決按鈕
    const markResolvedBtn = container.querySelector('.mark-resolved');
    if (markResolvedBtn) {
      markResolvedBtn.addEventListener('click', () => {
        this._markErrorAsResolved(analysis);
      });
    }

    // 關閉分析按鈕
    const closeBtn = container.querySelector('.close-analysis');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this._closeErrorAnalysis();
      });
    }
  }

  /**
   * 開始推薦的練習
   */
  async _startRecommendedPractice(practice) {
    try {
      // 生成基於推薦的練習選項
      const practiceOptions = {
        topic: practice.topic,
        difficulty: practice.difficulty,
        questionCount: practice.count,
        focusArea: practice.focus
      };

      // 關閉錯誤分析並開始新練習
      this._closeErrorAnalysis();
      
      // 觸發新的練習生成
      if (this.app && this.app.startNewPractice) {
        await this.app.startNewPractice(practiceOptions);
      }
    } catch (error) {
      console.error('開始推薦練習失敗:', error);
      alert('開始練習失敗，請稍後再試');
    }
  }

  /**
   * 標記錯誤為已解決
   */
  async _markErrorAsResolved(analysis) {
    try {
      // 更新錯誤分析狀態為已解決
      const updatedAnalysis = {
        ...analysis,
        resolved: true,
        resolvedAt: new Date().toISOString()
      };

      // 保存更新後的分析
      await this.storageService.saveErrorAnalysis(updatedAnalysis);
      
      // 更新 UI
      const container = this._getErrorAnalysisContainer();
      const markResolvedBtn = container.querySelector('.mark-resolved');
      if (markResolvedBtn) {
        markResolvedBtn.textContent = '✓ 已標記為解決';
        markResolvedBtn.disabled = true;
        markResolvedBtn.classList.add('resolved');
      }

      // 顯示成功訊息
      this._showSuccessMessage('錯誤已標記為解決！');
      
    } catch (error) {
      console.error('標記錯誤為已解決失敗:', error);
      alert('操作失敗，請稍後再試');
    }
  }

  /**
   * 關閉錯誤分析
   */
  _closeErrorAnalysis() {
    const container = this._getErrorAnalysisContainer();
    container.style.display = 'none';
    container.innerHTML = '';
  }

  /**
   * 顯示成功訊息
   */
  _showSuccessMessage(message) {
    // 創建或更新成功訊息
    let successMsg = document.querySelector('.error-analysis-success');
    if (!successMsg) {
      successMsg = document.createElement('div');
      successMsg.className = 'error-analysis-success';
      document.body.appendChild(successMsg);
    }
    
    successMsg.textContent = message;
    successMsg.style.display = 'block';
    
    // 3秒後自動隱藏
    setTimeout(() => {
      successMsg.style.display = 'none';
    }, 3000);
  }

  /**
   * 獲取錯誤分析容器
   */
  _getErrorAnalysisContainer() {
    let container = document.getElementById('error-analysis-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'error-analysis-container';
      container.className = 'error-analysis-modal';
      document.body.appendChild(container);
    }
    return container;
  }

  /**
   * 獲取嚴重程度樣式類別
   */
  _getSeverityClass(severity) {
    const severityMap = {
      '輕微': 'severity-light',
      '中等': 'severity-medium', 
      '嚴重': 'severity-severe'
    };
    return severityMap[severity] || 'severity-medium';
  }

  /**
   * 獲取錯誤類型圖標
   */
  _getErrorTypeIcon(errorType) {
    const iconMap = {
      '概念理解錯誤': '🧠',
      '計算錯誤': '🔢',
      '語法錯誤': '📝',
      '邏輯推理錯誤': '🤔',
      '粗心大意': '😅'
    };
    return iconMap[errorType] || '❌';
  }

  /**
   * 獲取嚴重程度文字
   */
  _getSeverityText(severity) {
    return severity || '中等';
  }

  /**
   * 獲取難度文字
   */
  _getDifficultyText(difficulty) {
    const difficultyMap = {
      'easy': '簡單',
      'medium': '中等',
      'hard': '困難',
      'expert': '專家級'
    };
    return difficultyMap[difficulty] || difficulty;
  }

  /**
   * 生成補強內容HTML
   */
  _generateRemediationContentHTML(content, index) {
    switch (content.type) {
      case 'conversation_snippet':
        return this._generateConversationSnippetHTML(content, index);
      case 'external_link':
        return this._generateExternalLinkHTML(content, index);
      case 'mini_explanation':
        return this._generateMiniExplanationHTML(content, index);
      default:
        return '';
    }
  }

  /**
   * 生成對話片段HTML
   */
  _generateConversationSnippetHTML(content, index) {
    return `
      <div class="remediation-item conversation-snippet">
        <div class="remediation-header">
          <h6>💬 ${content.title}</h6>
          <button class="conversation-toggle" data-content-index="${index}">
            <span class="toggle-text">展開</span>
            <span class="toggle-icon">▼</span>
          </button>
        </div>
        <div class="conversation-content" id="conversation-${index}" style="display: none;">
          <div class="conversation-text">
            ${content.content}
          </div>
          ${content.source ? `
            <div class="conversation-source">
              <small>來源：${content.source}</small>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * 生成外部連結HTML
   */
  _generateExternalLinkHTML(content, index) {
    const categoryIcon = this._getLinkCategoryIcon(content.category);
    return `
      <div class="remediation-item external-link">
        <div class="link-content">
          <div class="link-header">
            <h6>${categoryIcon} ${content.title}</h6>
            <span class="link-category">${this._getLinkCategoryText(content.category)}</span>
          </div>
          <p class="link-description">${content.description}</p>
          <button class="external-link-btn" data-url="${content.url}">
            🔗 前往資源
          </button>
        </div>
      </div>
    `;
  }

  /**
   * 生成小解釋HTML
   */
  _generateMiniExplanationHTML(content, index) {
    return `
      <div class="remediation-item mini-explanation">
        <div class="explanation-content">
          <h6>🔍 ${content.title}</h6>
          <div class="explanation-text">
            ${content.content}
          </div>
          ${content.examples && content.examples.length > 0 ? `
            <div class="explanation-examples">
              <strong>例子：</strong>
              <ul>
                ${content.examples.map(example => `<li>${example}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          ${content.difficulty ? `
            <div class="explanation-difficulty">
              <small>難度：${content.difficulty}</small>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * 打開外部連結
   */
  _openExternalLink(url) {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  /**
   * 切換對話內容顯示
   */
  _toggleConversationContent(contentIndex) {
    const content = document.getElementById(`conversation-${contentIndex}`);
    const toggle = document.querySelector(`[data-content-index="${contentIndex}"]`);
    
    if (content && toggle) {
      const isVisible = content.style.display !== 'none';
      content.style.display = isVisible ? 'none' : 'block';
      
      const toggleText = toggle.querySelector('.toggle-text');
      const toggleIcon = toggle.querySelector('.toggle-icon');
      
      if (toggleText && toggleIcon) {
        toggleText.textContent = isVisible ? '展開' : '收起';
        toggleIcon.textContent = isVisible ? '▼' : '▲';
      }
    }
  }

  /**
   * 獲取連結類別圖標
   */
  _getLinkCategoryIcon(category) {
    const iconMap = {
      'video': '🎥',
      'article': '📄',
      'interactive': '🎮',
      'exercise': '📝'
    };
    return iconMap[category] || '🔗';
  }

  /**
   * 獲取連結類別文字
   */
  _getLinkCategoryText(category) {
    const textMap = {
      'video': '影片',
      'article': '文章',
      'interactive': '互動',
      'exercise': '練習'
    };
    return textMap[category] || '資源';
  }
}

export default PracticeUIErrorAnalysis; 