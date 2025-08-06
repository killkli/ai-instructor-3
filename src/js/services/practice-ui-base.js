// practice-ui-base.js
// 基礎UI管理模塊 - 處理模態框、導航、狀態管理等核心UI功能

import contentRenderer from './content-renderer.js';

export class PracticeUIBase {
  constructor(app, practiceCore, questionBankService, practiceSession) {
    this.app = app;
    this.practiceCore = practiceCore;
    this.questionBankService = questionBankService;
    this.practiceSession = practiceSession;
    
    // 狀態屬性
    this.currentQuestions = [];
    this.currentQuestionIndex = 0;
    this.questionResults = [];
    
    // 確保 content-renderer 已初始化
    this._ensureContentRendererReady();
  }

  /**
   * 確保 content-renderer 已準備就緒
   */
  async _ensureContentRendererReady() {
    try {
      await contentRenderer.init();
    } catch (error) {
      console.warn('Content renderer initialization failed:', error);
    }
  }

  /**
   * 顯示單題練習模態框
   */
  async showPracticeModal(question) {
    const modal = document.getElementById('practice-modal');
    const questionContainer = document.getElementById('practice-question-container');
    const modalTitle = document.getElementById('practice-modal-title');
    
    if (!modal || !questionContainer || !modalTitle) return;
    
    modalTitle.textContent = `📚 練習題`;
    questionContainer.innerHTML = await this._renderQuestionContent(question);
    
    const questionContent = questionContainer.querySelector('.practice-question-content');
    this.setupPracticeModalInteraction(questionContent, question);
    this.setupNewQuestionButton();
    
    // 後處理渲染內容
    this._postProcessRenderedContent(questionContainer);
    
    modal.classList.remove('hidden');
    this.app.messageProcessingManager.addMessageToUI('assistant', '📚 練習題已準備就緒！請查看彈出的專用練習窗口。');
  }

  /**
   * 顯示多題練習模態框
   */
  async showPracticeModalMultiple(questions, topicSummary = null) {
    const modal = document.getElementById('practice-modal');
    const questionContainer = document.getElementById('practice-question-container');
    const modalTitle = document.getElementById('practice-modal-title');
    
    if (!modal || !questionContainer || !modalTitle) return;
    
    modal.classList.add('hidden');
    setTimeout(async () => {
      this.currentQuestions = questions;
      this.currentQuestionIndex = 0;
      this.questionResults = new Array(questions.length).fill(null);
      
      modalTitle.textContent = `📚 練習題組`;
      
      let summaryElem = modal.querySelector('#practice-topic-summary');
      if (!summaryElem) {
        summaryElem = document.createElement('div');
        summaryElem.id = 'practice-topic-summary';
        summaryElem.className = 'practice-topic-summary';
        modalTitle.parentNode.insertBefore(summaryElem, modalTitle.nextSibling);
      }
      summaryElem.textContent = topicSummary ? `主題摘要：${topicSummary}` : '';
      
      questionContainer.innerHTML = this._renderQuestionsContainer(questions);
      await this.loadQuestionAtIndex(0);
      this.setupQuestionNavigation();
      this.setupNewQuestionButton();
      
      modal.classList.remove('hidden');
      modal.style.display = 'flex';
      
      this.app.messageProcessingManager.addMessageToUI('assistant', `📚 ${questions.length}道練習題已準備就緒！請查看練習窗口開始答題。`);
    }, 100);
  }

  /**
   * 加載指定索引的題目
   */
  async loadQuestionAtIndex(index) {
    if (index < 0 || index >= this.currentQuestions.length) return;
    
    this.currentQuestionIndex = index;
    const question = this.currentQuestions[index];
    const questionContainer = document.getElementById('practice-current-question');
    
    if (!questionContainer) return;
    
    questionContainer.innerHTML = await this._renderQuestionContent(question);
    this.setupQuestionInteraction(questionContainer, question, index);
    this.updateTabsStatus();
    this.updateNavigationButtons();
    
    // 後處理渲染內容
    this._postProcessRenderedContent(questionContainer);
    
    // 更新進度顯示
    const currentQNum = document.getElementById('current-q-num');
    if (currentQNum) {
      currentQNum.textContent = index + 1;
    }
  }

  /**
   * 設置題目交互（需要外部模塊實現）
   */
  setupQuestionInteraction(questionContainer, question, questionIndex) {
    // 這個方法會被外部的交互模塊覆蓋
    console.log('Setting up question interaction for question', questionIndex);
  }

  /**
   * 設置練習模態框交互（需要外部模塊實現）
   */
  setupPracticeModalInteraction(questionContent, question) {
    // 這個方法會被外部的交互模塊覆蓋
    console.log('Setting up practice modal interaction');
  }

  /**
   * 設置題目導航
   */
  setupQuestionNavigation() {
    const prevBtn = document.getElementById('practice-prev-btn');
    const nextBtn = document.getElementById('practice-next-btn');
    
    if (prevBtn) {
      prevBtn.addEventListener('click', async () => {
        await this.loadPreviousQuestion();
      });
    }
    
    if (nextBtn) {
      nextBtn.addEventListener('click', async () => {
        await this.loadNextQuestion();
      });
    }
    
    // 設置標籤點擊事件
    const tabs = document.querySelectorAll('.practice-tab');
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', async () => {
        await this.loadQuestionAtIndex(index);
      });
    });
  }

  /**
   * 加載下一題
   */
  async loadNextQuestion() {
    if (this.currentQuestionIndex < this.currentQuestions.length - 1) {
      await this.loadQuestionAtIndex(this.currentQuestionIndex + 1);
    } else if (this.allQuestionsCompleted()) {
      this.completePractice();
    }
  }

  /**
   * 加載上一題
   */
  async loadPreviousQuestion() {
    if (this.currentQuestionIndex > 0) {
      await this.loadQuestionAtIndex(this.currentQuestionIndex - 1);
    }
  }

  /**
   * 更新標籤狀態
   */
  updateTabsStatus() {
    this.questionResults.forEach((result, index) => {
      const tabStatus = document.getElementById(`tab-status-${index}`);
      const tab = document.querySelector(`.practice-tab[data-question-index="${index}"]`);
      
      if (tabStatus && tab) {
        if (result && result.answered) {
          tabStatus.textContent = result.isCorrect ? '✅' : '❌';
          tab.classList.add(result.isCorrect ? 'correct' : 'incorrect');
        } else if (result && result.skipped) {
          tabStatus.textContent = '⏭️';
          tab.classList.add('skipped');
        } else {
          tabStatus.textContent = '⏳';
          tab.classList.remove('correct', 'incorrect', 'skipped');
        }
        
        // 設置當前活動標籤
        if (index === this.currentQuestionIndex) {
          tab.classList.add('active');
        } else {
          tab.classList.remove('active');
        }
      }
    });
  }

  /**
   * 更新導航按鈕
   */
  updateNavigationButtons() {
    const prevBtn = document.getElementById('practice-prev-btn');
    const nextBtn = document.getElementById('practice-next-btn');
    
    if (prevBtn) {
      prevBtn.disabled = this.currentQuestionIndex === 0;
    }
    
    if (nextBtn) {
      const isLastQuestion = this.currentQuestionIndex === this.currentQuestions.length - 1;
      const currentResult = this.questionResults[this.currentQuestionIndex];
      const hasAnswered = currentResult && (currentResult.answered || currentResult.skipped);
      
      if (isLastQuestion && this.allQuestionsCompleted()) {
        nextBtn.textContent = '完成練習 🎯';
        nextBtn.disabled = false;
      } else {
        nextBtn.textContent = '下一題 ➡️';
        nextBtn.disabled = !hasAnswered;
      }
    }
  }

  /**
   * 檢查是否所有題目都已完成
   */
  allQuestionsCompleted() {
    return this.questionResults.every(result => result && (result.answered || result.skipped));
  }

  /**
   * 完成練習
   */
  completePractice() {
    // 如果有完成模塊，直接顯示詳細結果
    if (this.completion && this.completion.showPracticeResults) {
      this.completion.showPracticeResults(
        this.currentQuestions,
        this.questionResults,
        this.practiceSession,
        this.feedback
      );
    } else {
      // 後備方案
      this.showPracticeComplete();
    }
  }

  /**
   * 關閉模態框
   */
  closePracticeModal() {
    const modal = document.getElementById('practice-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.style.display = 'none';
    }
  }

  /**
   * 設置新題目按鈕
   */
  setupNewQuestionButton() {
    const newQuestionBtn = document.getElementById('practice-new-question-btn');
    if (newQuestionBtn) {
      newQuestionBtn.addEventListener('click', () => {
        this.generateNewQuestionForModal();
      });
    }
  }

  /**
   * 為模態框生成新題目
   */
  async generateNewQuestionForModal() {
    try {
      const generateBtn = document.getElementById('practice-new-question-btn');
      if (generateBtn) {
        generateBtn.disabled = true;
        generateBtn.textContent = '生成中...';
      }

      if (this.app.practiceIntegration) {
        await this.app.practiceIntegration.generateNewQuestion();
      }
    } catch (error) {
      console.error('生成新題目失敗:', error);
      this.app._showNotification('生成新題目失敗，請稍後再試', 'error');
    } finally {
      const generateBtn = document.getElementById('practice-new-question-btn');
      if (generateBtn) {
        generateBtn.disabled = false;
        generateBtn.textContent = '🎲 生成新題目';
      }
    }
  }

  /**
   * 渲染題目容器
   */
  _renderQuestionsContainer(questions) {
    return `
      <div class="practice-questions-container">
        <div class="practice-tabs">
          ${questions.map((q, index) => `
            <button class="practice-tab ${index === 0 ? 'active' : ''}" data-question-index="${index}">
              <span class="tab-number">第${index + 1}題</span>
              <span class="tab-status" id="tab-status-${index}">⏳</span>
            </button>
          `).join('')}
        </div>
        <div class="practice-current-question" id="practice-current-question"></div>
        <div class="practice-navigation">
          <button id="practice-prev-btn" class="nav-button secondary-button" disabled>⬅️ 上一題</button>
          <span class="question-progress">第 <span id="current-q-num">1</span> 題 / 共 ${questions.length} 題</span>
          <button id="practice-next-btn" class="nav-button secondary-button" disabled>下一題 ➡️</button>
        </div>
      </div>
    `;
  }

  /**
   * 渲染題目內容
   */
  async _renderQuestionContent(question) {
    const questionType = question.type || 'multiple_choice';
    
    // 渲染題目文本
    const renderedQuestion = await this._renderText(question.question);
    
    return `
      <div class="practice-question-content" data-question-id="${question.id || 'unknown'}">
        <div class="practice-header">
          <h4>📚 練習題</h4>
          <span class="difficulty-badge difficulty-${question.difficulty}">${this._getDifficultyDisplayName(question.difficulty)}</span>
          <span class="question-type-badge">${this._getQuestionTypeDisplayName(questionType)}</span>
        </div>
        <div class="practice-question">
          <div class="question-text">${renderedQuestion}</div>
        </div>
        ${await this._renderQuestionInputArea(question, questionType)}
        <div class="practice-actions">
          <button class="practice-submit btn-primary" disabled>提交答案</button>
          <button class="practice-skip btn-secondary">跳過</button>
        </div>
        <div class="practice-feedback" style="display: none;"></div>
      </div>
    `;
  }

  /**
   * 渲染題目輸入區域
   */
  async _renderQuestionInputArea(question, questionType) {
    switch (questionType) {
      case 'multiple_choice':
        return await this._renderMultipleChoiceOptions(question);
      case 'fill_in_blank':
        return await this._renderFillInBlankInputs(question);
      case 'short_answer':
      case 'essay':
        return `
          <div class="practice-text-area">
            <textarea class="practice-textarea" placeholder="${this._getWritingTips(questionType)}" maxlength="500"></textarea>
            <div class="textarea-info">
              <span class="word-count-info">字數: 0 | 字符: 0</span>
              <span class="char-limit-indicator">0/500</span>
              <span class="auto-save-status">自動保存</span>
            </div>
          </div>
        `;
      case 'calculation':
        return `
          <div class="practice-calculation">
            <input type="number" class="practice-number-input" placeholder="請輸入數字答案" step="any">
            ${question.unit ? `<span class="unit-label">${question.unit}</span>` : ''}
          </div>
        `;
      default:
        return '<div class="practice-unknown">未知題型</div>';
    }
  }

  /**
   * 渲染選擇題選項
   */
  async _renderMultipleChoiceOptions(question) {
    const optionsHtml = await Promise.all(
      question.options.map(async (option, index) => {
        const cleanOption = this._cleanOptionText(option, index);
        const renderedOption = await this._renderText(cleanOption);
        
        return `
          <button class="practice-option" data-option-index="${index}" tabindex="${index === 0 ? 0 : -1}">
            <span class="option-letter">${String.fromCharCode(65 + index)}</span>
            <span class="option-text">${renderedOption}</span>
          </button>
        `;
      })
    );
    
    return `
      <div class="practice-options">
        ${optionsHtml.join('')}
      </div>
    `;
  }

  /**
   * 渲染填空題輸入
   */
  async _renderFillInBlankInputs(question) {
    const questionText = question.question;
    const blankPattern = /___+/g;
    const blanks = questionText.match(blankPattern) || [];
    
    if (blanks.length === 0) {
      return `
        <div class="practice-fill-blank">
          <input type="text" class="practice-fill-input" placeholder="請填入答案">
        </div>
      `;
    }
    
    // 渲染帶有填空的題目文本
    let html = '<div class="practice-fill-blank">';
    let lastIndex = 0;
    let blankIndex = 0;
    
    // 先處理文本中的填空部分
    const parts = [];
    questionText.replace(blankPattern, (match, offset) => {
      // 添加填空前的文本
      if (offset > lastIndex) {
        parts.push({
          type: 'text',
          content: questionText.substring(lastIndex, offset)
        });
      }
      
      // 添加填空輸入框
      parts.push({
        type: 'input',
        index: blankIndex,
        placeholder: `填空${blankIndex + 1}`
      });
      
      lastIndex = offset + match.length;
      blankIndex++;
      return match;
    });
    
    // 添加最後剩餘的文本
    if (lastIndex < questionText.length) {
      parts.push({
        type: 'text',
        content: questionText.substring(lastIndex)
      });
    }
    
    // 渲染各部分
    for (const part of parts) {
      if (part.type === 'text') {
        const renderedText = await this._renderText(part.content);
        html += `<span class="fill-blank-text">${renderedText}</span>`;
      } else if (part.type === 'input') {
        html += `<input type="text" class="practice-fill-input" placeholder="${part.placeholder}" data-blank-index="${part.index}">`;
      }
    }
    
    html += '</div>';
    return html;
  }

  /**
   * 渲染文本內容（處理 Markdown 和 LaTeX）
   */
  async _renderText(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }
    
    try {
      // 確保 content-renderer 已初始化
      if (!contentRenderer.initialized) {
        await contentRenderer.init();
      }
      
      return contentRenderer.render(text);
    } catch (error) {
      console.warn('Text rendering failed:', error);
      // 回退到基本的 HTML 轉義
      return this._escapeHtml(text);
    }
  }

  /**
   * 後處理已渲染的內容
   */
  _postProcessRenderedContent(container) {
    if (!container) return;
    
    try {
      // 應用語法高亮
      contentRenderer.highlightCodeBlocks(container);
      
      // 重新渲染數學公式（如果需要）
      contentRenderer.renderMathInElement(container);
    } catch (error) {
      console.warn('Post-processing rendered content failed:', error);
    }
  }

  /**
   * 獲取寫作提示
   */
  _getWritingTips(questionType) {
    switch (questionType) {
      case 'short_answer':
        return '請簡要回答問題，建議50-200字...';
      case 'essay':
        return '請詳細闡述您的觀點，建議200-500字...';
      default:
        return '請輸入您的答案...';
    }
  }

  /**
   * HTML 轉義（回退方案）
   */
  _escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 獲取難度顯示名稱
   */
  _getDifficultyDisplayName(difficulty) {
    switch (difficulty) {
      case 'easy': return '簡單';
      case 'medium': return '中等';
      case 'hard': return '困難';
      default: return '';
    }
  }

  /**
   * 獲取題型顯示名稱
   */
  _getQuestionTypeDisplayName(type) {
    const typeMap = {
      'multiple_choice': '選擇題',
      'fill_in_blank': '填空題',
      'short_answer': '簡答題',
      'essay': '作文題',
      'calculation': '計算題'
    };
    return typeMap[type] || '其他';
  }

  /**
   * 清理選項文本，移除重複的選項標籤
   */
  _cleanOptionText(option, index) {
    if (typeof option !== 'string') return option;
    
    const expectedLetter = String.fromCharCode(65 + index); // A, B, C, D
    const patterns = [
      // 匹配 "A) text", "A.) text", "A: text" (後面必須有符號)
      new RegExp(`^${expectedLetter}[\\)\\.:,]\\s*(.+)$`, 'i'),
      // 匹配 "AA) text", "BB) text" 等重複標籤
      new RegExp(`^${expectedLetter}${expectedLetter}[\\)\\.:,]\\s*(.+)$`, 'i'),
      // 匹配 "A text" (字母後直接跟空格)
      new RegExp(`^${expectedLetter}\\s+(.+)$`, 'i')
    ];
    
    for (const pattern of patterns) {
      const match = option.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    // 如果沒有匹配到模式，返回原文本
    return option.trim();
  }

  /**
   * 備用練習完成方法
   */
  showPracticeComplete() {
    const modal = document.getElementById('practice-modal');
    const container = document.getElementById('practice-question-container');
    const modalTitle = document.getElementById('practice-modal-title');
    
    if (!modal || !container || !modalTitle) return;
    
    modalTitle.textContent = '🎉 練習完成！';
    container.innerHTML = `
      <div class="practice-complete">
        <div class="complete-header">
          <div class="complete-icon">🎉</div>
          <h3>恭喜完成練習！</h3>
          <p>您已經完成了所有題目，請查看詳細結果。</p>
        </div>
        <div class="complete-actions">
          <button class="btn-primary" id="show-detailed-results-btn">查看詳細結果</button>
          <button class="btn-secondary" id="close-practice-modal-btn">關閉</button>
        </div>
      </div>
    `;
    
    // 設置事件監聽器
    const showResultsBtn = container.querySelector('#show-detailed-results-btn');
    const closeModalBtn = container.querySelector('#close-practice-modal-btn');
    
    if (showResultsBtn) {
      showResultsBtn.addEventListener('click', () => {
        if (this.completion && this.completion.showPracticeResults) {
          this.completion.showPracticeResults(
            this.currentQuestions,
            this.questionResults,
            this.practiceSession,
            this.feedback
          );
        }
      });
    }
    
    if (closeModalBtn) {
      closeModalBtn.addEventListener('click', () => {
        this.closePracticeModal();
      });
    }
  }
} 