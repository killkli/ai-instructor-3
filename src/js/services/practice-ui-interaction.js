// practice-ui-interaction.js
// 交互處理模塊 - 處理用戶輸入、事件監聽、答案驗證等交互邏輯

import { InputValidationService } from './input-validation.js';

/**
 * 練習題交互邏輯模組
 * 負責處理用戶與練習題的交互，包括點擊、輸入、提交等
 */
export class PracticeUIInteraction {
  constructor() {
    this.validationService = new InputValidationService();
    this.autoSaveTimeout = null;
    this.lastSavedContent = '';
  }

  /**
   * 設置練習交互（聊天界面中的單題）
   */
  setupPracticeInteraction(questionContent, question, app, practiceSession, achievementService = null) {
    const questionType = question.type || 'multiple_choice';
    const submitButton = questionContent.querySelector('.practice-submit');
    const skipButton = questionContent.querySelector('.practice-skip');
    const feedbackDiv = questionContent.querySelector('.practice-feedback');
    let questionStartTime = Date.now();
    
    // 根據題型設置不同的交互邏輯
    this._setupQuestionTypeInteraction(questionContent, question, questionType, submitButton);
    
    submitButton.addEventListener('click', async () => {
      const userAnswer = this._getUserAnswer(questionContent, question, questionType);
      if (userAnswer === null) return;
      
      const responseTime = Math.round((Date.now() - questionStartTime) / 1000);
      const isCorrect = this._validateAnswer(userAnswer, question, questionType);
      
      // 禁用所有輸入元素
      this._disableQuestionInputs(questionContent, questionType);
      submitButton.disabled = true;
      skipButton.disabled = true;
      
      // 顯示反饋（需要從外部傳入反饋顯示方法）
      await practiceSession.recordPracticeResult(question, userAnswer, isCorrect, responseTime, achievementService);
      
      setTimeout(() => {
        if (isCorrect) {
          app.messageProcessingManager.addMessageToUI('assistant', '✨ 太棒了！回答正確！您想繼續練習更多題目嗎？');
        } else {
          app.messageProcessingManager.addMessageToUI('assistant', `📝 這題答錯了，不過沒關係！${question.explanation}\n\n要不要再試一道類似的題目來加強練習？`);
        }
      }, 2000);
    });
    
    skipButton.addEventListener('click', () => {
      app.messageProcessingManager.addMessageToUI('assistant', '好的，我們跳過這道題。如果您想練習其他題目，可以使用 /practice 指令哦！');
    });
  }

  /**
   * 設置題目交互（模態框中的多題）
   */
  setupQuestionInteraction(questionContainer, question, questionIndex, questionResults, practiceSession, callbacks, achievementService = null) {
    const questionType = question.type || 'multiple_choice';
    const submitButton = questionContainer.querySelector('.practice-submit');
    const skipButton = questionContainer.querySelector('.practice-skip');
    const feedbackDiv = questionContainer.querySelector('.practice-feedback');
    let questionStartTime = Date.now();
    
    // 根據題型設置不同的交互邏輯
    this._setupQuestionTypeInteraction(questionContainer, question, questionType, submitButton);
    
    submitButton.addEventListener('click', async () => {
      const userAnswer = this._getUserAnswer(questionContainer, question, questionType);
      if (userAnswer === null) return;
      
      const responseTime = Math.round((Date.now() - questionStartTime) / 1000);
      const isCorrect = this._validateAnswer(userAnswer, question, questionType);
      
      // 禁用所有輸入元素
      this._disableQuestionInputs(questionContainer, questionType);
      submitButton.disabled = true;
      
      // 立即顯示反饋
      if (callbacks.showFeedback) {
        callbacks.showFeedback(feedbackDiv, question, userAnswer, isCorrect, null, questionType);
      }
      
      // 記錄結果
      questionResults[questionIndex] = {
        question,
        selectedAnswer: userAnswer,
        selectedOptionIndex: null,
        isCorrect,
        answered: true,
        responseTime: responseTime
      };
      
      // 更新UI狀態
      if (callbacks.updateTabsStatus) callbacks.updateTabsStatus();
      if (callbacks.updateNavigationButtons) callbacks.updateNavigationButtons();
      
      // 在背景中記錄到數據庫（不阻塞UI）
      practiceSession.recordPracticeResult(question, userAnswer, isCorrect, responseTime, achievementService).catch(error => {
        console.warn('記錄練習結果失敗:', error);
      });
    });
    
    skipButton.addEventListener('click', () => {
      questionResults[questionIndex] = {
        question,
        selectedAnswer: null,
        selectedOptionIndex: null,
        isCorrect: false,
        skipped: true
      };
      
      if (callbacks.updateTabsStatus) callbacks.updateTabsStatus();
      if (callbacks.loadNextQuestion) {
        callbacks.loadNextQuestion(questionIndex);
      }
    });
  }

  /**
   * 根據題型設置交互邏輯
   */
  _setupQuestionTypeInteraction(questionContent, question, questionType, submitButton) {
    switch (questionType) {
      case 'multiple_choice':
        this._setupMultipleChoiceInteraction(questionContent, submitButton);
        break;
      case 'fill_in_blank':
        this._setupFillInBlankInteraction(questionContent, submitButton);
        break;
      case 'short_answer':
      case 'essay':
        this._setupTextAreaInteraction(questionContent, submitButton);
        break;
      case 'calculation':
        this._setupCalculationInteraction(questionContent, submitButton);
        break;
    }
  }

  /**
   * 多選題交互
   */
  _setupMultipleChoiceInteraction(questionContent, submitButton) {
    const optionButtons = questionContent.querySelectorAll('.practice-option');
    
    optionButtons.forEach((button, index) => {
      // 點擊事件
      button.addEventListener('click', () => {
        this._selectOption(optionButtons, button, submitButton);
      });
      
      // 鍵盤事件支持
      button.addEventListener('keydown', (e) => {
        switch(e.key) {
          case 'Enter':
          case ' ':
            e.preventDefault();
            this._selectOption(optionButtons, button, submitButton);
            break;
          case 'ArrowDown':
            e.preventDefault();
            this._focusNextOption(optionButtons, index, 1);
            break;
          case 'ArrowUp':
            e.preventDefault();
            this._focusNextOption(optionButtons, index, -1);
            break;
        }
      });
    });
    
    // 設置第一個選項為可聚焦
    if (optionButtons.length > 0) {
      optionButtons[0].tabIndex = 0;
      optionButtons.forEach((btn, idx) => {
        if (idx > 0) btn.tabIndex = -1;
      });
    }
  }

  /**
   * 選擇選項的通用方法
   */
  _selectOption(optionButtons, selectedButton, submitButton) {
    optionButtons.forEach(btn => btn.classList.remove('selected'));
    selectedButton.classList.add('selected');
    submitButton.disabled = false;
    
    // 更新 tabIndex
    optionButtons.forEach(btn => btn.tabIndex = -1);
    selectedButton.tabIndex = 0;
  }

  /**
   * 聚焦下一個選項
   */
  _focusNextOption(optionButtons, currentIndex, direction) {
    const nextIndex = (currentIndex + direction + optionButtons.length) % optionButtons.length;
    optionButtons[nextIndex].focus();
    
    // 更新 tabIndex
    optionButtons.forEach(btn => btn.tabIndex = -1);
    optionButtons[nextIndex].tabIndex = 0;
  }

  /**
   * 填空題交互
   */
  _setupFillInBlankInteraction(questionContent, submitButton) {
    const inputs = questionContent.querySelectorAll('.practice-fill-input');
    
    const checkInputs = () => {
      let hasValidInput = false;
      let allValid = true;
      
      inputs.forEach((input, index) => {
        // 包裝輸入元素以便顯示驗證訊息
        if (!input.parentElement.classList.contains('input-validation-container')) {
          const wrapper = document.createElement('div');
          wrapper.className = 'input-validation-container';
          input.parentElement.insertBefore(wrapper, input);
          wrapper.appendChild(input);
        }
        
        const container = input.parentElement;
        const value = input.value.trim();
        
        // 驗證輸入
        const validationResult = this.validationService.validateInput(value, 'fill_in_blank');
        
        // 設置驗證狀態
        this.validationService.setInputValidationState(input, validationResult);
        this.validationService.displayValidationMessage(container, validationResult);
        
        if (value !== '') {
          hasValidInput = true;
        }
        
        if (!validationResult.isValid) {
          allValid = false;
        }
      });
      
      submitButton.disabled = !hasValidInput;
    };

    inputs.forEach(input => {
      input.addEventListener('input', checkInputs);
      input.addEventListener('blur', checkInputs);
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          submitButton.click();
        }
      });
    });
    
    // 初始檢查
    checkInputs();
  }

  /**
   * 文本框交互（簡答題、作文題）
   */
  _setupTextAreaInteraction(questionContent, submitButton) {
    const textarea = questionContent.querySelector('.practice-textarea');
    const wordCountInfo = questionContent.querySelector('.word-count-info');
    const charLimitIndicator = questionContent.querySelector('.char-limit-indicator');
    const autoSaveStatus = questionContent.querySelector('.auto-save-status');
    const questionId = questionContent.getAttribute('data-question-id') || 'unknown';
    
    let autoSaveTimeout;
    let lastSavedContent = '';
    
    // 恢復自動保存的內容
    this._restoreAutoSavedContent(textarea, questionId);
    
    const updateWordCount = () => {
      const text = textarea.value.trim();
      const charCount = textarea.value.length;
      const wordCount = text ? text.match(/[\u4e00-\u9fa5]|[a-zA-Z]+/g)?.length || 0 : 0;
      const maxLength = parseInt(textarea.getAttribute('maxlength')) || 500;
      
      // 決定題目類型
      const questionType = maxLength > 500 ? 'essay' : 'short_answer';
      
      // 包裝文本域以便顯示驗證訊息
      if (!textarea.parentElement.classList.contains('input-validation-container')) {
        const wrapper = document.createElement('div');
        wrapper.className = 'input-validation-container';
        textarea.parentElement.insertBefore(wrapper, textarea);
        wrapper.appendChild(textarea);
      }
      
      const container = textarea.parentElement;
      
      // 進行驗證
      const validationResult = this.validationService.validateInput(textarea.value, questionType, {
        maxLength: maxLength,
        minLength: questionType === 'essay' ? 50 : 5,
        minWords: questionType === 'essay' ? 20 : 3
      });
      
      // 設置驗證狀態
      this.validationService.setInputValidationState(textarea, validationResult);
      this.validationService.displayValidationMessage(container, validationResult);
      
      // 更新字數顯示
      if (wordCountInfo) {
        wordCountInfo.textContent = `字數: ${wordCount} | 字符: ${charCount}`;
      }
      
      // 更新字符限制指示器
      if (charLimitIndicator) {
        charLimitIndicator.textContent = `${charCount}/${maxLength}`;
        charLimitIndicator.className = 'char-limit-indicator';
        
        if (charCount > maxLength * 0.9) {
          charLimitIndicator.classList.add('warning');
        }
        if (charCount >= maxLength) {
          charLimitIndicator.classList.add('error');
        }
      }
      
      // 啟用/禁用提交按鈕 - 要求至少有內容且通過基本驗證
      const hasContent = wordCount > 0;
      const isValidForSubmit = validationResult.isValid || validationResult.errors.length === 0;
      submitButton.disabled = !hasContent || !isValidForSubmit;
      
      // 自動保存邏輯
      if (textarea.value !== lastSavedContent) {
        this._scheduleAutoSave(textarea, autoSaveStatus, questionId);
      }
    };
    
    const handleKeydown = (e) => {
      // Ctrl+Enter 快速提交
      if (e.ctrlKey && e.key === 'Enter' && !submitButton.disabled) {
        e.preventDefault();
        submitButton.click();
      }
    };
    
    // 事件監聽
    textarea.addEventListener('input', updateWordCount);
    textarea.addEventListener('paste', () => setTimeout(updateWordCount, 10));
    textarea.addEventListener('keydown', handleKeydown);
    
    // 焦點事件
    textarea.addEventListener('focus', () => {
      textarea.classList.add('focused');
    });
    
    textarea.addEventListener('blur', () => {
      textarea.classList.remove('focused');
      this._performAutoSave(textarea, autoSaveStatus, questionId);
    });
    
    // 初始檢查
    updateWordCount();
  }

  /**
   * 計算題交互
   */
  _setupCalculationInteraction(questionContent, submitButton) {
    const input = questionContent.querySelector('.practice-number-input');
    
    // 包裝輸入元素以便顯示驗證訊息
    if (!input.parentElement.classList.contains('input-validation-container')) {
      const wrapper = document.createElement('div');
      wrapper.className = 'input-validation-container number-input-container';
      input.parentElement.insertBefore(wrapper, input);
      wrapper.appendChild(input);
      
      // 添加格式提示
      const hint = document.createElement('div');
      hint.className = 'number-format-hint hide';
      hint.textContent = '支援整數、小數、負數和科學記號格式';
      wrapper.appendChild(hint);
    }
    
    const container = input.parentElement;
    const hint = container.querySelector('.number-format-hint');
    
    const checkInput = () => {
      const value = input.value.trim();
      
      // 驗證數值格式
      const validationResult = this.validationService.validateInput(value, 'calculation', {
        maxDecimals: 6,
        allowNegative: true
      });
      
      // 設置驗證狀態
      this.validationService.setInputValidationState(input, validationResult);
      this.validationService.displayValidationMessage(container, validationResult);
      
      // 控制提交按鈕
      const hasValidValue = value !== '' && validationResult.isValid;
      submitButton.disabled = !hasValidValue;
    };

    input.addEventListener('input', checkInput);
    input.addEventListener('blur', checkInput);
    
    input.addEventListener('focus', () => {
      if (hint) {
        hint.classList.remove('hide');
        hint.classList.add('show');
      }
    });
    
    input.addEventListener('blur', () => {
      if (hint && !input.value.trim()) {
        hint.classList.remove('show');
        hint.classList.add('hide');
      }
    });
    
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !submitButton.disabled) {
        submitButton.click();
      }
    });
    
    // 初始檢查
    checkInput();
  }

  /**
   * 獲取用戶答案
   */
  _getUserAnswer(questionContent, question, questionType) {
    switch (questionType) {
      case 'multiple_choice':
        const selectedOption = questionContent.querySelector('.practice-option.selected');
        if (!selectedOption) return null;
        const selectedIndex = parseInt(selectedOption.dataset.optionIndex);
        return question.options[selectedIndex];

      case 'fill_in_blank':
        const inputs = questionContent.querySelectorAll('.practice-fill-input');
        if (inputs.length === 1) {
          return inputs[0].value.trim();
        } else {
          return Array.from(inputs).map(input => input.value.trim());
        }

      case 'short_answer':
      case 'essay':
        const textarea = questionContent.querySelector('.practice-textarea');
        return textarea.value.trim();

      case 'calculation':
        const numberInput = questionContent.querySelector('.practice-number-input');
        const value = numberInput.value.trim();
        return value ? parseFloat(value) : null;

      default:
        return null;
    }
  }

  /**
   * 驗證答案
   */
  _validateAnswer(userAnswer, question, questionType) {
    if (!userAnswer && userAnswer !== 0) return false;

    switch (questionType) {
      case 'multiple_choice':
        const selectedIndex = question.options.indexOf(userAnswer);
        const selectedOptionLetter = String.fromCharCode(65 + selectedIndex);
        const isCorrectByIndex = selectedOptionLetter === question.correctAnswer.trim().toUpperCase();
        const normalizedSelected = userAnswer.trim().toLowerCase();
        const normalizedCorrect = question.correctAnswer.trim().toLowerCase();
        const isCorrectByContent = normalizedSelected === normalizedCorrect;
        return isCorrectByIndex || isCorrectByContent;

      case 'fill_in_blank':
        if (Array.isArray(userAnswer)) {
          // 多個空格
          if (!Array.isArray(question.correctAnswer)) return false;
          return userAnswer.every((answer, index) => {
            const cleanAnswer = answer.trim().toLowerCase();
            const correctAnswers = Array.isArray(question.correctAnswer[index]) 
              ? question.correctAnswer[index] 
              : [question.correctAnswer[index]];
            return correctAnswers.some(correct => 
              cleanAnswer === (correct || '').toString().trim().toLowerCase()
            );
          });
        } else {
          // 單個空格
          const cleanAnswer = userAnswer.trim().toLowerCase();
          let correctAnswers = Array.isArray(question.correctAnswer) 
            ? question.correctAnswer 
            : [question.correctAnswer];
          
          if (Array.isArray(correctAnswers[0])) {
            correctAnswers = correctAnswers[0];
          }
          
          return correctAnswers.some(correct => 
            cleanAnswer === (correct || '').toString().trim().toLowerCase()
          );
        }

      case 'calculation':
        const correctValue = parseFloat(question.correctAnswer);
        const tolerance = question.tolerance || 0.01;
        return Math.abs(userAnswer - correctValue) <= tolerance;

      case 'short_answer':
        return userAnswer.toLowerCase().includes(question.correctAnswer.toLowerCase()) ||
               question.correctAnswer.toLowerCase().includes(userAnswer.toLowerCase());

      case 'essay':
        return true; // 作文題通常需要人工評分

      default:
        return false;
    }
  }

  /**
   * 禁用題目輸入元素
   */
  _disableQuestionInputs(questionContent, questionType) {
    switch (questionType) {
      case 'multiple_choice':
        const optionButtons = questionContent.querySelectorAll('.practice-option');
        optionButtons.forEach(btn => btn.disabled = true);
        break;
      case 'fill_in_blank':
        const inputs = questionContent.querySelectorAll('.practice-fill-input');
        inputs.forEach(input => input.disabled = true);
        break;
      case 'short_answer':
      case 'essay':
        const textarea = questionContent.querySelector('.practice-textarea');
        textarea.disabled = true;
        break;
      case 'calculation':
        const numberInput = questionContent.querySelector('.practice-number-input');
        numberInput.disabled = true;
        break;
    }
  }

  /**
   * 安排自動保存
   */
  _scheduleAutoSave(textarea, autoSaveStatus, questionId) {
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }
    
    this.autoSaveTimeout = setTimeout(() => {
      this._performAutoSave(textarea, autoSaveStatus, questionId);
    }, 2000); // 2秒後自動保存
  }

  /**
   * 執行自動保存
   */
  _performAutoSave(textarea, autoSaveStatus, questionId) {
    if (!textarea.value.trim()) return;
    
    const content = textarea.value;
    
    try {
      const savedAnswers = JSON.parse(localStorage.getItem('practice_auto_save') || '{}');
      savedAnswers[questionId] = {
        content: content,
        timestamp: Date.now()
      };
      localStorage.setItem('practice_auto_save', JSON.stringify(savedAnswers));
      
      // 顯示保存狀態
      if (autoSaveStatus) {
        autoSaveStatus.textContent = '已自動保存';
        autoSaveStatus.classList.add('visible');
        textarea.classList.add('auto-saved');
        
        setTimeout(() => {
          autoSaveStatus.classList.remove('visible');
          textarea.classList.remove('auto-saved');
        }, 2000);
      }
      
      this.lastSavedContent = content;
    } catch (error) {
      console.warn('自動保存失敗:', error);
    }
  }

  /**
   * 恢復自動保存的內容
   */
  _restoreAutoSavedContent(textarea, questionId) {
    try {
      const savedAnswers = JSON.parse(localStorage.getItem('practice_auto_save') || '{}');
      const savedAnswer = savedAnswers[questionId];
      
      if (savedAnswer && savedAnswer.content) {
        // 檢查保存時間（24小時內有效）
        const hoursSinceLastSave = (Date.now() - savedAnswer.timestamp) / (1000 * 60 * 60);
        if (hoursSinceLastSave < 24) {
          textarea.value = savedAnswer.content;
          return true;
        }
      }
    } catch (error) {
      console.warn('恢復自動保存內容失敗:', error);
    }
    return false;
  }
} 