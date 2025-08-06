// practice-ui-renderer.js
// 題目渲染模塊 - 處理不同題型的HTML渲染邏輯

export class PracticeUIRenderer {
  constructor() {}

  /**
   * 渲染題目內容
   */
  renderQuestionContent(question) {
    const questionType = question.type || 'multiple_choice';
    
    return `
      <div class="practice-question-content" data-question-id="${question.id || 'unknown'}">
        <div class="practice-header">
          <h4>📚 練習題</h4>
          <span class="difficulty-badge difficulty-${question.difficulty}">${this._getDifficultyDisplayName(question.difficulty)}</span>
          <span class="question-type-badge">${this._getQuestionTypeDisplayName(questionType)}</span>
        </div>
        <div class="practice-question">
          <p>${question.question}</p>
        </div>
        ${this._renderQuestionInputArea(question, questionType)}
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
  _renderQuestionInputArea(question, questionType) {
    switch (questionType) {
      case 'multiple_choice':
        return this._renderMultipleChoice(question);
      case 'fill_in_blank':
        return this._renderFillInBlank(question);
      case 'short_answer':
      case 'essay':
        return this._renderTextArea(question, questionType);
      case 'calculation':
        return this._renderCalculation(question);
      default:
        return '<div class="practice-unknown">未知題型</div>';
    }
  }

  /**
   * 渲染選擇題
   */
  _renderMultipleChoice(question) {
    return `
      <div class="practice-options">
        ${question.options.map((option, index) => {
          const cleanOption = this._cleanOptionText(option, index);
          return `
            <button class="practice-option" data-option-index="${index}" tabindex="${index === 0 ? 0 : -1}">
              <span class="option-letter">${String.fromCharCode(65 + index)}</span>
              <span class="option-text">${cleanOption}</span>
            </button>
          `;
        }).join('')}
      </div>
    `;
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
   * 渲染填空題
   */
  _renderFillInBlank(question) {
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
    
    let html = '<div class="practice-fill-blank">';
    let lastIndex = 0;
    let blankIndex = 0;
    
    questionText.replace(blankPattern, (match, offset) => {
      html += questionText.substring(lastIndex, offset);
      html += `<input type="text" class="practice-fill-input" placeholder="填空${blankIndex + 1}" data-blank-index="${blankIndex}">`;
      lastIndex = offset + match.length;
      blankIndex++;
      return match;
    });
    
    html += questionText.substring(lastIndex);
    html += '</div>';
    
    return html;
  }

  /**
   * 渲染文本區域 (簡答題/作文題)
   */
  _renderTextArea(question, questionType) {
    const maxLength = questionType === 'essay' ? 1000 : 500;
    return `
      <div class="practice-text-area">
        <textarea 
          class="practice-textarea" 
          placeholder="${this._getWritingTips(questionType)}" 
          maxlength="${maxLength}">
        </textarea>
        <div class="textarea-info">
          <span class="word-count-info">字數: 0 | 字符: 0</span>
          <span class="char-limit-indicator">0/${maxLength}</span>
          <span class="auto-save-status">自動保存</span>
        </div>
      </div>
    `;
  }

  /**
   * 渲染計算題
   */
  _renderCalculation(question) {
    return `
      <div class="practice-calculation">
        <input type="number" class="practice-number-input" placeholder="請輸入數字答案" step="any">
        ${question.unit ? `<span class="unit-label">${question.unit}</span>` : ''}
      </div>
    `;
  }

  /**
   * 獲取寫作提示
   */
  _getWritingTips(questionType) {
    switch (questionType) {
      case 'short_answer':
        return '請簡要回答問題，建議50-200字...';
      case 'essay':
        return '請詳細闡述您的觀點，建議200-1000字...';
      default:
        return '請輸入您的答案...';
    }
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
} 