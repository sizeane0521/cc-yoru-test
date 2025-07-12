class ColorPickerPopup {
    constructor() {
        this.currentColor = null;
        this.colorHistory = this.loadColorHistory();
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadColorHistory();
        this.renderColorHistory();
    }

    setupEventListeners() {
        const pickColorBtn = document.getElementById('pickColor');
        const clearHistoryBtn = document.getElementById('clearHistory');
        const dragHandle = document.getElementById('dragHandle');
        
        pickColorBtn.addEventListener('click', () => this.openFloatingWindow());
        clearHistoryBtn.addEventListener('click', () => this.clearHistory());
        
        if (dragHandle) {
            dragHandle.addEventListener('click', () => this.openFloatingWindow());
        }

        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'colorPicked') {
                this.handleColorPicked(request.color);
                sendResponse({success: true});
            }
            return false; // 同步回應
        });

        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('color-value')) {
                this.copyToClipboard(e.target.textContent);
            }
            if (e.target.classList.contains('palette-color') || e.target.classList.contains('history-color')) {
                const color = e.target.style.backgroundColor || e.target.dataset.color;
                this.copyToClipboard(this.rgbToHex(color));
            }
        });
    }

    async openFloatingWindow() {
        try {
            // 開啟獨立的顏色吸取視窗
            const windowUrl = chrome.runtime.getURL('color-picker-window.html');
            const windowFeatures = 'width=420,height=650,resizable=yes,scrollbars=no,status=no,menubar=no,toolbar=no';
            
            window.open(windowUrl, 'colorPicker', windowFeatures);
            window.close();
        } catch (error) {
            console.error('開啟視窗失敗:', error);
            // 退回到直接使用 EyeDropper
            if ('EyeDropper' in window) {
                await this.startEyeDropper();
            } else {
                this.showToast('瀏覽器不支援此功能', 'error');
            }
        }
    }

    async startEyeDropper() {
        try {
            const eyeDropper = new EyeDropper();
            const result = await eyeDropper.open();
            this.handleColorPicked(result.sRGBHex);
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('取色失敗:', error);
                this.showToast('取色失敗', 'error');
            }
        }
    }

    handleColorPicked(color) {
        this.currentColor = color;
        this.displayCurrentColor(color);
        this.generateColorSuggestions(color);
        this.addToHistory(color);
        this.copyToClipboard(color);
        this.showToast('顏色已複製到剪貼簿！');
    }

    displayCurrentColor(hexColor) {
        const currentColorSection = document.getElementById('currentColor');
        const colorPreview = document.getElementById('colorPreview');
        const hexValue = document.getElementById('hexValue');
        const rgbValue = document.getElementById('rgbValue');
        const hslValue = document.getElementById('hslValue');

        currentColorSection.classList.remove('hidden');
        colorPreview.style.backgroundColor = hexColor;

        const rgb = this.hexToRgb(hexColor);
        const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);

        hexValue.textContent = hexColor.toUpperCase();
        rgbValue.textContent = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
        hslValue.textContent = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
    }

    generateColorSuggestions(hexColor) {
        const suggestionsSection = document.getElementById('colorSuggestions');
        suggestionsSection.classList.remove('hidden');

        const hsl = this.hexToHsl(hexColor);
        
        this.renderColorPalette('complementaryColors', this.getComplementaryColors(hsl));
        this.renderColorPalette('analogousColors', this.getAnalogousColors(hsl));
        this.renderColorPalette('triadicColors', this.getTriadicColors(hsl));
        this.renderColorPalette('splitComplementaryColors', this.getSplitComplementaryColors(hsl));
    }

    renderColorPalette(containerId, colors) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';

        colors.forEach(color => {
            const colorDiv = document.createElement('div');
            colorDiv.className = 'palette-color';
            colorDiv.style.backgroundColor = color;
            colorDiv.dataset.color = color;
            colorDiv.title = color;
            container.appendChild(colorDiv);
        });
    }

    getComplementaryColors(hsl) {
        const complementaryHue = (hsl.h + 180) % 360;
        return [
            this.hslToHex({h: complementaryHue, s: hsl.s, l: hsl.l}),
            this.hslToHex({h: complementaryHue, s: Math.max(hsl.s - 20, 0), l: hsl.l}),
            this.hslToHex({h: complementaryHue, s: Math.min(hsl.s + 20, 100), l: hsl.l}),
            this.hslToHex({h: complementaryHue, s: hsl.s, l: Math.max(hsl.l - 20, 0)}),
            this.hslToHex({h: complementaryHue, s: hsl.s, l: Math.min(hsl.l + 20, 100)})
        ];
    }

    getAnalogousColors(hsl) {
        return [
            this.hslToHex({h: (hsl.h - 30 + 360) % 360, s: hsl.s, l: hsl.l}),
            this.hslToHex({h: (hsl.h - 15 + 360) % 360, s: hsl.s, l: hsl.l}),
            this.hslToHex({h: hsl.h, s: hsl.s, l: hsl.l}),
            this.hslToHex({h: (hsl.h + 15) % 360, s: hsl.s, l: hsl.l}),
            this.hslToHex({h: (hsl.h + 30) % 360, s: hsl.s, l: hsl.l})
        ];
    }

    getTriadicColors(hsl) {
        return [
            this.hslToHex({h: hsl.h, s: hsl.s, l: hsl.l}),
            this.hslToHex({h: (hsl.h + 120) % 360, s: hsl.s, l: hsl.l}),
            this.hslToHex({h: (hsl.h + 240) % 360, s: hsl.s, l: hsl.l}),
            this.hslToHex({h: (hsl.h + 120) % 360, s: Math.max(hsl.s - 20, 0), l: hsl.l}),
            this.hslToHex({h: (hsl.h + 240) % 360, s: Math.max(hsl.s - 20, 0), l: hsl.l})
        ];
    }

    getSplitComplementaryColors(hsl) {
        const comp1 = (hsl.h + 150) % 360;
        const comp2 = (hsl.h + 210) % 360;
        return [
            this.hslToHex({h: hsl.h, s: hsl.s, l: hsl.l}),
            this.hslToHex({h: comp1, s: hsl.s, l: hsl.l}),
            this.hslToHex({h: comp2, s: hsl.s, l: hsl.l}),
            this.hslToHex({h: comp1, s: Math.max(hsl.s - 20, 0), l: hsl.l}),
            this.hslToHex({h: comp2, s: Math.max(hsl.s - 20, 0), l: hsl.l})
        ];
    }

    addToHistory(color) {
        if (!this.colorHistory.includes(color)) {
            this.colorHistory.unshift(color);
            if (this.colorHistory.length > 20) {
                this.colorHistory = this.colorHistory.slice(0, 20);
            }
            this.saveColorHistory();
            this.renderColorHistory();
        }
    }

    renderColorHistory() {
        const historyList = document.getElementById('historyList');
        historyList.innerHTML = '';

        this.colorHistory.forEach(color => {
            const colorDiv = document.createElement('div');
            colorDiv.className = 'history-color';
            colorDiv.style.backgroundColor = color;
            colorDiv.dataset.color = color;
            colorDiv.title = color;
            historyList.appendChild(colorDiv);
        });
    }

    clearHistory() {
        this.colorHistory = [];
        this.saveColorHistory();
        this.renderColorHistory();
        this.showToast('歷史記錄已清除');
    }

    loadColorHistory() {
        const stored = localStorage.getItem('colorPickerHistory');
        return stored ? JSON.parse(stored) : [];
    }

    saveColorHistory() {
        localStorage.setItem('colorPickerHistory', JSON.stringify(this.colorHistory));
    }

    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showToast(`已複製: ${text}`);
            
            const colorValues = document.querySelectorAll('.color-value');
            colorValues.forEach(el => {
                if (el.textContent === text) {
                    el.classList.add('copied');
                    setTimeout(() => el.classList.remove('copied'), 1000);
                }
            });
        } catch (error) {
            console.error('複製失敗:', error);
            this.showToast('複製失敗', 'error');
        }
    }

    showToast(message, type = 'success') {
        const existingToast = document.querySelector('.toast');
        if (existingToast) {
            existingToast.remove();
        }

        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.style.background = type === 'error' ? '#dc3545' : '#28a745';
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 100);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    rgbToHex(rgb) {
        if (typeof rgb === 'string') {
            const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
            if (match) {
                const r = parseInt(match[1]);
                const g = parseInt(match[2]);
                const b = parseInt(match[3]);
                return "#" + [r, g, b].map(x => {
                    const hex = x.toString(16);
                    return hex.length === 1 ? "0" + hex : hex;
                }).join("");
            }
        }
        return rgb;
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

    hexToHsl(hex) {
        const rgb = this.hexToRgb(hex);
        return this.rgbToHsl(rgb.r, rgb.g, rgb.b);
    }

    hslToHex(hsl) {
        const h = hsl.h / 360;
        const s = hsl.s / 100;
        const l = hsl.l / 100;

        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };

        let r, g, b;

        if (s === 0) {
            r = g = b = l;
        } else {
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }

        const toHex = (c) => {
            const hex = Math.round(c * 255).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };

        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ColorPickerPopup();
});