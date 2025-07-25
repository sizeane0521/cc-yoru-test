# 顏色吸取工具 - Color Picker Pro

專為 UI/UX 設計師打造的 Chrome 擴充套件，提供強大的顏色吸取功能和色彩建議。

## 功能特色

### 🎨 顏色吸取
- 使用現代化的 EyeDropper API
- 支援放大鏡預覽功能
- 十字線輔助精確定位
- 即時顯示顏色值

### 🎯 色彩建議
- **輔助色（Complementary）**: 提供對比色建議
- **類似色（Analogous）**: 相近色調搭配
- **三角色（Triadic）**: 三角配色方案
- **分割補色（Split Complementary）**: 分割補色搭配

### 📋 多格式支援
- HEX 格式 (#FF0000)
- RGB 格式 (rgb(255, 0, 0))
- HSL 格式 (hsl(0, 100%, 50%))
- 一鍵複製到剪貼簿

### 📝 歷史記錄
- 保存最近 20 個顏色
- 快速重複使用
- 一鍵清除歷史

## 安裝方式

### 開發者模式安裝

1. 下載或克隆此專案到本地
2. 打開 Chrome 瀏覽器
3. 進入 `chrome://extensions/`
4. 開啟右上角的「開發者模式」
5. 點擊「載入未封裝項目」
6. 選擇專案資料夾
7. 擴充套件將自動安裝並顯示在工具列

## 使用方法

1. **開啟擴充套件**: 點擊工具列中的擴充套件圖標
2. **開始吸色**: 點擊「吸取顏色」按鈕
3. **選擇顏色**: 在網頁上點擊想要的顏色
4. **查看建議**: 擴充套件會自動生成色彩搭配建議
5. **複製顏色**: 點擊任何顏色值即可複製到剪貼簿

## 鍵盤快捷鍵

- `ESC`: 取消顏色吸取模式

## 技術特色

- 使用現代 Chrome Extension Manifest V3
- 支援最新的 EyeDropper API
- 響應式設計，適配不同螢幕尺寸
- 基於色彩理論的智能建議算法
- 本地儲存歷史記錄

## 瀏覽器支援

- Chrome 95+
- Edge 95+
- 其他基於 Chromium 的瀏覽器

## 開發

```bash
# 進入專案目錄
cd color-picker-pro

# 在 Chrome 中載入擴充套件
# 1. 打開 chrome://extensions/
# 2. 開啟開發者模式
# 3. 點擊「載入未封裝項目」
# 4. 選擇此資料夾
```

## 檔案結構

```
color-picker-pro/
├── manifest.json          # 擴充套件配置
├── popup.html             # 彈出視窗界面
├── popup.css              # 樣式文件
├── popup.js               # 主要邏輯
├── content.js             # 內容腳本
├── icons/                 # 圖標文件
│   └── icon.svg
└── README.md              # 說明文件
```

## 授權

MIT License

## 貢獻

歡迎提交 Issues 和 Pull Requests！

## 更新日誌

### v1.0.0
- 初始版本發布
- 基本顏色吸取功能
- 色彩建議算法
- 歷史記錄功能
- 多格式支援