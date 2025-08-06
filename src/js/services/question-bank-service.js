/**
 * 智能題庫與練習系統服務
 * 整合Gemini AI進行題目生成和錯誤分析
 */
import sessionManager from './session-manager.js';

class QuestionBankService {
    constructor(geminiService = null, storageService = null) {
        this.geminiService = geminiService;
        this.storageService = storageService;
        this.questionTypes = {
            MULTIPLE_CHOICE: 'multiple_choice',
            FILL_BLANK: 'fill_blank',
            SHORT_ANSWER: 'short_answer',
            CALCULATION: 'calculation',
            ESSAY: 'essay'
        };
        this.difficultyLevels = ['easy', 'medium', 'hard', 'expert'];
        this.subjects = {
            MATH: 'math',
            ENGLISH: 'english',
            SCIENCE: 'science',
            CHINESE: 'chinese'
        };
    }

    /**
     * 生成練習題目
     * @param {Object} options - 生成選項
     * @returns {Promise<Array>} 生成的題目陣列
     */
    async generateQuestions(options) {
        const {
            topic = '',
            difficulty = 'medium',
            questionType = this.questionTypes.MULTIPLE_CHOICE,
            count = 5,
            userLevel = 'intermediate',
            context = ''
        } = options;

        try {
            const prompt = this.buildQuestionGenerationPrompt({
                topic,
                difficulty,
                questionType,
                count,
                userLevel,
                context
            });

            const response = await this.geminiService.generateContent(prompt);
            const questions = this.parseQuestionsFromResponse(response);
            
            // 如果解析成功，儲存生成的題目到本地
            if (questions && questions.length > 0) {
                await this.saveGeneratedQuestions(questions, options);
                return questions;
            } else {
                // 如果沒有解析到題目，返回預設題目
                console.warn('無法解析AI回應，使用預設題目');
                const fallbackQuestions = this.generateFallbackQuestion();
                return fallbackQuestions;
            }
        } catch (error) {
            console.error('題目生成失敗:', error);
            console.error('使用預設題目');
            
            // 生成預設題目而不是拋出錯誤
            return this.generateFallbackQuestion();
        }
    }

    /**
     * 建立題目生成的提示詞
     */
    buildQuestionGenerationPrompt(options) {
        const { topic, difficulty, questionType, count, userLevel, context } = options;
        
        const typeInstructions = this.getQuestionTypeInstructions(questionType);

        return `請直接以JSON格式生成${count}道練習題，不要有任何額外說明文字。

生成要求：
- 主題：${topic || '不限定'}
- 難度：${this.getDifficultyDescription(difficulty)}
- 題型：${this.getQuestionTypeDescription(questionType)}
- 數量：${count}題

請直接輸出以下JSON格式（不要包含任何其他文字）：
{
  "questions": [
    {
      "id": "q_${Date.now()}_1",
      "topic": "${topic || '基礎概念'}",
      "type": "${questionType}",
      "difficulty": "${difficulty}",
      "question": "題目內容",
      ${questionType === this.questionTypes.MULTIPLE_CHOICE ? '"options": ["選項A", "選項B", "選項C", "選項D"],' : ''}
      "correctAnswer": "正確答案",
      "explanation": "詳細解答說明",
      "relatedConcepts": ["相關概念1", "相關概念2"],
      "estimatedTime": 3,
      "tags": ["${difficulty}"]
    }
  ]
}`;
    }

    /**
     * 生成類似題目
     * @param {Object} originalQuestion - 原始題目
     * @param {number} count - 生成數量
     * @returns {Promise<Array>} 類似題目陣列
     */
    async generateSimilarQuestions(originalQuestion, count = 3) {
        try {
            const prompt = this.buildSimilarQuestionPrompt(originalQuestion, count);
            const response = await this.geminiService.generateContent(prompt);
            const questions = this.parseQuestionsFromResponse(response);
            
            if (questions && questions.length > 0) {
                // 為類似題目添加標記
                questions.forEach((q, index) => {
                    q.id = `similar_${originalQuestion.id}_${index + 1}`;
                    q.isGenerated = true;
                    q.originalQuestionId = originalQuestion.id;
                });
                return questions;
            } else {
                console.warn('無法解析類似題目回應');
                return [];
            }
        } catch (error) {
            console.error('生成類似題目失敗:', error);
            throw error;
        }
    }

    /**
     * 建立類似題目生成的提示詞
     */
    buildSimilarQuestionPrompt(originalQuestion, count) {
        return `請基於以下題目生成${count}道類似的練習題，保持相同的題型、難度和知識點，但變換題目內容和數據。

**原始題目：**
- 題目：${originalQuestion.question}
- 題型：${originalQuestion.type}
- 難度：${originalQuestion.difficulty}
${originalQuestion.options ? `- 選項：${originalQuestion.options.join(', ')}` : ''}
- 正確答案：${originalQuestion.correctAnswer}
- 主題：${originalQuestion.topic || '基礎概念'}

**生成要求：**
1. 保持相同的題型和難度級別
2. 測試相同的知識點和概念
3. 變換具體的數據、情境或表達方式
4. 確保答案的準確性和合理性
5. 保持題目的教育價值

請直接輸出以下JSON格式（不要包含任何其他文字）：
{
  "questions": [
    {
      "id": "similar_${originalQuestion.id}_1",
      "topic": "${originalQuestion.topic || '基礎概念'}",
      "type": "${originalQuestion.type}",
      "difficulty": "${originalQuestion.difficulty}",
      "question": "類似題目內容1",
      ${originalQuestion.type === this.questionTypes.MULTIPLE_CHOICE ? '"options": ["新選項A", "新選項B", "新選項C", "新選項D"],' : ''}
      "correctAnswer": "對應的正確答案",
      "explanation": "詳細解答說明",
      "relatedConcepts": ${JSON.stringify(originalQuestion.relatedConcepts || ['基礎概念'])},
      "estimatedTime": ${originalQuestion.estimatedTime || 3},
      "tags": ${JSON.stringify(originalQuestion.tags || [originalQuestion.difficulty])}
    }
  ]
}`;
    }

    /**
     * 錯誤分析功能
     */
    async analyzeError(questionData, userAnswer, responseTime) {
        try {
            const prompt = this.buildErrorAnalysisPrompt(questionData, userAnswer, responseTime);
            const response = await this.geminiService.generateContent(prompt);
            const analysis = this.parseErrorAnalysisFromResponse(response);
            
            // 儲存錯誤分析結果
            await this.saveErrorAnalysis(questionData.id, analysis);
            
            return analysis;
        } catch (error) {
            console.error('錯誤分析失敗:', error);
            throw new Error('錯誤分析失敗，請稍後再試');
        }
    }

    /**
     * 建立錯誤分析提示詞
     */
    buildErrorAnalysisPrompt(questionData, userAnswer, responseTime) {
        return `你是一位專業的教育心理學家和教育專家，請深入分析學習者的答題錯誤：

**題目資訊：**
- 題目：${questionData.question}
${questionData.options ? `- 選項：${questionData.options.join(', ')}` : ''}
- 正確答案：${questionData.correctAnswer}
- 難度：${questionData.difficulty}

**學習者表現：**
- 學習者答案：${userAnswer}
- 作答時間：${responseTime}秒
- 預估時間：${questionData.estimatedTime}分鐘

**分析要求：**
1. 識別具體的錯誤類型（概念理解錯誤、計算錯誤、語法錯誤、邏輯推理錯誤、粗心大意等）
2. 分析錯誤的根本原因（基礎知識薄弱、題目理解偏差、解題方法錯誤、時間壓力等）
3. 評估錯誤的嚴重程度（輕微、中等、嚴重）
4. 提供具體的改進建議和學習策略
5. 推薦相關的補強練習內容

**輸出格式：**
請以JSON格式輸出詳細分析：
{
  "errorType": "錯誤類型分類",
  "severity": "錯誤嚴重程度",
  "confidence": "分析信心度(0-1)",
  "rootCause": "錯誤根本原因詳細說明",
  "suggestions": [
    "具體改進建議1",
    "具體改進建議2"
  ],
  "relatedConcepts": ["需要加強的相關概念"],
  "recommendedPractice": [
    {
      "topic": "建議練習主題",
      "difficulty": "建議難度",
      "count": "建議題數",
      "focus": "重點關注領域"
    }
  ],
  "remediationContent": [
    {
      "type": "conversation_snippet",
      "title": "相關教學對話",
      "content": "教師與學生關於此概念的對話片段",
      "source": "對話來源描述"
    },
    {
      "type": "external_link",
      "title": "推薦學習資源",
      "url": "https://example.com/resource",
      "description": "資源描述",
      "category": "video|article|interactive|exercise"
    },
    {
      "type": "mini_explanation",
      "title": "概念小解釋",
      "content": "針對錯誤概念的簡短重新解釋",
      "difficulty": "簡單易懂的解釋程度",
      "examples": ["相關例子1", "相關例子2"]
    }
  ],
  "learningStrategy": "個人化學習策略建議",
  "timeAnalysis": "答題時間分析",
  "nextSteps": "後續學習步驟建議"
}`;
    }

    /**
     * 難度自適應調整
     */
    adjustDifficulty(userPerformance, currentLevel) {
        const recentPerformance = userPerformance.slice(-10); // 最近10次表現
        const successRate = recentPerformance.filter(p => p.correct).length / recentPerformance.length;
        const avgResponseTime = recentPerformance.reduce((sum, p) => sum + p.responseTime, 0) / recentPerformance.length;
        
        let newLevel = currentLevel;
        
        // 根據正確率調整
        if (successRate > 0.8 && avgResponseTime < 60) {
            // 表現優異，提升難度
            newLevel = this.increaseDifficulty(currentLevel);
        } else if (successRate < 0.6 || avgResponseTime > 180) {
            // 表現不佳，降低難度
            newLevel = this.decreaseDifficulty(currentLevel);
        }
        
        return {
            newLevel,
            reason: this.getDifficultyAdjustmentReason(successRate, avgResponseTime),
            recommendation: this.getDifficultyRecommendation(newLevel)
        };
    }

    /**
     * 獲取學習進度統計
     */
    async getLearningStats(userId, timeRange = '7d') {
        try {
            const userData = await this.storageService.getCache(`user_${userId}_questions`) || [];
            const timeRangeMs = this.parseTimeRange(timeRange);
            const cutoffTime = Date.now() - timeRangeMs;
            
            const recentData = userData.filter(item => item.timestamp > cutoffTime);
            
            return {
                totalQuestions: recentData.length,
                correctAnswers: recentData.filter(item => item.correct).length,
                averageTime: recentData.reduce((sum, item) => sum + item.responseTime, 0) / recentData.length,
                subjectBreakdown: this.getSubjectBreakdown(recentData),
                difficultyBreakdown: this.getDifficultyBreakdown(recentData),
                improvementTrend: this.calculateImprovementTrend(recentData),
                weakAreas: this.identifyWeakAreas(recentData),
                strongAreas: this.identifyStrongAreas(recentData)
            };
        } catch (error) {
            console.error('獲取學習統計失敗:', error);
            return null;
        }
    }

    // 輔助方法
    getDifficultyDescription(difficulty) {
        const descriptions = {
            easy: '簡單',
            medium: '中等',
            hard: '困難',
            expert: '專家級'
        };
        return descriptions[difficulty] || difficulty;
    }

    getQuestionTypeDescription(type) {
        const descriptions = {
            multiple_choice: '選擇題',
            fill_blank: '填空題',
            short_answer: '簡答題',
            calculation: '計算題',
            essay: '作文題'
        };
        return descriptions[type] || type;
    }

    getUserLevelDescription(level) {
        const descriptions = {
            beginner: '初學者',
            intermediate: '中級',
            advanced: '高級'
        };
        return descriptions[level] || level;
    }

    getQuestionTypeInstructions(type) {
        const instructions = {
            multiple_choice: `- 提供4個選項，包含1個正確答案和3個合理的錯誤答案
- 錯誤選項應反映常見錯誤或迷思
- 選項長度應該相近
- 避免"以上皆是"或"以上皆非"的選項`,
            fill_blank: `- 空格應該測試關鍵概念或技能
- 提供足夠的語境線索
- 答案應該明確且唯一
- 考慮同義詞或相近答案的接受度`,
            short_answer: `- 問題應該開放但有明確評分標準
- 預期答案長度2-3句話
- 測試理解而非記憶
- 提供評分參考點`,
            calculation: `- 提供所有必要的數據和公式
- 步驟應該邏輯清晰
- 包含單位和有效數字要求
- 提供檢驗答案的方法`,
            essay: `- 題目應該促進批判思考
- 提供寫作指引和評分標準
- 建議字數範圍
- 包含結構要求`
        };
        return instructions[type] || '';
    }

    // 解析和儲存方法
    parseQuestionsFromResponse(response) {
        try {
            // 先嘗試清理回應文字
            let cleanedResponse = response.trim();
            
            // 移除 markdown 代碼塊標記
            cleanedResponse = cleanedResponse.replace(/```json\n?|\n?```/g, '');
            
            // 尋找 JSON 物件開始和結束的位置
            const jsonStart = cleanedResponse.indexOf('{');
            const jsonEnd = cleanedResponse.lastIndexOf('}');
            
            if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
                cleanedResponse = cleanedResponse.substring(jsonStart, jsonEnd + 1);
            }
            
            // 嘗試解析 JSON
            const parsed = JSON.parse(cleanedResponse);
            
            // 驗證解析結果
            if (parsed.questions && Array.isArray(parsed.questions)) {
                return parsed.questions;
            } else {
                // 如果沒有 questions 陣列，嘗試生成一個假的題目
                console.warn('AI 回應格式不正確，生成預設題目');
                return this.generateFallbackQuestion();
            }
        } catch (error) {
            console.error('解析題目回應失敗:', error);
            console.error('原始回應:', response);
            
            // 如果完全無法解析，生成一個預設題目
            return this.generateFallbackQuestion();
        }
    }
    
    /**
     * 生成預設題目（當AI回應解析失敗時使用）
     */
    generateFallbackQuestion() {
        return [{
            id: `fallback_${Date.now()}`,
            topic: '基礎數學',
            type: 'multiple_choice',
            difficulty: 'easy',
            question: '2 + 3 = ?',
            options: ['4', '5', '6', '7'],
            correctAnswer: '5',
            explanation: '2 + 3 = 5，這是基本的加法運算。',
            relatedConcepts: ['加法', '基礎運算'],
            estimatedTime: 1,
            tags: ['easy', 'addition']
        }];
    }

    parseErrorAnalysisFromResponse(response) {
        try {
            const cleanedResponse = response.replace(/```json\n?|\n?```/g, '').trim();
            return JSON.parse(cleanedResponse);
        } catch (error) {
            console.error('解析錯誤分析回應失敗:', error);
            throw new Error('錯誤分析格式解析失敗');
        }
    }

    async saveGeneratedQuestions(questions, options) {
        const timestamp = Date.now();
        const currentSessionId = (sessionManager.getCurrentSession() && sessionManager.getCurrentSession().id) ? sessionManager.getCurrentSession().id : 'default';
        
        // 保存每個題目到 questionBank 對象存儲
        for (const question of questions) {
            const questionData = {
                ...question,
                // 移除原有的 id，讓 IndexedDB 自動生成
                id: undefined,
                // 保留原始 id 作為 originalId
                originalId: question.id,
                // 添加生成相關的元數據
                generationPrompt: this.buildQuestionGenerationPrompt(options),
                generationOptions: options,
                sessionId: currentSessionId,
                createdAt: timestamp,
                userId: 'default', // 可以根據需要修改為實際用戶ID
                version: '1.0'
            };
            
            // 移除 undefined 的 id 欄位
            delete questionData.id;
            
            // 保存到 questionBank 對象存儲
            await this.storageService.saveQuestion(questionData);
        }
        
        console.log(`已將 ${questions.length} 道題目保存到題庫中`);
        return questions;
    }

    async saveErrorAnalysis(questionId, analysis) {
        const timestamp = Date.now();
        const analysisData = {
            questionId,
            analysis,
            timestamp
        };
        
        await this.storageService.saveCache(`error_analysis_${questionId}_${timestamp}`, analysisData);
    }

    // 統計分析方法
    getSubjectBreakdown(data) {
        const breakdown = {};
        data.forEach(item => {
            if (!breakdown[item.topic]) {
                breakdown[item.topic] = { total: 0, correct: 0 };
            }
            breakdown[item.topic].total++;
            if (item.correct) breakdown[item.topic].correct++;
        });
        return breakdown;
    }

    getDifficultyBreakdown(data) {
        const breakdown = {};
        data.forEach(item => {
            if (!breakdown[item.difficulty]) {
                breakdown[item.difficulty] = { total: 0, correct: 0 };
            }
            breakdown[item.difficulty].total++;
            if (item.correct) breakdown[item.difficulty].correct++;
        });
        return breakdown;
    }

    calculateImprovementTrend(data) {
        if (data.length < 5) return null;
        
        const sorted = data.sort((a, b) => a.timestamp - b.timestamp);
        const firstHalf = sorted.slice(0, Math.floor(sorted.length / 2));
        const secondHalf = sorted.slice(Math.floor(sorted.length / 2));
        
        const firstHalfAccuracy = firstHalf.filter(item => item.correct).length / firstHalf.length;
        const secondHalfAccuracy = secondHalf.filter(item => item.correct).length / secondHalf.length;
        
        return {
            trend: secondHalfAccuracy > firstHalfAccuracy ? 'improving' : 'declining',
            change: secondHalfAccuracy - firstHalfAccuracy
        };
    }

    identifyWeakAreas(data) {
        const subjects = this.getSubjectBreakdown(data);
        return Object.entries(subjects)
            .filter(([_, stats]) => stats.correct / stats.total < 0.6)
            .map(([subject, stats]) => ({
                subject,
                accuracy: stats.correct / stats.total,
                total: stats.total
            }))
            .sort((a, b) => a.accuracy - b.accuracy);
    }

    identifyStrongAreas(data) {
        const subjects = this.getSubjectBreakdown(data);
        return Object.entries(subjects)
            .filter(([_, stats]) => stats.correct / stats.total > 0.8)
            .map(([subject, stats]) => ({
                subject,
                accuracy: stats.correct / stats.total,
                total: stats.total
            }))
            .sort((a, b) => b.accuracy - a.accuracy);
    }

    // 難度調整方法
    increaseDifficulty(currentLevel) {
        const levels = this.difficultyLevels;
        const currentIndex = levels.indexOf(currentLevel);
        return currentIndex < levels.length - 1 ? levels[currentIndex + 1] : currentLevel;
    }

    decreaseDifficulty(currentLevel) {
        const levels = this.difficultyLevels;
        const currentIndex = levels.indexOf(currentLevel);
        return currentIndex > 0 ? levels[currentIndex - 1] : currentLevel;
    }

    getDifficultyAdjustmentReason(successRate, avgResponseTime) {
        if (successRate > 0.8 && avgResponseTime < 60) {
            return '表現優異，建議提升難度挑戰自己';
        } else if (successRate < 0.6) {
            return '正確率偏低，建議降低難度鞏固基礎';
        } else if (avgResponseTime > 180) {
            return '答題時間較長，建議降低難度提升信心';
        } else {
            return '表現穩定，維持當前難度';
        }
    }

    getDifficultyRecommendation(level) {
        const recommendations = {
            easy: '建議多練習基礎題目，建立信心',
            medium: '保持練習頻率，逐步提升難度',
            hard: '挑戰困難題目，培養深度思考',
            expert: '探索高階概念，追求卓越表現'
        };
        return recommendations[level] || '';
    }

    parseTimeRange(timeRange) {
        const ranges = {
            '1d': 24 * 60 * 60 * 1000,
            '7d': 7 * 24 * 60 * 60 * 1000,
            '30d': 30 * 24 * 60 * 60 * 1000
        };
        return ranges[timeRange] || ranges['7d'];
    }
}

export default QuestionBankService; 