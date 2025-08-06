/**
 * 學習報告生成器
 * 負責生成個人化的學習報告，整合學習追蹤、視覺化和 AI 分析
 */

class ReportGenerator {
  constructor(storageService, geminiService) {
    this.storageService = storageService;
    this.geminiService = geminiService;
    this.learningTracker = null;
    this.learningVisualization = null;
    this.userId = 'default';
  }

  /**
   * 初始化報告生成器
   * @param {LearningTracker} learningTracker - 學習追蹤器實例
   * @param {LearningVisualization} learningVisualization - 學習視覺化實例
   */
  async initialize(learningTracker, learningVisualization) {
    this.learningTracker = learningTracker;
    this.learningVisualization = learningVisualization;
    console.log('ReportGenerator initialized');
  }

  /**
   * 生成週報告
   * @param {string} userId - 用戶ID（可選）
   * @param {Object} options - 報告選項
   * @returns {Promise<Object>} 週報告數據
   */
  async generateWeeklyReport(userId = null, options = {}) {
    try {
      const targetUserId = userId || this.userId;
      const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      
      const filters = {
        startDate: oneWeekAgo,
        endDate: Date.now(),
        ...options.filters
      };

      // 獲取學習數據
      const [timeStats, successStats, difficultAreas] = await Promise.all([
        this.learningTracker.calculateLearningTime(targetUserId, filters),
        this.learningTracker.calculateSuccessRates(targetUserId, filters),
        this.learningTracker.identifyDifficultAreas(targetUserId)
      ]);

      // 生成 AI 分析
      const aiAnalysis = await this._generateAIAnalysis({
        timeStats,
        successStats,
        difficultAreas,
        reportType: 'weekly'
      });

      // 生成視覺化圖表
      const charts = await this._generateCharts({
        timeStats,
        successStats,
        difficultAreas,
        reportType: 'weekly'
      });

      const report = {
        id: this._generateReportId('weekly', targetUserId),
        type: 'weekly',
        userId: targetUserId,
        generatedAt: Date.now(),
        period: {
          start: oneWeekAgo,
          end: Date.now(),
          description: '過去 7 天'
        },
        summary: this._generateSummary(timeStats, successStats, difficultAreas),
        data: {
          timeStats,
          successStats,
          difficultAreas
        },
        analysis: aiAnalysis,
        charts,
        recommendations: this._generateRecommendations(difficultAreas, 'weekly'),
        achievements: this._calculateAchievements(timeStats, successStats),
        nextSteps: this._suggestNextSteps(difficultAreas, timeStats, successStats)
      };

      // 儲存報告
      await this._saveReport(report);

      return report;

    } catch (error) {
      console.error('生成週報告失敗:', error);
      throw error;
    }
  }

  /**
   * 生成月報告
   * @param {string} userId - 用戶ID（可選）
   * @param {Object} options - 報告選項
   * @returns {Promise<Object>} 月報告數據
   */
  async generateMonthlyReport(userId = null, options = {}) {
    try {
      const targetUserId = userId || this.userId;
      const oneMonthAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      
      const filters = {
        startDate: oneMonthAgo,
        endDate: Date.now(),
        ...options.filters
      };

      // 獲取學習數據
      const [timeStats, successStats, difficultAreas] = await Promise.all([
        this.learningTracker.calculateLearningTime(targetUserId, filters),
        this.learningTracker.calculateSuccessRates(targetUserId, filters),
        this.learningTracker.identifyDifficultAreas(targetUserId)
      ]);

      // 生成 AI 分析
      const aiAnalysis = await this._generateAIAnalysis({
        timeStats,
        successStats,
        difficultAreas,
        reportType: 'monthly'
      });

      // 生成視覺化圖表
      const charts = await this._generateCharts({
        timeStats,
        successStats,
        difficultAreas,
        reportType: 'monthly'
      });

      const report = {
        id: this._generateReportId('monthly', targetUserId),
        type: 'monthly',
        userId: targetUserId,
        generatedAt: Date.now(),
        period: {
          start: oneMonthAgo,
          end: Date.now(),
          description: '過去 30 天'
        },
        summary: this._generateSummary(timeStats, successStats, difficultAreas),
        data: {
          timeStats,
          successStats,
          difficultAreas
        },
        analysis: aiAnalysis,
        charts,
        recommendations: this._generateRecommendations(difficultAreas, 'monthly'),
        achievements: this._calculateAchievements(timeStats, successStats),
        nextSteps: this._suggestNextSteps(difficultAreas, timeStats, successStats)
      };

      // 儲存報告
      await this._saveReport(report);

      return report;

    } catch (error) {
      console.error('生成月報告失敗:', error);
      throw error;
    }
  }

  /**
   * 生成自定義期間報告
   * @param {number} startDate - 開始日期時間戳
   * @param {number} endDate - 結束日期時間戳
   * @param {string} userId - 用戶ID（可選）
   * @param {Object} options - 報告選項
   * @returns {Promise<Object>} 自定義報告數據
   */
  async generateCustomReport(startDate, endDate, userId = null, options = {}) {
    try {
      const targetUserId = userId || this.userId;
      
      const filters = {
        startDate,
        endDate,
        ...options.filters
      };

      // 獲取學習數據
      const [timeStats, successStats, difficultAreas] = await Promise.all([
        this.learningTracker.calculateLearningTime(targetUserId, filters),
        this.learningTracker.calculateSuccessRates(targetUserId, filters),
        this.learningTracker.identifyDifficultAreas(targetUserId)
      ]);

      // 生成 AI 分析
      const aiAnalysis = await this._generateAIAnalysis({
        timeStats,
        successStats,
        difficultAreas,
        reportType: 'custom',
        period: { startDate, endDate }
      });

      // 生成視覺化圖表
      const charts = await this._generateCharts({
        timeStats,
        successStats,
        difficultAreas,
        reportType: 'custom'
      });

      const daysDiff = Math.ceil((endDate - startDate) / (24 * 60 * 60 * 1000));
      const periodDescription = `${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()} (${daysDiff} 天)`;

      const report = {
        id: this._generateReportId('custom', targetUserId),
        type: 'custom',
        userId: targetUserId,
        generatedAt: Date.now(),
        period: {
          start: startDate,
          end: endDate,
          description: periodDescription
        },
        summary: this._generateSummary(timeStats, successStats, difficultAreas),
        data: {
          timeStats,
          successStats,
          difficultAreas
        },
        analysis: aiAnalysis,
        charts,
        recommendations: this._generateRecommendations(difficultAreas, 'custom'),
        achievements: this._calculateAchievements(timeStats, successStats),
        nextSteps: this._suggestNextSteps(difficultAreas, timeStats, successStats)
      };

      // 儲存報告
      await this._saveReport(report);

      return report;

    } catch (error) {
      console.error('生成自定義報告失敗:', error);
      throw error;
    }
  }

  /**
   * 獲取已保存的報告列表
   * @param {string} userId - 用戶ID（可選）
   * @param {Object} filters - 過濾條件
   * @returns {Promise<Array>} 報告列表
   */
  async getReports(userId = null, filters = {}) {
    try {
      const targetUserId = userId || this.userId;
      const reports = await this.storageService.getReports({
        userId: targetUserId,
        ...filters
      });

      return reports.sort((a, b) => b.generatedAt - a.generatedAt);

    } catch (error) {
      console.error('獲取報告列表失敗:', error);
      throw error;
    }
  }

  /**
   * 獲取特定報告
   * @param {string} reportId - 報告ID
   * @returns {Promise<Object>} 報告數據
   */
  async getReport(reportId) {
    try {
      const report = await this.storageService.getReport(reportId);
      if (!report) {
        throw new Error(`找不到報告: ${reportId}`);
      }
      return report;

    } catch (error) {
      console.error('獲取報告失敗:', error);
      throw error;
    }
  }

  /**
   * 刪除報告
   * @param {string} reportId - 報告ID
   * @returns {Promise<boolean>} 刪除是否成功
   */
  async deleteReport(reportId) {
    try {
      await this.storageService.deleteReport(reportId);
      return true;

    } catch (error) {
      console.error('刪除報告失敗:', error);
      return false;
    }
  }

  /**
   * 生成 AI 分析
   * @private
   */
  async _generateAIAnalysis(data) {
    try {
      if (!this.geminiService || !this.geminiService.isInitialized()) {
        console.warn('GeminiService 未初始化，跳過 AI 分析');
        return {
          summary: '系統分析：基於學習數據的基礎分析',
          insights: [],
          strengths: [],
          improvements: [],
          personalizedAdvice: '建議繼續保持學習習慣，專注於困難領域的練習。'
        };
      }

      const { timeStats, successStats, difficultAreas, reportType } = data;
      
      const prompt = this._buildAnalysisPrompt(timeStats, successStats, difficultAreas, reportType);
      
      const response = await this.geminiService.sendMessage(prompt, [], 
        '你是一位專業的學習分析師，負責分析學生的學習數據並提供個人化的建議。請以友善、鼓勵的語調提供分析，並給出具體可行的建議。');

      return this._parseAIResponse(response.text);

    } catch (error) {
      console.error('生成 AI 分析失敗:', error);
      return {
        summary: '分析暫時無法生成，請稍後再試',
        insights: [],
        strengths: [],
        improvements: [],
        personalizedAdvice: '建議繼續保持學習習慣，專注於困難領域的練習。'
      };
    }
  }

  /**
   * 構建 AI 分析提示詞
   * @private
   */
  _buildAnalysisPrompt(timeStats, successStats, difficultAreas, reportType) {
    const periodText = reportType === 'weekly' ? '本週' : reportType === 'monthly' ? '本月' : '這段時間';
    
    return `請分析以下學習數據並提供個人化建議：

**學習時間統計：**
- 總學習時間：${this._formatTime(timeStats.total.totalTime)}
- 答題數量：${timeStats.total.questionsAnswered} 題
- 平均答題時間：${this._formatTime(timeStats.total.averageResponseTime)}
- 學習會話數：${timeStats.total.sessions} 次

**成功率統計：**
- 整體正確率：${successStats.overall.successRate.toFixed(1)}%
- 總答題數：${successStats.overall.total} 題
- 正確題數：${successStats.overall.correct} 題

**主題表現：**
${Object.entries(successStats.byTopic).map(([topic, data]) => 
  `- ${topic}：${data.successRate.toFixed(1)}% (${data.correct}/${data.total})`
).join('\n')}

**困難區域：**
${difficultAreas.byTopic.length > 0 ? 
  difficultAreas.byTopic.map(area => 
    `- ${area.topic}：成功率 ${area.successRate.toFixed(1)}%，需要改善`
  ).join('\n') : 
  '- 目前沒有明顯的困難區域'}

請提供以下格式的分析：

## 學習表現總結
[提供${periodText}學習表現的整體評價]

## 主要優點
[列出 2-3 個學習優點]

## 需要改善的地方
[列出 1-2 個需要改善的地方]

## 個人化建議
[提供 3-4 個具體可行的學習建議]

## 學習洞察
[提供 2-3 個有價值的學習洞察]

請保持正面鼓勵的語調，並提供具體可行的建議。`;
  }

  /**
   * 解析 AI 回應
   * @private
   */
  _parseAIResponse(responseText) {
    const sections = {
      summary: '',
      strengths: [],
      improvements: [],
      personalizedAdvice: '',
      insights: []
    };

    try {
      const lines = responseText.split('\n');
      let currentSection = '';
      let currentContent = [];

      for (const line of lines) {
        const trimmedLine = line.trim();
        
        if (trimmedLine.includes('學習表現總結') || trimmedLine.includes('總結')) {
          currentSection = 'summary';
          currentContent = [];
        } else if (trimmedLine.includes('主要優點') || trimmedLine.includes('優點')) {
          currentSection = 'strengths';
          currentContent = [];
        } else if (trimmedLine.includes('需要改善') || trimmedLine.includes('改善')) {
          currentSection = 'improvements';
          currentContent = [];
        } else if (trimmedLine.includes('個人化建議') || trimmedLine.includes('建議')) {
          currentSection = 'personalizedAdvice';
          currentContent = [];
        } else if (trimmedLine.includes('學習洞察') || trimmedLine.includes('洞察')) {
          currentSection = 'insights';
          currentContent = [];
        } else if (trimmedLine && !trimmedLine.startsWith('#')) {
          currentContent.push(trimmedLine);
        }

        if (trimmedLine.startsWith('#') && currentContent.length > 0) {
          this._saveSectionContent(sections, currentSection, currentContent);
          currentContent = [];
        }
      }

      if (currentContent.length > 0) {
        this._saveSectionContent(sections, currentSection, currentContent);
      }

    } catch (error) {
      console.error('解析 AI 回應失敗:', error);
    }

    return sections;
  }

  /**
   * 保存章節內容
   * @private
   */
  _saveSectionContent(sections, sectionName, content) {
    const text = content.join(' ').trim();
    
    if (sectionName === 'summary' || sectionName === 'personalizedAdvice') {
      sections[sectionName] = text;
    } else if (sectionName === 'strengths' || sectionName === 'improvements' || sectionName === 'insights') {
      const items = content.filter(line => line.trim()).map(line => line.replace(/^[-*]\s*/, '').trim());
      sections[sectionName] = items;
    }
  }

  /**
   * 生成圖表
   * @private
   */
  async _generateCharts(data) {
    try {
      if (!this.learningVisualization) {
        console.warn('LearningVisualization 未初始化，跳過圖表生成');
        return {};
      }

      const { timeStats, successStats } = data;
      
      return {
        timeDistribution: {
          type: 'pie',
          data: this._prepareTimeDistributionData(timeStats),
          title: '學習時間分佈'
        },
        successRates: {
          type: 'bar',
          data: this._prepareSuccessRateData(successStats),
          title: '各主題成功率'
        }
      };

    } catch (error) {
      console.error('生成圖表失敗:', error);
      return {};
    }
  }

  /**
   * 準備時間分佈數據
   * @private
   */
  _prepareTimeDistributionData(timeStats) {
    const topics = Object.keys(timeStats.byTopic);
    const data = topics.map(topic => timeStats.byTopic[topic].totalTime);
    
    return {
      labels: topics,
      datasets: [{
        data,
        backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0']
      }]
    };
  }

  /**
   * 準備成功率數據
   * @private
   */
  _prepareSuccessRateData(successStats) {
    const topics = Object.keys(successStats.byTopic);
    const data = topics.map(topic => successStats.byTopic[topic].successRate);
    
    return {
      labels: topics,
      datasets: [{
        label: '成功率 (%)',
        data,
        backgroundColor: data.map(rate => 
          rate >= 80 ? '#4CAF50' : 
          rate >= 60 ? '#FFC107' : '#F44336'
        )
      }]
    };
  }

  /**
   * 生成報告摘要
   * @private
   */
  _generateSummary(timeStats, successStats, difficultAreas) {
    const totalTime = this._formatTime(timeStats.total.totalTime);
    const questionsCount = timeStats.total.questionsAnswered;
    const successRate = successStats.overall.successRate.toFixed(1);
    const difficultTopicsCount = difficultAreas.byTopic.length;
    
    return {
      totalTime,
      questionsCount,
      successRate: `${successRate}%`,
      sessionsCount: timeStats.total.sessions,
      difficultTopicsCount,
      averageResponseTime: this._formatTime(timeStats.total.averageResponseTime),
      topPerformingTopic: this._getTopPerformingTopic(successStats),
      mostDifficultTopic: difficultAreas.summary.mostDifficultTopic?.topic || '無'
    };
  }

  /**
   * 獲取表現最佳的主題
   * @private
   */
  _getTopPerformingTopic(successStats) {
    const topics = Object.entries(successStats.byTopic);
    if (topics.length === 0) return '無';
    
    const topTopic = topics.reduce((best, [topic, data]) => 
      data.successRate > best.successRate ? { topic, successRate: data.successRate } : best,
      { topic: '', successRate: 0 }
    );
    
    return topTopic.topic;
  }

  /**
   * 生成建議
   * @private
   */
  _generateRecommendations(difficultAreas, reportType) {
    const recommendations = [];
    
    if (difficultAreas.byTopic.length > 0) {
      const topDifficult = difficultAreas.byTopic.slice(0, 3);
      recommendations.push({
        type: 'focus_practice',
        priority: 'high',
        title: '重點練習困難主題',
        description: `建議優先練習：${topDifficult.map(area => area.topic).join('、')}`,
        actionItems: [
          '查看錯誤分析找出問題根源',
          '完成更多相關練習題',
          '複習基礎概念和方法'
        ]
      });
    }
    
    return recommendations;
  }

  /**
   * 計算成就
   * @private
   */
  _calculateAchievements(timeStats, successStats) {
    const achievements = [];
    
    if (timeStats.total.questionsAnswered >= 50) {
      achievements.push({
        type: 'quantity',
        title: '勤奮學習者',
        description: `已完成 ${timeStats.total.questionsAnswered} 道題目`,
        icon: '📚'
      });
    }
    
    if (successStats.overall.successRate >= 80) {
      achievements.push({
        type: 'accuracy',
        title: '優秀表現',
        description: `整體正確率達到 ${successStats.overall.successRate.toFixed(1)}%`,
        icon: '⭐'
      });
    }
    
    return achievements;
  }

  /**
   * 建議下一步行動
   * @private
   */
  _suggestNextSteps(difficultAreas, timeStats, successStats) {
    const nextSteps = [];
    
    if (difficultAreas.byTopic.length > 0) {
      nextSteps.push({
        type: 'improvement',
        title: '攻克困難主題',
        description: `重點練習 ${difficultAreas.byTopic[0].topic}`,
        priority: 'high'
      });
    }
    
    return nextSteps;
  }

  /**
   * 生成報告ID
   * @private
   */
  _generateReportId(type, userId) {
    const timestamp = Date.now();
    return `${type}_${userId}_${timestamp}`;
  }

  /**
   * 保存報告
   * @private
   */
  async _saveReport(report) {
    try {
      await this.storageService.saveReport(report);
      console.log(`報告已保存: ${report.id}`);
    } catch (error) {
      console.error('保存報告失敗:', error);
      throw error;
    }
  }

  /**
   * 格式化時間
   * @private
   */
  _formatTime(milliseconds) {
    if (!milliseconds || milliseconds < 0) return '0 秒';
    
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours} 小時 ${minutes % 60} 分鐘`;
    } else if (minutes > 0) {
      return `${minutes} 分鐘 ${seconds % 60} 秒`;
    } else {
      return `${seconds} 秒`;
    }
  }
}

export { ReportGenerator }; 