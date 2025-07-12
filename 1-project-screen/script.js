class OCRTool {
    constructor() {
        this.uploadArea = document.getElementById('uploadArea');
        this.fileInput = document.getElementById('fileInput');
        this.processingSection = document.getElementById('processingSection');
        this.resultSection = document.getElementById('resultSection');
        this.progressFill = document.getElementById('progressFill');
        this.progressText = document.getElementById('progressText');
        this.previewImg = document.getElementById('previewImg');
        this.resultText = document.getElementById('resultText');
        
        this.currentImageFile = null;
        this.recognizedText = '';
        this.rawText = ''; // 儲存原始辨識文字
        
        this.initEventListeners();
    }

    initEventListeners() {
        // 檔案輸入點擊事件
        this.uploadArea.addEventListener('click', () => {
            this.fileInput.click();
        });

        // 檔案選擇事件
        this.fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFile(e.target.files[0]);
            }
        });

        // 拖拽事件
        this.uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.uploadArea.classList.add('drag-over');
        });

        this.uploadArea.addEventListener('dragleave', () => {
            this.uploadArea.classList.remove('drag-over');
        });

        this.uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.uploadArea.classList.remove('drag-over');
            
            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].type.startsWith('image/')) {
                this.handleFile(files[0]);
            }
        });

        // 按鈕事件
        document.getElementById('copyBtn').addEventListener('click', () => {
            this.copyToClipboard();
        });

        document.getElementById('downloadTxtBtn').addEventListener('click', () => {
            this.downloadFile('txt');
        });

        document.getElementById('downloadMdBtn').addEventListener('click', () => {
            this.downloadFile('md');
        });

        document.getElementById('newAnalysisBtn').addEventListener('click', () => {
            this.resetTool();
        });

        document.getElementById('reprocessBtn').addEventListener('click', () => {
            this.reprocessText();
        });

        // 表格樣式變更事件
        document.getElementById('tableStyle').addEventListener('change', () => {
            this.reprocessText();
        });

        // 強制表格模式變更事件
        document.getElementById('forceTableMode').addEventListener('change', () => {
            this.reprocessText();
        });

        // 添加剪貼簿貼上功能
        document.addEventListener('paste', (e) => {
            this.handlePaste(e);
        });
    }

    async handlePaste(event) {
        const items = event.clipboardData.items;
        
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            
            // 檢查是否為圖片
            if (item.type.indexOf('image') !== -1) {
                event.preventDefault();
                
                const file = item.getAsFile();
                if (file) {
                    this.showMessage('已檢測到剪貼簿圖片，開始處理...', 'success');
                    await this.handleFile(file);
                }
                return;
            }
        }
        
        // 如果沒有找到圖片，提示用戶
        if (event.clipboardData.items.length > 0) {
            this.showMessage('剪貼簿中沒有圖片內容，請複製圖片後再試', 'error');
        }
    }

    async handleFile(file) {
        if (!file.type.startsWith('image/')) {
            this.showMessage('請選擇圖片檔案', 'error');
            return;
        }

        this.currentImageFile = file;
        
        // 顯示預覽圖片
        const imageUrl = URL.createObjectURL(file);
        this.previewImg.src = imageUrl;
        
        // 開始OCR處理
        await this.startOCR(file);
    }

    async startOCR(file) {
        // 隱藏上傳區域，顯示處理中畫面
        this.uploadArea.parentElement.style.display = 'none';
        this.processingSection.style.display = 'block';
        this.resultSection.style.display = 'none';

        try {
            // 使用簡化的API調用
            const { data: { text } } = await Tesseract.recognize(
                file,
                'chi_tra+eng',
                {
                    logger: (m) => {
                        console.log(m);
                        if (m.status === 'recognizing text') {
                            const progress = Math.round(m.progress * 100);
                            this.updateProgress(progress);
                        }
                    }
                }
            );
            
            // 儲存原始文字和處理結果
            this.rawText = text;
            this.recognizedText = this.processRecognizedText(text);
            this.showResults();
            
        } catch (error) {
            console.error('OCR辨識失敗:', error);
            this.showMessage('文字辨識失敗，請重試', 'error');
            this.resetTool();
        }
    }

    processRecognizedText(text) {
        // 保留原始換行結構，不要過度清理
        let lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        
        console.log('原始行數:', lines.length);
        console.log('原始內容:', lines);
        
        const forceTableMode = document.getElementById('forceTableMode')?.checked ?? true;
        
        if (forceTableMode) {
            // 智能表格辨識
            const processedLines = this.smartTableDetection(lines);
            console.log('處理後結果:', processedLines);
            return processedLines.join('\n');
        } else {
            // 簡單清理，保持原始格式
            return lines.join('\n');
        }
    }

    reprocessText() {
        if (this.rawText) {
            this.recognizedText = this.processRecognizedText(this.rawText);
            this.resultText.value = this.recognizedText;
            
            // 自動調整 textarea 高度
            this.resultText.style.height = 'auto';
            this.resultText.style.height = Math.max(300, this.resultText.scrollHeight) + 'px';
            
            this.showMessage('文字已重新處理', 'success');
        }
    }

    smartTableDetection(lines) {
        const forceTableMode = document.getElementById('forceTableMode')?.checked ?? true;
        
        if (forceTableMode && lines.length > 1) {
            // 強制表格模式：將所有行都當作表格處理
            return this.forceCreateTable(lines);
        }
        
        const result = [];
        let isInTable = false;
        let tableBuffer = [];
        let columnCount = 0;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cells = this.extractTableCells(line);
            
            // 判斷是否為表格行
            if (this.isTableRow(line, cells)) {
                if (!isInTable) {
                    // 開始新表格
                    isInTable = true;
                    columnCount = cells.length;
                    tableBuffer = [];
                }
                
                // 調整列數一致性
                while (cells.length < columnCount) {
                    cells.push('');
                }
                if (cells.length > columnCount) {
                    columnCount = cells.length;
                    // 回溯調整之前的行
                    tableBuffer = tableBuffer.map(row => {
                        while (row.length < columnCount) {
                            row.push('');
                        }
                        return row;
                    });
                }
                
                tableBuffer.push(cells);
            } else {
                // 非表格行，結束當前表格
                if (isInTable && tableBuffer.length > 0) {
                    result.push(...this.formatTable(tableBuffer));
                    tableBuffer = [];
                    isInTable = false;
                }
                
                result.push(line);
            }
        }
        
        // 處理最後的表格
        if (isInTable && tableBuffer.length > 0) {
            result.push(...this.formatTable(tableBuffer));
        }
        
        return result;
    }

    forceCreateTable(lines) {
        // 先檢查整體內容特性
        console.log('強制表格模式分析:', lines);
        
        // 計算有多少行看起來像表格
        let tableRowCount = 0;
        const tableData = [];
        
        for (let line of lines) {
            const cells = this.extractTableCells(line);
            console.log(`行分析: "${line}" → ${cells.length}列:`, cells);
            
            // 改進的表格行判斷邏輯
            if (this.shouldTreatAsTableRow(line, cells)) {
                tableRowCount++;
                tableData.push(cells);
            } else {
                // 單列或連續文字，但也要檢查是否可以作為表格的一部分
                if (this.canBeTableCell(line)) {
                    tableData.push([line.trim()]);
                } else {
                    tableData.push([line.trim()]);
                }
            }
        }
        
        console.log(`表格行數: ${tableRowCount}/${lines.length}`);
        
        // 降低表格化門檻，更積極地處理為表格
        if (tableRowCount < lines.length * 0.2) {
            console.log('不足20%的行為表格，返回原文');
            return lines;
        }
        
        // 統一列數
        const maxColumns = Math.max(...tableData.map(row => row.length));
        console.log('最大列數:', maxColumns);
        
        if (maxColumns === 1) {
            return lines; // 全部都是單列，返回原文
        }
        
        tableData.forEach(row => {
            while (row.length < maxColumns) {
                row.push('');
            }
        });
        
        return this.formatTable(tableData);
    }

    shouldCreateTable(lines) {
        // 判斷是否應該創建表格
        let hasMultipleColumns = false;
        let hasTableIndicators = false;
        
        for (let line of lines) {
            // 檢查是否有明顯的分隔符
            if (line.includes('|') || line.includes('\t') || /\s{2,}/.test(line)) {
                hasTableIndicators = true;
            }
            
            // 檢查是否有多列內容
            const cells = this.extractTableCells(line);
            if (cells.length > 1) {
                hasMultipleColumns = true;
            }
        }
        
        return hasTableIndicators || hasMultipleColumns;
    }

    isContinuousText(text) {
        // 判斷是否為連續文字（而非表格數據）
        if (!text || text.length === 0) return false;
        
        // 檢查字符間空格的模式
        const chars = text.replace(/\s/g, '');
        const spaces = (text.match(/\s/g) || []).length;
        
        // 如果每個字符之間都有空格（OCR常見問題），不是連續文字
        if (spaces > chars.length * 0.5) {
            console.log(`檢測到字符間空格模式: ${chars.length}字符, ${spaces}空格`);
            return false;
        }
        
        // 檢查是否只有1-2個空格（正常單詞間距）
        const hasLargeSpaces = /\s{3,}/.test(text);
        
        // 如果有大間距，可能不是連續文字
        if (hasLargeSpaces) return false;
        
        // 檢查是否主要是中文字符且空格不多
        const chineseChars = text.match(/[\u4e00-\u9fa5]/g);
        const totalChars = text.replace(/\s/g, '').length;
        
        // 如果中文字符比例超過60%且空格較少，認為是連續文字
        if (chineseChars && (chineseChars.length / totalChars) > 0.6 && spaces < chineseChars.length * 0.3) {
            return true;
        }
        
        // 檢查英文單詞的情況
        const words = text.trim().split(/\s+/);
        if (words.length >= 2 && words.length <= 5) {
            // 2-5個單詞，且沒有大間距，可能是正常句子
            const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
            if (avgWordLength > 3) {
                return true;
            }
        }
        
        // 檢查是否為單個長單詞
        if (words.length === 1 && words[0].length > 4) {
            return true;
        }
        
        // 檢查是否包含常見的句子結構（但空格不能太多）
        if ((text.includes('的') || text.includes('與') || text.includes('和') || 
            text.includes('是') || text.includes('為') || text.includes('在') ||
            text.includes('the') || text.includes('and') || text.includes('of')) && 
            spaces < totalChars * 0.4) {
            return true;
        }
        
        return false;
    }

    intelligentSplit(lines) {
        // 更保守的智能分割
        const tableData = [];
        
        for (let line of lines) {
            // 如果是連續文字，不分割
            if (this.isContinuousText(line)) {
                tableData.push([line]);
                continue;
            }
            
            let cells = [];
            
            // 規則1: 按明顯分隔符分割
            if (line.includes('|')) {
                cells = line.split('|').map(s => s.trim()).filter(s => s.length > 0);
            }
            else if (line.includes('\t')) {
                cells = line.split('\t').map(s => s.trim()).filter(s => s.length > 0);
            }
            else if (/\s{2,}/.test(line)) {
                cells = line.split(/\s{2,}/).map(s => s.trim()).filter(s => s.length > 0);
            }
            // 規則2: 按標點符號分割
            else if (line.includes(',') || line.includes('，')) {
                cells = line.split(/[,，]/).map(s => s.trim()).filter(s => s.length > 0);
            }
            // 規則3: 數字和文字明確分離
            else if (/\d+.*?[^\d\s]/.test(line)) {
                cells = line.match(/(\d+|[^\d\s]+)/g) || [line];
                cells = cells.map(s => s.trim()).filter(s => s.length > 0);
            }
            else {
                cells = [line];
            }
            
            tableData.push(cells);
        }
        
        // 如果所有行都只有一列，可能不是表格
        const maxCols = Math.max(...tableData.map(row => row.length));
        if (maxCols === 1) {
            return lines; // 返回原始文字
        }
        
        // 統一列數
        tableData.forEach(row => {
            while (row.length < maxCols) {
                row.push('');
            }
        });
        
        return this.formatTable(tableData);
    }

    extractTableCells(line) {
        // 更精準的分隔符檢測
        let cells = [];
        
        console.log('提取表格單元格:', line);
        
        // 策略1: 檢測製表符（最可靠）
        if (line.includes('\t')) {
            cells = line.split('\t').map(cell => cell.trim()).filter(cell => cell.length > 0);
            if (cells.length > 1) return cells;
        }
        
        // 策略2: 檢測管道符
        if (line.includes('|')) {
            cells = line.split('|').map(cell => cell.trim()).filter(cell => cell.length > 0);
            if (cells.length > 1) return cells;
        }
        
        // 策略3: 檢測冒號分隔（常見於標題行）
        if (line.includes('：') || line.includes(':')) {
            // 特別處理 "階段：核心任務" 這種格式
            cells = line.split(/[：:]/).map(cell => cell.trim()).filter(cell => cell.length > 0);
            if (cells.length >= 2) return cells;
        }
        
        // 策略4: 優先檢測字符間空格模式
        if (this.isCharacterSpacingPattern(line)) {
            console.log('檢測到字符間空格模式，直接重組');
            cells = this.directReconstructLine(line);
            if (cells.length > 0) return cells;
        }
        
        // 策略5: 檢測多個空格（表格列分隔）
        if (this.hasSignificantSpacing(line)) {
            cells = this.parseBySpacing(line);
            if (cells.length > 1) return cells;
        }
        
        // 策略6: 檢測固定寬度列（最後手段）
        if (cells.length <= 1) {
            cells = this.detectFixedWidthColumns(line);
        }
        
        return cells;
    }

    isCharacterSpacingPattern(line) {
        // 檢測是否為字符間空格模式（OCR常見問題）
        console.log('檢測字符間空格模式:', line);
        
        // 移除所有空格，獲得純字符
        const chars = line.replace(/\s/g, '');
        const spaces = (line.match(/\s/g) || []).length;
        
        // 如果沒有空格，不是字符間空格模式
        if (spaces === 0) return false;
        
        // 先檢查是否為常見的完整中文詞語，如果是就不拆分
        if (this.isKnownCompletePhrase(chars)) {
            console.log('識別為完整詞語，不拆分:', chars);
            return false;
        }
        
        // 提高檢測門檻，更保守地判斷字符間空格
        if (spaces >= chars.length * 0.8) { // 從0.6提高到0.8
            console.log(`字符間空格模式: ${chars.length}字符, ${spaces}空格`);
            return true;
        }
        
        // 檢查是否每個字符（或大部分字符）之間都有空格
        const parts = line.split(/\s+/).filter(part => part.length > 0);
        
        // 提高單字符部分的門檻，從0.7提高到0.85
        const singleCharParts = parts.filter(part => part.length === 1);
        if (singleCharParts.length >= parts.length * 0.85) {
            console.log(`單字符部分占比: ${singleCharParts.length}/${parts.length}`);
            return true;
        }
        
        // 特別檢查中文字符間空格模式，但更保守
        if (this.isChineseCharacterSpacing(line)) {
            console.log('檢測到中文字符間空格');
            return true;
        }
        
        return false;
    }

    isKnownCompletePhrase(text) {
        // 檢查是否為常見的完整中文詞語，避免過度拆分
        const commonPhrases = [
            // 常見形容詞
            '理想', '活動', '重要', '特別', '普通', '一般', '基本', '主要', '核心', '關鍵', '特殊', '完整', '詳細', '簡單', '複雜',
            // 常見名詞
            '產品', '項目', '系統', '方法', '流程', '設計', '開發', '測試', '分析', '管理', '策略', '計畫', '任務', '階段', '功能',
            '用戶', '使用者', '客戶', '服務', '內容', '資料', '資訊', '技術', '工具', '平台', '介面', '操作', '體驗', '效果',
            // 常見動詞
            '建立', '創建', '設置', '配置', '安裝', '執行', '處理', '檢查', '測試', '驗證', '確認', '完成', '開始', '結束',
            '提供', '支援', '幫助', '協助', '改善', '優化', '更新', '修改', '調整', '增加', '減少', '刪除', '移除',
            // 技術相關
            '網站', '網頁', '應用', '程式', '軟體', '硬體', '資料庫', '伺服器', '網路', '安全', '備份', '更新', '版本',
            '介面', '操作', '功能', '設定', '選項', '參數', '變數', '函數', '方法', '類別', '物件', '屬性',
            // 學習相關  
            '學習', '教學', '訓練', '課程', '內容', '知識', '技能', '能力', '經驗', '實踐', '練習', '測驗', '評估',
            // 商業相關
            '業務', '商業', '市場', '銷售', '行銷', '推廣', '宣傳', '品牌', '產品', '服務', '客戶', '合作', '夥伴',
            // 生活相關
            '生活', '工作', '時間', '空間', '環境', '條件', '情況', '狀況', '問題', '解決', '方案', '建議', '意見'
        ];
        
        // 檢查是否為已知的完整詞語
        if (commonPhrases.includes(text)) {
            return true;
        }
        
        // 檢查常見的詞語模式
        const patterns = [
            /^.{2,4}活動$/, // X活動
            /^.{2,4}管理$/, // X管理
            /^.{2,4}系統$/, // X系統
            /^.{2,4}設計$/, // X設計
            /^.{2,4}開發$/, // X開發
            /^.{2,4}測試$/, // X測試
            /^.{2,4}分析$/, // X分析
            /^.{2,4}服務$/, // X服務
            /^.{2,4}方法$/, // X方法
            /^.{2,4}策略$/, // X策略
            /^使用.{1,3}$/, // 使用X
            /^執行.{1,3}$/, // 執行X
            /^處理.{1,3}$/, // 處理X
            /^建立.{1,3}$/, // 建立X
            /^設置.{1,3}$/, // 設置X
        ];
        
        return patterns.some(pattern => pattern.test(text));
    }

    isChineseCharacterSpacing(line) {
        // 檢測中文字符間空格模式，但更保守
        const parts = line.split(/\s+/).filter(part => part.length > 0);
        const chineseParts = parts.filter(part => /^[\u4e00-\u9fa5]+$/.test(part));
        
        // 先檢查是否整行組合起來是已知詞語
        const combinedText = parts.join('');
        if (this.isKnownCompletePhrase(combinedText)) {
            console.log('組合後是已知詞語，不拆分:', combinedText);
            return false;
        }
        
        // 更嚴格的條件：需要大部分是中文且都是單字符
        if (chineseParts.length >= parts.length * 0.8) { // 提高到80%
            const avgChineseLength = chineseParts.reduce((sum, part) => sum + part.length, 0) / chineseParts.length;
            const singleCharCount = chineseParts.filter(part => part.length === 1).length;
            
            // 只有當大部分都是單字符時才認為是字符間空格
            if (avgChineseLength <= 1.2 && singleCharCount >= chineseParts.length * 0.8) {
                return true;
            }
        }
        
        return false;
    }

    directReconstructLine(line) {
        // 直接重組帶有字符間空格的行
        console.log('直接重組行:', line);
        
        // 移除多餘的空格，保留有意義的分隔
        const cleanLine = line.replace(/\s+/g, ' ').trim();
        const parts = cleanLine.split(' ').filter(part => part.length > 0);
        
        console.log('清理後的部分:', parts);
        
        // 如果都是單個字符，嘗試重組成完整詞語
        if (parts.every(part => part.length <= 2)) {
            const reconstructed = this.reconstructChinesePhrase(parts);
            console.log('重組結果:', reconstructed);
            return reconstructed;
        }
        
        // 如果有混合內容，使用更智能的分組
        return this.intelligentGrouping(parts);
    }

    reconstructChinesePhrase(parts) {
        // 重組中文詞語
        const fullText = parts.join('');
        
        // 如果總長度不長，且主要是中文，作為一個整體
        if (fullText.length <= 15 && /^[\u4e00-\u9fa5\d]+$/.test(fullText)) {
            return [fullText];
        }
        
        // 嘗試智能分組
        return this.smartGroupChineseParts(parts);
    }

    smartGroupChineseParts(parts) {
        // 智能分組中文部分
        const groups = [];
        let currentGroup = '';
        
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            
            // 如果是數字，單獨成組
            if (/^\d+$/.test(part)) {
                if (currentGroup) {
                    groups.push(currentGroup);
                    currentGroup = '';
                }
                groups.push(part);
                continue;
            }
            
            // 如果是標點符號，單獨成組
            if (/^[．。，,：:]$/.test(part)) {
                if (currentGroup) {
                    groups.push(currentGroup);
                    currentGroup = '';
                }
                groups.push(part);
                continue;
            }
            
            // 中文字符加入當前組
            currentGroup += part;
            
            // 檢查是否應該結束當前組
            if (this.shouldEndChineseGroup(currentGroup, parts.slice(i + 1))) {
                if (currentGroup) {
                    groups.push(currentGroup);
                    currentGroup = '';
                }
            }
        }
        
        // 處理最後一組
        if (currentGroup) {
            groups.push(currentGroup);
        }
        
        return groups.filter(group => group.length > 0);
    }

    shouldEndChineseGroup(currentGroup, remainingParts) {
        // 判斷是否應該結束當前中文組
        if (remainingParts.length === 0) return true;
        
        // 如果當前組已經是完整詞語
        const meaningfulWords = ['階段', '核心任務', '建立', '套取', '構思', '現場', '行為', '計畫', '使用者', '故事', '規格', '描述', '產品', '設計', '架構', '檢測', '修正', '介紹'];
        if (meaningfulWords.some(word => currentGroup.includes(word))) {
            return true;
        }
        
        // 如果當前組長度合適，且下一個部分是數字或標點
        if (currentGroup.length >= 2 && /^[\d．。，,：:]/.test(remainingParts[0])) {
            return true;
        }
        
        // 如果當前組過長，強制分割
        if (currentGroup.length >= 8) {
            return true;
        }
        
        return false;
    }

    intelligentGrouping(parts) {
        // 智能分組混合內容
        const groups = [];
        let currentGroup = '';
        
        for (let part of parts) {
            // 數字單獨成組
            if (/^\d+$/.test(part)) {
                if (currentGroup) {
                    groups.push(currentGroup);
                    currentGroup = '';
                }
                groups.push(part);
            }
            // 標點符號單獨成組
            else if (/^[．。，,：:]$/.test(part)) {
                if (currentGroup) {
                    groups.push(currentGroup);
                    currentGroup = '';
                }
                groups.push(part);
            }
            // 其他字符加入當前組
            else {
                currentGroup += part;
            }
        }
        
        if (currentGroup) {
            groups.push(currentGroup);
        }
        
        return groups.filter(group => group.length > 0);
    }

    hasSignificantSpacing(line) {
        // 檢查是否有明顯的大間距（可能是表格分隔）
        
        // 計算所有空格序列的長度
        const spaceSequences = line.match(/\s{2,}/g);
        if (!spaceSequences) return false;
        
        // 如果有3個或以上連續空格，認為是表格分隔
        const hasLargeGaps = spaceSequences.some(seq => seq.length >= 3);
        
        // 或者有多個2空格的間距
        const multipleMediumGaps = spaceSequences.filter(seq => seq.length >= 2).length >= 2;
        
        return hasLargeGaps || multipleMediumGaps;
    }

    parseBySpacing(line) {
        // 根據間距解析列
        console.log('解析間距:', line);
        
        // 檢查是否為字符間空格模式（OCR常見）
        const chars = line.replace(/\s/g, '');
        const spaces = (line.match(/\s/g) || []).length;
        
        if (spaces > chars.length * 0.5) {
            // 字符間空格模式，嘗試重組詞語
            console.log('檢測到字符間空格，嘗試重組');
            return this.reconstructWords(line);
        }
        
        // 正常的空格分隔處理
        const cells = [];
        let currentCell = '';
        let spaceCount = 0;
        let lineChars = line.split('');
        
        for (let i = 0; i < lineChars.length; i++) {
            const char = lineChars[i];
            
            if (char === ' ') {
                spaceCount++;
                // 如果遇到3個或以上空格，認為是分隔
                if (spaceCount >= 3) {
                    if (currentCell.trim().length > 0) {
                        cells.push(currentCell.trim());
                        currentCell = '';
                    }
                    spaceCount = 0;
                } else if (spaceCount === 1 || spaceCount === 2) {
                    // 保持1-2個空格作為單詞間距
                    currentCell += char;
                }
            } else {
                // 非空格字符，重置計數
                spaceCount = 0;
                currentCell += char;
            }
        }
        
        if (currentCell.trim().length > 0) {
            cells.push(currentCell.trim());
        }
        
        return cells;
    }

    reconstructWords(line) {
        // 重組被空格分開的字符
        const parts = line.split(/\s+/).filter(part => part.length > 0);
        const cells = [];
        let currentWord = '';
        
        console.log('重組輸入:', line);
        console.log('分割後的部分:', parts);
        
        // 檢查是否為純中文字符間空格模式
        const allChineseSingleChar = parts.every(part => /^[\u4e00-\u9fa5]$/.test(part));
        
        if (allChineseSingleChar && parts.length > 1) {
            // 如果都是單個中文字符，嘗試智能重組
            console.log('檢測到純中文字符間空格模式');
            return this.intelligentChineseRegroup(parts);
        }
        
        // 原有邏輯處理混合內容
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            
            // 如果是中文字符，嘗試組成詞語
            if (/[\u4e00-\u9fa5]/.test(part)) {
                currentWord += part;
                
                // 檢查下一個字符，決定是否結束當前詞
                const nextPart = parts[i + 1];
                if (!nextPart || this.shouldBreakWord(currentWord, nextPart)) {
                    if (currentWord.length > 0) {
                        cells.push(currentWord);
                        currentWord = '';
                    }
                }
            } 
            // 英文或數字
            else if (/[a-zA-Z0-9]/.test(part)) {
                currentWord += part;
                
                // 英文單詞通常在空格處分割
                if (currentWord.length > 0) {
                    cells.push(currentWord);
                    currentWord = '';
                }
            }
            // 其他字符
            else {
                currentWord += part;
            }
        }
        
        if (currentWord.length > 0) {
            cells.push(currentWord);
        }
        
        console.log('重組結果:', cells);
        return cells;
    }

    intelligentChineseRegroup(chars) {
        // 智能重組中文字符，避免過度分割
        console.log('智能重組中文字符:', chars);
        
        // 首先嘗試組成完整的詞語
        const fullText = chars.join('');
        
        // 優先檢查是否為已知的完整詞語
        if (this.isKnownCompletePhrase(fullText)) {
            console.log('識別為已知完整詞語:', fullText);
            return [fullText];
        }
        
        // 放寬字符數限制，對於常見詞語更積極地保持完整性
        if (chars.length <= 6 && this.looksLikeCompletePhrase(fullText)) {
            console.log('識別為完整詞語:', fullText);
            return [fullText];
        }
        
        // 如果是4個字符以內的純中文，很可能是一個詞語
        if (chars.length <= 4 && /^[\u4e00-\u9fa5]+$/.test(fullText)) {
            console.log('4字符以內純中文，保持完整:', fullText);
            return [fullText];
        }
        
        // 嘗試按語意分組
        const groups = this.groupChineseByMeaning(chars);
        console.log('語意分組結果:', groups);
        
        return groups;
    }

    looksLikeCompletePhrase(text) {
        // 判斷是否看起來像完整的詞語
        
        // 先檢查是否為已知詞語
        if (this.isKnownCompletePhrase(text)) {
            return true;
        }
        
        // 常見的完整詞語模式
        const commonPatterns = [
            /心理學/,
            /行為策略/,
            /對應.*策略/,
            /.*分析/,
            /.*設計/,
            /.*建立/,
            /.*檢視/,
            /.*考慮/,
            /.*架構/,
            /核心任務/,
            /.*階段/,
            /.*項目/,
            /.*管理/,
            /.*系統/,
            /.*方法/,
            /.*流程/,
            /.*活動/,
            /.*功能/,
            /.*服務/,
            /.*平台/,
            /.*工具/,
            /.*技術/,
            /.*開發/,
            /.*測試/,
            /.*處理/,
            /.*操作/,
            /.*使用/,
            /.*應用/,
            /.*實現/,
            /.*完成/
        ];
        
        // 如果是純中文且長度適中，很可能是完整詞語
        if (/^[\u4e00-\u9fa5]{2,4}$/.test(text)) {
            return true;
        }
        
        return commonPatterns.some(pattern => pattern.test(text));
    }

    groupChineseByMeaning(chars) {
        // 按語意分組中文字符，更積極地保持詞語完整性
        const groups = [];
        let currentGroup = '';
        
        for (let i = 0; i < chars.length; i++) {
            const char = chars[i];
            currentGroup += char;
            
            // 先檢查當前組合是否為已知完整詞語
            if (this.isKnownCompletePhrase(currentGroup)) {
                // 如果是已知詞語，檢查是否應該繼續組合
                const remainingChars = chars.slice(i + 1);
                if (remainingChars.length > 0) {
                    const potentialLongerPhrase = currentGroup + remainingChars.join('');
                    if (!this.isKnownCompletePhrase(potentialLongerPhrase)) {
                        // 如果加上剩餘字符不是已知詞語，就結束當前組
                        groups.push(currentGroup);
                        currentGroup = '';
                        continue;
                    }
                }
            }
            
            // 檢查是否應該結束當前組
            if (this.shouldEndGroup(currentGroup, chars.slice(i + 1))) {
                if (currentGroup.length > 0) {
                    groups.push(currentGroup);
                    currentGroup = '';
                }
            }
        }
        
        // 處理最後一組
        if (currentGroup.length > 0) {
            groups.push(currentGroup);
        }
        
        return groups;
    }

    shouldEndGroup(currentGroup, remainingChars) {
        // 決定是否應該結束當前組，更保守的分組策略
        
        // 如果沒有剩餘字符，結束組
        if (remainingChars.length === 0) return true;
        
        // 如果當前組是已知的完整詞語，結束組
        if (this.isKnownCompletePhrase(currentGroup)) {
            return true;
        }
        
        // 如果當前組是有意義的詞語
        const meaningfulWords = ['對應', '心理', '學習', '行為', '策略', '分析', '設計', '建立', '檢視', '考慮', '架構', '核心', '任務', '階段', '項目', '管理', '系統', '方法', '流程', '理想', '活動'];
        
        if (meaningfulWords.includes(currentGroup)) {
            return true;
        }
        
        // 如果當前組是2-4個字符的純中文，且看起來像完整詞語
        if (currentGroup.length >= 2 && currentGroup.length <= 4 && /^[\u4e00-\u9fa5]+$/.test(currentGroup)) {
            // 檢查是否看起來像完整的詞語
            if (this.looksLikeCompleteWord(currentGroup)) {
                return true;
            }
        }
        
        // 提高強制分割的門檻，從6個字符提高到8個字符
        if (currentGroup.length >= 8) {
            return true;
        }
        
        return false;
    }

    looksLikeCompleteWord(word) {
        // 判斷是否看起來像完整的詞語
        
        // 先檢查是否為已知詞語
        if (this.isKnownCompletePhrase(word)) {
            return true;
        }
        
        const commonEndings = ['學', '策', '略', '析', '計', '立', '視', '慮', '構', '務', '段', '目', '理', '統', '法', '程', '應', '為', '心', '行', '動', '能', '用', '作', '果', '式', '類'];
        const commonStartings = ['對', '心', '行', '分', '設', '建', '檢', '考', '架', '核', '階', '項', '管', '系', '方', '流', '理', '主', '基', '重', '特', '完', '詳', '簡'];
        
        // 如果是常見的2-4個字符詞語結構
        if (word.length >= 2 && word.length <= 4) {
            const hasCommonEnding = commonEndings.includes(word[word.length - 1]);
            const hasCommonStarting = commonStartings.includes(word[0]);
            
            if (hasCommonEnding || hasCommonStarting) {
                return true;
            }
        }
        
        return false;
    }

    shouldBreakWord(currentWord, nextChar) {
        // 決定是否應該在此處分割詞語，更傾向於保持完整性
        if (!nextChar) return true;
        
        // 如果當前詞是已知的完整詞語，分割
        if (this.isKnownCompletePhrase(currentWord)) {
            return true;
        }
        
        // 如果當前詞是完整的有意義詞語，分割
        const meaningfulWords = ['對應', '心理', '學習', '行為', '策略', '分析', '設計', '建立', '檢視', '考慮', '架構', '核心', '任務', '階段', '項目', '管理', '系統', '方法', '流程', '理想', '活動'];
        if (meaningfulWords.includes(currentWord)) {
            return true;
        }
        
        // 如果當前詞以常見結尾字符結束，且長度合適
        const endings = ['學', '策', '略', '析', '計', '立', '視', '慮', '構', '務', '段', '目', '理', '統', '法', '程', '應', '為', '動', '能', '用', '作', '果'];
        if (currentWord.length >= 2 && endings.includes(currentWord[currentWord.length - 1])) {
            return true;
        }
        
        // 如果下個字符是數字或符號，分割
        if (/[\d﹒：:]/.test(nextChar)) {
            return true;
        }
        
        // 如果下個字符是常見的詞語開頭，分割
        const startings = ['對', '心', '行', '分', '設', '建', '檢', '考', '架', '核', '階', '項', '管', '系', '方', '流', '理', '主', '基'];
        if (startings.includes(nextChar)) {
            return true;
        }
        
        // 提高強制分割的閾值，從8個字符提高到10個字符
        if (currentWord.length >= 10) {
            return true;
        }
        
        return false;
    }

    detectFixedWidthColumns(line) {
        // 只有在明確條件下才分割
        const cells = [];
        
        // 如果是純中文或主要是中文，不要分割
        if (this.isContinuousText(line)) {
            return [line.trim()];
        }
        
        // 只在有明確分隔跡象時才分割
        const words = line.trim().split(/\s+/);
        
        // 如果只有1-2個詞，且沒有明顯分隔符，不分割
        if (words.length <= 2 && !line.includes(':') && !line.includes('：')) {
            return [line.trim()];
        }
        
        // 如果有冒號，按冒號分割
        if (line.includes('：') || line.includes(':')) {
            const parts = line.split(/[：:]/);
            return parts.map(p => p.trim()).filter(p => p.length > 0);
        }
        
        // 其他情況，按空格分割（但要謹慎）
        if (words.length >= 2) {
            return words;
        }
        
        return [line.trim()];
    }

    isTableRow(line, cells) {
        // 更嚴格的表格行判斷條件
        return (
            cells.length >= 2 && ( // 必須至少2列，且滿足以下條件之一：
                line.includes('|') || // 包含管道符
                line.includes('\t') || // 包含製表符
                this.hasSignificantSpacing(line) || // 有明顯大間距
                this.looksLikeTableData(line, cells) // 看起來像表格數據
            )
        );
    }

    looksLikeTableData(line, cells) {
        // 判斷是否看起來像表格數據
        
        // 如果包含數字和文字的組合，可能是表格
        const hasNumbers = /\d/.test(line);
        const hasText = /[a-zA-Z\u4e00-\u9fa5]/.test(line);
        
        if (hasNumbers && hasText && cells.length >= 2) {
            return true;
        }
        
        // 如果每個格子都很短（可能是表格內容）
        const avgCellLength = cells.reduce((sum, cell) => sum + cell.length, 0) / cells.length;
        if (avgCellLength <= 6 && cells.length >= 3) {
            return true;
        }
        
        // 如果包含常見的表格關鍵字
        const tableKeywords = ['項目', '數量', '價格', '名稱', '金額', '日期', '時間', '編號', 'No', 'ID'];
        const hasTableKeywords = tableKeywords.some(keyword => line.includes(keyword));
        if (hasTableKeywords && cells.length >= 2) {
            return true;
        }
        
        return false;
    }

    formatTable(tableData) {
        if (tableData.length === 0) return [];
        
        const tableStyle = document.getElementById('tableStyle')?.value || 'ascii';
        
        switch (tableStyle) {
            case 'ascii':
                return this.formatASCIITable(tableData);
            case 'grid':
                return this.formatGridTable(tableData);
            case 'markdown':
                return this.formatMarkdownTable(tableData);
            case 'simple':
                return this.formatSimpleTable(tableData);
            default:
                return this.formatASCIITable(tableData);
        }
    }

    formatASCIITable(tableData) {
        // 計算每列的最大寬度
        const columnWidths = [];
        for (let colIndex = 0; colIndex < tableData[0].length; colIndex++) {
            let maxWidth = 0;
            for (let rowIndex = 0; rowIndex < tableData.length; rowIndex++) {
                const cellContent = tableData[rowIndex][colIndex] || '';
                maxWidth = Math.max(maxWidth, cellContent.length);
            }
            columnWidths.push(Math.max(maxWidth, 3)); // 最小寬度為3
        }
        
        const result = [];
        
        // 生成頂部邊框
        const topBorder = '┌' + columnWidths.map(w => '─'.repeat(w + 2)).join('┬') + '┐';
        result.push(topBorder);
        
        // 智能檢測表頭
        const hasHeader = this.detectTableHeader(tableData);
        let headerProcessed = false;
        
        // 處理所有行
        for (let i = 0; i < tableData.length; i++) {
            const dataRow = '│' + tableData[i].map((cell, j) => 
                ' ' + (cell || '').padEnd(columnWidths[j]) + ' '
            ).join('│') + '│';
            result.push(dataRow);
            
            // 在每行後添加分隔線（除了最後一行）
            if (i < tableData.length - 1) {
                // 如果是表頭行，使用特殊分隔線
                if (hasHeader && !headerProcessed && i === 0) {
                    const headerSeparator = '├' + columnWidths.map(w => '─'.repeat(w + 2)).join('┼') + '┤';
                    result.push(headerSeparator);
                    headerProcessed = true;
                }
                // 其他行使用標準分隔線
                else {
                    const rowSeparator = '├' + columnWidths.map(w => '─'.repeat(w + 2)).join('┼') + '┤';
                    result.push(rowSeparator);
                }
            }
        }
        
        // 底部邊框
        const bottomBorder = '└' + columnWidths.map(w => '─'.repeat(w + 2)).join('┴') + '┘';
        result.push(bottomBorder);
        
        return result;
    }

    detectTableHeader(tableData) {
        // 檢測是否有明確的表頭
        if (tableData.length === 0) return false;
        
        const firstRow = tableData[0];
        const hasHeaderKeywords = ['階段', '核心任務', '項目', '名稱', '編號', '類型', '狀態', '說明'].some(keyword => 
            firstRow.some(cell => cell && cell.includes(keyword))
        );
        
        // 如果第一行包含明確的表頭關鍵字，認為是表頭
        if (hasHeaderKeywords) return true;
        
        // 如果第一行都不是數字開頭，且第二行是數字開頭，可能是表頭
        if (tableData.length >= 2) {
            const firstRowHasNumbers = firstRow.some(cell => /^\d/.test(cell));
            const secondRowHasNumbers = tableData[1].some(cell => /^\d/.test(cell));
            
            if (!firstRowHasNumbers && secondRowHasNumbers) {
                return true;
            }
        }
        
        return false;
    }

    isNumberedRow(row) {
        // 檢測是否為數字編號行（如"1.", "2.", "3."等）
        if (!row || row.length === 0) return false;
        
        const firstCell = row[0];
        if (!firstCell) return false;
        
        // 檢查是否以數字開頭或包含數字編號
        return /^\d+[\.。]?\s*$/.test(firstCell.trim()) || /^\d+[\.。]/.test(firstCell.trim());
    }

    shouldTreatAsTableRow(line, cells) {
        // 改進的表格行判斷邏輯
        
        // 如果有多列且不是純連續文字，當作表格行
        if (cells.length >= 2 && !this.isContinuousText(line)) {
            return true;
        }
        
        // 如果包含冒號分隔，很可能是表格的鍵值對
        if (line.includes('：') || line.includes(':')) {
            return true;
        }
        
        // 如果是數字編號開頭，可能是表格項目
        if (/^\d+[\.。]/.test(line.trim())) {
            return true;
        }
        
        // 如果包含明顯的表格關鍵字
        const tableKeywords = ['階段', '核心任務', '項目', '編號', '名稱', '設計', '建立', '檢視', '分析'];
        if (tableKeywords.some(keyword => line.includes(keyword))) {
            return true;
        }
        
        return false;
    }

    canBeTableCell(line) {
        // 判斷單行內容是否可以作為表格單元格
        const trimmedLine = line.trim();
        
        // 空行不處理
        if (trimmedLine.length === 0) return false;
        
        // 很短的內容可能是表格單元格
        if (trimmedLine.length <= 10) return true;
        
        // 包含數字的可能是表格數據
        if (/\d/.test(trimmedLine)) return true;
        
        // 包含常見表格術語的
        const tableTerms = ['階段', '任務', '項目', '設計', '建立', '檢視', '分析', '考慮', '架構'];
        if (tableTerms.some(term => trimmedLine.includes(term))) return true;
        
        // 其他情況，保守處理
        return false;
    }

    formatMarkdownTable(tableData) {
        const result = [];
        
        // 第一行作為表頭
        result.push('| ' + tableData[0].join(' | ') + ' |');
        
        // 添加分隔線
        const separatorLine = '|' + ' --- |'.repeat(tableData[0].length);
        result.push(separatorLine);
        
        // 添加數據行
        for (let i = 1; i < tableData.length; i++) {
            result.push('| ' + tableData[i].join(' | ') + ' |');
        }
        
        return result;
    }

    formatGridTable(tableData) {
        // 計算每列的最大寬度
        const columnWidths = [];
        for (let colIndex = 0; colIndex < tableData[0].length; colIndex++) {
            let maxWidth = 0;
            for (let rowIndex = 0; rowIndex < tableData.length; rowIndex++) {
                const cellContent = tableData[rowIndex][colIndex] || '';
                maxWidth = Math.max(maxWidth, cellContent.length);
            }
            columnWidths.push(Math.max(maxWidth, 3));
        }
        
        const result = [];
        
        // 生成頂部邊框
        const topBorder = '┌' + columnWidths.map(w => '─'.repeat(w + 2)).join('┬') + '┐';
        result.push(topBorder);
        
        // 智能檢測表頭
        const hasHeader = this.detectTableHeader(tableData);
        let headerProcessed = false;
        
        // 數據行 (智能分隔線)
        for (let i = 0; i < tableData.length; i++) {
            const dataRow = '│' + tableData[i].map((cell, j) => 
                ' ' + (cell || '').padEnd(columnWidths[j]) + ' '
            ).join('│') + '│';
            result.push(dataRow);
            
            // 在每行後添加分隔線（除了最後一行）
            if (i < tableData.length - 1) {
                // 如果是表頭行，使用特殊分隔線
                if (hasHeader && !headerProcessed && i === 0) {
                    const headerSeparator = '├' + columnWidths.map(w => '─'.repeat(w + 2)).join('┼') + '┤';
                    result.push(headerSeparator);
                    headerProcessed = true;
                }
                // 其他行使用標準分隔線
                else {
                    const rowSeparator = '├' + columnWidths.map(w => '─'.repeat(w + 2)).join('┼') + '┤';
                    result.push(rowSeparator);
                }
            }
        }
        
        // 底部邊框
        const bottomBorder = '└' + columnWidths.map(w => '─'.repeat(w + 2)).join('┴') + '┘';
        result.push(bottomBorder);
        
        return result;
    }

    formatSimpleTable(tableData) {
        // 計算每列的最大寬度
        const columnWidths = [];
        for (let colIndex = 0; colIndex < tableData[0].length; colIndex++) {
            let maxWidth = 0;
            for (let rowIndex = 0; rowIndex < tableData.length; rowIndex++) {
                const cellContent = tableData[rowIndex][colIndex] || '';
                maxWidth = Math.max(maxWidth, cellContent.length);
            }
            columnWidths.push(Math.max(maxWidth, 3));
        }
        
        const result = [];
        
        // 表頭
        const headerRow = tableData[0].map((cell, i) => 
            (cell || '').padEnd(columnWidths[i])
        ).join(' │ ');
        result.push(headerRow);
        
        // 分隔線
        const separatorLine = columnWidths.map(w => '─'.repeat(w)).join('─┼─');
        result.push(separatorLine);
        
        // 數據行
        for (let i = 1; i < tableData.length; i++) {
            const dataRow = tableData[i].map((cell, j) => 
                (cell || '').padEnd(columnWidths[j])
            ).join(' │ ');
            result.push(dataRow);
        }
        
        return result;
    }

    updateProgress(progress) {
        this.progressFill.style.width = `${progress}%`;
        this.progressText.textContent = `${progress}%`;
    }

    showResults() {
        // 隱藏處理畫面，顯示結果
        this.processingSection.style.display = 'none';
        this.resultSection.style.display = 'block';
        
        // 顯示辨識文字
        this.resultText.value = this.recognizedText;
        
        // 自動調整 textarea 高度
        this.resultText.style.height = 'auto';
        this.resultText.style.height = Math.max(300, this.resultText.scrollHeight) + 'px';
    }

    async copyToClipboard() {
        try {
            await navigator.clipboard.writeText(this.recognizedText);
            this.showMessage('文字已複製到剪貼簿', 'success');
        } catch (error) {
            // 備用方案
            this.resultText.select();
            document.execCommand('copy');
            this.showMessage('文字已複製到剪貼簿', 'success');
        }
    }

    downloadFile(format) {
        let content = this.recognizedText;
        let filename = `ocr_result_${new Date().getTime()}`;
        let mimeType = 'text/plain';

        if (format === 'md') {
            // 為 Markdown 格式添加標題
            content = `# 圖片文字辨識結果\n\n辨識時間：${new Date().toLocaleString()}\n\n---\n\n${content}`;
            filename += '.md';
            mimeType = 'text/markdown';
        } else {
            filename += '.txt';
        }

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showMessage(`${format.toUpperCase()} 檔案已下載`, 'success');
    }

    resetTool() {
        // 重置工具到初始狀態
        this.uploadArea.parentElement.style.display = 'block';
        this.processingSection.style.display = 'none';
        this.resultSection.style.display = 'none';
        
        this.fileInput.value = '';
        this.currentImageFile = null;
        this.recognizedText = '';
        
        // 重置進度條
        this.progressFill.style.width = '0%';
        this.progressText.textContent = '0%';
    }

    showMessage(message, type) {
        // 移除現有訊息
        const existingMessage = document.querySelector('.message');
        if (existingMessage) {
            existingMessage.remove();
        }

        // 創建新訊息
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}-message`;
        messageDiv.textContent = message;
        
        // 插入到容器頂部
        const container = document.querySelector('.container');
        container.insertBefore(messageDiv, container.firstChild);
        
        // 3秒後自動移除
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 3000);
    }
}

// 頁面載入完成後初始化
document.addEventListener('DOMContentLoaded', () => {
    new OCRTool();
});