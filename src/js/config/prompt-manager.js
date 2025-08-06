/**
 * AI教學助理提示詞管理器
 * 負責載入和管理系統提示詞配置
 */

class PromptManager {
  constructor() {
    this.config = null;
    this.initialized = false;
    // 新增：學習架構暫存
    const storedData = window.localStorage.getItem("__learningStructures__");
    this.learningStructures = storedData ? JSON.parse(storedData) : {};
  }

  /**
   * 初始化配置
   */
  async init() {
    try {
      const response = await fetch('./src/config/ai-instructor-prompts.json');
      this.config = await response.json();
      this.initialized = true;
      console.log('PromptManager initialized with config version:',
                  this.config.version);
    } catch (error) {
      console.error('Failed to load prompt configuration:', error);
      throw new Error('無法載入AI助理配置');
    }
  }

  /**
   * 獲取所有可用的角色配置
   * @returns {Object} 角色配置列表
   */
  getRoleProfiles() {
    this._ensureInitialized();
    return this.config.roleProfiles || {};
  }

  /**
   * 獲取特定角色的配置
   * @param {string} roleId - 角色ID (mathematics, english, science, chinese,
   *     general)
   * @returns {Object|null} 角色配置
   */
  getRoleProfile(roleId) {
    this._ensureInitialized();
    return this.config.roleProfiles?.[roleId] || null;
  }

  /**
   * 獲取特定角色的系統提示詞
   * @param {string} roleId - 角色ID
   * @param {Object} variables - 要替換的變數
   * @param {Object|null} grade_info - 要替換的變數
   * @param {string} grade_info.grade - 學生年級
   * @param {string} grade_info.customLevel - 學生年級
   * @returns {string} 系統提示詞
   */
  getRoleSystemPrompt(roleId, variables = {}, grade_info = null) {
    this._ensureInitialized();

    const roleProfile = this.getRoleProfile(roleId);
    if (!roleProfile) {
      console.warn(
          `Role profile not found: ${roleId}, falling back to main prompt`);
      return this.getMainSystemPrompt(variables);
    }

    let prompt = roleProfile.systemPrompt;

    if (grade_info) {
      const {grade, customLevel} = grade_info;
      const learning_structures =
          this.getLearningStructure(roleId, grade, customLevel);
      const learning_structures_prompt =
          learning_structures
              ? `# 此次教學主要教學範疇\n${learning_structures}\n\n`
              : '';
      prompt =
          prompt.replace(`{learning_structures}`, learning_structures_prompt);
    } else {
      prompt = prompt.replace(`{learning_structures}`, '');
    }

    return this.preparePrompt(prompt, variables);
  }

  preparePrompt(prompt, variables) {
    const currentTime =
        variables.current_datetime || new Date().toLocaleString('zh-TW', {
          timeZone : 'Asia/Taipei',
          year : 'numeric',
          month : '2-digit',
          day : '2-digit',
          hour : '2-digit',
          minute : '2-digit'
        });

    prompt = prompt.replace('{current_datetime}', currentTime);

    Object.keys(this.config?.tools ?? []).forEach(k => {
      prompt = prompt.replace(`{tools.${k}}`, this.config.tools[k]);
    });

    // 替換其他變數
    Object.entries(variables).forEach(
        ([
          key, value
        ]) => { prompt = prompt.replace(new RegExp(`{${key}}`, 'g'), value); });
    return prompt;
  }

  /**
   * 檢查角色是否存在
   * @param {string} roleId - 角色ID
   * @returns {boolean}
   */
  hasRole(roleId) {
    this._ensureInitialized();
    return !!(this.config.roleProfiles?.[roleId]);
  }

  /**
   * 獲取角色選擇的歡迎訊息
   * @param {string} roleId - 角色ID
   * @returns {string}
   */
  getRoleWelcomeMessage(roleId) {
    this._ensureInitialized();

    const roleProfile = this.getRoleProfile(roleId);
    if (!roleProfile) {
      return this.getUIMessage('welcome');
    }

    const template = this.getUIMessage('roleSelected');
    return template.replace('{roleName}', roleProfile.name);
  }

  /**
   * 獲取主要教學助理的系統提示詞
   * @param {Object} variables - 要替換的變數 (如 current_datetime)
   * @returns {string} 完整的系統提示詞
   */
  getMainSystemPrompt(variables = {}) {
    this._ensureInitialized();

    const assistant = this.config.systemPrompts.mainTeachingAssistant;
    let prompt = assistant.basePrompt;

    // 替換變數
    const currentTime =
        variables.current_datetime || new Date().toLocaleString('zh-TW', {
          timeZone : 'Asia/Taipei',
          year : 'numeric',
          month : '2-digit',
          day : '2-digit',
          hour : '2-digit',
          minute : '2-digit'
        });

    prompt = prompt.replace('{current_datetime}', currentTime);

    // 添加詳細的教學流程
    prompt += this._buildTeachingFlowPrompt(assistant.teachingFlow);

    return prompt;
  }

  /**
   * 構建教學流程提示詞
   */
  _buildTeachingFlowPrompt(teachingFlow) {
    let flowPrompt = '\n\n';

    // Step 1: 意圖判斷
    const step1 = teachingFlow.step1;
    flowPrompt += `## 1. ${step1.name}\n\n`;
    flowPrompt += `- 若訊息中出現${
        step1.triggers.map(t => `「${t}」`).join('、')}，視為學生語境。\n`;
    flowPrompt +=
        `- 若訊息過短或不明確，請主動詢問：「${step1.fallbackResponse}」\n\n`;

    // Step 2: 科目辨識
    const step2 = teachingFlow.step2;
    flowPrompt += `## 2. ${step2.name}\n\n`;
    flowPrompt += `- 若科目是數學，使用數學教學流程，並採用「${
        step2.mathSubject.description}」邏輯。\n\n`;

    // Step 3: 數學科教學流程
    const step3 = teachingFlow.step3;
    flowPrompt += `## 3. ${step3.name}\n\n`;

    // 初步訊息蒐集
    const gathering = step3.phases.informationGathering;
    flowPrompt += `### 🎒 ${gathering.name}\n\n`;
    flowPrompt += `請主動以自然語氣邀請學生補充更多線索，例如：\n\n`;
    gathering.prompts.forEach(prompt => { flowPrompt += `- 「${prompt}」\n`; });

    // CPA教學步驟
    const cpa = step3.phases.cpaTeaching;
    flowPrompt += `\n### 🧩 ${cpa.name}\n\n`;
    flowPrompt += `${cpa.note}\n\n`;
    cpa.steps.forEach(step => {
      flowPrompt += `- **${step.name}**：${step.description}`;
      if (step.action) {
        flowPrompt += `，${step.action}`;
      }
      if (step.tools) {
        flowPrompt += `，如有需要可自動使用 ${step.tools.join('、')}`;
      }
      flowPrompt += `。\n`;
    });

    // Step 4: 教學節奏調整
    const step4 = teachingFlow.step4;
    flowPrompt += `\n## 4. ${step4.name}\n\n`;
    flowPrompt += `依學生反應調整難度與語速：\n\n`;
    Object.values(step4.adaptiveStrategies).forEach(strategy => {
      flowPrompt +=
          `- ${strategy.condition} → ${strategy.action || strategy.response}\n`;
    });

    // Step 5: 語氣原則
    const step5 = teachingFlow.step5;
    flowPrompt += `\n## 5. ${step5.name}\n\n`;
    step5.guidelines.forEach(
        guideline => { flowPrompt += `- ${guideline}\n`; });

    return flowPrompt;
  }

  /**
   * 獲取會話指令配置
   */
  getSessionCommands() {
    this._ensureInitialized();
    return this.config.sessionCommands;
  }

  /**
   * 獲取模型配置
   */
  getModelConfiguration() {
    this._ensureInitialized();
    return this.config.modelConfiguration;
  }

  /**
   * 獲取教學設定
   */
  getTeachingSettings() {
    this._ensureInitialized();
    return this.config.teachingSettings;
  }

  /**
   * 獲取UI訊息
   */
  getUIMessages() {
    this._ensureInitialized();
    return this.config.uiMessages;
  }

  /**
   * 獲取特定UI訊息
   * @param {string} key - 訊息鍵值
   * @returns {string} UI訊息文字
   */
  getUIMessage(key) {
    this._ensureInitialized();

    if (!this.config.uiMessages || !this.config.uiMessages[key]) {
      console.warn(`UI message not found for key: ${key}`);
      return `[訊息未找到: ${key}]`;
    }

    return this.config.uiMessages[key];
  }

  /**
   * 獲取系統提示詞（簡化版本，用於一般調用）
   * @param {Object} variables - 要替換的變數
   * @returns {string} 系統提示詞
   */
  getSystemPrompt(variables = {}) {
    return this.getMainSystemPrompt(variables);
  }

  /**
   * 獲取特定會話指令的回應
   */
  getCommandResponse(command, variables = {}) {
    this._ensureInitialized();

    const commandConfig = this.config.sessionCommands[command];
    if (!commandConfig) {
      return null;
    }

    if (commandConfig.responseTemplate) {
      let response = commandConfig.responseTemplate;
      Object.entries(variables).forEach(
          ([ key,
             value ]) => { response = response.replace(`{${key}}`, value); });
      return response;
    }

    return commandConfig.response;
  }

  /**
   * 獲取適應性教學策略
   */
  getAdaptiveStrategy(condition) {
    this._ensureInitialized();

    const teachingFlow =
        this.config.systemPrompts.mainTeachingAssistant?.teachingFlow;
    if (!teachingFlow || !teachingFlow.step4) {
      return null;
    }

    return teachingFlow.step4.adaptiveStrategies[condition] || null;
  }

  /**
   * 檢查是否已初始化
   */
  _ensureInitialized() {
    if (!this.initialized) {
      throw new Error('PromptManager not initialized. Call init() first.');
    }
  }

  /**
   * 獲取完整配置（除錯用）
   */
  getFullConfig() {
    this._ensureInitialized();
    return this.config;
  }

  /**
   * 設定學習架構資料
   * @param {string} roleId
   * @param {string} grade
   * @param {string} customLevel
   * @param {string} structureText
   */
  setLearningStructure(roleId, grade, customLevel, structureText) {
    if (!roleId || !grade)
      return;
    if (!this.learningStructures[roleId])
      this.learningStructures[roleId] = {};
    const key = `${grade}__${customLevel || ''}`;
    this.learningStructures[roleId][key] = structureText;
    window.localStorage.setItem("__learningStructures__",
                                JSON.stringify(this.learningStructures));
  }

  /**
   * 取得學習架構資料
   * @param {string} roleId
   * @param {string} grade
   * @param {string} customLevel
   * @returns {string|null}
   */
  getLearningStructure(roleId, grade, customLevel) {
    if (!roleId || !grade)
      return null;
    const key = `${grade}__${customLevel || ''}`;
    return this.learningStructures[roleId]?.[key] || null;
  }
}

// 創建並導出PromptManager實例
const promptManager = new PromptManager();
export default promptManager;
