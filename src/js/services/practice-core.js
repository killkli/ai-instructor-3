import sessionManager from './session-manager.js';

// 主題摘要產生器
export function generateTopicSummary(fullDescription) {
  const match = fullDescription.match(/主題[:：]?\s*([^\n，。；;]+)/);
  if (match) return match[1].trim();
  const firstSentence = fullDescription.split(/[。；;\n]/)[0];
  if (firstSentence.length < 20) return firstSentence;
  return fullDescription.slice(0, 20) + '...';
}

export class PracticeCore {
  constructor(questionBankService, storageService) {
    this.questionBankService = questionBankService;
    this.storageService = storageService;
    // 通用 fallback 題目
    this.fallbackQuestions = [{
      id: "fallback_1",
      topic: "基礎運算",
      type: "multiple_choice",
      difficulty: "easy",
      question: "2 + 3 = ?",
      options: ["4", "5", "6", "7"],
      correctAnswer: "5",
      explanation: "2 + 3 = 5，這是基本的加法運算。",
      relatedConcepts: ["加法", "基礎運算"],
      estimatedTime: 1,
      tags: ["easy", "addition"]
    }];
  }

  // 題目產生
  async generatePracticeQuestions(options) {
    try {
      const questions = await this.questionBankService.generateQuestions(options);
      if (questions && questions.length > 0) {
        await this.questionBankService.saveGeneratedQuestions(questions, options);
        return questions;
      } else {
        return this.useFallbackQuestion();
      }
    } catch (error) {
      console.error('題目產生失敗，使用 fallback 題目', error);
      return this.useFallbackQuestion();
    }
  }

  // fallback 題目
  useFallbackQuestion() {
    return this.fallbackQuestions;
  }

  // 可擴充更多底層邏輯...
} 