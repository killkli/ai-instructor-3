/**
 * Prompt處理器
 * 負責處理複雜的提示詞生成和處理邏輯
 * 將原本在app主文件中的prompt相關方法抽離出來
 */

import promptManager from '../config/prompt-manager.js';
import appStateManager from '../state/appStateManager.js';

import sessionManager from './session-manager.js';

class PromptProcessor {
  constructor() { this.initialized = false; }

  /**
   * 初始化
   */
  async init() {
    this.initialized = true;
    console.log('📝 PromptProcessor initialized');
  }

  /**
   * 獲取有效的系統提示詞
   * 優先級：自定義提示詞 > 角色專屬提示詞 > 動態生成的提示詞
   */
  getEffectiveSystemPrompt() {
    // 如果有自定義系統提示詞，優先使用
    const customPrompt = appStateManager.get('customSystemPrompt');
    if (customPrompt && customPrompt.trim()) {
      return promptManager.preparePrompt(customPrompt, {});
    }

    // 獲取當前會話的角色信息
    const currentSession = sessionManager.getCurrentSession();
    const roleId = currentSession?.metadata?.roleId;
    const grade = currentSession?.metadata?.grade;
    const customLevel = currentSession?.metadata?.customLevel;
    const gradeData = grade !== undefined && customLevel !== undefined
                          ? {grade, customLevel}
                          : null;

    // 如果會話有指定角色，使用角色專屬的系統提示詞
    if (roleId && promptManager.hasRole(roleId)) {
      return promptManager.getRoleSystemPrompt(roleId, {}, gradeData);
    }

    // 否則使用動態生成的系統提示詞
    return this.generateDynamicSystemPrompt();
  }

  /**
   * 根據用戶設定動態生成系統提示詞
   */
  generateDynamicSystemPrompt() {
    // 獲取基礎提示詞
    let basePrompt = promptManager.getSystemPrompt();

    basePrompt = promptManager.preparePrompt(basePrompt, {});

    // 根據設定添加額外的指導原則
    const additionalGuidelines = this._buildAdditionalGuidelines();

    // 組合最終的系統提示詞
    if (additionalGuidelines.length > 0) {
      basePrompt += '\n\n' +
                    '# 🎛️ 個人化教學設定\n' +
                    '根據用戶的偏好設定，請特別注意以下教學指導原則：' +
                    additionalGuidelines.join('\n');

      basePrompt += this._buildSettingsSummary();
    }

    return basePrompt;
  }

  /**
   * 構建額外的指導原則
   */
  _buildAdditionalGuidelines() {
    const additionalGuidelines = [];

    // 分步驟教學設定
    if (appStateManager.get('stepByStep') !== false) {
      additionalGuidelines.push(`
## 📚 分步驟教學模式
- 將複雜概念分解為小步驟，每次只教一個重點
- 每個步驟結束後，等待學生確認理解再繼續
- 使用「你明白了嗎？」、「我們繼續下一步好嗎？」等互動語句
- 如果學生表示不理解，立即停下來重新解釋當前步驟`);
    }

    // 自動調整難度設定
    if (appStateManager.get('adaptiveDifficulty') !== false) {
      additionalGuidelines.push(`
## 🎯 自動難度調整
- 根據學生的回應調整教學難度和節奏
- 如果學生回答正確且快速，可以適當提高挑戰性
- 如果學生多次出錯或表示困惑，立即降低難度，提供更多基礎解釋
- 觀察學生的語言表達能力，調整自己的用詞複雜度
- 記住學生之前的學習表現，持續優化教學策略`);
    }

    // 預設科目特殊指導
    const subjectGuideline = this._buildSubjectGuideline();
    if (subjectGuideline) {
      additionalGuidelines.push(subjectGuideline);
    }

    return additionalGuidelines;
  }

  /**
   * 根據預設科目構建特殊指導
   */
  _buildSubjectGuideline() {
    const defaultSubject = appStateManager.get('defaultSubject');
    if (!defaultSubject)
      return null;

    switch (defaultSubject) {
    case 'mathematics':
      return `
## 🔢 數學教學專項指導
- 優先使用 CPA 教學法（具體→圖像→抽象）
- 多用生活實例和視覺化說明
- 鼓勵學生動手操作和畫圖理解
- 特別注意常見的數學迷思概念`;

    case 'science':
      return `
## 🔬 科學教學專項指導
- 採用探究式學習方法
- 鼓勵學生提出假設和進行思考實驗
- 連結科學概念與日常生活現象
- 培養科學思維和批判性思考`;

    case 'language':
      return `
## 📝 語言學習專項指導
- 採用互動式教學方法
- 鼓勵學生多說多練習
- 提供豐富的語言情境和例句
- 注重語言的實用性和溝通功能`;

    default:
      return null;
    }
  }

  /**
   * 構建設定摘要
   */
  _buildSettingsSummary() {
    return `\n\n## ⚙️ 當前設定摘要
- 分步驟教學：${
        appStateManager.get('stepByStep') !== false ? '✅ 啟用' : '❌ 停用'}
- 自動調整難度：${
        appStateManager.get('adaptiveDifficulty') !== false ? '✅ 啟用'
                                                            : '❌ 停用'}
- 預設科目：${this.getSubjectDisplayName(appStateManager.get('defaultSubject'))}

請根據這些設定調整你的教學方式，提供最適合學生的個人化學習體驗。`;
  }

  /**
   * 將練習分析加入系統提示詞
   */
  addPracticeAnalysisToSystemPrompt(systemPrompt, history) {
    try {
      // 從歷史訊息中提取隱藏的練習分析
      const practiceAnalyses =
          history
              .filter(msg => msg.role === 'system' &&
                             msg.metadata?.type === 'practice_analysis' &&
                             msg.metadata?.hidden === true)
              .map(msg => msg.content)
              .slice(-5); // 只取最近5個分析

      if (practiceAnalyses.length === 0) {
        return systemPrompt;
      }

      // 建構學習分析上下文
      const analysisContext = `

## 📊 學習者背景分析
基於最近的練習表現，以下是學習者的狀況分析：

${practiceAnalyses.join('\n\n')}

請在回答時參考這些分析，提供更有針對性的教學建議和回饋。如果學習者在某個主題上有困難，請特別加強相關說明；如果表現良好，可以適當提高挑戰性。`;

      console.log('📋 已加入練習分析到系統提示詞:', practiceAnalyses.length,
                  '項分析');

      return systemPrompt + analysisContext;

    } catch (error) {
      console.error('❌ 處理練習分析失敗:', error);
      return systemPrompt;
    }
  }

  /**
   * 獲取科目顯示名稱
   */
  getSubjectDisplayName(subject) {
    const subjectNames = {
      'mathematics' : '數學',
      'science' : '自然科學',
      'language' : '語言學習',
      'general' : '通用'
    };
    return subjectNames[subject] || '通用';
  }

  /**
   * 獲取當前日期時間字串
   */
  _getCurrentDateTime() {
    return new Date().toLocaleString('zh-TW', {
      timeZone : 'Asia/Taipei',
      year : 'numeric',
      month : '2-digit',
      day : '2-digit',
      hour : '2-digit',
      minute : '2-digit'
    });
  }

  /**
   * 檢查是否已初始化
   */
  _ensureInitialized() {
    if (!this.initialized) {
      throw new Error('PromptProcessor not initialized. Call init() first.');
    }
  }
}

// 創建並導出實例
const promptProcessor = new PromptProcessor();
export default promptProcessor;
