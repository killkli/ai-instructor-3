/**
 * 成就系統服務
 * 負責監控學生學習進度並在達成里程碑時觸發成就
 */

class AchievementService {
  constructor(storageService, learningTracker) {
    this.storageService = storageService;
    this.learningTracker = learningTracker;
    this.userId = 'default';
    
    // 成就定義配置
    this.achievementDefinitions = {
      // 答題數量成就
      'first_question': {
        id: 'first_question',
        title: '初次嘗試',
        description: '完成第一道題目',
        icon: '🌟',
        category: 'progress',
        type: 'milestone',
        criteria: {
          questionsAnswered: 1
        },
        points: 10
      },
      'questions_10': {
        id: 'questions_10',
        title: '積少成多',
        description: '累計回答 10 道題目',
        icon: '📚',
        category: 'progress',
        type: 'milestone',
        criteria: {
          questionsAnswered: 10
        },
        points: 50
      },
      'questions_50': {
        id: 'questions_50',
        title: '勤學好問',
        description: '累計回答 50 道題目',
        icon: '🎯',
        category: 'progress',
        type: 'milestone',
        criteria: {
          questionsAnswered: 50
        },
        points: 150
      },
      'questions_100': {
        id: 'questions_100',
        title: '百題達人',
        description: '累計回答 100 道題目',
        icon: '🏆',
        category: 'progress',
        type: 'milestone',
        criteria: {
          questionsAnswered: 100
        },
        points: 300
      },
      
      // 正確率成就
      'accuracy_80': {
        id: 'accuracy_80',
        title: '八成高手',
        description: '在至少 10 道題目中達到 80% 正確率',
        icon: '🎖️',
        category: 'accuracy',
        type: 'performance',
        criteria: {
          successRate: 80,
          minQuestions: 10
        },
        points: 100
      },
      'accuracy_90': {
        id: 'accuracy_90',
        title: '九成專家',
        description: '在至少 20 道題目中達到 90% 正確率',
        icon: '🥇',
        category: 'accuracy',
        type: 'performance',
        criteria: {
          successRate: 90,
          minQuestions: 20
        },
        points: 200
      },
      'perfect_streak_5': {
        id: 'perfect_streak_5',
        title: '連勝先鋒',
        description: '連續答對 5 道題目',
        icon: '🔥',
        category: 'accuracy',
        type: 'streak',
        criteria: {
          consecutiveCorrect: 5
        },
        points: 75
      },
      'perfect_streak_10': {
        id: 'perfect_streak_10',
        title: '連勝高手',
        description: '連續答對 10 道題目',
        icon: '⚡',
        category: 'accuracy',
        type: 'streak',
        criteria: {
          consecutiveCorrect: 10
        },
        points: 150
      },
      
      // 學習時間成就
      'daily_learner': {
        id: 'daily_learner',
        title: '每日學習者',
        description: '連續 7 天進行學習',
        icon: '📅',
        category: 'consistency',
        type: 'streak',
        criteria: {
          consecutiveDays: 7
        },
        points: 100
      },
      'dedicated_learner': {
        id: 'dedicated_learner',
        title: '專注學習者',
        description: '單次學習時間超過 30 分鐘',
        icon: '⏰',
        category: 'time',
        type: 'session',
        criteria: {
          sessionTime: 30 * 60 * 1000 // 30分鐘，以毫秒為單位
        },
        points: 50
      },
      'marathon_learner': {
        id: 'marathon_learner',
        title: '馬拉松學習者',
        description: '單次學習時間超過 60 分鐘',
        icon: '🏃‍♂️',
        category: 'time',
        type: 'session',
        criteria: {
          sessionTime: 60 * 60 * 1000 // 60分鐘
        },
        points: 100
      },
      
      // 主題掌握成就
      'topic_master': {
        id: 'topic_master',
        title: '主題專家',
        description: '在某個主題達到 95% 正確率（至少 20 題）',
        icon: '🧠',
        category: 'mastery',
        type: 'topic',
        criteria: {
          topicSuccessRate: 95,
          minTopicQuestions: 20
        },
        points: 250
      },
      
      // 速度成就
      'speed_demon': {
        id: 'speed_demon',
        title: '快手達人',
        description: '平均答題時間少於 30 秒（至少 10 題）',
        icon: '💨',
        category: 'speed',
        type: 'performance',
        criteria: {
          averageResponseTime: 30 * 1000, // 30秒，以毫秒為單位
          minQuestions: 10
        },
        points: 120
      }
    };
  }

  /**
   * 檢查用戶的學習記錄並觸發相應的成就
   * @param {string} userId - 用戶ID
   * @returns {Promise<Array>} 新獲得的成就列表
   */
  async checkAndTriggerAchievements(userId = null) {
    try {
      const targetUserId = userId || this.userId;
      const newAchievements = [];

      // 獲取用戶已有的成就
      const existingAchievements = await this.storageService.getUserAchievements(targetUserId);
      const earnedAchievementIds = new Set(existingAchievements.map(a => a.achievementId));

      // 獲取學習統計數據
      const learningStats = await this.learningTracker.calculateLearningTime(targetUserId);
      const successStats = await this.learningTracker.calculateSuccessRates(targetUserId);
      const learningRecords = await this.storageService.getLearningRecords({ userId: targetUserId });

      // 檢查每個成就定義
      for (const [achievementId, definition] of Object.entries(this.achievementDefinitions)) {
        // 如果已經獲得此成就，跳過
        if (earnedAchievementIds.has(achievementId)) {
          continue;
        }

        // 檢查是否滿足成就條件
        const isEarned = await this._checkAchievementCriteria(
          definition, 
          learningStats, 
          successStats, 
          learningRecords, 
          targetUserId
        );

        if (isEarned) {
          // 創建成就記錄
          const achievement = {
            userId: targetUserId,
            achievementId: achievementId,
            title: definition.title,
            description: definition.description,
            icon: definition.icon,
            category: definition.category,
            type: definition.type,
            points: definition.points,
            dateEarned: Date.now(),
            criteria: definition.criteria
          };

          // 保存成就
          await this.storageService.saveAchievement(achievement);
          newAchievements.push(achievement);
        }
      }

      return newAchievements;

    } catch (error) {
      console.error('檢查成就時發生錯誤:', error);
      throw error;
    }
  }

  /**
   * 檢查特定成就的條件是否滿足
   * @param {Object} definition - 成就定義
   * @param {Object} learningStats - 學習時間統計
   * @param {Object} successStats - 成功率統計
   * @param {Array} learningRecords - 學習記錄
   * @param {string} userId - 用戶ID
   * @returns {Promise<boolean>} 是否滿足條件
   */
  async _checkAchievementCriteria(definition, learningStats, successStats, learningRecords, userId) {
    const criteria = definition.criteria;

    try {
      // 檢查答題數量
      if (criteria.questionsAnswered !== undefined) {
        if (learningStats.total.questionsAnswered < criteria.questionsAnswered) {
          return false;
        }
      }

      // 檢查成功率
      if (criteria.successRate !== undefined) {
        const minQuestions = criteria.minQuestions || 1;
        if (successStats.overall.total < minQuestions || 
            successStats.overall.successRate < criteria.successRate) {
          return false;
        }
      }

      // 檢查連續答對
      if (criteria.consecutiveCorrect !== undefined) {
        const hasStreak = this._checkConsecutiveCorrect(learningRecords, criteria.consecutiveCorrect);
        if (!hasStreak) {
          return false;
        }
      }

      // 檢查連續學習天數
      if (criteria.consecutiveDays !== undefined) {
        const hasConsecutiveDays = await this._checkConsecutiveLearningDays(userId, criteria.consecutiveDays);
        if (!hasConsecutiveDays) {
          return false;
        }
      }

      // 檢查單次學習時間
      if (criteria.sessionTime !== undefined) {
        const hasLongSession = this._checkLongSession(learningRecords, criteria.sessionTime);
        if (!hasLongSession) {
          return false;
        }
      }

      // 檢查主題掌握度
      if (criteria.topicSuccessRate !== undefined) {
        const hasTopicMastery = this._checkTopicMastery(
          successStats.byTopic, 
          criteria.topicSuccessRate, 
          criteria.minTopicQuestions || 20
        );
        if (!hasTopicMastery) {
          return false;
        }
      }

      // 檢查平均答題速度
      if (criteria.averageResponseTime !== undefined) {
        const minQuestions = criteria.minQuestions || 10;
        if (learningStats.total.questionsAnswered < minQuestions ||
            learningStats.total.averageResponseTime > criteria.averageResponseTime) {
          return false;
        }
      }

      return true;

    } catch (error) {
      console.error('檢查成就條件時發生錯誤:', error);
      return false;
    }
  }

  /**
   * 檢查連續答對記錄
   * @param {Array} records - 學習記錄
   * @param {number} requiredStreak - 需要的連續數量
   * @returns {boolean} 是否有滿足的連續記錄
   */
  _checkConsecutiveCorrect(records, requiredStreak) {
    // 按時間排序
    const sortedRecords = records.sort((a, b) => a.timestamp - b.timestamp);
    
    let currentStreak = 0;
    let maxStreak = 0;

    for (const record of sortedRecords) {
      if (record.correctness) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }

    return maxStreak >= requiredStreak;
  }

  /**
   * 檢查連續學習天數
   * @param {string} userId - 用戶ID
   * @param {number} requiredDays - 需要的連續天數
   * @returns {Promise<boolean>} 是否有滿足的連續學習天數
   */
  async _checkConsecutiveLearningDays(userId, requiredDays) {
    try {
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      const records = await this.storageService.getLearningRecords({
        userId: userId,
        startDate: thirtyDaysAgo
      });

      // 按日期分組
      const dayGroups = {};
      records.forEach(record => {
        const date = new Date(record.timestamp).toDateString();
        if (!dayGroups[date]) {
          dayGroups[date] = [];
        }
        dayGroups[date].push(record);
      });

      // 檢查連續天數
      const dates = Object.keys(dayGroups).sort();
      let consecutiveDays = 0;
      let maxConsecutiveDays = 0;
      let lastDate = null;

      for (const dateStr of dates) {
        const currentDate = new Date(dateStr);
        
        if (lastDate === null) {
          consecutiveDays = 1;
        } else {
          const dayDiff = (currentDate - lastDate) / (24 * 60 * 60 * 1000);
          if (dayDiff === 1) {
            consecutiveDays++;
          } else {
            consecutiveDays = 1;
          }
        }
        
        maxConsecutiveDays = Math.max(maxConsecutiveDays, consecutiveDays);
        lastDate = currentDate;
      }

      return maxConsecutiveDays >= requiredDays;

    } catch (error) {
      console.error('檢查連續學習天數時發生錯誤:', error);
      return false;
    }
  }

  /**
   * 檢查是否有長時間學習會話
   * @param {Array} records - 學習記錄
   * @param {number} requiredTime - 需要的時間（毫秒）
   * @returns {boolean} 是否有滿足的長時間會話
   */
  _checkLongSession(records, requiredTime) {
    // 按會話分組
    const sessionGroups = {};
    records.forEach(record => {
      if (!sessionGroups[record.sessionId]) {
        sessionGroups[record.sessionId] = [];
      }
      sessionGroups[record.sessionId].push(record);
    });

    // 檢查每個會話的時間長度
    for (const sessionRecords of Object.values(sessionGroups)) {
      if (sessionRecords.length === 0) continue;

      const sortedRecords = sessionRecords.sort((a, b) => a.timestamp - b.timestamp);
      const sessionStart = sortedRecords[0].timestamp;
      const sessionEnd = sortedRecords[sortedRecords.length - 1].timestamp;
      const sessionDuration = sessionEnd - sessionStart;

      if (sessionDuration >= requiredTime) {
        return true;
      }
    }

    return false;
  }

  /**
   * 檢查主題掌握度
   * @param {Object} topicStats - 按主題的統計數據
   * @param {number} requiredSuccessRate - 需要的成功率
   * @param {number} minQuestions - 最少題目數量
   * @returns {boolean} 是否有掌握的主題
   */
  _checkTopicMastery(topicStats, requiredSuccessRate, minQuestions) {
    for (const topicData of Object.values(topicStats)) {
      if (topicData.total >= minQuestions && topicData.successRate >= requiredSuccessRate) {
        return true;
      }
    }
    return false;
  }

  /**
   * 獲取用戶的所有成就
   * @param {string} userId - 用戶ID
   * @returns {Promise<Array>} 用戶成就列表
   */
  async getUserAchievements(userId = null) {
    const targetUserId = userId || this.userId;
    return await this.storageService.getUserAchievements(targetUserId);
  }

  /**
   * 獲取用戶的成就統計
   * @param {string} userId - 用戶ID
   * @returns {Promise<Object>} 成就統計
   */
  async getUserAchievementStats(userId = null) {
    try {
      const targetUserId = userId || this.userId;
      const achievements = await this.getUserAchievements(targetUserId);
      
      const stats = {
        totalAchievements: achievements.length,
        totalPoints: achievements.reduce((sum, a) => sum + (a.points || 0), 0),
        byCategory: {},
        byType: {},
        recentAchievements: []
      };

      // 按類別和類型統計
      achievements.forEach(achievement => {
        // 按類別統計
        if (!stats.byCategory[achievement.category]) {
          stats.byCategory[achievement.category] = {
            count: 0,
            points: 0
          };
        }
        stats.byCategory[achievement.category].count++;
        stats.byCategory[achievement.category].points += achievement.points || 0;

        // 按類型統計
        if (!stats.byType[achievement.type]) {
          stats.byType[achievement.type] = {
            count: 0,
            points: 0
          };
        }
        stats.byType[achievement.type].count++;
        stats.byType[achievement.type].points += achievement.points || 0;
      });

      // 最近的成就（最近30天）
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      stats.recentAchievements = achievements
        .filter(a => a.dateEarned >= thirtyDaysAgo)
        .sort((a, b) => b.dateEarned - a.dateEarned)
        .slice(0, 5);

      return stats;

    } catch (error) {
      console.error('獲取成就統計時發生錯誤:', error);
      throw error;
    }
  }

  /**
   * 獲取所有可用的成就定義
   * @returns {Object} 成就定義
   */
  getAchievementDefinitions() {
    return this.achievementDefinitions;
  }

  /**
   * 獲取用戶尚未獲得的成就
   * @param {string} userId - 用戶ID
   * @returns {Promise<Array>} 尚未獲得的成就定義列表
   */
  async getAvailableAchievements(userId = null) {
    const targetUserId = userId || this.userId;
    const userAchievements = await this.getUserAchievements(targetUserId);
    const earnedIds = new Set(userAchievements.map(a => a.achievementId));
    
    return Object.values(this.achievementDefinitions)
      .filter(def => !earnedIds.has(def.id));
  }
}

// 導出類別
export default AchievementService; 