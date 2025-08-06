/**
 * 學習進度追蹤器
 * 負責追蹤學習時間、計算成功率和識別困難區域
 */

class LearningTracker {
  constructor(storageService) {
    this.storageService = storageService;
    this.userId = 'default'; // 預設用戶ID
  }

  /**
   * 計算總學習時間統計
   * @param {string} userId - 用戶ID（可選）
   * @param {Object} filters - 過濾條件
   * @returns {Promise<Object>} 學習時間統計
   */
  async calculateLearningTime(userId = null, filters = {}) {
    try {
      const targetUserId = userId || this.userId;
      const learningRecords = await this.storageService.getLearningRecords({
        userId: targetUserId,
        ...filters
      });

      const stats = {
        total: {
          sessions: 0,
          totalTime: 0, // 毫秒
          questionsAnswered: 0,
          averageResponseTime: 0
        },
        bySubject: {},
        byTopic: {},
        byDate: {},
        recentActivity: []
      };

      // 按會話分組計算時間
      const sessionGroups = this._groupBy(learningRecords, 'sessionId');
      
      stats.total.sessions = Object.keys(sessionGroups).length;
      stats.total.questionsAnswered = learningRecords.length;

      // 計算總響應時間
      let totalResponseTime = 0;
      for (const record of learningRecords) {
        totalResponseTime += record.responseTime || 0;
        
        // 按主題統計
        if (!stats.byTopic[record.topic]) {
          stats.byTopic[record.topic] = {
            questionsAnswered: 0,
            totalTime: 0,
            averageTime: 0
          };
        }
        stats.byTopic[record.topic].questionsAnswered++;
        stats.byTopic[record.topic].totalTime += record.responseTime || 0;

        // 按科目統計
        if (!stats.bySubject[record.subject]) {
          stats.bySubject[record.subject] = {
            questionsAnswered: 0,
            totalTime: 0,
            averageTime: 0
          };
        }
        stats.bySubject[record.subject].questionsAnswered++;
        stats.bySubject[record.subject].totalTime += record.responseTime || 0;

        // 按日期統計
        const date = new Date(record.timestamp).toDateString();
        if (!stats.byDate[date]) {
          stats.byDate[date] = {
            questionsAnswered: 0,
            totalTime: 0,
            sessions: new Set()
          };
        }
        stats.byDate[date].questionsAnswered++;
        stats.byDate[date].totalTime += record.responseTime || 0;
        stats.byDate[date].sessions.add(record.sessionId);
      }

      // 計算平均值
      stats.total.totalTime = totalResponseTime;
      stats.total.averageResponseTime = learningRecords.length > 0 ? 
        totalResponseTime / learningRecords.length : 0;

      // 計算各分類的平均時間
      Object.keys(stats.byTopic).forEach(topic => {
        const topicData = stats.byTopic[topic];
        topicData.averageTime = topicData.questionsAnswered > 0 ? 
          topicData.totalTime / topicData.questionsAnswered : 0;
      });

      Object.keys(stats.bySubject).forEach(subject => {
        const subjectData = stats.bySubject[subject];
        subjectData.averageTime = subjectData.questionsAnswered > 0 ? 
          subjectData.totalTime / subjectData.questionsAnswered : 0;
      });

      // 轉換 byDate 中的 Set 為數量
      Object.keys(stats.byDate).forEach(date => {
        const dateData = stats.byDate[date];
        dateData.sessionCount = dateData.sessions.size;
        delete dateData.sessions;
      });

      // 獲取最近活動
      stats.recentActivity = learningRecords
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 10)
        .map(record => ({
          timestamp: record.timestamp,
          topic: record.topic,
          isCorrect: record.correctness,
          responseTime: record.responseTime
        }));

      return stats;

    } catch (error) {
      console.error('計算學習時間統計失敗:', error);
      throw error;
    }
  }

  /**
   * 計算答題成功率統計
   * @param {string} userId - 用戶ID（可選）
   * @param {Object} filters - 過濾條件
   * @returns {Promise<Object>} 成功率統計
   */
  async calculateSuccessRates(userId = null, filters = {}) {
    try {
      const targetUserId = userId || this.userId;
      const learningRecords = await this.storageService.getLearningRecords({
        userId: targetUserId,
        ...filters
      });

      const stats = {
        overall: {
          total: 0,
          correct: 0,
          successRate: 0
        },
        byTopic: {},
        byDifficulty: {},
        byQuestionType: {},
        bySubject: {},
        trends: []
      };

      stats.overall.total = learningRecords.length;
      stats.overall.correct = learningRecords.filter(r => r.correctness).length;
      stats.overall.successRate = stats.overall.total > 0 ? 
        (stats.overall.correct / stats.overall.total) * 100 : 0;

      // 按不同維度統計成功率
      ['topic', 'difficulty', 'questionType', 'subject'].forEach(dimension => {
        const dimensionKey = dimension === 'questionType' ? 'questionType' : dimension;
        const statsKey = `by${dimension.charAt(0).toUpperCase() + dimension.slice(1)}`;
        
        learningRecords.forEach(record => {
          const value = record[dimensionKey] || 'unknown';
          
          if (!stats[statsKey][value]) {
            stats[statsKey][value] = {
              total: 0,
              correct: 0,
              successRate: 0
            };
          }
          
          stats[statsKey][value].total++;
          if (record.correctness) {
            stats[statsKey][value].correct++;
          }
        });

        // 計算成功率
        Object.keys(stats[statsKey]).forEach(key => {
          const data = stats[statsKey][key];
          data.successRate = data.total > 0 ? (data.correct / data.total) * 100 : 0;
        });
      });

      // 計算時間趨勢（最近30天）
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      const recentRecords = learningRecords.filter(r => r.timestamp >= thirtyDaysAgo);
      
      // 按日期分組計算成功率趨勢
      const dailyGroups = this._groupBy(recentRecords, record => {
        return new Date(record.timestamp).toDateString();
      });

      stats.trends = Object.keys(dailyGroups)
        .sort()
        .map(date => {
          const dayRecords = dailyGroups[date];
          const correct = dayRecords.filter(r => r.correctness).length;
          return {
            date,
            total: dayRecords.length,
            correct,
            successRate: dayRecords.length > 0 ? (correct / dayRecords.length) * 100 : 0
          };
        });

      return stats;

    } catch (error) {
      console.error('計算成功率統計失敗:', error);
      throw error;
    }
  }

  /**
   * 識別困難區域
   * @param {string} userId - 用戶ID（可選）
   * @param {Object} thresholds - 閾值設定
   * @returns {Promise<Object>} 困難區域分析
   */
  async identifyDifficultAreas(userId = null, thresholds = {}) {
    try {
      const defaultThresholds = {
        lowSuccessRate: 60, // 成功率低於60%視為困難
        highResponseTime: 30000, // 響應時間超過30秒視為困難
        minimumAttempts: 3 // 至少嘗試3次才納入分析
      };

      const finalThresholds = { ...defaultThresholds, ...thresholds };
      const targetUserId = userId || this.userId;

      // 獲取成功率和時間統計
      const [successStats, timeStats] = await Promise.all([
        this.calculateSuccessRates(targetUserId),
        this.calculateLearningTime(targetUserId)
      ]);

      const difficultAreas = {
        byTopic: [],
        byDifficulty: [],
        byQuestionType: [],
        recommendations: [],
        summary: {
          totalDifficultTopics: 0,
          mostDifficultTopic: null,
          averageSuccessRate: successStats.overall.successRate,
          needsImprovementCount: 0
        }
      };

      // 分析困難主題
      Object.keys(successStats.byTopic).forEach(topic => {
        const successData = successStats.byTopic[topic];
        const timeData = timeStats.byTopic[topic] || {};

        if (successData.total >= finalThresholds.minimumAttempts) {
          const isDifficultBySuccess = successData.successRate < finalThresholds.lowSuccessRate;
          const isDifficultByTime = (timeData.averageTime || 0) > finalThresholds.highResponseTime;

          if (isDifficultBySuccess || isDifficultByTime) {
            difficultAreas.byTopic.push({
              topic,
              successRate: successData.successRate,
              totalAttempts: successData.total,
              averageTime: timeData.averageTime || 0,
              difficultyReasons: [
                ...(isDifficultBySuccess ? ['低成功率'] : []),
                ...(isDifficultByTime ? ['響應時間過長'] : [])
              ],
              severity: this._calculateSeverity(successData.successRate, timeData.averageTime || 0, finalThresholds)
            });
          }
        }
      });

      // 分析困難難度等級
      Object.keys(successStats.byDifficulty).forEach(difficulty => {
        const successData = successStats.byDifficulty[difficulty];
        
        if (successData.total >= finalThresholds.minimumAttempts && 
            successData.successRate < finalThresholds.lowSuccessRate) {
          difficultAreas.byDifficulty.push({
            difficulty,
            successRate: successData.successRate,
            totalAttempts: successData.total,
            severity: this._calculateSeverity(successData.successRate, 0, finalThresholds)
          });
        }
      });

      // 分析困難題型
      Object.keys(successStats.byQuestionType).forEach(questionType => {
        const successData = successStats.byQuestionType[questionType];
        
        if (successData.total >= finalThresholds.minimumAttempts && 
            successData.successRate < finalThresholds.lowSuccessRate) {
          difficultAreas.byQuestionType.push({
            questionType,
            successRate: successData.successRate,
            totalAttempts: successData.total,
            severity: this._calculateSeverity(successData.successRate, 0, finalThresholds)
          });
        }
      });

      // 排序困難區域（按嚴重程度）
      difficultAreas.byTopic.sort((a, b) => b.severity - a.severity);
      difficultAreas.byDifficulty.sort((a, b) => b.severity - a.severity);
      difficultAreas.byQuestionType.sort((a, b) => b.severity - a.severity);

      // 生成建議
      difficultAreas.recommendations = this._generateRecommendations(difficultAreas);

      // 更新摘要
      difficultAreas.summary.totalDifficultTopics = difficultAreas.byTopic.length;
      difficultAreas.summary.mostDifficultTopic = difficultAreas.byTopic[0] || null;
      difficultAreas.summary.needsImprovementCount = 
        difficultAreas.byTopic.length + 
        difficultAreas.byDifficulty.length + 
        difficultAreas.byQuestionType.length;

      return difficultAreas;

    } catch (error) {
      console.error('識別困難區域失敗:', error);
      throw error;
    }
  }

  /**
   * 獲取學習進度總覽
   * @param {string} userId - 用戶ID（可選）
   * @returns {Promise<Object>} 學習進度總覽
   */
  async getLearningProgressOverview(userId = null) {
    try {
      const targetUserId = userId || this.userId;

      const [timeStats, successStats, difficultAreas] = await Promise.all([
        this.calculateLearningTime(targetUserId),
        this.calculateSuccessRates(targetUserId),
        this.identifyDifficultAreas(targetUserId)
      ]);

      const overview = {
        summary: {
          totalSessions: timeStats.total.sessions,
          totalQuestions: timeStats.total.questionsAnswered,
          totalTime: timeStats.total.totalTime,
          averageResponseTime: timeStats.total.averageResponseTime,
          overallSuccessRate: successStats.overall.successRate,
          difficultTopicsCount: difficultAreas.summary.totalDifficultTopics
        },
        achievements: this._calculateAchievements(timeStats, successStats),
        insights: this._generateInsights(timeStats, successStats, difficultAreas),
        nextSteps: this._suggestNextSteps(difficultAreas),
        timeStats,
        successStats,
        difficultAreas
      };

      return overview;

    } catch (error) {
      console.error('獲取學習進度總覽失敗:', error);
      throw error;
    }
  }

  /**
   * 輔助方法：按指定鍵分組
   * @private
   */
  _groupBy(array, key) {
    return array.reduce((groups, item) => {
      const groupKey = typeof key === 'function' ? key(item) : item[key];
      groups[groupKey] = groups[groupKey] || [];
      groups[groupKey].push(item);
      return groups;
    }, {});
  }

  /**
   * 計算困難程度嚴重性
   * @private
   */
  _calculateSeverity(successRate, averageTime, thresholds) {
    let severity = 0;
    
    // 基於成功率的嚴重性（0-50分）
    if (successRate < thresholds.lowSuccessRate) {
      severity += (thresholds.lowSuccessRate - successRate) / thresholds.lowSuccessRate * 50;
    }
    
    // 基於響應時間的嚴重性（0-50分）
    if (averageTime > thresholds.highResponseTime) {
      const timeRatio = Math.min(averageTime / thresholds.highResponseTime, 3); // 最多3倍
      severity += (timeRatio - 1) / 2 * 50;
    }

    return Math.min(severity, 100); // 最高100分
  }

  /**
   * 生成學習建議
   * @private
   */
  _generateRecommendations(difficultAreas) {
    const recommendations = [];

    // 針對困難主題的建議
    if (difficultAreas.byTopic.length > 0) {
      const mostDifficult = difficultAreas.byTopic[0];
      recommendations.push({
        type: 'topic_focus',
        priority: 'high',
        title: `加強「${mostDifficult.topic}」練習`,
        description: `您在${mostDifficult.topic}主題的成功率為${mostDifficult.successRate.toFixed(1)}%，建議增加相關練習`,
        actionItems: [
          '查看該主題的錯誤分析',
          '完成更多相關練習題',
          '複習基礎概念'
        ]
      });
    }

    // 針對困難題型的建議
    if (difficultAreas.byQuestionType.length > 0) {
      const mostDifficultType = difficultAreas.byQuestionType[0];
      recommendations.push({
        type: 'question_type',
        priority: 'medium',
        title: `改善「${mostDifficultType.questionType}」題型表現`,
        description: `您在${mostDifficultType.questionType}題型的表現需要改善`,
        actionItems: [
          '針對該題型進行專項練習',
          '學習答題技巧',
          '分析錯誤模式'
        ]
      });
    }

    // 針對整體表現的建議
    if (difficultAreas.summary.needsImprovementCount > 5) {
      recommendations.push({
        type: 'overall_improvement',
        priority: 'high',
        title: '全面提升學習效果',
        description: '發現多個需要改善的領域，建議制定系統性學習計劃',
        actionItems: [
          '每日定時練習',
          '重點攻克困難主題',
          '定期複習已學內容'
        ]
      });
    }

    return recommendations;
  }

  /**
   * 計算學習成就
   * @private
   */
  _calculateAchievements(timeStats, successStats) {
    const achievements = [];

    // 基於答題數量的成就
    if (timeStats.total.questionsAnswered >= 100) {
      achievements.push({
        type: 'quantity',
        title: '學習達人',
        description: `已完成${timeStats.total.questionsAnswered}道題目`
      });
    } else if (timeStats.total.questionsAnswered >= 50) {
      achievements.push({
        type: 'quantity',
        title: '勤奮學習者',
        description: `已完成${timeStats.total.questionsAnswered}道題目`
      });
    }

    // 基於成功率的成就
    if (successStats.overall.successRate >= 90) {
      achievements.push({
        type: 'accuracy',
        title: '精確射手',
        description: `整體正確率達到${successStats.overall.successRate.toFixed(1)}%`
      });
    } else if (successStats.overall.successRate >= 80) {
      achievements.push({
        type: 'accuracy',
        title: '優秀表現',
        description: `整體正確率達到${successStats.overall.successRate.toFixed(1)}%`
      });
    }

    // 基於學習天數的成就
    const learningDays = Object.keys(timeStats.byDate).length;
    if (learningDays >= 30) {
      achievements.push({
        type: 'consistency',
        title: '持續學習者',
        description: `已學習${learningDays}天`
      });
    } else if (learningDays >= 7) {
      achievements.push({
        type: 'consistency',
        title: '週期學習者',
        description: `已學習${learningDays}天`
      });
    }

    return achievements;
  }

  /**
   * 生成學習洞察
   * @private
   */
  _generateInsights(timeStats, successStats, difficultAreas) {
    const insights = [];

    // 學習時間洞察
    if (timeStats.total.averageResponseTime > 20000) {
      insights.push({
        type: 'time_management',
        title: '考慮提升答題速度',
        description: '您的平均答題時間較長，可以嘗試練習快速判斷'
      });
    }

    // 成功率趨勢洞察
    if (successStats.trends.length >= 3) {
      const recentTrend = successStats.trends.slice(-3);
      const isImproving = recentTrend.every((day, index) => 
        index === 0 || day.successRate >= recentTrend[index - 1].successRate
      );
      
      if (isImproving) {
        insights.push({
          type: 'improvement_trend',
          title: '學習效果持續提升',
          description: '您的表現呈現上升趨勢，繼續保持！'
        });
      }
    }

    // 主題分佈洞察
    const topicCount = Object.keys(timeStats.byTopic).length;
    if (topicCount >= 5) {
      insights.push({
        type: 'topic_diversity',
        title: '學習領域多元化',
        description: `您已涉獵${topicCount}個不同主題，知識面廣泛`
      });
    }

    return insights;
  }

  /**
   * 建議下一步行動
   * @private
   */
  _suggestNextSteps(difficultAreas) {
    const nextSteps = [];

    if (difficultAreas.byTopic.length > 0) {
      const topDifficult = difficultAreas.byTopic.slice(0, 3);
      nextSteps.push({
        type: 'focus_practice',
        title: '重點練習困難主題',
        topics: topDifficult.map(area => area.topic),
        description: '建議優先練習表現較弱的主題'
      });
    }

    if (difficultAreas.summary.needsImprovementCount === 0) {
      nextSteps.push({
        type: 'maintain_performance',
        title: '保持學習水準',
        description: '您的表現很好，繼續保持學習習慣'
      });
    }

    return nextSteps;
  }
}

export { LearningTracker }; 