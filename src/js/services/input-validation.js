/**
 * 輸入驗證服務
 * 為所有練習題型提供即時驗證功能
 */
export class InputValidationService {
  constructor() {
    this.validationRules = {
      // 填空題驗證規則
      fill_in_blank: {
        required: true,
        minLength: 1,
        maxLength: 100,
        pattern: null // 可選的正則表達式
      },
      
      // 簡答題驗證規則
      short_answer: {
        required: true,
        minLength: 5,
        maxLength: 500,
        minWords: 3
      },
      
      // 論述題驗證規則
      essay: {
        required: true,
        minLength: 50,
        maxLength: 1000,
        minWords: 20
      },
      
      // 計算題驗證規則
      calculation: {
        required: true,
        isNumber: true,
        allowNegative: true,
        allowDecimals: true,
        maxDecimals: 6
      }
    };
    
    this.errorMessages = {
      required: '此欄位為必填',
      minLength: '內容太短，至少需要 {min} 個字符',
      maxLength: '內容太長，最多只能有 {max} 個字符',
      minWords: '內容太短，至少需要 {min} 個詞',
      invalidNumber: '請輸入有效的數字',
      outOfRange: '數字超出允許範圍',
      tooManyDecimals: '小數位數過多，最多允許 {max} 位',
      invalidFormat: '格式不正確'
    };
  }

  /**
   * 驗證單個輸入
   * @param {string} value - 輸入值
   * @param {string} questionType - 題目類型
   * @param {Object} options - 額外選項
   * @returns {Object} 驗證結果
   */
  validateInput(value, questionType, options = {}) {
    const rules = { ...this.validationRules[questionType], ...options };
    const result = {
      isValid: true,
      errors: [],
      warnings: []
    };

    // 必填檢查
    if (rules.required && this._isEmpty(value)) {
      result.isValid = false;
      result.errors.push(this.errorMessages.required);
      return result;
    }

    // 如果值為空且非必填，直接返回有效
    if (this._isEmpty(value)) {
      return result;
    }

    // 根據題目類型進行具體驗證
    switch (questionType) {
      case 'fill_in_blank':
        return this._validateFillInBlank(value, rules, result);
      case 'short_answer':
        return this._validateShortAnswer(value, rules, result);
      case 'essay':
        return this._validateEssay(value, rules, result);
      case 'calculation':
        return this._validateCalculation(value, rules, result);
      default:
        return result;
    }
  }

  /**
   * 批量驗證（用於多空格填空題）
   * @param {Array} values - 輸入值陣列
   * @param {string} questionType - 題目類型
   * @param {Object} options - 額外選項
   * @returns {Object} 驗證結果
   */
  validateMultipleInputs(values, questionType, options = {}) {
    const results = values.map(value => this.validateInput(value, questionType, options));
    
    return {
      isValid: results.every(r => r.isValid),
      results: results,
      errors: results.flatMap(r => r.errors),
      warnings: results.flatMap(r => r.warnings)
    };
  }

  /**
   * 設置驗證訊息到DOM元素
   * @param {HTMLElement} container - 容器元素
   * @param {Object} validationResult - 驗證結果
   */
  displayValidationMessage(container, validationResult) {
    // 清除現有訊息
    this._clearValidationMessages(container);
    
    if (!validationResult.isValid && validationResult.errors.length > 0) {
      const errorDiv = this._createValidationMessage(validationResult.errors[0], 'error');
      container.appendChild(errorDiv);
    } else if (validationResult.warnings.length > 0) {
      const warningDiv = this._createValidationMessage(validationResult.warnings[0], 'warning');
      container.appendChild(warningDiv);
    }
  }

  /**
   * 設置輸入元素的驗證狀態
   * @param {HTMLElement} inputElement - 輸入元素
   * @param {Object} validationResult - 驗證結果
   */
  setInputValidationState(inputElement, validationResult) {
    // 移除所有驗證狀態類別
    inputElement.classList.remove('invalid', 'valid');
    inputElement.removeAttribute('aria-invalid');
    
    if (!validationResult.isValid) {
      inputElement.classList.add('invalid');
      inputElement.setAttribute('aria-invalid', 'true');
    } else if (inputElement.value.trim() !== '') {
      inputElement.classList.add('valid');
      inputElement.setAttribute('aria-invalid', 'false');
    }
  }

  // 私有方法
  _isEmpty(value) {
    return value === null || value === undefined || value.toString().trim() === '';
  }

  _validateFillInBlank(value, rules, result) {
    const cleanValue = value.toString().trim();
    
    if (rules.minLength && cleanValue.length < rules.minLength) {
      result.isValid = false;
      result.errors.push(this.errorMessages.minLength.replace('{min}', rules.minLength));
    }
    
    if (rules.maxLength && cleanValue.length > rules.maxLength) {
      result.isValid = false;
      result.errors.push(this.errorMessages.maxLength.replace('{max}', rules.maxLength));
    }
    
    if (rules.pattern && !rules.pattern.test(cleanValue)) {
      result.isValid = false;
      result.errors.push(this.errorMessages.invalidFormat);
    }
    
    return result;
  }

  _validateShortAnswer(value, rules, result) {
    const cleanValue = value.toString().trim();
    const wordCount = this._getWordCount(cleanValue);
    
    if (rules.minLength && cleanValue.length < rules.minLength) {
      result.isValid = false;
      result.errors.push(this.errorMessages.minLength.replace('{min}', rules.minLength));
    }
    
    if (rules.maxLength && cleanValue.length > rules.maxLength) {
      result.isValid = false;
      result.errors.push(this.errorMessages.maxLength.replace('{max}', rules.maxLength));
    }
    
    if (rules.minWords && wordCount < rules.minWords) {
      result.warnings.push(this.errorMessages.minWords.replace('{min}', rules.minWords));
    }
    
    // 字數接近上限時警告
    if (rules.maxLength && cleanValue.length > rules.maxLength * 0.9) {
      result.warnings.push(`字數接近上限 (${cleanValue.length}/${rules.maxLength})`);
    }
    
    return result;
  }

  _validateEssay(value, rules, result) {
    const cleanValue = value.toString().trim();
    const wordCount = this._getWordCount(cleanValue);
    
    if (rules.minLength && cleanValue.length < rules.minLength) {
      result.warnings.push(this.errorMessages.minLength.replace('{min}', rules.minLength));
    }
    
    if (rules.maxLength && cleanValue.length > rules.maxLength) {
      result.isValid = false;
      result.errors.push(this.errorMessages.maxLength.replace('{max}', rules.maxLength));
    }
    
    if (rules.minWords && wordCount < rules.minWords) {
      result.warnings.push(this.errorMessages.minWords.replace('{min}', rules.minWords));
    }
    
    // 字數接近上限時警告
    if (rules.maxLength && cleanValue.length > rules.maxLength * 0.85) {
      result.warnings.push(`建議控制字數 (${cleanValue.length}/${rules.maxLength})`);
    }
    
    return result;
  }

  _validateCalculation(value, rules, result) {
    const stringValue = value.toString().trim();
    
    // 檢查是否為數字
    const numericValue = parseFloat(stringValue);
    if (isNaN(numericValue)) {
      result.isValid = false;
      result.errors.push(this.errorMessages.invalidNumber);
      return result;
    }
    
    // 檢查負數
    if (!rules.allowNegative && numericValue < 0) {
      result.isValid = false;
      result.errors.push('不允許負數');
      return result;
    }
    
    // 檢查小數位數
    if (rules.maxDecimals !== undefined) {
      const decimalPart = stringValue.split('.')[1];
      if (decimalPart && decimalPart.length > rules.maxDecimals) {
        result.isValid = false;
        result.errors.push(this.errorMessages.tooManyDecimals.replace('{max}', rules.maxDecimals));
      }
    }
    
    // 檢查範圍
    if (rules.min !== undefined && numericValue < rules.min) {
      result.isValid = false;
      result.errors.push(`數值不能小於 ${rules.min}`);
    }
    
    if (rules.max !== undefined && numericValue > rules.max) {
      result.isValid = false;
      result.errors.push(`數值不能大於 ${rules.max}`);
    }
    
    return result;
  }

  _getWordCount(text) {
    if (!text) return 0;
    // 計算中文字數和英文單詞數
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
    return chineseChars + englishWords;
  }

  _clearValidationMessages(container) {
    const existingMessages = container.querySelectorAll('.validation-error, .validation-warning');
    existingMessages.forEach(msg => msg.remove());
  }

  _createValidationMessage(message, type) {
    const div = document.createElement('div');
    div.className = `validation-${type}`;
    div.textContent = message;
    div.setAttribute('role', 'alert');
    div.setAttribute('aria-live', 'polite');
    return div;
  }
} 