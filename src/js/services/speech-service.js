/**
 * 語音服務
 * 提供語音辨識（中文輸入）和語音朗讀（英文為主）功能
 */

class SpeechService {
  constructor() {
    this.recognition = null;
    this.synthesis = window.speechSynthesis;
    this.isListening = false;
    this.isSupported = this._checkSupport();
    this.voices = [];

    // 語音辨識設定
    this.recognitionSettings = {
      language: 'zh-TW',
      continuous: false,
      interimResults: true,
      maxAlternatives: 1
    };

    // 語音朗讀設定
    this.speechSettings = {
      english: {
        lang: 'en-US',
        rate: 0.9,
        pitch: 1.0,
        volume: 0.8
      },
      chinese: {
        lang: 'zh-TW',
        rate: 0.8,
        pitch: 1.0,
        volume: 0.8
      }
    };

    this._init();
  }

  /**
   * 初始化語音服務
   */
  async _init() {
    try {
      if (this.isSupported.recognition) {
        this._initSpeechRecognition();
      }

      if (this.isSupported.synthesis) {
        await this._loadVoices();
      }

      console.log('Speech service initialized', {
        recognition: this.isSupported.recognition,
        synthesis: this.isSupported.synthesis,
        voices: this.voices.length
      });
    } catch (error) {
      console.error('Failed to initialize speech service:', error);
    }
  }

  /**
   * 檢查瀏覽器支援度
   */
  _checkSupport() {
    return {
      recognition: 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window,
      synthesis: 'speechSynthesis' in window
    };
  }

  /**
   * 初始化語音辨識
   */
  _initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('Speech recognition not supported');
      return;
    }

    this.recognition = new SpeechRecognition();

    // 設定語音辨識參數
    Object.assign(this.recognition, this.recognitionSettings);

    // 事件監聽器
    this.recognition.onstart = () => {
      this.isListening = true;
      this._triggerEvent('recognition-start');
      console.log('Speech recognition started');
    };

    this.recognition.onresult = (event) => {
      const results = Array.from(event.results);
      const transcript = results.map(result => result[0].transcript).join('');
      const isFinal = event.results[event.results.length - 1].isFinal;

      this._triggerEvent('recognition-result', {
        transcript: transcript.trim(),
        isFinal,
        confidence: event.results[event.results.length - 1][0].confidence
      });
    };

    this.recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      this.isListening = false;
      this._triggerEvent('recognition-error', { error: event.error });
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this._triggerEvent('recognition-end');
      console.log('Speech recognition ended');
    };
  }

  /**
   * 載入可用的語音
   */
  async _loadVoices() {
    return new Promise((resolve) => {
      const loadVoices = () => {
        this.voices = this.synthesis.getVoices();
        if (this.voices.length > 0) {
          console.log('Voices loaded:', this.voices.length);
          resolve();
        } else {
          // 某些瀏覽器需要等待
          setTimeout(loadVoices, 100);
        }
      };

      if (this.synthesis.onvoiceschanged !== undefined) {
        this.synthesis.onvoiceschanged = loadVoices;
      }

      loadVoices();
    });
  }

  /**
   * 觸發自定義事件
   */
  _triggerEvent(type, detail = {}) {
    window.dispatchEvent(new CustomEvent(type, { detail }));
  }

  /**
   * 開始語音辨識
   */
  startRecognition() {
    if (!this.isSupported.recognition) {
      throw new Error('語音辨識不支援');
    }

    if (this.isListening) {
      console.warn('Speech recognition already running');
      return;
    }

    try {
      this.recognition.start();
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      throw error;
    }
  }

  /**
   * 停止語音辨識
   */
  stopRecognition() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
  }

  /**
   * 語音朗讀文字
   * @param {string} text - 要朗讀的文字
   * @param {string} language - 語言 ('english' 或 'chinese')
   * @param {Object} options - 額外選項
   */
  speak(text, language = 'english', options = {}) {
    if (!this.isSupported.synthesis) {
      console.warn('Speech synthesis not supported');
      return Promise.reject(new Error('語音朗讀不支援'));
    }

    if (!text || text.trim().length === 0) {
      console.warn('No text to speak');
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      // 停止目前的朗讀
      this.stopSpeaking();

      const utterance = new SpeechSynthesisUtterance(text.trim());
      const settings = this.speechSettings[language] || this.speechSettings.english;

      // 設定語音參數
      Object.assign(utterance, {
        ...settings,
        ...options
      });

      // 選擇合適的語音
      const voice = this._selectVoice(language);
      if (voice) {
        utterance.voice = voice;
      }

      // 事件監聽
      utterance.onstart = () => {
        this._triggerEvent('speech-start', { text, language });
      };

      utterance.onend = () => {
        this._triggerEvent('speech-end', { text, language });
        resolve();
      };

      utterance.onerror = (event) => {
        console.error('Speech synthesis error:', event.error);
        this._triggerEvent('speech-error', { error: event.error, text, language });
        reject(new Error(`語音朗讀失敗: ${event.error}`));
      };

      // 開始朗讀
      this.synthesis.speak(utterance);
    });
  }

  /**
   * 停止語音朗讀
   */
  stopSpeaking() {
    if (this.synthesis.speaking) {
      this.synthesis.cancel();
    }
  }

  /**
   * 選擇合適的語音
   * @param {string} language - 語言類型
   */
  _selectVoice(language) {
    if (this.voices.length === 0) return null;

    const langCode = this.speechSettings[language]?.lang;
    if (!langCode) return null;

    // 尋找最匹配的語音
    let voice = this.voices.find(v => v.lang === langCode && v.localService);
    if (!voice) {
      voice = this.voices.find(v => v.lang === langCode);
    }
    if (!voice) {
      voice = this.voices.find(v => v.lang.startsWith(langCode.split('-')[0]));
    }

    return voice;
  }

  /**
   * 自動檢測並朗讀英文內容
   * @param {string} text - 包含英文的文字
   */
  async speakEnglishContent(text) {
    if (!text) return;

    // 提取英文句子或單詞
    const englishTexts = this.extractEnglish(text);

    if (englishTexts.length === 0) return;

    // 逐一朗讀英文內容（有間隔）
    for (let i = 0; i < englishTexts.length; i++) {
      const englishText = englishTexts[i];

      try {
        await this.speak(englishText, 'english');

        // 如果還有下一個，稍微暫停
        if (i < englishTexts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      } catch (error) {
        console.error('Failed to speak English text:', englishText, error);
      }
    }
  }

  /**
   * 提取文字中的英文內容（優先檢測 [SPEAK] 標記）
   * @param {string} text - 原文字
   * @returns {Array} 英文內容陣列
   */
  extractEnglish(text) {
    if (!text) return [];

    const englishTexts = [];

    // 首先檢測 [SPEAK]內容[/SPEAK] 標記
    const speakTagPattern = /\[SPEAK\](.*?)\[\/SPEAK\]/gi;
    let match;

    while ((match = speakTagPattern.exec(text)) !== null) {
      const content = match[1].trim();
      if (content && content.length > 0) {
        // 對標記的內容不需要額外驗證，因為是 AI 主動標記的
        englishTexts.push(content);
      }
    }

    return [...new Set(englishTexts)]; // 去重
  }

  /**
   * 檢查是否為有效的英文內容
   * @param {string} text - 要檢查的文字
   * @returns {boolean}
   */
  _isValidEnglish(text) {
    if (!text || text.length < 2) return false;

    // 計算英文字符比例（包括撇號）
    const englishChars = text.match(/[A-Za-z']/g) || [];
    const totalChars = text.replace(/\s/g, '').length;

    if (totalChars === 0) return false;

    const englishRatio = englishChars.length / totalChars;

    // 放寬標準：英文字符比例需要超過50%，或者是純英文單詞（含撇號）
    return englishRatio > 0.5 || /^[A-Za-z'\s]*$/.test(text.trim());
  }

  /**
   * 檢查是否為有效的英文段落
   * @param {string} text - 要檢查的文字
   * @returns {boolean}
   */
  _isValidEnglishParagraph(text) {
    if (!text || text.length < 10) return false;

    // 計算英文字符和單詞數量（包括撇號）
    const englishChars = text.match(/[A-Za-z']/g) || [];
    const words = text.trim().split(/\s+/).filter(word => /[A-Za-z']/.test(word));
    const totalChars = text.replace(/\s/g, '').length;

    if (totalChars === 0 || words.length < 3) return false;

    const englishRatio = englishChars.length / totalChars;

    // 英文字符比例需要超過70%，且至少包含3個單詞
    return englishRatio > 0.7 && words.length >= 3;
  }

  /**
   * 獲取支援狀態
   */
  getSupport() {
    return this.isSupported;
  }

  /**
   * 獲取當前狀態
   */
  getStatus() {
    return {
      isListening: this.isListening,
      isSpeaking: this.synthesis.speaking,
      supported: this.isSupported,
      voiceCount: this.voices.length
    };
  }

  /**
   * 設定語音辨識語言
   * @param {string} language - 語言代碼 (如 'zh-TW', 'en-US')
   */
  setRecognitionLanguage(language) {
    this.recognitionSettings.language = language;
    if (this.recognition) {
      this.recognition.lang = language;
    }
  }

  /**
   * 設定語音朗讀選項
   * @param {string} language - 語言類型
   * @param {Object} settings - 設定選項
   */
  setSpeechSettings(language, settings) {
    if (this.speechSettings[language]) {
      Object.assign(this.speechSettings[language], settings);
    }
  }
}

// 創建單例
const speechService = new SpeechService();

export default speechService; 