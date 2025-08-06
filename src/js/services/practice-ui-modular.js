// practice-ui-modular.js
// 模塊化練習UI主入口 - 整合所有子模塊的功能

import { PracticeUIBase } from './practice-ui-base.js';
import { PracticeUIRenderer } from './practice-ui-renderer.js';
import { PracticeUIInteraction } from './practice-ui-interaction.js';
import { PracticeUIFeedback } from './practice-ui-feedback.js';
import { PracticeUICompletion } from './practice-ui-completion.js';
import { PracticeUIErrorAnalysis } from './practice-ui-error-analysis.js';

export class PracticeUIModular {
  constructor(app, practiceCore, questionBankService, practiceSession, achievementService = null) {
    this.app = app;
    this.practiceCore = practiceCore;
    this.questionBankService = questionBankService;
    this.practiceSession = practiceSession;
    this.achievementService = achievementService;
    
    // 初始化各個模塊
    this.base = new PracticeUIBase(app, practiceCore, questionBankService, practiceSession);
    this.renderer = new PracticeUIRenderer();
    this.interaction = new PracticeUIInteraction();
    this.feedback = new PracticeUIFeedback(app);
    this.completion = new PracticeUICompletion(app, practiceSession);
    this.errorAnalysis = new PracticeUIErrorAnalysis(app, practiceSession);
    
    // 設置模塊間的引用關係
    this.setupModuleReferences();
  }

  /**
   * 設置模塊間的引用關係
   */
  setupModuleReferences() {
    // 為基礎模塊設置其他模塊的引用
    this.base.renderer = this.renderer;
    this.base.interaction = this.interaction;
    this.base.feedback = this.feedback;
    this.base.completion = this.completion;
    
    // 覆蓋基礎模塊的方法，使其使用正確的模塊
    this.base.setupPracticeModalInteraction = (questionContent, question) => {
      return this.interaction.setupPracticeInteraction(questionContent, question, this.app, this.practiceSession, this.achievementService);
    };
    
    this.base.setupQuestionInteraction = (questionContainer, question, questionIndex) => {
      const callbacks = {
        updateTabsStatus: () => this.base.updateTabsStatus(),
        updateNavigationButtons: () => this.base.updateNavigationButtons(),
        showFeedback: (feedbackDiv, question, userAnswer, isCorrect, selectedIndex, questionType) => {
          return this.feedback.showPracticeFeedback(feedbackDiv, question, userAnswer, isCorrect, selectedIndex, questionType);
        },
        loadNextQuestion: (index) => this.base.loadNextQuestion()
      };
      return this.interaction.setupQuestionInteraction(
        questionContainer, 
        question, 
        questionIndex, 
        this.base.questionResults, 
        this.practiceSession, 
        callbacks,
        this.achievementService
      );
    };
    
    // 為交互模塊設置其他模塊的引用
    this.interaction.feedback = this.feedback;
    this.interaction.base = this.base;
    
    // 為反饋模塊設置其他模塊的引用
    this.feedback.base = this.base;
    
    // 為完成模塊設置其他模塊的引用
    this.completion.feedback = this.feedback;
    
    // 為錯誤分析模塊設置其他模塊的引用
    this.errorAnalysis.feedback = this.feedback;
    this.errorAnalysis.base = this.base;
  }

  /**
   * 顯示單題練習模態框
   */
  showPracticeModal(question) {
    return this.base.showPracticeModal(question);
  }

  /**
   * 顯示多題練習模態框
   */
  showPracticeModalMultiple(questions, topicSummary = null) {
    return this.base.showPracticeModalMultiple(questions, topicSummary);
  }

  /**
   * 顯示多題練習模態框 (向後兼容別名)
   */
  showPracticeModalWithMultipleQuestions(questions, topicSummary = null) {
    return this.showPracticeModalMultiple(questions, topicSummary);
  }

  /**
   * 在聊天界面中顯示練習題
   */
  displayPracticeQuestion(question) {
    const messageWrapper = document.createElement('div');
    messageWrapper.className = 'message-wrapper assistant practice-question';
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar assistant';
    avatar.textContent = '🎯';
    
    const messageBubble = document.createElement('div');
    messageBubble.className = 'message-bubble assistant practice-bubble';
    
    const questionContent = document.createElement('div');
    questionContent.className = 'practice-question-content';
    questionContent.innerHTML = this.renderer.renderQuestionContent(question);
    
    messageBubble.appendChild(questionContent);
    messageWrapper.appendChild(avatar);
    messageWrapper.appendChild(messageBubble);
    
    this.app.elements.messagesContainer.appendChild(messageWrapper);
    this.interaction.setupPracticeInteraction(questionContent, question, this.app, this.practiceSession, this.achievementService);
    this.app._scrollToBottom();
  }

  /**
   * 關閉練習模態框
   */
  closePracticeModal() {
    return this.base.closePracticeModal();
  }

  /**
   * 生成新題目
   */
  async generateNewQuestionForModal() {
    return await this.base.generateNewQuestionForModal();
  }

  /**
   * 獲取當前題目結果
   */
  getCurrentQuestionResults() {
    return this.base.questionResults;
  }

  /**
   * 獲取當前題目列表
   */
  getCurrentQuestions() {
    return this.base.currentQuestions;
  }

  /**
   * 重置練習狀態
   */
  resetPracticeState() {
    this.base.currentQuestions = [];
    this.base.currentQuestionIndex = 0;
    this.base.questionResults = [];
  }

  /**
   * 設置新題目按鈕
   */
  setupNewQuestionButton() {
    return this.base.setupNewQuestionButton();
  }

  /**
   * 顯示練習結果
   */
  showPracticeResults() {
    return this.completion.showPracticeResults(
      this.base.currentQuestions,
      this.base.questionResults,
      this.practiceSession,
      this.feedback
    );
  }

  /**
   * 顯示錯誤分析
   */
  async showErrorAnalysis(questionId, questionData, userAnswer, responseTime) {
    return await this.errorAnalysis.showErrorAnalysis(questionId, questionData, userAnswer, responseTime);
  }

  /**
   * 關閉錯誤分析
   */
  closeErrorAnalysis() {
    return this.errorAnalysis._closeErrorAnalysis();
  }
} 