/**
 * 匯出服務
 * 負責處理對話會話的匯出和下載功能
 */

class ExportService {
  constructor() {
    this.sessionManager = null;
    this.initialized = false;
  }

  /**
   * 初始化匯出服務
   * @param {Object} sessionManager - 會話管理器實例
   */
  init(sessionManager) {
    this.sessionManager = sessionManager;
    this.initialized = true;
    console.log('ExportService initialized');
  }

  /**
   * 檢查是否已初始化
   */
  _ensureInitialized() {
    if (!this.initialized) {
      throw new Error('ExportService not initialized. Call init() first.');
    }
  }

  /**
   * 匯出並下載單個會話
   * @param {string} sessionId - 會話ID
   * @param {string} format - 匯出格式
   */
  async exportAndDownloadSession(sessionId, format = 'json') {
    this._ensureInitialized();

    try {
      const exportResult = await this.sessionManager.exportSession(sessionId, format);
      this._downloadFile(exportResult.content, exportResult.fileName, exportResult.mimeType);
      
      return {
        success: true,
        fileName: exportResult.fileName,
        session: exportResult.session
      };
    } catch (error) {
      console.error('Failed to export session:', error);
      throw error;
    }
  }

  /**
   * 匯出並下載多個會話
   * @param {Array<string>} sessionIds - 會話ID陣列
   * @param {string} format - 匯出格式
   */
  async exportAndDownloadMultipleSessions(sessionIds, format = 'json') {
    this._ensureInitialized();

    try {
      const exportResult = await this.sessionManager.exportMultipleSessions(sessionIds, format);
      this._downloadFile(exportResult.content, exportResult.fileName, exportResult.mimeType);
      
      return {
        success: true,
        fileName: exportResult.fileName,
        sessionsCount: exportResult.sessions.length
      };
    } catch (error) {
      console.error('Failed to export multiple sessions:', error);
      throw error;
    }
  }

  /**
   * 匯出並下載所有會話
   * @param {string} format - 匯出格式
   */
  async exportAndDownloadAllSessions(format = 'json') {
    this._ensureInitialized();

    try {
      const exportResult = await this.sessionManager.exportAllSessions(format);
      this._downloadFile(exportResult.content, exportResult.fileName, exportResult.mimeType);
      
      return {
        success: true,
        fileName: exportResult.fileName,
        totalSessions: exportResult.totalSessions
      };
    } catch (error) {
      console.error('Failed to export all sessions:', error);
      throw error;
    }
  }

  /**
   * 獲取匯出預覽（不下載）
   * @param {string} sessionId - 會話ID
   * @param {string} format - 匯出格式
   */
  async getExportPreview(sessionId, format = 'json') {
    this._ensureInitialized();

    try {
      const exportResult = await this.sessionManager.exportSession(sessionId, format);
      
      // 限制預覽內容長度
      let previewContent = exportResult.content;
      if (previewContent.length > 5000) {
        previewContent = previewContent.substring(0, 5000) + '\n\n... (內容已截斷，完整內容請下載檔案查看)';
      }
      
      return {
        content: previewContent,
        fileName: exportResult.fileName,
        mimeType: exportResult.mimeType,
        fullSize: exportResult.content.length,
        session: exportResult.session
      };
    } catch (error) {
      console.error('Failed to get export preview:', error);
      throw error;
    }
  }

  /**
   * 獲取可用的匯出格式
   */
  getAvailableFormats() {
    return [
      {
        id: 'json',
        name: 'JSON',
        description: '結構化數據格式，適合程式處理',
        extension: '.json',
        mimeType: 'application/json'
      },
      {
        id: 'txt',
        name: '純文字',
        description: '簡潔的文字格式，易於閱讀',
        extension: '.txt',
        mimeType: 'text/plain'
      },
      {
        id: 'md',
        name: 'Markdown',
        description: '帶格式的文字格式，支援目錄和連結',
        extension: '.md',
        mimeType: 'text/markdown'
      },
      {
        id: 'html',
        name: 'HTML',
        description: '網頁格式，包含美觀的樣式',
        extension: '.html',
        mimeType: 'text/html'
      }
    ];
  }

  /**
   * 獲取會話統計資訊
   */
  async getExportStatistics() {
    this._ensureInitialized();

    const sessions = this.sessionManager.getSessionsList();
    console.log('Export statistics - sessions:', sessions); // 調試信息
    
    let totalMessages = 0;
    let totalCharacters = 0;
    let oldestSession = null;
    let newestSession = null;
    let roleStats = {};

    sessions.forEach(session => {
      console.log('Processing session:', session); // 調試信息
      
      // 確保 session 存在
      if (!session) {
        console.warn('Empty session found');
        return;
      }
      
      // 從會話本身或metadata獲取消息數量
      let messageCount = 0;
      if (session.metadata && session.metadata.messageCount) {
        messageCount = session.metadata.messageCount;
      } else if (session.messageCount) {
        messageCount = session.messageCount;
      } else if (session.messages && Array.isArray(session.messages)) {
        messageCount = session.messages.length;
      }
      
      totalMessages += messageCount;
      
      // 計算字元數（粗略估計）
      let estimatedChars = 0;
      if (session.metadata && session.metadata.lastUserMessage) {
        estimatedChars = session.metadata.lastUserMessage.length * Math.max(messageCount, 1);
      } else if (session.title) {
        estimatedChars = session.title.length * Math.max(messageCount, 1) * 10; // 假設平均訊息長度
      }
      totalCharacters += estimatedChars;

      // 找出最舊和最新的會話
      if (session.createdAt) {
        const createdDate = new Date(session.createdAt);
        if (!oldestSession || createdDate < new Date(oldestSession.createdAt)) {
          oldestSession = session;
        }
        if (!newestSession || createdDate > new Date(newestSession.createdAt)) {
          newestSession = session;
        }
      }

      // 統計角色
      let roleName = '一般對話';
      if (session.metadata && session.metadata.roleName) {
        roleName = session.metadata.roleName;
      }
      roleStats[roleName] = (roleStats[roleName] || 0) + 1;
    });

    const result = {
      totalSessions: sessions.length,
      totalMessages,
      estimatedCharacters: totalCharacters,
      oldestSession: oldestSession ? {
        title: oldestSession.title,
        createdAt: oldestSession.createdAt
      } : null,
      newestSession: newestSession ? {
        title: newestSession.title,
        createdAt: newestSession.createdAt
      } : null,
      roleDistribution: roleStats,
      estimatedExportSizes: this._estimateExportSizes(totalCharacters, sessions.length)
    };
    
    console.log('Export statistics result:', result); // 調試信息
    return result;
  }

  /**
   * 估算不同格式的匯出檔案大小
   * @private
   */
  _estimateExportSizes(totalCharacters, sessionCount) {
    // 這些是粗略的估算
    const baseSize = totalCharacters * 2; // 考慮中文字元和結構
    
    return {
      json: Math.round(baseSize * 1.5), // JSON 有額外的結構資訊
      txt: Math.round(baseSize * 1.1),  // 純文字最小
      md: Math.round(baseSize * 1.3),   // Markdown 有格式標記
      html: Math.round(baseSize * 2.0)  // HTML 有完整的樣式
    };
  }

  /**
   * 下載檔案
   * @private
   */
  _downloadFile(content, fileName, mimeType) {
    try {
      // 建立 Blob
      const blob = new Blob([content], { type: mimeType });
      
      // 建立下載連結
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      
      // 觸發下載
      document.body.appendChild(link);
      link.click();
      
      // 清理
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      console.log(`File downloaded: ${fileName}`);
    } catch (error) {
      console.error('Failed to download file:', error);
      throw new Error('檔案下載失敗');
    }
  }

  /**
   * 複製內容到剪貼簿
   * @param {string} content - 要複製的內容
   */
  async copyToClipboard(content) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(content);
      } else {
        // 舊版瀏覽器回退方案
        const textArea = document.createElement('textarea');
        textArea.value = content;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      return false;
    }
  }

  /**
   * 批量選擇工具：根據條件篩選會話
   * @param {Object} criteria - 篩選條件
   */
  selectSessionsByCriteria(criteria = {}) {
    this._ensureInitialized();

    const sessions = this.sessionManager.getSessionsList();
    let filteredSessions = [...sessions];

    // 按日期範圍篩選
    if (criteria.dateFrom || criteria.dateTo) {
      filteredSessions = filteredSessions.filter(session => {
        const sessionDate = new Date(session.createdAt);
        
        if (criteria.dateFrom && sessionDate < new Date(criteria.dateFrom)) {
          return false;
        }
        
        if (criteria.dateTo && sessionDate > new Date(criteria.dateTo)) {
          return false;
        }
        
        return true;
      });
    }

    // 按角色篩選
    if (criteria.roleId || criteria.roleName) {
      filteredSessions = filteredSessions.filter(session => {
        if (criteria.roleId && session.metadata.roleId !== criteria.roleId) {
          return false;
        }
        
        if (criteria.roleName && session.metadata.roleName !== criteria.roleName) {
          return false;
        }
        
        return true;
      });
    }

    // 按訊息數量篩選
    if (criteria.minMessages || criteria.maxMessages) {
      filteredSessions = filteredSessions.filter(session => {
        const messageCount = session.metadata.messageCount || 0;
        
        if (criteria.minMessages && messageCount < criteria.minMessages) {
          return false;
        }
        
        if (criteria.maxMessages && messageCount > criteria.maxMessages) {
          return false;
        }
        
        return true;
      });
    }

    // 按標題關鍵字篩選
    if (criteria.titleKeyword) {
      const keyword = criteria.titleKeyword.toLowerCase();
      filteredSessions = filteredSessions.filter(session => 
        session.title.toLowerCase().includes(keyword) ||
        (session.metadata.lastUserMessage && 
         session.metadata.lastUserMessage.toLowerCase().includes(keyword))
      );
    }

    return {
      sessions: filteredSessions,
      totalCount: filteredSessions.length,
      criteria: criteria
    };
  }
}

// 建立並匯出實例
const exportService = new ExportService();
export default exportService; 