// practice-session.js
// 將所有與 sessionManager、DB 結構、練習分析加入會話、狀態同步有關的函式與類別搬移到此檔案。
// 若 DB 結構有 subject 欄位，未來移除 subject 時自動填入 'dummy' 或空字串。
// ... 

export class PracticeSession {
  constructor(sessionManager, storageService, questionBankService) {
    this.sessionManager = sessionManager;
    this.storageService = storageService;
    this.questionBankService = questionBankService;
  }

  /**
   * 生成練習分析並加入會話上下文
   */
  async addPracticeAnalysisToSession(practiceResult, question, questionBankService) {
    try {
      console.log('📊 正在生成練習分析...');

      // 判斷正確性 - 處理不同物件結構
      const isCorrect = practiceResult.isCorrect !== undefined ? 
        practiceResult.isCorrect : practiceResult.correctness;

      // 建構分析提示詞
      const analysisPrompt = `請分析以下學習者的練習結果，生成簡潔的學習狀況分析：

練習資訊：
- 主題：${question.topic}
- 難度：${this._getDifficultyDisplayName(question.difficulty)}
- 題目：${question.question}
- 學習者選擇：${practiceResult.selectedAnswer}
- 正確答案：${question.correctAnswer}
- 回答結果：${isCorrect ? '正確' : '錯誤'}

請以第三人稱客觀分析，重點包括：
1. 學習者在該主題的掌握程度
2. 可能的知識盲點或誤區
3. 建議的學習方向

回答請簡潔（不超過150字），適合作為AI助理的背景參考：`;

      // 調用AI生成分析
      const analysisResponse = await questionBankService.geminiService.generateContent(analysisPrompt);

      if (analysisResponse && analysisResponse.trim()) {
        // 建構包含原始題目內容的完整分析訊息
        const fullContent = `[學習分析] ${analysisResponse.trim()}

原始題目：${question.question}
學習者答案：${practiceResult.selectedAnswer}
正確答案：${question.correctAnswer}
選項：${(question.options || []).join(', ')}
${question.explanation ? `解釋：${question.explanation}` : ''}`;

        // 將分析加入會話（作為系統訊息，不顯示給用戶）
        const currentSession = this.sessionManager.getCurrentSession();
        if (currentSession) {
          // 直接加入到messages陣列，但標記為系統分析
          currentSession.messages.push({
            id: `analysis_${Date.now()}`,
            role: 'system',
            content: fullContent,
            timestamp: new Date().toISOString(),
            metadata: {
              type: 'practice_analysis',
              subject: 'dummy', // 填入 dummy subject，避免 DB 結構問題
              topic: question.topic,
              isCorrect: isCorrect,
              hidden: true // 標記為隱藏訊息
            }
          });

          // 更新會話
          currentSession.updatedAt = new Date().toISOString();
          await this.sessionManager._saveSession(currentSession);

          console.log('✅ 練習分析已加入會話上下文');
          console.log('📋 分析內容:', fullContent);
        }
      }

    } catch (error) {
      console.error('❌ 生成練習分析失敗:', error);
    }
  }

  /**
   * 記錄練習結果到儲存服務，並自動填入 dummy subject
   */
  async recordPracticeResult(question, selectedAnswer, isCorrect, responseTime = null, achievementService = null) {
    try {
      const timestamp = Date.now();
      const currentSessionId = this.sessionManager.getCurrentSession() ? 
        this.sessionManager.getCurrentSession().id : 'default';
      
      const learningRecord = {
        questionId: question.id,
        sessionId: currentSessionId,
        userId: 'default',
        question: question.question,
        selectedAnswer,
        correctAnswer: question.correctAnswer,
        correctness: isCorrect,
        responseTime: responseTime || 0,
        timestamp: timestamp,
        subject: 'dummy', // 自動填入 dummy subject，避免 DB 結構問題
        topic: question.topic,
        difficulty: question.difficulty,
        questionType: question.type || 'multiple_choice',
        options: question.options || [],
        explanation: question.explanation || '',
        tags: question.tags || [],
        createdAt: timestamp
      };

      // 保存到 learningRecords 對象存儲
      await this.storageService.saveLearningRecord(learningRecord);
      
      console.log(`已記錄學習結果：${isCorrect ? '正確' : '錯誤'} - ${question.topic}`);

      // 生成練習分析並加入會話上下文
      await this.addPracticeAnalysisToSession(learningRecord, question, this.questionBankService);

      // 檢查並觸發成就（如果成就服務可用）
      if (achievementService) {
        try {
          const newAchievements = await achievementService.checkAndTriggerAchievements(learningRecord.userId);
          if (newAchievements && newAchievements.length > 0) {
            console.log('🏆 獲得新成就!', newAchievements);
            // 這裡可以添加成就通知的邏輯
            newAchievements.forEach(achievement => {
              console.log(`🎉 新成就: ${achievement.title} - ${achievement.description}`);
            });
          }
        } catch (error) {
          console.error('檢查成就時發生錯誤:', error);
          // 不拋出錯誤，避免影響主要功能
        }
      }

      return learningRecord;

    } catch (error) {
      console.error('記錄練習結果失敗:', error);
      throw error;
    }
  }

  /**
   * 恢復題目狀態（當回到已回答的題目時）
   */
  restoreQuestionState(questionContainer, result) {
    if (!result.answered && !result.skipped) return;

    const optionButtons = questionContainer.querySelectorAll('.practice-option');
    const submitButton = questionContainer.querySelector('.practice-submit');
    const feedbackDiv = questionContainer.querySelector('.practice-feedback');

    if (result.skipped) {
      // 跳過的題目，顯示跳過狀態
      optionButtons.forEach(btn => btn.disabled = true);
      submitButton.disabled = true;
      submitButton.textContent = '已跳過';

      feedbackDiv.innerHTML = `
        <div class="feedback-content skipped">
          <div class="feedback-result">
            <span class="feedback-icon">⏭️</span>
            <span class="feedback-text">此題已跳過</span>
          </div>
        </div>
      `;
      feedbackDiv.style.display = 'block';

    } else if (result.answered) {
      // 已回答的題目，恢復選擇狀態和反饋
      if (result.selectedOptionIndex !== null) {
        optionButtons[result.selectedOptionIndex].classList.add('selected');
      }

      optionButtons.forEach(btn => btn.disabled = true);
      submitButton.disabled = true;
      submitButton.textContent = '已作答';

      // 顯示反饋（簡化版本）
      const correctIndex = result.question.options.indexOf(result.question.correctAnswer);
      optionButtons.forEach((button, index) => {
        if (index === correctIndex) button.classList.add('correct');
        else if (index === result.selectedOptionIndex && !result.isCorrect) button.classList.add('incorrect');
      });

      feedbackDiv.innerHTML = `
        <div class="feedback-content ${result.isCorrect ? 'correct' : 'incorrect'}">
          <div class="feedback-result">
            <span class="feedback-icon">${result.isCorrect ? '✅' : '❌'}</span>
            <span class="feedback-text">${result.isCorrect ? '回答正確！' : '回答錯誤'}</span>
          </div>
          <div class="feedback-explanation">
            <strong>正確答案：</strong>${result.question.correctAnswer}<br>
            <strong>解釋：</strong>${result.question.explanation || '暫無詳細說明'}
          </div>
        </div>
      `;
      feedbackDiv.style.display = 'block';
    }
  }

  /**
   * 獲取難度顯示名稱
   */
  _getDifficultyDisplayName(difficulty) {
    const names = {
      easy: '簡單',
      medium: '中等',
      hard: '困難',
      expert: '專家級'
    };
    return names[difficulty] || difficulty;
  }
} 