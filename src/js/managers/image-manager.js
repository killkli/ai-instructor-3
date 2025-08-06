/**
 * 圖片管理器
 * 負責處理圖片上傳、預覽、格式轉換等功能
 */
class ImageManager {
  constructor(app) {
    this.app = app;
    this.initialized = false;
  }

  /**
   * 初始化圖片管理器
   */
  async init() {
    try {
      this.setupEventListeners();
      this.initialized = true;
      console.log('📸 ImageManager initialized');
    } catch (error) {
      console.error('❌ ImageManager initialization failed:', error);
      throw error;
    }
  }

  /**
   * 設定事件監聽器
   */
  setupEventListeners() {
    console.log('📸 ImageManager setupEventListeners called');
    console.log('📸 imageUploadBtn element:', this.app.elements.imageUploadBtn);
    console.log('📸 imageUpload element:', this.app.elements.imageUpload);

    // 圖片上傳按鈕
    if (this.app.elements.imageUploadBtn) {
      this.app.elements.imageUploadBtn.addEventListener('click', () => {
        console.log('📸 Image upload button clicked');
        this.app.elements.imageUpload?.click();
      });
      console.log('📸 Image upload button event listener added');
    } else {
      console.error('❌ imageUploadBtn element not found!');
    }

    // 圖片文件選擇
    if (this.app.elements.imageUpload) {
      this.app.elements.imageUpload.addEventListener('change', (e) => {
        console.log('📸 Image upload file selected');
        this.handleImageUpload(e);
      });
      console.log('📸 Image upload change event listener added');
    } else {
      console.error('❌ imageUpload element not found!');
    }
  }

  /**
   * 處理圖片上傳
   */
  async handleImageUpload(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    // 檢查文件類型和大小
    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        this.app._showNotification(`文件 ${file.name} 不是有效的圖片格式`, 'warning');
        return false;
      }

      if (file.size > 10 * 1024 * 1024) { // 10MB限制
        this.app._showNotification(`文件 ${file.name} 大小超過10MB限制`, 'warning');
        return false;
      }

      return true;
    });

    if (validFiles.length === 0) return;

    try {
      // 處理每個文件
      for (const file of validFiles) {
        const imageData = await this.fileToBase64(file);
        const imageInfo = {
          name: file.name,
          size: file.size,
          mimeType: file.type,
          data: imageData
        };

        this.app.appStateManager.addUploadedImage(imageInfo);
      }

      // 更新預覽
      this.updateImagePreview();

      // 更新發送按鈕狀態
      this.app._updateSendButtonState();

    } catch (error) {
      console.error('圖片上傳處理失敗:', error);
      this.app._showNotification('圖片處理失敗: ' + error.message, 'error');
    }

    // 清空文件輸入
    event.target.value = '';
  }

  /**
   * 將文件轉換為base64
   */
  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // 移除 data:image/xxx;base64, 前綴
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('文件讀取失敗'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * 更新圖片預覽
   */
  updateImagePreview() {
    if (!this.app.elements.imagePreview) return;

    const uploadedImages = this.app.appStateManager.get('uploadedImages');

    if (uploadedImages.length === 0) {
      this.app.elements.imagePreview.style.display = 'none';
      return;
    }

    this.app.elements.imagePreview.style.display = 'block';
    this.app.elements.imagePreview.innerHTML = '';

    uploadedImages.forEach((image, index) => {
      const previewItem = document.createElement('div');
      previewItem.className = 'image-preview-item';

      const thumbnail = document.createElement('img');
      thumbnail.className = 'image-preview-thumbnail';
      thumbnail.src = `data:${image.mimeType};base64,${image.data}`;
      thumbnail.alt = image.name;

      const infoDiv = document.createElement('div');
      infoDiv.className = 'image-preview-info';

      const nameDiv = document.createElement('div');
      nameDiv.className = 'image-preview-name';
      nameDiv.textContent = image.name;

      const sizeDiv = document.createElement('div');
      sizeDiv.className = 'image-preview-size';
      sizeDiv.textContent = this.formatFileSize(image.size);

      infoDiv.appendChild(nameDiv);
      infoDiv.appendChild(sizeDiv);

      const removeBtn = document.createElement('button');
      removeBtn.className = 'image-preview-remove';
      removeBtn.innerHTML = '×';
      removeBtn.title = '移除圖片';
      removeBtn.addEventListener('click', () => {
        this.removeUploadedImage(index);
      });

      previewItem.appendChild(thumbnail);
      previewItem.appendChild(infoDiv);
      previewItem.appendChild(removeBtn);

      this.app.elements.imagePreview.appendChild(previewItem);
    });
  }

  /**
   * 移除已上傳的圖片
   */
  removeUploadedImage(index) {
    this.app.appStateManager.removeUploadedImage(index);
    this.updateImagePreview();
    this.app._updateSendButtonState();
  }

  /**
   * 清空已上傳的圖片
   */
  clearUploadedImages() {
    this.app.appStateManager.clearUploadedImages();
    this.updateImagePreview();
    this.app._updateSendButtonState();
  }

  /**
   * 構建多模態訊息
   */
  buildMultimodalMessage(text) {
    const uploadedImages = this.app.appStateManager.get('uploadedImages');
    if (uploadedImages.length === 0) {
      return text;
    }

    return {
      text: text || '',
      images: uploadedImages.map(img => ({
        mimeType: img.mimeType,
        data: img.data
      }))
    };
  }

  /**
   * 顯示圖片燈箱
   */
  showImageLightbox(imageSrc) {
    const lightbox = document.createElement('div');
    lightbox.className = 'image-lightbox';

    const img = document.createElement('img');
    img.src = imageSrc;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'image-lightbox-close';
    closeBtn.innerHTML = '×';
    closeBtn.title = '關閉';

    lightbox.appendChild(img);
    lightbox.appendChild(closeBtn);

    // 點擊背景或關閉按鈕關閉燈箱
    const closeLightbox = () => {
      document.body.removeChild(lightbox);
    };

    lightbox.addEventListener('click', closeLightbox);
    closeBtn.addEventListener('click', closeLightbox);

    // 防止點擊圖片時關閉燈箱
    img.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    // ESC鍵關閉燈箱
    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        closeLightbox();
        document.removeEventListener('keydown', handleKeydown);
      }
    };
    document.addEventListener('keydown', handleKeydown);

    document.body.appendChild(lightbox);
  }

  /**
   * 格式化文件大小
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 檢查是否有圖片上傳
   */
  hasUploadedImages() {
    return this.app.appStateManager.get('uploadedImages').length > 0;
  }

  /**
   * 獲取上傳的圖片數量
   */
  getUploadedImagesCount() {
    return this.app.appStateManager.get('uploadedImages').length;
  }

  /**
   * 獲取所有上傳的圖片
   */
  getUploadedImages() {
    return this.app.appStateManager.get('uploadedImages');
  }
}

export default ImageManager; 