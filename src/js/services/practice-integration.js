/**
 * 練習功能整合模組 (重構版)
 * 負責將智能題庫系統整合到主聊天應用中
 * 只保留真正的整合邏輯，UI和會話管理功能已模組化
 */
import sessionManager from './session-manager.js';
import { PracticeCore, generateTopicSummary } from './practice-core.js';
import { PracticeUI } from './practice-ui.js';
import { PracticeSession } from './practice-session.js';

class PracticeIntegration {
  constructor(app, questionBankService, storageService, achievementService = null) {
    this.app = app;
    this.questionBankService = questionBankService;
    this.storageService = storageService;
    this.achievementService = achievementService;
    this.practiceCore = new PracticeCore(questionBankService, storageService);
    this.practiceSession = new PracticeSession(sessionManager, storageService, questionBankService);
    this.practiceUI = new PracticeUI(this.app, this.practiceCore, this.questionBankService, this.practiceSession, this.achievementService);
  }

  /**
   * 處理練習請求 - 主要整合邏輯
   */
  async handlePracticeRequest(args) {
    // 立即顯示處理中的訊息給用戶
    const processingMessageId = this.app.messageProcessingManager.addThinkingMessage();
    this.app.messageProcessingManager.updateMessageContent(processingMessageId, '🎯 正在為您生成練習題，請稍候...');

    try {
      this.app._showLoading('正在生成練習題...');
      console.log('開始處理練習請求，參數:', args);

      // 檢查服務是否已初始化
      if (!this.questionBankService) {
        throw new Error('題庫服務未初始化');
      }

      if (!this.questionBankService.geminiService) {
        throw new Error('AI服務未初始化，請檢查API Key設置');
      }

      if (!this.questionBankService.geminiService.apiKey) {
        throw new Error('請先設置Gemini API Key');
      }

      // 分析對話內容，決定練習主題
      const topic = await this.determineTopicFromSession(args);
      const topicSummary = generateTopicSummary(topic);

      // 生成練習題
      const options = {
        topic: topic,
        difficulty: 'medium',
        questionType: 'multiple_choice',
        count: 5
      };

      const questions = await this.practiceCore.generatePracticeQuestions(options);

      if (questions && questions.length > 0) {
        console.log('顯示練習題組:', questions);
        // 移除處理中訊息
        const messageWrapper = document.querySelector(`[data-message-id="${processingMessageId}"]`);
        if (messageWrapper) messageWrapper.remove();

        // 使用 UI 模組顯示練習
        this.practiceUI.showPracticeModalWithMultipleQuestions(questions, topicSummary);
      } else {
        console.log('沒有生成到題目，使用備用題目');
        this.app.messageProcessingManager.updateMessageContent(processingMessageId, '🤖 正在使用備用題目...');
        setTimeout(() => {
          const messageWrapper = document.querySelector(`[data-message-id="${processingMessageId}"]`);
          if (messageWrapper) messageWrapper.remove();
        }, 1000);

        this.practiceUI.showPracticeModalWithMultipleQuestions(this.practiceCore.useFallbackQuestion());
      }

    } catch (error) {
      console.error('練習題生成失敗:', error);

      // 更新處理中訊息為錯誤狀態
      this.app.messageProcessingManager.updateMessageContent(processingMessageId, '⚠️ 題目生成遇到問題，正在使用備用題目...');
      setTimeout(() => {
        const messageWrapper = document.querySelector(`[data-message-id="${processingMessageId}"]`);
        if (messageWrapper) messageWrapper.remove();
      }, 2000);

      // 使用備用題目
      console.log('API調用失敗，使用備用題目');
      this.practiceUI.showPracticeModalWithMultipleQuestions(this.practiceCore.useFallbackQuestion());

      // 顯示提示訊息但不阻止功能使用
      this.app._showNotification('使用示例題目（請檢查API Key設置以獲得更多題目）', 'warning');
    } finally {
      this.app._hideLoading();
    }
  }

  /**
   * 根據會話內容分析並決定練習主題
   */
  async determineTopicFromSession(args) {
    // 如果有明確指定主題參數，優先使用
    if (args && args.length > 1) {
      return args.slice(1).join(' ');
    }

    try {
      // 獲取當前會話的聊天記錄
      const currentSession = sessionManager.getCurrentSession();
      if (!currentSession || !currentSession.messages || currentSession.messages.length === 0) {
        return this.getDefaultTopic();
      }

      // 分析聊天內容提取主題
      const analysisResult = await this.analyzeSessionContent(currentSession.messages);
      if (analysisResult && analysisResult.trim()) {
        console.log('📋 從會話內容分析出的主題:', analysisResult);
        return analysisResult;
      }

    } catch (error) {
      console.error('❌ 分析會話內容失敗:', error);
    }

    // 回退到預設主題
    return this.getDefaultTopic();
  }

  /**
   * 分析會話內容提取學習主題
   */
  async analyzeSessionContent(messages) {
    try {
      // 獲取最近的消息（最多取最近10條）
      const recentMessages = messages.slice(-10);
      const conversationContent = recentMessages
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n');

      console.log('📋 分析會話內容:', conversationContent.substring(0, 200) + '...');

      // 建構分析提示詞
      const analysisPrompt = `請分析以下對話內容，生成一個詳細的學習狀況描述，用於生成練習題。

對話內容：
${conversationContent}

請根據對話中涉及的具體概念、問題或學習重點，生成一個詳細的學習狀況描述，包含：
1. 學生目前的理解程度
2. 需要加強的具體概念
3. 常見的錯誤或誤解
4. 建議的學習方向

描述長度請控制在500字以內，要具體且實用。
同時，也要清楚地指出這段對話中學習的科目是什麼

請直接給出描述內容，不要其他說明：`;

      // 調用AI分析
      const analysisResponse = await this.questionBankService.geminiService.generateContent(analysisPrompt);

      if (analysisResponse && analysisResponse.trim()) {
        // 清理回應，保留完整描述
        const topic = analysisResponse.trim()
          .replace(/^["']|["']$/g, '') // 移除引號
          .replace(/^\d+\.\s*/, '') // 移除編號
          .substring(0, 500); // 限制長度為500字

        return topic || this.getDefaultTopic();
      }

    } catch (error) {
      console.error('❌ AI分析會話內容失敗:', error);
    }

    return this.getDefaultTopic();
  }

  /**
   * 獲取預設主題
   */
  getDefaultTopic() {
    const defaultTopics = {
      'math': '基礎運算',
      'english': '基礎語法',
      'science': '基礎概念',
      'chinese': '基礎語文'
    };

    return defaultTopics['math'] || '基礎練習';
  }

  /**
   * 獲取科目顯示名稱
   */
  getSubjectDisplayName(subject) {
    const subjectNames = {
      'mathematics': '數學',
      'science': '自然科學',
      'language': '語言學習',
      'general': '通用'
    };
    return subjectNames[subject] || '通用';
  }

  /**
   * 顯示單個練習題 - 委託給 UI 模組
   */
  showPracticeModal(question) {
    return this.practiceUI.showPracticeModal(question);
  }

  /**
   * 生成新題目 - 被 practice-ui-base.js 調用
   * 注意：方法名為 generateNewQuestion，不是 generateNewQuestionForModal
   */
  async generateNewQuestion() {
    try {
      console.log('🔄 生成新題目...');

      const options = {
        topic: this.getDefaultTopic(),
        difficulty: 'medium',
        questionType: 'multiple_choice',
        count: 5  // 生成5道題的組合
      };

      const questions = await this.practiceCore.generatePracticeQuestions(options);

      if (questions && questions.length > 0) {
        // 使用 UI 模組顯示新的練習題組
        this.practiceUI.showPracticeModalWithMultipleQuestions(questions);
      } else {
        // 使用備用題目
        this.practiceUI.showPracticeModalWithMultipleQuestions(this.practiceCore.useFallbackQuestion());
      }
    } catch (error) {
      console.error('生成新題目失敗:', error);
      // 使用備用題目
      this.practiceUI.showPracticeModalWithMultipleQuestions(this.practiceCore.useFallbackQuestion());
      throw error; // 重新拋出錯誤，讓調用方處理
    }
  }

  /**
   * 生成新題目（用於模態框） - 保持原有方法名以兼容
   */
  async generateNewQuestionForModal() {
    return this.generateNewQuestion();
  }

  /**
   * 開始練習會話 - 被 practice-ui-completion.js 調用
   * 重新生成指定數量的練習題
   */
  async startPracticeSession(questionCount = 5, subject) {
    console.log(`🔄 開始新的練習會話: ${questionCount} 題, 科目: ${subject || '未指定'}`);

    try {
      const options = {
        topic: subject || this.getDefaultTopic(),
        difficulty: 'medium',
        questionType: 'multiple_choice',
        count: questionCount
      };

      console.log('📋 練習選項:', options);

      const questions = await this.practiceCore.generatePracticeQuestions(options);

      if (questions && questions.length > 0) {
        console.log(`✅ 成功生成 ${questions.length} 道題目`);
        // 使用 UI 模組顯示新的練習題組
        const topicSummary = `${subject || '練習'} - ${questionCount} 題`;
        this.practiceUI.showPracticeModalWithMultipleQuestions(questions, topicSummary);
      } else {
        console.log('⚠️ 沒有生成到題目，使用備用題目');
        // 使用備用題目
        this.practiceUI.showPracticeModalWithMultipleQuestions(this.practiceCore.useFallbackQuestion());
      }
    } catch (error) {
      console.error('❌ 開始練習會話失敗:', error);
      // 使用備用題目
      console.log('🔧 使用備用題目');
      this.practiceUI.showPracticeModalWithMultipleQuestions(this.practiceCore.useFallbackQuestion());

      // 顯示提示訊息
      if (this.app._showNotification) {
        this.app._showNotification('使用示例題目（請檢查API Key設置以獲得更多題目）', 'warning');
      }
    }
  }
}

export default PracticeIntegration; 