class ColorPicker {
    constructor() {
        this.isActive = false;
        this.canvas = null;
        this.ctx = null;
        this.magnifier = null;
        this.crosshair = null;
        this.floatingWindow = null;
        this.init();
    }

    init() {
        this.createCanvas();
        this.createMagnifier();
        this.createCrosshair();
        this.setupEventListeners();
    }

    createCanvas() {
        this.canvas = document.createElement('canvas');
        this.canvas.style.position = 'fixed';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100vw';
        this.canvas.style.height = '100vh';
        this.canvas.style.zIndex = '999999';
        this.canvas.style.cursor = 'crosshair';
        this.canvas.style.display = 'none';
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.ctx = this.canvas.getContext('2d');
        document.body.appendChild(this.canvas);
    }

    createMagnifier() {
        this.magnifier = document.createElement('div');
        this.magnifier.style.position = 'fixed';
        this.magnifier.style.width = '120px';
        this.magnifier.style.height = '120px';
        this.magnifier.style.border = '3px solid #000';
        this.magnifier.style.borderRadius = '50%';
        this.magnifier.style.background = '#fff';
        this.magnifier.style.zIndex = '1000000';
        this.magnifier.style.display = 'none';
        this.magnifier.style.pointerEvents = 'none';
        this.magnifier.style.boxShadow = '0 4px 15px rgba(0,0,0,0.3)';
        this.magnifier.innerHTML = `
            <div style="position: relative; width: 100%; height: 100%; border-radius: 50%; overflow: hidden;">
                <canvas style="width: 100%; height: 100%; image-rendering: pixelated;"></canvas>
                <div style="
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 20px;
                    height: 20px;
                    border: 2px solid #000;
                    background: rgba(255,255,255,0.8);
                "></div>
                <div style="
                    position: absolute;
                    bottom: -30px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: rgba(0,0,0,0.8);
                    color: white;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    font-family: monospace;
                    white-space: nowrap;
                " id="colorDisplay"></div>
            </div>
        `;
        document.body.appendChild(this.magnifier);
    }

    createCrosshair() {
        this.crosshair = document.createElement('div');
        this.crosshair.style.position = 'fixed';
        this.crosshair.style.width = '2px';
        this.crosshair.style.height = '100vh';
        this.crosshair.style.background = 'rgba(0,0,0,0.8)';
        this.crosshair.style.zIndex = '999998';
        this.crosshair.style.display = 'none';
        this.crosshair.style.pointerEvents = 'none';
        this.crosshair.innerHTML = `
            <div style="
                position: absolute;
                top: 0;
                left: -1px;
                width: 100vw;
                height: 2px;
                background: rgba(0,0,0,0.8);
            "></div>
        `;
        document.body.appendChild(this.crosshair);
    }

    setupEventListeners() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'startPicking') {
                this.startPicking();
                sendResponse({success: true});
            } else if (request.action === 'stopPicking') {
                this.stopPicking();
                sendResponse({success: true});
            } else if (request.action === 'openFloatingWindow') {
                this.createFloatingWindow();
                sendResponse({success: true});
            }
            return false; // 同步回應
        });

        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isActive) {
                this.stopPicking();
            }
        });
    }

    async startPicking() {
        this.isActive = true;
        this.canvas.style.display = 'block';
        this.magnifier.style.display = 'block';
        this.crosshair.style.display = 'block';
        
        document.body.style.userSelect = 'none';
        document.body.style.overflow = 'hidden';
        
        await this.captureScreen();
    }

    stopPicking() {
        this.isActive = false;
        this.canvas.style.display = 'none';
        this.magnifier.style.display = 'none';
        this.crosshair.style.display = 'none';
        
        document.body.style.userSelect = '';
        document.body.style.overflow = '';
    }

    async captureScreen() {
        try {
            if ('getDisplayMedia' in navigator.mediaDevices) {
                const stream = await navigator.mediaDevices.getDisplayMedia({
                    video: { mediaSource: 'screen' }
                });
                
                const video = document.createElement('video');
                video.srcObject = stream;
                video.play();
                
                video.addEventListener('loadedmetadata', () => {
                    this.ctx.drawImage(video, 0, 0, this.canvas.width, this.canvas.height);
                    stream.getTracks().forEach(track => track.stop());
                });
            } else {
                html2canvas(document.body).then(canvas => {
                    this.ctx.drawImage(canvas, 0, 0, this.canvas.width, this.canvas.height);
                });
            }
        } catch (error) {
            console.error('無法截取畫面:', error);
            this.useEyeDropperAPI();
        }
    }

    async useEyeDropperAPI() {
        if ('EyeDropper' in window) {
            try {
                const eyeDropper = new EyeDropper();
                const result = await eyeDropper.open();
                this.sendColorToPopup(result.sRGBHex);
                this.stopPicking();
            } catch (error) {
                console.error('EyeDropper API 錯誤:', error);
                this.stopPicking();
            }
        }
    }

    handleMouseMove(e) {
        if (!this.isActive) return;

        const x = e.clientX;
        const y = e.clientY;

        this.updateCrosshair(x, y);
        this.updateMagnifier(x, y);
    }

    updateCrosshair(x, y) {
        this.crosshair.style.left = x + 'px';
        this.crosshair.querySelector('div').style.top = y + 'px';
    }

    updateMagnifier(x, y) {
        const magnifierSize = 120;
        const zoomSize = 10;
        
        let magnifierX = x + 20;
        let magnifierY = y - magnifierSize - 20;
        
        if (magnifierX + magnifierSize > window.innerWidth) {
            magnifierX = x - magnifierSize - 20;
        }
        if (magnifierY < 0) {
            magnifierY = y + 20;
        }
        
        this.magnifier.style.left = magnifierX + 'px';
        this.magnifier.style.top = magnifierY + 'px';
        
        const magnifierCanvas = this.magnifier.querySelector('canvas');
        const magnifierCtx = magnifierCanvas.getContext('2d');
        
        magnifierCanvas.width = magnifierSize;
        magnifierCanvas.height = magnifierSize;
        
        const sourceSize = magnifierSize / zoomSize;
        const sourceX = x - sourceSize / 2;
        const sourceY = y - sourceSize / 2;
        
        magnifierCtx.imageSmoothingEnabled = false;
        magnifierCtx.drawImage(
            this.canvas,
            sourceX, sourceY, sourceSize, sourceSize,
            0, 0, magnifierSize, magnifierSize
        );
        
        const centerColor = this.getColorAtPoint(x, y);
        this.magnifier.querySelector('#colorDisplay').textContent = centerColor;
    }

    handleClick(e) {
        if (!this.isActive) return;

        const color = this.getColorAtPoint(e.clientX, e.clientY);
        this.sendColorToPopup(color);
        this.stopPicking();
    }

    getColorAtPoint(x, y) {
        const imageData = this.ctx.getImageData(x, y, 1, 1);
        const [r, g, b] = imageData.data;
        return this.rgbToHex(r, g, b);
    }

    rgbToHex(r, g, b) {
        return "#" + [r, g, b].map(x => {
            const hex = x.toString(16);
            return hex.length === 1 ? "0" + hex : hex;
        }).join("");
    }

    sendColorToPopup(color) {
        chrome.runtime.sendMessage({
            action: 'colorPicked',
            color: color
        });
        
        // 如果有浮動視窗，也發送給它
        if (this.floatingWindow && this.floatingWindow.style.display !== 'none') {
            this.floatingWindow.dispatchEvent(new CustomEvent('colorPicked', {
                detail: { color: color }
            }));
        }
    }

    createFloatingWindow() {
        console.log('創建浮動視窗...');
        
        // 如果已經存在，就顯示它
        if (this.floatingWindow) {
            console.log('浮動視窗已存在，顯示它');
            this.floatingWindow.style.display = 'block';
            return;
        }

        // 創建浮動視窗
        this.floatingWindow = document.createElement('div');
        this.floatingWindow.id = 'colorPickerFloatingWindow';
        this.floatingWindow.innerHTML = this.getFloatingWindowHTML();
        this.floatingWindow.style.cssText = this.getFloatingWindowCSS();
        
        document.body.appendChild(this.floatingWindow);
        console.log('浮動視窗已添加到頁面');
        
        // 設置浮動視窗的事件監聽器
        this.setupFloatingWindowEvents();
        console.log('浮動視窗事件監聽器已設置');
    }

    getFloatingWindowCSS() {
        return `
            position: fixed;
            top: 20px;
            right: 20px;
            width: 350px;
            min-height: 500px;
            z-index: 999999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            overflow: hidden;
            user-select: none;
        `;
    }

    getFloatingWindowHTML() {
        return `
            <div class="drag-header" style="
                background: rgba(255,255,255,0.1);
                padding: 10px 20px;
                cursor: move;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid rgba(255,255,255,0.1);
            ">
                <h1 style="color: white; font-size: 16px; margin: 0; text-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; gap: 8px;">
                    <span style="opacity: 0.7; font-size: 12px;">⋮⋮</span>
                    🎨 顏色吸取工具
                </h1>
                <button class="close-btn" style="
                    background: none;
                    border: none;
                    color: rgba(255,255,255,0.8);
                    font-size: 18px;
                    cursor: pointer;
                    padding: 5px;
                    border-radius: 4px;
                    transition: all 0.2s ease;
                ">✕</button>
            </div>
            
            <div class="content" style="padding: 20px;">
                <button class="pick-btn" style="
                    background: white;
                    border: none;
                    border-radius: 25px;
                    padding: 12px 24px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin: 0 auto 20px auto;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                    transition: all 0.3s ease;
                ">
                    <span>🎨</span>
                    吸取顏色
                </button>

                <div class="current-color" style="
                    background: white;
                    border-radius: 15px;
                    padding: 20px;
                    margin-bottom: 15px;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                    display: none;
                ">
                    <h2 style="font-size: 16px; margin-bottom: 15px; color: #333;">當前顏色</h2>
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <div class="color-preview" style="
                            width: 60px;
                            height: 60px;
                            border-radius: 12px;
                            border: 3px solid #f0f0f0;
                            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                            flex-shrink: 0;
                        "></div>
                        <div style="flex: 1; display: flex; flex-direction: column; gap: 8px;">
                            <div class="color-value hex-value" style="
                                background: #f8f9fa;
                                padding: 8px 12px;
                                border-radius: 8px;
                                font-family: Monaco, Menlo, monospace;
                                font-size: 12px;
                                cursor: pointer;
                                transition: all 0.2s ease;
                                border: 1px solid #e9ecef;
                            ">#000000</div>
                            <div class="color-value rgb-value" style="
                                background: #f8f9fa;
                                padding: 8px 12px;
                                border-radius: 8px;
                                font-family: Monaco, Menlo, monospace;
                                font-size: 12px;
                                cursor: pointer;
                                transition: all 0.2s ease;
                                border: 1px solid #e9ecef;
                            ">rgb(0, 0, 0)</div>
                            <div class="color-value hsl-value" style="
                                background: #f8f9fa;
                                padding: 8px 12px;
                                border-radius: 8px;
                                font-family: Monaco, Menlo, monospace;
                                font-size: 12px;
                                cursor: pointer;
                                transition: all 0.2s ease;
                                border: 1px solid #e9ecef;
                            ">hsl(0, 0%, 0%)</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    setupFloatingWindowEvents() {
        const dragHeader = this.floatingWindow.querySelector('.drag-header');
        const closeBtn = this.floatingWindow.querySelector('.close-btn');
        const pickBtn = this.floatingWindow.querySelector('.pick-btn');
        
        // 拖拽功能
        let isDragging = false;
        let dragOffset = { x: 0, y: 0 };
        
        // 確保拖拽區域有正確的樣式
        dragHeader.style.cursor = 'move';
        dragHeader.style.userSelect = 'none';
        
        const handleMouseDown = (e) => {
            // 只有點擊標題欄時才開始拖拽
            if (e.target === closeBtn || e.target.closest('.close-btn')) return;
            
            isDragging = true;
            const rect = this.floatingWindow.getBoundingClientRect();
            dragOffset.x = e.clientX - rect.left;
            dragOffset.y = e.clientY - rect.top;
            
            // 添加拖拽時的視覺反饋
            this.floatingWindow.style.cursor = 'grabbing';
            dragHeader.style.background = 'rgba(255,255,255,0.2)';
            
            e.preventDefault();
            e.stopPropagation();
        };

        const handleMouseMove = (e) => {
            if (!isDragging) return;
            
            const newX = e.clientX - dragOffset.x;
            const newY = e.clientY - dragOffset.y;
            
            // 確保視窗不會移出螢幕
            const maxX = window.innerWidth - 350;
            const maxY = window.innerHeight - this.floatingWindow.offsetHeight;
            
            const constrainedX = Math.max(0, Math.min(newX, maxX));
            const constrainedY = Math.max(0, Math.min(newY, maxY));
            
            this.floatingWindow.style.left = constrainedX + 'px';
            this.floatingWindow.style.top = constrainedY + 'px';
            this.floatingWindow.style.right = 'auto';
            this.floatingWindow.style.bottom = 'auto';
            
            e.preventDefault();
        };

        const handleMouseUp = () => {
            if (isDragging) {
                isDragging = false;
                this.floatingWindow.style.cursor = 'default';
                dragHeader.style.background = 'rgba(255,255,255,0.1)';
            }
        };
        
        // 綁定事件監聽器
        dragHeader.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        
        // 防止拖拽時選中文字
        dragHeader.addEventListener('selectstart', (e) => e.preventDefault());

        // 關閉按鈕
        closeBtn.addEventListener('click', () => {
            this.floatingWindow.style.display = 'none';
        });

        // 吸取顏色按鈕
        pickBtn.addEventListener('click', () => {
            this.startPicking();
        });

        // 複製顏色值
        this.floatingWindow.addEventListener('click', (e) => {
            if (e.target.classList.contains('color-value')) {
                this.copyToClipboard(e.target.textContent);
            }
        });

        // 監聽顏色選取事件
        this.floatingWindow.addEventListener('colorPicked', (e) => {
            this.updateFloatingWindowColor(e.detail.color);
        });
    }

    updateFloatingWindowColor(color) {
        const currentColorSection = this.floatingWindow.querySelector('.current-color');
        const colorPreview = this.floatingWindow.querySelector('.color-preview');
        const hexValue = this.floatingWindow.querySelector('.hex-value');
        const rgbValue = this.floatingWindow.querySelector('.rgb-value');
        const hslValue = this.floatingWindow.querySelector('.hsl-value');

        currentColorSection.style.display = 'block';
        colorPreview.style.backgroundColor = color;

        const rgb = this.hexToRgb(color);
        const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);

        hexValue.textContent = color.toUpperCase();
        rgbValue.textContent = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
        hslValue.textContent = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;

        this.copyToClipboard(color);
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    rgbToHsl(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }

        return {
            h: Math.round(h * 360),
            s: Math.round(s * 100),
            l: Math.round(l * 100)
        };
    }

    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showFloatingToast(`已複製: ${text}`);
        } catch (error) {
            console.error('複製失敗:', error);
        }
    }

    showFloatingToast(message) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: #28a745;
            color: white;
            padding: 8px 16px;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            z-index: 9999999;
            font-size: 12px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => toast.remove(), 2000);
    }
}

const colorPicker = new ColorPicker();