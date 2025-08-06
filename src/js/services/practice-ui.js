// practice-ui.js
// 重構為使用模塊化架構的兼容性包裝器
// 保持原有API接口，內部使用拆分後的模塊實現

import { PracticeUIModular } from './practice-ui-modular.js';

export class PracticeUI {
  constructor(app, practiceCore, questionBankService, practiceSession, achievementService = null) {
    // 使用模塊化實現作為內部引擎
    this.modularUI = new PracticeUIModular(app, practiceCore, questionBankService, practiceSession, achievementService);
    
    // 保持原有的屬性接口以確保兼容性
    this.app = app;
    this.practiceCore = practiceCore;
    this.questionBankService = questionBankService;
    this.practiceSession = practiceSession;
    this.achievementService = achievementService;
  }

  // 代理屬性以保持兼容性
  get currentQuestions() {
    return this.modularUI.getCurrentQuestions();
  }

  set currentQuestions(value) {
    this.modularUI.base.currentQuestions = value;
  }

  get currentQuestionIndex() {
    return this.modularUI.base.currentQuestionIndex;
  }

  set currentQuestionIndex(value) {
    this.modularUI.base.currentQuestionIndex = value;
  }

  get questionResults() {
    return this.modularUI.getCurrentQuestionResults();
  }

  set questionResults(value) {
    this.modularUI.base.questionResults = value;
  }

  showPracticeModal(question) {
    return this.modularUI.showPracticeModal(question);
  }

  displayPracticeQuestion(question) {
    return this.modularUI.displayPracticeQuestion(question);
  }

  setupPracticeInteraction(questionContent, question) {
    return this.modularUI.interaction.setupPracticeInteraction(questionContent, question, this.app, this.practiceSession, this.achievementService);
  }

  showPracticeFeedback(feedbackDiv, question, selectedAnswer, isCorrect, selectedIndex, questionType = 'multiple_choice') {
    return this.modularUI.feedback.showPracticeFeedback(feedbackDiv, question, selectedAnswer, isCorrect, selectedIndex, questionType);
  }

  // 格式化正確答案顯示 - 代理到 feedback 模塊
  _formatCorrectAnswer(question, questionType) {
    return this.modularUI.feedback._formatCorrectAnswer(question, questionType);
  }

  // 格式化用戶答案顯示 - 代理到 feedback 模塊
  _formatUserAnswer(userAnswer, questionType) {
    return this.modularUI.feedback._formatUserAnswer(userAnswer, questionType);
  }

  // 顯示多題練習模態框 - 代理到 base 模塊
  showPracticeModalWithMultipleQuestions(questions, topicSummary = null) {
    return this.modularUI.base.showPracticeModalMultiple(questions, topicSummary);
  }

  // 載入指定索引的題目 - 代理到 base 模塊
  loadQuestionAtIndex(index) {
    return this.modularUI.base.loadQuestionAtIndex(index);
  }

  // 設置題目交互 - 代理到 interaction 模塊
  setupQuestionInteraction(questionContainer, question, questionIndex) {
    return this.modularUI.interaction.setupQuestionInteraction(questionContainer, question, questionIndex, this.app, this.practiceSession, this.achievementService);
  }

  // 顯示帶 Markdown 的練習反饋 - 代理到 feedback 模塊
  showPracticeFeedbackWithMarkdown(feedbackDiv, question, selectedAnswer, isCorrect, selectedIndex, questionType = 'multiple_choice') {
    return this.modularUI.feedback.showPracticeFeedbackWithMarkdown(feedbackDiv, question, selectedAnswer, isCorrect, selectedIndex, questionType, this.app);
  }

  // 設置題目導航 - 代理到 base 模塊
  setupQuestionNavigation() {
    return this.modularUI.base.setupQuestionNavigation();
  }

  // 更新標籤狀態 - 代理到 base 模塊
  updateTabsStatus() {
    return this.modularUI.base.updateTabsStatus();
  }

  // 更新導航按鈕 - 代理到 base 模塊
  updateNavigationButtons() {
    return this.modularUI.base.updateNavigationButtons();
  }

  // 檢查是否所有題目都已完成 - 代理到 base 模塊
  allQuestionsCompleted() {
    return this.modularUI.base.allQuestionsCompleted();
  }

  // 顯示練習完成 - 代理到 completion 模塊
  showPracticeComplete() {
    return this.modularUI.completion.showPracticeComplete();
  }

  // 顯示詳細的練習完成頁面 - 代理到 completion 模塊
  showDetailedPracticeComplete() {
    return this.modularUI.completion.showDetailedPracticeComplete();
  }

  // 獲取正確答案文本 - 代理到 completion 模塊
  getCorrectAnswerText(question) {
    return this.modularUI.completion.getCorrectAnswerText(question);
  }

  // 獲取準確率等級 - 代理到 completion 模塊
  getAccuracyLevel(accuracy) {
    return this.modularUI.completion.getAccuracyLevel(accuracy);
  }

  // 生成學習建議 - 代理到 completion 模塊
  generateLearningTips(accuracy, incorrectCount, totalCount) {
    return this.modularUI.completion.generateLearningTips(accuracy, incorrectCount, totalCount);
  }

  // 設置回顧切換 - 代理到 completion 模塊
  setupReviewToggles() {
    return this.modularUI.completion.setupReviewToggles();
  }

  // 恢復題目狀態 - 代理到 base 模塊
  restoreQuestionState(questionContainer, result) {
    return this.modularUI.base.restoreQuestionState(questionContainer, result);
  }

  // 設置新題目按鈕 - 代理到 base 模塊
  setupNewQuestionButton() {
    return this.modularUI.base.setupNewQuestionButton();
  }

  // 為模態框生成新題目 - 代理到 base 模塊
  async generateNewQuestionForModal() {
    return this.modularUI.base.generateNewQuestionForModal();
  }

  // 渲染題目內容 - 代理到 renderer 模塊
  _renderQuestionContent(question) {
    return this.modularUI.renderer.renderQuestionContent(question);
  }

  // 渲染題目輸入區域 - 代理到 renderer 模塊
  _renderQuestionInputArea(question, questionType) {
    return this.modularUI.renderer.renderQuestionInputArea(question, questionType);
  }

  // 渲染填空題輸入框 - 代理到 renderer 模塊
  _renderFillInBlankInputs(question) {
    return this.modularUI.renderer.renderFillInBlankInputs(question);
  }

  // 獲取寫作提示 - 代理到 renderer 模塊
  _getWritingTips(questionType) {
    return this.modularUI.renderer.getWritingTips(questionType);
  }

  // 獲取題型顯示名稱 - 代理到 renderer 模塊
  _getQuestionTypeDisplayName(type) {
    return this.modularUI.renderer.getQuestionTypeDisplayName(type);
  }

  // 渲染題目容器 - 代理到 renderer 模塊
  _renderQuestionsContainer(questions) {
    return this.modularUI.renderer.renderQuestionsContainer(questions);
  }

  // 獲取難度顯示名稱 - 代理到 renderer 模塊
  _getDifficultyDisplayName(difficulty) {
    return this.modularUI.renderer.getDifficultyDisplayName(difficulty);
  }

  // 重新開始當前練習 - 代理到 completion 模塊
  restartCurrentPractice() {
    return this.modularUI.completion.restartCurrentPractice();
  }

  // 只練習錯題 - 代理到 completion 模塊
  practiceIncorrectQuestionsOnly() {
    return this.modularUI.completion.practiceIncorrectQuestionsOnly();
  }

  // 重做特定題目 - 代理到 completion 模塊
  retrySpecificQuestion(questionIndex) {
    return this.modularUI.completion.retrySpecificQuestion(questionIndex);
  }

  // 根據題型設置交互邏輯 - 代理到 interaction 模塊
  _setupQuestionTypeInteraction(questionContent, question, questionType, submitButton) {
    return this.modularUI.interaction.setupQuestionTypeInteraction(questionContent, question, questionType, submitButton);
  }

  // 多選題交互 - 代理到 interaction 模塊
  _setupMultipleChoiceInteraction(questionContent, submitButton) {
    return this.modularUI.interaction.setupMultipleChoiceInteraction(questionContent, submitButton);
  }

  // 選擇選項 - 代理到 interaction 模塊
  _selectOption(optionButtons, selectedButton, submitButton) {
    return this.modularUI.interaction.selectOption(optionButtons, selectedButton, submitButton);
  }

  // 聚焦下一個選項 - 代理到 interaction 模塊
  _focusNextOption(optionButtons, currentIndex, direction) {
    return this.modularUI.interaction.focusNextOption(optionButtons, currentIndex, direction);
  }

  // 填空題交互 - 代理到 interaction 模塊
  _setupFillInBlankInteraction(questionContent, submitButton) {
    return this.modularUI.interaction.setupFillInBlankInteraction(questionContent, submitButton);
  }

  // 文本框交互 - 代理到 interaction 模塊
  _setupTextAreaInteraction(questionContent, submitButton) {
    return this.modularUI.interaction.setupTextAreaInteraction(questionContent, submitButton);
  }

  // 安排自動保存 - 代理到 interaction 模塊
  _scheduleAutoSave(textarea, autoSaveStatus, questionId) {
    return this.modularUI.interaction.scheduleAutoSave(textarea, autoSaveStatus, questionId);
  }

  // 執行自動保存 - 代理到 interaction 模塊
  _performAutoSave(textarea, autoSaveStatus, questionId) {
    return this.modularUI.interaction.performAutoSave(textarea, autoSaveStatus, questionId);
  }

  // 恢復自動保存的內容 - 代理到 interaction 模塊
  _restoreAutoSavedContent(textarea, questionId) {
    return this.modularUI.interaction.restoreAutoSavedContent(textarea, questionId);
  }

  // 計算題交互 - 代理到 interaction 模塊
  _setupCalculationInteraction(questionContent, submitButton) {
    return this.modularUI.interaction.setupCalculationInteraction(questionContent, submitButton);
  }

  // 獲取用戶答案 - 代理到 interaction 模塊
  _getUserAnswer(questionContent, question, questionType) {
    return this.modularUI.interaction.getUserAnswer(questionContent, question, questionType);
  }

  // 驗證答案 - 代理到 interaction 模塊
  _validateAnswer(userAnswer, question, questionType) {
    return this.modularUI.interaction.validateAnswer(userAnswer, question, questionType);
  }

  // 禁用題目輸入元素 - 代理到 interaction 模塊
  _disableQuestionInputs(questionContent, questionType) {
    return this.modularUI.interaction.disableQuestionInputs(questionContent, questionType);
  }

  // 向後兼容的方法別名
  setupPracticeModalInteraction(questionContent, question) {
    return this.setupPracticeInteraction(questionContent, question);
  }
} 