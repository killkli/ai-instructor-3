// practice-ui-feedback.js
// 反饋與評分模塊 - 處理答案驗證、反饋顯示、視覺效果等

export class PracticeUIFeedback {
  constructor(app) {
    this.app = app;
  }

  /**
   * 顯示練習反饋（基礎版本）
   */
  showPracticeFeedback(feedbackDiv, question, selectedAnswer, isCorrect, selectedIndex, questionType = 'multiple_choice') {
    // 針對多選題的視覺反饋
    if (questionType === 'multiple_choice') {
      const correctIndex = question.options.indexOf(question.correctAnswer);
      const optionButtons = feedbackDiv.parentElement.querySelectorAll('.practice-option');
      optionButtons.forEach((button, index) => {
        if (index === correctIndex) button.classList.add('correct');
        else if (index === selectedIndex && !isCorrect) button.classList.add('incorrect');
      });
    }

    // 針對填空題的視覺反饋
    if (questionType === 'fill_in_blank') {
      const inputs = feedbackDiv.parentElement.querySelectorAll('.practice-fill-input');
      inputs.forEach((input, index) => {
        if (Array.isArray(selectedAnswer)) {
          // 多個空格的情況
          const userAnswer = selectedAnswer[index] || '';
          const correctAnswers = Array.isArray(question.correctAnswer[index])
            ? question.correctAnswer[index]
            : [question.correctAnswer[index]];
          const isAnswerCorrect = correctAnswers.some(correct =>
            userAnswer.trim().toLowerCase() === (correct || '').toString().trim().toLowerCase()
          );
          input.classList.add(isAnswerCorrect ? 'correct' : 'incorrect');
        } else {
          // 單個空格的情況
          input.classList.add(isCorrect ? 'correct' : 'incorrect');
        }
      });
    }

    // 針對不同題型顯示不同的正確答案格式
    const correctAnswerDisplay = this._formatCorrectAnswer(question, questionType);
    const userAnswerDisplay = this._formatUserAnswer(selectedAnswer, questionType);

    feedbackDiv.innerHTML = `
      <div class="feedback-content ${isCorrect ? 'correct' : 'incorrect'}">
        <div class="feedback-result">
          <span class="feedback-icon">${isCorrect ? '✅' : '❌'}</span>
          <span class="feedback-text">${isCorrect ? '回答正確！' : '回答錯誤'}</span>
        </div>
        <div class="feedback-explanation">
          <strong>您的答案：</strong>${userAnswerDisplay}<br>
          <strong>正確答案：</strong>${correctAnswerDisplay}<br>
          <strong>解釋：</strong>${this.app.contentRenderer.render(question.explanation) || '暫無詳細說明'}
        </div>
      </div>
    `;
    feedbackDiv.style.display = 'block';
  }

  /**
   * 顯示練習反饋（支持Markdown渲染）
   */
  showPracticeFeedbackWithMarkdown(feedbackDiv, question, selectedAnswer, isCorrect, selectedIndex, questionType = 'multiple_choice') {
    // 針對多選題的視覺反饋
    if (questionType === 'multiple_choice') {
      const correctIndex = question.options.indexOf(question.correctAnswer);
      const optionButtons = feedbackDiv.parentElement.querySelectorAll('.practice-option');
      optionButtons.forEach((button, index) => {
        if (index === correctIndex) button.classList.add('correct');
        else if (index === selectedIndex && !isCorrect) button.classList.add('incorrect');
      });
    }

    // 針對不同題型顯示不同的正確答案格式
    const correctAnswerDisplay = this._formatCorrectAnswer(question, questionType);
    const userAnswerDisplay = this._formatUserAnswer(selectedAnswer, questionType);

    const explanation = question.explanation || '暫無詳細說明';
    const renderedExplanation = this.app.contentRenderer ?
      this.app.contentRenderer.render(explanation) :
      explanation.replace(/\n/g, '<br>');

    feedbackDiv.innerHTML = `
      <div class="feedback-content ${isCorrect ? 'correct' : 'incorrect'}">
        <div class="feedback-result">
          <span class="feedback-icon">${isCorrect ? '✅' : '❌'}</span>
          <span class="feedback-text">${isCorrect ? '回答正確！' : '回答錯誤'}</span>
        </div>
        <div class="feedback-explanation">
          <strong>您的答案：</strong>${userAnswerDisplay}<br>
          <strong>正確答案：</strong>${correctAnswerDisplay}<br>
          <strong>解釋：</strong>
          <div class="explanation-content">${renderedExplanation}</div>
        </div>
      </div>
    `;
    feedbackDiv.style.display = 'block';

    // 渲染數學公式和代碼高亮
    if (this.app.contentRenderer) {
      const explanationContent = feedbackDiv.querySelector('.explanation-content');
      if (explanationContent) {
        this.app.contentRenderer.highlightCodeBlocks(explanationContent);
        this.app.contentRenderer.renderMathInElement(explanationContent);
      }
    }

  }

  /**
   * 格式化正確答案顯示
   */
  _formatCorrectAnswer(question, questionType) {
    switch (questionType) {
      case 'multiple_choice':
        return question.correctAnswer;
      case 'fill_in_blank':
        if (Array.isArray(question.correctAnswer)) {
          return question.correctAnswer.join(', ');
        }
        return question.correctAnswer;
      case 'calculation':
        return question.correctAnswer + (question.unit ? ` ${question.unit}` : '');
      default:
        return question.correctAnswer;
    }
  }

  /**
   * 格式化用戶答案顯示
   */
  _formatUserAnswer(userAnswer, questionType) {
    switch (questionType) {
      case 'fill_in_blank':
        if (Array.isArray(userAnswer)) {
          return userAnswer.join(', ');
        }
        return userAnswer;
      case 'short_answer':
      case 'essay':
        return userAnswer.length > 50 ? userAnswer.substring(0, 50) + '...' : userAnswer;
      default:
        return userAnswer;
    }
  }

  /**
   * 獲取正確答案文本（用於錯題回顧）
   */
  getCorrectAnswerText(question) {
    return question.correctAnswer || '未知';
  }

  /**
   * 獲取準確率等級
   */
  getAccuracyLevel(accuracy) {
    if (accuracy >= 90) return 'excellent';
    if (accuracy >= 80) return 'good';
    if (accuracy >= 60) return 'fair';
    return 'needs-improvement';
  }

  /**
   * 生成學習建議
   */
  generateLearningTips(accuracy, incorrectCount, totalCount) {
    const tips = [];

    if (accuracy >= 90) {
      tips.push('🌟 您的表現非常優秀！可以嘗試更有挑戰性的題目');
      tips.push('📈 建議繼續保持這種學習狀態，並拓展相關知識領域');
    } else if (accuracy >= 80) {
      tips.push('👍 整體表現良好，建議重點複習答錯的題目');
      tips.push('📝 可以針對薄弱環節進行專項練習');
    } else if (accuracy >= 60) {
      tips.push('💪 還有進步空間，建議加強基礎概念的理解');
      tips.push('📚 多做類似題目來鞏固知識點');
    } else {
      tips.push('🎯 建議從基礎開始，循序漸進地學習');
      tips.push('🤝 可以尋求老師或同學的幫助來理解難點');
      tips.push('⏰ 保持耐心，學習是一個持續的過程');
    }

    if (incorrectCount > 0) {
      tips.push(`🔍 特別關注下方的${incorrectCount}道錯題，理解錯誤原因`);
    }

    return tips;
  }

  /**
   * 為填空題添加視覺反饋
   */
  addFillInBlankVisualFeedback(questionContent, selectedAnswer, question, isCorrect) {
    const inputs = questionContent.querySelectorAll('.practice-fill-input');
    inputs.forEach((input, index) => {
      if (Array.isArray(selectedAnswer)) {
        // 多個空格的情況
        const userAnswer = selectedAnswer[index] || '';
        const correctAnswers = Array.isArray(question.correctAnswer[index])
          ? question.correctAnswer[index]
          : [question.correctAnswer[index]];
        const isAnswerCorrect = correctAnswers.some(correct =>
          userAnswer.trim().toLowerCase() === (correct || '').toString().trim().toLowerCase()
        );
        input.classList.add(isAnswerCorrect ? 'correct' : 'incorrect');
      } else {
        // 單個空格的情況
        input.classList.add(isCorrect ? 'correct' : 'incorrect');
      }
    });
  }

  /**
   * 為多選題添加視覺反饋
   */
  addMultipleChoiceVisualFeedback(questionContent, question, selectedIndex, isCorrect) {
    const correctIndex = question.options.indexOf(question.correctAnswer);
    const optionButtons = questionContent.querySelectorAll('.practice-option');
    optionButtons.forEach((button, index) => {
      if (index === correctIndex) {
        button.classList.add('correct');
      } else if (index === selectedIndex && !isCorrect) {
        button.classList.add('incorrect');
      }
    });
  }

  /**
   * 創建反饋動畫效果
   */
  createFeedbackAnimation(feedbackDiv, isCorrect) {
    // 添加動畫類
    feedbackDiv.classList.add('feedback-animate');

    // 根據正確性添加不同的動畫效果
    if (isCorrect) {
      feedbackDiv.classList.add('success-animation');
    } else {
      feedbackDiv.classList.add('error-animation');
    }

    // 移除動畫類（避免重複觸發）
    setTimeout(() => {
      feedbackDiv.classList.remove('feedback-animate', 'success-animation', 'error-animation');
    }, 1000);
  }

  /**
   * 顯示答案解析彈窗
   */
  showAnswerExplanationModal(question, userAnswer, isCorrect) {
    const modal = document.createElement('div');
    modal.className = 'answer-explanation-modal';
    modal.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content">
          <div class="modal-header">
            <h3>${isCorrect ? '🎉 回答正確！' : '📚 答案解析'}</h3>
            <button class="modal-close">&times;</button>
          </div>
          <div class="modal-body">
            <div class="question-review">
              <h4>題目：</h4>
              <p>${question.question}</p>
            </div>
            <div class="answer-comparison">
              <div class="user-answer ${isCorrect ? 'correct' : 'incorrect'}">
                <h4>您的答案：</h4>
                <p>${userAnswer}</p>
              </div>
              <div class="correct-answer">
                <h4>正確答案：</h4>
                <p>${question.correctAnswer}</p>
              </div>
            </div>
            <div class="explanation">
              <h4>詳細解釋：</h4>
              <div class="explanation-content">${this.app.contentRenderer.render(question.explanation) || '暫無詳細說明'}</div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-primary modal-understand">我明白了</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // 設置關閉事件
    const closeModal = () => {
      modal.remove();
    };

    modal.querySelector('.modal-close').addEventListener('click', closeModal);
    modal.querySelector('.modal-understand').addEventListener('click', closeModal);
    modal.querySelector('.modal-overlay').addEventListener('click', (e) => {
      if (e.target === modal.querySelector('.modal-overlay')) {
        closeModal();
      }
    });

    // 渲染數學公式和代碼高亮
    if (this.app.contentRenderer) {
      const explanationContent = modal.querySelector('.explanation-content');
      if (explanationContent) {
        this.app.contentRenderer.highlightCodeBlocks(explanationContent);
        this.app.contentRenderer.renderMathInElement(explanationContent);
      }
    }
  }
} 
