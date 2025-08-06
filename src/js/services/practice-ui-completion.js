// practice-ui-completion.js
// 練習完成模塊 - 處理結果統計、完成頁面、錯題回顧等

export class PracticeUICompletion {
  constructor(app, practiceSession) {
    this.app = app;
    this.practiceSession = practiceSession;
  }

  /**
   * 顯示練習完成結果
   */
  showPracticeResults(questions, questionResults, practiceSession, feedback) {
    const modal = document.getElementById('practice-modal');
    const container = document.getElementById('practice-question-container');
    const modalTitle = document.getElementById('practice-modal-title');
    
    if (!modal || !container || !modalTitle) return;
    
    // 計算統計數據
    const stats = this._calculateStats(questionResults);
    
    modalTitle.textContent = '📊 練習完成';
    container.innerHTML = this._generateResultsHTML(stats, questionResults, questions);
    
    // 設置事件監聽器
    this._setupResultsEventListeners(container, questions, questionResults, practiceSession, feedback);
  }

  /**
   * 計算統計數據
   */
  _calculateStats(questionResults) {
    const totalQuestions = questionResults.length;
    const answeredQuestions = questionResults.filter(result => result.answered).length;
    const correctAnswers = questionResults.filter(result => result.isCorrect).length;
    const skippedQuestions = questionResults.filter(result => result.skipped).length;
    const accuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
    const completionRate = totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0;
    
    // 計算平均回答時間
    const answeredResults = questionResults.filter(result => result.answered && result.responseTime);
    const avgResponseTime = answeredResults.length > 0 
      ? Math.round(answeredResults.reduce((sum, result) => sum + result.responseTime, 0) / answeredResults.length)
      : 0;

    return {
      totalQuestions,
      answeredQuestions,
      correctAnswers,
      incorrectAnswers: answeredQuestions - correctAnswers,
      skippedQuestions,
      accuracy,
      completionRate,
      avgResponseTime
    };
  }

  /**
   * 生成結果頁面HTML
   */
  _generateResultsHTML(stats, questionResults, questions) {
    const accuracyLevel = this._getAccuracyLevel(stats.accuracy);
    const learningTips = this._generateLearningTips(stats.accuracy, stats.incorrectAnswers, stats.totalQuestions);
    
    return `
      <div class="practice-results">
        <div class="results-header">
          <div class="results-score ${accuracyLevel}">
            <div class="score-circle">
              <span class="score-number">${stats.accuracy}%</span>
              <span class="score-label">準確率</span>
            </div>
          </div>
          <div class="results-summary">
            <h3>練習完成！</h3>
            <p class="results-message">${this._getResultsMessage(stats.accuracy)}</p>
          </div>
        </div>
        
        <div class="results-stats">
          <div class="stat-item">
            <span class="stat-number">${stats.totalQuestions}</span>
            <span class="stat-label">總題數</span>
          </div>
          <div class="stat-item correct">
            <span class="stat-number">${stats.correctAnswers}</span>
            <span class="stat-label">正確</span>
          </div>
          <div class="stat-item incorrect">
            <span class="stat-number">${stats.incorrectAnswers}</span>
            <span class="stat-label">錯誤</span>
          </div>
          <div class="stat-item skipped">
            <span class="stat-number">${stats.skippedQuestions}</span>
            <span class="stat-label">跳過</span>
          </div>
        </div>

        ${stats.avgResponseTime > 0 ? `
          <div class="results-time">
            <span class="time-label">平均答題時間：</span>
            <span class="time-value">${stats.avgResponseTime}秒</span>
          </div>
        ` : ''}

        <div class="results-progress">
          <div class="progress-bar">
            <div class="progress-fill correct" style="width: ${(stats.correctAnswers / stats.totalQuestions) * 100}%"></div>
            <div class="progress-fill incorrect" style="width: ${(stats.incorrectAnswers / stats.totalQuestions) * 100}%"></div>
            <div class="progress-fill skipped" style="width: ${(stats.skippedQuestions / stats.totalQuestions) * 100}%"></div>
          </div>
          <div class="progress-legend">
            <span class="legend-item correct">正確 (${stats.correctAnswers})</span>
            <span class="legend-item incorrect">錯誤 (${stats.incorrectAnswers})</span>
            <span class="legend-item skipped">跳過 (${stats.skippedQuestions})</span>
          </div>
        </div>

        <div class="learning-tips">
          <h4>📚 學習建議</h4>
          <ul>
            ${learningTips.map(tip => `<li>${tip}</li>`).join('')}
          </ul>
        </div>

        ${stats.incorrectAnswers > 0 ? `
          <div class="incorrect-questions-section">
            <h4>❌ 錯題回顧 (${stats.incorrectAnswers}題)</h4>
            <div class="incorrect-questions-list">
              ${this._generateIncorrectQuestionsHTML(questionResults, questions)}
            </div>
          </div>
        ` : ''}

        <div class="results-actions">
          <button class="btn-secondary practice-again">再練一次</button>
          <button class="btn-primary practice-new">新的練習</button>
          <button class="btn-outline practice-export">導出結果</button>
        </div>
      </div>
    `;
  }

  /**
   * 生成錯題回顧HTML
   */
  _generateIncorrectQuestionsHTML(questionResults, questions) {
    return questionResults
      .map((result, index) => {
        if (!result.answered || result.isCorrect) return '';
        
        const question = questions[index];
        return `
          <div class="incorrect-question-item" data-question-index="${index}">
            <div class="question-header">
              <span class="question-number">第 ${index + 1} 題</span>
              <span class="question-type">${this._getQuestionTypeDisplayName(question.type)}</span>
            </div>
            <div class="question-content">
              <p class="question-text">${question.question}</p>
              <div class="answer-comparison">
                <div class="your-answer incorrect">
                  <strong>您的答案：</strong>${result.selectedAnswer || '未作答'}
                </div>
                <div class="correct-answer">
                  <strong>正確答案：</strong>${question.correctAnswer}
                </div>
              </div>
              <div class="question-explanation">
                <strong>解釋：</strong>
                <div class="explanation-content">${question.explanation || '暫無詳細說明'}</div>
              </div>
            </div>
            <div class="feedback-actions">
              <button class="feedback-action-btn retry-btn retry-question" data-question-index="${index}">
                <span class="btn-icon"></span>重做此題
              </button>
              <button class="feedback-action-btn similar-btn similar-questions" data-question-index="${index}">
                <span class="btn-icon"></span>類似題目
              </button>
            </div>
          </div>
        `;
      })
      .filter(html => html !== '')
      .join('');
  }

  /**
   * 設置結果頁面事件監聽器
   */
  _setupResultsEventListeners(container, questions, questionResults, practiceSession, feedback) {
    // 再練一次
    const practiceAgainBtn = container.querySelector('.practice-again');
    if (practiceAgainBtn) {
      practiceAgainBtn.addEventListener('click', async () => {
        try {
          await this._restartPractice(questions);
        } catch (error) {
          console.error('❌ 再練一次按鈕執行失敗:', error);
        }
      });
    }

    // 新的練習
    const practiceNewBtn = container.querySelector('.practice-new');
    if (practiceNewBtn) {
      practiceNewBtn.addEventListener('click', () => {
        this._startNewPractice();
      });
    }

    // 導出結果
    const exportBtn = container.querySelector('.practice-export');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        this._exportResults(questions, questionResults);
      });
    }

    // 重做錯題
    const retryButtons = container.querySelectorAll('.retry-question');
    retryButtons.forEach(button => {
      button.addEventListener('click', () => {
        const questionIndex = parseInt(button.dataset.questionIndex);
        this._retryQuestion(questions[questionIndex], questionIndex);
      });
    });

    // 類似題目
    const similarButtons = container.querySelectorAll('.similar-questions');
    similarButtons.forEach(button => {
      button.addEventListener('click', () => {
        const questionIndex = parseInt(button.dataset.questionIndex);
        this._generateSimilarQuestions(questions[questionIndex]);
      });
    });

    // 渲染數學公式和代碼高亮
    if (this.app.contentRenderer) {
      const explanationContents = container.querySelectorAll('.explanation-content');
      explanationContents.forEach(content => {
        this.app.contentRenderer.highlightCodeBlocks(content);
        this.app.contentRenderer.renderMathInElement(content);
      });
    }
  }

  /**
   * 重新開始練習
   */
  async _restartPractice(questions) {
    const modal = document.getElementById('practice-modal');
    if (modal) {
      modal.style.display = 'none';
    }
    
    // 觸發新的練習會話
    if (this.app.practiceIntegration) {
      try {
        // 獲取科目信息，如果沒有則使用預設值
        const subject = questions && questions.length > 0 && questions[0].subject 
          ? questions[0].subject 
          : '練習';
        
        const questionCount = questions ? questions.length : 5;
        
        console.log(`🔄 重新開始練習: ${questionCount} 題, 科目: ${subject}`);
        
        await this.app.practiceIntegration.startPracticeSession(questionCount, subject);
      } catch (error) {
        console.error('❌ 重新開始練習失敗:', error);
        // 如果失敗，顯示錯誤提示
        if (this.app._showNotification) {
          this.app._showNotification('重新開始練習時遇到問題，請稍後再試', 'error');
        }
      }
    }
  }

  /**
   * 開始新練習
   */
  _startNewPractice() {
    const modal = document.getElementById('practice-modal');
    if (modal) {
      modal.style.display = 'none';
    }
    
    // 提示用戶開始新練習
    this.app.messageProcessingManager.addMessageToUI('assistant', '好的！請告訴我您想練習什麼主題，或者使用 /practice 指令開始新的練習。');
  }

  /**
   * 導出練習結果
   */
  _exportResults(questions, questionResults) {
    const stats = this._calculateStats(questionResults);
    const exportData = {
      timestamp: new Date().toISOString(),
      stats: stats,
      questions: questions.map((question, index) => ({
        question: question.question,
        type: question.type,
        correctAnswer: question.correctAnswer,
        userAnswer: questionResults[index]?.selectedAnswer || null,
        isCorrect: questionResults[index]?.isCorrect || false,
        responseTime: questionResults[index]?.responseTime || null,
        skipped: questionResults[index]?.skipped || false
      }))
    };

    // 使用導出服務
    if (this.app.exportService) {
      this.app.exportService.exportPracticeResults(exportData);
    } else {
      // 備用導出方法
      this._downloadJSON(exportData, `practice_results_${new Date().toISOString().split('T')[0]}.json`);
    }
  }

  /**
   * 重做單個題目
   */
  _retryQuestion(question, questionIndex) {
    const modal = document.getElementById('practice-modal');
    if (modal) {
      modal.style.display = 'none';
    }
    
    // 在練習模態框中顯示題目
    if (this.app.practiceIntegration) {
      this.app.practiceIntegration.showPracticeModal(question);
    }
  }

  /**
   * 生成類似題目
   */
  async _generateSimilarQuestions(question) {
    try {
      // 顯示載入狀態（在練習視窗中）
      this._showSimilarQuestionsLoading();
      
      // 使用問題庫服務生成類似題目
      if (this.app.questionBankService) {
        const similarQuestions = await this.app.questionBankService.generateSimilarQuestions(question, 5);
        
        if (similarQuestions && similarQuestions.length > 0) {
          // 直接在練習視窗中顯示類似題目組合，而不是發送到聊天
          console.log('🎯 生成類似題目成功，直接在練習視窗中顯示');
          
          // 關閉當前的練習結果模態框
          const modal = document.getElementById('practice-modal');
          if (modal) {
            modal.style.display = 'none';
          }
          
          // 使用 practiceIntegration 顯示類似題目組合
          if (this.app.practiceIntegration && this.app.practiceIntegration.practiceUI) {
            // 生成主題摘要
            const topicSummary = `基於「${question.question.substring(0, 50)}...」生成的類似題目`;
            
            // 使用 UI 模組顯示多題練習
            this.app.practiceIntegration.practiceUI.showPracticeModalWithMultipleQuestions(
              similarQuestions, 
              topicSummary
            );
          } else {
            // 備用方案：顯示第一題
            this.app.practiceIntegration.showPracticeModal(similarQuestions[0]);
          }
        } else {
          // 顯示錯誤但不發送到聊天
          this._showSimilarQuestionsError('暫時無法生成類似題目，請稍後再試。');
        }
      }
    } catch (error) {
      console.error('生成類似題目失敗:', error);
      this._showSimilarQuestionsError('生成類似題目時出現錯誤，請稍後再試。');
    }
  }

  /**
   * 顯示類似題目載入狀態
   */
  _showSimilarQuestionsLoading() {
    // 在練習結果視窗中顯示載入狀態
    const similarButtons = document.querySelectorAll('.similar-questions');
    similarButtons.forEach(btn => {
      btn.disabled = true;
      btn.textContent = '🔄 生成中...';
    });
  }

  /**
   * 顯示類似題目錯誤
   */
  _showSimilarQuestionsError(message) {
    // 恢復按鈕狀態並顯示錯誤提示
    const similarButtons = document.querySelectorAll('.similar-questions');
    similarButtons.forEach(btn => {
      btn.disabled = false;
      btn.textContent = '🎲 類似題目';
      btn.title = message;
    });

    // 顯示臨時通知
    if (this.app._showNotification) {
      this.app._showNotification(message, 'warning');
    }
  }

  /**
   * 獲取準確率等級
   */
  _getAccuracyLevel(accuracy) {
    if (accuracy >= 90) return 'excellent';
    if (accuracy >= 80) return 'good';
    if (accuracy >= 60) return 'fair';
    return 'needs-improvement';
  }

  /**
   * 獲取結果訊息
   */
  _getResultsMessage(accuracy) {
    if (accuracy >= 90) return '🌟 表現優異！您已經掌握了這些知識點！';
    if (accuracy >= 80) return '👍 表現良好！繼續保持！';
    if (accuracy >= 60) return '💪 還不錯！繼續努力會更好！';
    return '🎯 繼續加油！熟能生巧！';
  }

  /**
   * 生成學習建議
   */
  _generateLearningTips(accuracy, incorrectCount, totalCount) {
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
   * 下載JSON文件
   */
  _downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * 顯示練習摘要（簡化版本，用於聊天界面）
   */
  showPracticeSummary(stats) {
    const message = `
📊 **練習完成摘要**

✅ 總共完成：${stats.totalQuestions} 題
🎯 正確率：${stats.accuracy}%
⏱️ 平均用時：${stats.avgResponseTime || 0} 秒

${stats.accuracy >= 80 ? '🌟 表現優秀！' : stats.accuracy >= 60 ? '👍 表現良好！' : '💪 繼續加油！'}

${stats.incorrectAnswers > 0 ? `\n❌ 錯誤題目：${stats.incorrectAnswers} 題\n建議重點複習這些題目。` : ''}

想要查看詳細結果或進行更多練習嗎？
    `;
    
    this.app.messageProcessingManager.addMessageToUI('assistant', message);
  }
} 