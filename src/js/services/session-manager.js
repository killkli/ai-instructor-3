/**
 * 會話管理服務
 * 負責管理聊天會話的創建、保存、載入和切換
 */

class SessionManager {
  constructor() {
    this.currentSession = null;
    this.sessions = new Map();
    this.storageService = null;
    this.initialized = false;
  }

  /**
   * 初始化會話管理器
   * @param {Object} storageService - 儲存服務實例
   */
  async init(storageService) {
    this.storageService = storageService;
    await this._loadSessions();
    this.initialized = true;
    console.log('SessionManager initialized');
  }

  /**
   * 檢查是否已初始化
   */
  _ensureInitialized() {
    if (!this.initialized) {
      throw new Error('SessionManager not initialized. Call init() first.');
    }
  }

  /**
   * 創建新會話
   * @param {Object|string} options - 選項物件或會話標題（向後兼容）
   * @param {string} options.title - 會話標題（可選）
   * @param {string} options.roleId - 角色ID（可選）
   * @param {string} options.roleName - 角色名稱（可選）
   * @param {string} options.grade - 目標年級
   * @param {string} options.customLevel - 目標自述學習程度
   * @returns {Promise<Object>} 新創建的會話
   */
  async createNewSession(options = {}) {
    this._ensureInitialized();

    // 向後兼容：如果傳入的是字符串，視為標題
    if (typeof options === 'string') {
      options = { title: options };
    }

    const { title, roleId, roleName, grade, customLevel } = options;

    const sessionId = this._generateSessionId();
    const session = {
      id: sessionId,
      title: title || this._generateDefaultTitle(roleName),
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      settings: {
        model: 'gemini-2.5-flash-preview-05-20',
        temperature: 0.7,
        subject: roleId || 'general'
      },
      metadata: {
        messageCount: 0,
        lastUserMessage: null,
        tags: [],
        roleId: roleId || null,
        roleName: roleName || null,
        grade, customLevel
      }
    };

    this.sessions.set(sessionId, session);
    this.currentSession = session;

    // 保存到儲存
    await this._saveSession(session);
    await this._updateSessionList();

    console.log(`New session created: ${sessionId} with role: ${roleId || 'default'}`);
    return session;
  }

  /**
   * 生成預設會話標題
   * @private
   */
  _generateDefaultTitle(roleName) {
    const timeStr = new Date().toLocaleString('zh-TW', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    if (roleName) {
      return `${roleName} ${timeStr}`;
    }

    return `新會話 ${timeStr}`;
  }

  /**
   * 獲取當前會話
   * @returns {Object|null} 當前會話物件
   */
  getCurrentSession() {
    return this.currentSession;
  }

  /**
   * 切換到指定會話
   * @param {string} sessionId - 會話ID
   * @returns {Promise<Object>} 切換後的會話
   */
  async switchToSession(sessionId) {
    this._ensureInitialized();

    if (!this.sessions.has(sessionId)) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const session = this.sessions.get(sessionId);
    this.currentSession = session;

    // 更新最後訪問時間
    session.lastAccessedAt = new Date().toISOString();
    await this._saveSession(session);

    console.log(`Switched to session: ${sessionId}`);
    return session;
  }

  /**
   * 添加訊息到當前會話
   * @param {string} role - 訊息角色 ('user' 或 'assistant')
   * @param {string|Object} content - 訊息內容，可以是字符串或包含文本和圖片的對象
   * @param {Object} metadata - 額外元數據
   * @param {Array} images - 圖片陣列（可選，用於向後兼容）
   * @returns {Promise<Object>} 添加的訊息物件
   */
  async addMessage(role, content, metadata = {}, images = null) {
    this._ensureInitialized();

    if (!this.currentSession) {
      await this.createNewSession();
    }

    // 處理多模態內容
    let messageContent = content;
    let messageImages = images;

    if (typeof content === 'object' && content.text !== undefined) {
      messageContent = content.text;
      messageImages = content.images || images;
    }

    const message = {
      id: this._generateMessageId(),
      role,
      content: messageContent,
      timestamp: new Date().toISOString(),
      metadata: {
        model: this.currentSession.settings.model,
        ...metadata
      }
    };

    // 添加圖片信息（如果有）
    if (messageImages && messageImages.length > 0) {
      message.images = messageImages.map(img => ({
        mimeType: img.mimeType,
        data: img.data,
        name: img.name || 'image',
        size: img.size || 0
      }));
    }

    this.currentSession.messages.push(message);
    this.currentSession.updatedAt = new Date().toISOString();
    this.currentSession.metadata.messageCount = this.currentSession.messages.length;

    // 更新會話標題（如果是第一個用戶訊息）
    if (role === 'user' && this.currentSession.messages.filter(m => m.role === 'user').length === 1) {
      const titleContent = typeof content === 'string' ? content : (content.text || '圖片訊息');
      this.currentSession.title = this._generateSessionTitle(titleContent);
      this.currentSession.metadata.lastUserMessage = titleContent.substring(0, 100);
    }

    // 保存會話
    await this._saveSession(this.currentSession);
    await this._updateSessionList();

    return message;
  }

  /**
   * 獲取會話的訊息歷史
   * @param {string} sessionId - 會話ID（可選，預設為當前會話）
   * @param {number} limit - 限制返回的訊息數量
   * @returns {Array} 訊息陣列
   */
  getSessionHistory(sessionId = null, limit = null) {
    this._ensureInitialized();

    const session = sessionId ? this.sessions.get(sessionId) : this.currentSession;

    if (!session) {
      return [];
    }

    const messages = session.messages;
    return limit ? messages.slice(-limit) : messages;
  }

  /**
   * 刪除會話
   * @param {string} sessionId - 要刪除的會話ID
   * @returns {Promise<boolean>} 是否成功刪除
   */
  async deleteSession(sessionId) {
    this._ensureInitialized();

    if (!this.sessions.has(sessionId)) {
      return false;
    }

    // 如果刪除的是當前會話，切換到其他會話或創建新會話
    if (this.currentSession && this.currentSession.id === sessionId) {
      const otherSessions = Array.from(this.sessions.values()).filter(s => s.id !== sessionId);
      if (otherSessions.length > 0) {
        await this.switchToSession(otherSessions[0].id);
      } else {
        this.currentSession = null;
      }
    }

    this.sessions.delete(sessionId);
    await this.storageService.deleteSession(sessionId);
    await this._updateSessionList();

    console.log(`Session deleted: ${sessionId}`);
    return true;
  }

  /**
   * 獲取所有會話列表
   * @returns {Array} 會話摘要陣列
   */
  getSessionsList() {
    this._ensureInitialized();

    return Array.from(this.sessions.values())
      .map(session => ({
        id: session.id,
        title: session.title,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        messageCount: session.metadata.messageCount,
        lastUserMessage: session.metadata.lastUserMessage,
        isActive: this.currentSession && this.currentSession.id === session.id
      }))
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  /**
   * 更新會話設定
   * @param {Object} settings - 新的設定
   * @returns {Promise<void>}
   */
  async updateSessionSettings(settings) {
    this._ensureInitialized();

    if (!this.currentSession) {
      throw new Error('No active session');
    }

    this.currentSession.settings = {
      ...this.currentSession.settings,
      ...settings
    };

    this.currentSession.updatedAt = new Date().toISOString();
    await this._saveSession(this.currentSession);
  }

  /**
   * 生成會話摘要
   * @param {string} sessionId - 會話ID（可選）
   * @returns {Promise<string>} 會話摘要
   */
  async generateSessionSummary(sessionId = null) {
    this._ensureInitialized();

    const session = sessionId ? this.sessions.get(sessionId) : this.currentSession;

    if (!session || session.messages.length === 0) {
      return '此會話尚無對話內容。';
    }

    const messages = session.messages;
    const userMessages = messages.filter(m => m.role === 'user').length;
    const assistantMessages = messages.filter(m => m.role === 'assistant').length;

    const duration = this._calculateSessionDuration(session);
    const topics = this._extractTopics(messages);

    return `
會話摘要：
- 開始時間：${new Date(session.createdAt).toLocaleString('zh-TW')}
- 持續時間：${duration}
- 總訊息數：${messages.length}（用戶：${userMessages}，助理：${assistantMessages}）
- 主要話題：${topics.join('、')}
- 最後更新：${new Date(session.updatedAt).toLocaleString('zh-TW')}
    `.trim();
  }

  /**
   * 搜尋會話
   * @param {string} query - 搜尋關鍵字
   * @returns {Array} 匹配的會話陣列
   */
  searchSessions(query) {
    this._ensureInitialized();

    if (!query || query.trim() === '') {
      return this.getSessionsList();
    }

    const normalizedQuery = query.toLowerCase().trim();

    return Array.from(this.sessions.values())
      .filter(session => {
        // 搜尋標題
        if (session.title.toLowerCase().includes(normalizedQuery)) {
          return true;
        }

        // 搜尋訊息內容
        return session.messages.some(message =>
          message.content.toLowerCase().includes(normalizedQuery)
        );
      })
      .map(session => ({
        id: session.id,
        title: session.title,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        messageCount: session.metadata.messageCount,
        lastUserMessage: session.metadata.lastUserMessage,
        isActive: this.currentSession && this.currentSession.id === session.id
      }))
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  /**
   * 從儲存載入所有會話
   */
  async _loadSessions() {
    try {
      const sessionsList = await this.storageService.getAllSessions();

      for (const sessionSummary of sessionsList) {
        const fullSession = await this.storageService.getSession(sessionSummary.id);
        if (fullSession) {
          this.sessions.set(fullSession.id, fullSession);
        }
      }

      // 設定最近的會話為當前會話
      if (this.sessions.size > 0) {
        const sortedSessions = Array.from(this.sessions.values())
          .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        this.currentSession = sortedSessions[0];
      }

      console.log(`Loaded ${this.sessions.size} sessions`);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  }

  /**
   * 保存單個會話到儲存
   */
  async _saveSession(session) {
    try {
      await this.storageService.saveSession(session);
    } catch (error) {
      console.error('Failed to save session:', error);
      throw error;
    }
  }

  /**
   * 更新會話列表到儲存
   */
  async _updateSessionList() {
    try {
      const sessionsList = Array.from(this.sessions.values()).map(session => ({
        id: session.id,
        title: session.title,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        messageCount: session.metadata.messageCount
      }));

      await this.storageService.saveSessionsList(sessionsList);
    } catch (error) {
      console.error('Failed to update sessions list:', error);
    }
  }

  /**
   * 生成唯一的會話ID
   */
  _generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 生成唯一的訊息ID
   */
  _generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 生成會話標題
   */
  _generateSessionTitle(firstMessage) {
    const maxLength = 30;
    let title = firstMessage.trim();

    // 移除指令前綴
    title = title.replace(/^\/\w+\s*/, '');

    if (title.length > maxLength) {
      title = title.substring(0, maxLength) + '...';
    }

    return title || '新對話';
  }

  /**
   * 計算會話持續時間
   */
  _calculateSessionDuration(session) {
    const start = new Date(session.createdAt);
    const end = new Date(session.updatedAt);
    const diffMs = end - start;

    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 1) {
      return '不到1分鐘';
    } else if (diffMins < 60) {
      return `${diffMins}分鐘`;
    } else {
      const diffHours = Math.floor(diffMins / 60);
      const remainingMins = diffMins % 60;
      return `${diffHours}小時${remainingMins}分鐘`;
    }
  }

  /**
   * 從訊息中提取主要話題
   */
  _extractTopics(messages) {
    const userMessages = messages
      .filter(m => m.role === 'user')
      .map(m => m.content)
      .join(' ');

    // 簡單的關鍵字提取（可以進一步改進）
    const keywords = ['數學', '英文', '科學', '歷史', '地理', '物理', '化學', '生物'];
    const foundTopics = keywords.filter(keyword =>
      userMessages.includes(keyword)
    );

    return foundTopics.length > 0 ? foundTopics : ['一般對話'];
  }

  /**
   * 匯出單個會話
   * @param {string} sessionId - 會話ID
   * @param {string} format - 匯出格式 ('json', 'txt', 'md', 'html')
   * @returns {Promise<Object>} 匯出結果
   */
  async exportSession(sessionId, format = 'json') {
    this._ensureInitialized();

    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const exportData = this._prepareExportData([session]);
    const content = this._formatExportContent(exportData, format);
    const fileName = this._generateExportFileName(session, format);

    return {
      content,
      fileName,
      mimeType: this._getExportMimeType(format),
      session: exportData.sessions[0]
    };
  }

  /**
   * 匯出多個會話
   * @param {Array<string>} sessionIds - 會話ID陣列
   * @param {string} format - 匯出格式
   * @returns {Promise<Object>} 匯出結果
   */
  async exportMultipleSessions(sessionIds, format = 'json') {
    this._ensureInitialized();

    const sessions = sessionIds.map(id => {
      const session = this.sessions.get(id);
      if (!session) {
        throw new Error(`Session not found: ${id}`);
      }
      return session;
    });

    const exportData = this._prepareExportData(sessions);
    const content = this._formatExportContent(exportData, format);
    const fileName = this._generateBatchExportFileName(sessions, format);

    return {
      content,
      fileName,
      mimeType: this._getExportMimeType(format),
      sessions: exportData.sessions
    };
  }

  /**
   * 匯出所有會話
   * @param {string} format - 匯出格式
   * @returns {Promise<Object>} 匯出結果
   */
  async exportAllSessions(format = 'json') {
    this._ensureInitialized();

    const allSessions = Array.from(this.sessions.values());
    if (allSessions.length === 0) {
      throw new Error('No sessions to export');
    }

    const exportData = this._prepareExportData(allSessions);
    const content = this._formatExportContent(exportData, format);
    const fileName = this._generateAllSessionsExportFileName(format);

    return {
      content,
      fileName,
      mimeType: this._getExportMimeType(format),
      sessions: exportData.sessions,
      totalSessions: allSessions.length
    };
  }

  /**
   * 準備匯出數據
   * @private
   */
  _prepareExportData(sessions) {
    const exportTimestamp = new Date().toISOString();

    return {
      exportInfo: {
        exportedAt: exportTimestamp,
        appVersion: '1.0.0',
        totalSessions: sessions.length,
        totalMessages: sessions.reduce((sum, session) => sum + session.messages.length, 0)
      },
      sessions: sessions.map(session => ({
        id: session.id,
        title: session.title,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        lastAccessedAt: session.lastAccessedAt,
        settings: session.settings,
        metadata: session.metadata,
        messages: session.messages.map(message => ({
          id: message.id,
          role: message.role,
          content: message.content,
          timestamp: message.timestamp,
          metadata: message.metadata,
          images: message.images || []
        }))
      }))
    };
  }

  /**
   * 格式化匯出內容
   * @private
   */
  _formatExportContent(exportData, format) {
    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(exportData, null, 2);

      case 'txt':
        return this._formatAsText(exportData);

      case 'md':
        return this._formatAsMarkdown(exportData);

      case 'html':
        return this._formatAsHTML(exportData);

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * 格式化為純文字
   * @private
   */
  _formatAsText(exportData) {
    let content = '';

    // 匯出資訊
    content += `AI 教學助理對話匯出\n`;
    content += `匯出時間: ${new Date(exportData.exportInfo.exportedAt).toLocaleString('zh-TW')}\n`;
    content += `會話數量: ${exportData.exportInfo.totalSessions}\n`;
    content += `訊息總數: ${exportData.exportInfo.totalMessages}\n`;
    content += `${'='.repeat(50)}\n\n`;

    // 每個會話
    exportData.sessions.forEach((session, index) => {
      content += `會話 ${index + 1}: ${session.title}\n`;
      content += `建立時間: ${new Date(session.createdAt).toLocaleString('zh-TW')}\n`;
      content += `更新時間: ${new Date(session.updatedAt).toLocaleString('zh-TW')}\n`;
      content += `訊息數量: ${session.messages.length}\n`;
      if (session.metadata.roleName) {
        content += `角色: ${session.metadata.roleName}\n`;
      }
      content += `${'-'.repeat(30)}\n\n`;

      // 訊息內容
      session.messages.forEach((message, msgIndex) => {
        const timestamp = new Date(message.timestamp).toLocaleString('zh-TW');
        const role = message.role === 'user' ? '使用者' : 'AI助理';

        content += `[${msgIndex + 1}] ${role} (${timestamp}):\n`;
        content += `${message.content}\n`;

        if (message.images && message.images.length > 0) {
          content += `附件: ${message.images.length} 張圖片\n`;
        }

        content += '\n';
      });

      content += `${'='.repeat(50)}\n\n`;
    });

    return content;
  }

  /**
   * 格式化為Markdown
   * @private
   */
  _formatAsMarkdown(exportData) {
    let content = '';

    // 標題和匯出資訊
    content += `# AI 教學助理對話匯出\n\n`;
    content += `**匯出時間:** ${new Date(exportData.exportInfo.exportedAt).toLocaleString('zh-TW')}\n`;
    content += `**會話數量:** ${exportData.exportInfo.totalSessions}\n`;
    content += `**訊息總數:** ${exportData.exportInfo.totalMessages}\n\n`;
    content += `---\n\n`;

    // 目錄
    if (exportData.sessions.length > 1) {
      content += `## 目錄\n\n`;
      exportData.sessions.forEach((session, index) => {
        const anchor = session.title.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '-').toLowerCase();
        content += `${index + 1}. [${session.title}](#${anchor})\n`;
      });
      content += `\n---\n\n`;
    }

    // 每個會話
    exportData.sessions.forEach((session, index) => {
      const anchor = session.title.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '-').toLowerCase();

      content += `## ${session.title} {#${anchor}}\n\n`;
      content += `**建立時間:** ${new Date(session.createdAt).toLocaleString('zh-TW')}\n`;
      content += `**更新時間:** ${new Date(session.updatedAt).toLocaleString('zh-TW')}\n`;
      content += `**訊息數量:** ${session.messages.length}\n`;

      if (session.metadata.roleName) {
        content += `**角色:** ${session.metadata.roleName}\n`;
      }

      content += `\n### 對話內容\n\n`;

      // 訊息內容
      session.messages.forEach((message, msgIndex) => {
        const timestamp = new Date(message.timestamp).toLocaleString('zh-TW');
        const role = message.role === 'user' ? '👤 **使用者**' : '🤖 **AI助理**';

        content += `#### ${role} \`${timestamp}\`\n\n`;
        content += `${message.content}\n\n`;

        if (message.images && message.images.length > 0) {
          content += `*📎 附件: ${message.images.length} 張圖片*\n\n`;
        }
      });

      if (index < exportData.sessions.length - 1) {
        content += `---\n\n`;
      }
    });

    return content;
  }

  /**
   * 格式化為HTML
   * @private
   */
  _formatAsHTML(exportData) {
    const timestamp = new Date(exportData.exportInfo.exportedAt).toLocaleString('zh-TW');

    let html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI 教學助理對話匯出</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
            color: #333;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            border-bottom: 2px solid #4285f4;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .export-info {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 30px;
        }
        .session {
            margin-bottom: 40px;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            overflow: hidden;
        }
        .session-header {
            background: #4285f4;
            color: white;
            padding: 15px 20px;
        }
        .session-meta {
            background: #f1f3f4;
            padding: 10px 20px;
            font-size: 0.9em;
            color: #666;
        }
        .message {
            padding: 15px 20px;
            border-bottom: 1px solid #f0f0f0;
        }
        .message:last-child {
            border-bottom: none;
        }
        .message-user {
            background: #e3f2fd;
        }
        .message-assistant {
            background: #f3e5f5;
        }
        .message-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
            font-weight: bold;
        }
        .message-role {
            color: #1976d2;
        }
        .message-timestamp {
            font-size: 0.8em;
            color: #666;
            font-weight: normal;
        }
        .message-content {
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        .message-images {
            margin-top: 10px;
            font-style: italic;
            color: #666;
        }
        .toc {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 5px;
            margin-bottom: 30px;
        }
        .toc ul {
            list-style-type: none;
            padding-left: 0;
        }
        .toc li {
            margin: 5px 0;
        }
        .toc a {
            text-decoration: none;
            color: #1976d2;
        }
        .toc a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🤖 AI 教學助理對話匯出</h1>
        </div>
        
        <div class="export-info">
            <h3>匯出資訊</h3>
            <p><strong>匯出時間:</strong> ${timestamp}</p>
            <p><strong>會話數量:</strong> ${exportData.exportInfo.totalSessions}</p>
            <p><strong>訊息總數:</strong> ${exportData.exportInfo.totalMessages}</p>
        </div>`;

    // 目錄
    if (exportData.sessions.length > 1) {
      html += `
        <div class="toc">
            <h3>目錄</h3>
            <ul>`;

      exportData.sessions.forEach((session, index) => {
        html += `<li><a href="#session-${index}">${index + 1}. ${this._escapeHtml(session.title)}</a></li>`;
      });

      html += `
            </ul>
        </div>`;
    }

    // 每個會話
    exportData.sessions.forEach((session, index) => {
      html += `
        <div class="session" id="session-${index}">
            <div class="session-header">
                <h2>${this._escapeHtml(session.title)}</h2>
            </div>
            <div class="session-meta">
                <strong>建立時間:</strong> ${new Date(session.createdAt).toLocaleString('zh-TW')} | 
                <strong>更新時間:</strong> ${new Date(session.updatedAt).toLocaleString('zh-TW')} | 
                <strong>訊息數量:</strong> ${session.messages.length}`;

      if (session.metadata.roleName) {
        html += ` | <strong>角色:</strong> ${this._escapeHtml(session.metadata.roleName)}`;
      }

      html += `
            </div>`;

      // 訊息內容
      session.messages.forEach((message) => {
        const timestamp = new Date(message.timestamp).toLocaleString('zh-TW');
        const roleClass = message.role === 'user' ? 'message-user' : 'message-assistant';
        const roleText = message.role === 'user' ? '👤 使用者' : '🤖 AI助理';

        html += `
            <div class="message ${roleClass}">
                <div class="message-header">
                    <span class="message-role">${roleText}</span>
                    <span class="message-timestamp">${timestamp}</span>
                </div>
                <div class="message-content">${this._escapeHtml(message.content)}</div>`;

        if (message.images && message.images.length > 0) {
          html += `<div class="message-images">📎 附件: ${message.images.length} 張圖片</div>`;
        }

        html += `
            </div>`;
      });

      html += `
        </div>`;
    });

    html += `
    </div>
</body>
</html>`;

    return html;
  }

  /**
   * 生成匯出檔案名稱
   * @private
   */
  _generateExportFileName(session, format) {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
    const safeTitle = session.title.replace(/[^\w\u4e00-\u9fff]/g, '_').substring(0, 30);
    return `ai-instructor-session-${safeTitle}-${timestamp}.${format}`;
  }

  /**
   * 生成批量匯出檔案名稱
   * @private
   */
  _generateBatchExportFileName(sessions, format) {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
    return `ai-instructor-sessions-${sessions.length}-${timestamp}.${format}`;
  }

  /**
   * 生成全部會話匯出檔案名稱
   * @private
   */
  _generateAllSessionsExportFileName(format) {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
    return `ai-instructor-all-sessions-${timestamp}.${format}`;
  }

  /**
   * 獲取匯出格式的MIME類型
   * @private
   */
  _getExportMimeType(format) {
    const mimeTypes = {
      json: 'application/json',
      txt: 'text/plain',
      md: 'text/markdown',
      html: 'text/html'
    };
    return mimeTypes[format.toLowerCase()] || 'text/plain';
  }

  /**
   * HTML 轉義
   * @private
   */
  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// 創建全域實例
const sessionManager = new SessionManager();

export default sessionManager; 
