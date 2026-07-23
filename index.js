// Copyright (c) 2026 Thirteen-Moons
// Licensed under AGPL-3.0; see LICENSE for full terms
// Derivative works must retain attribution to Thirteen-Moons

const LS_KEY = 'chatSearchTruncation';

function getSavedTruncation() {
    try {
        const raw = localStorage.getItem(LS_KEY);
        return raw ? Number(raw) : 0;
    } catch (e) {
        return 0;
    }
}

function setSavedTruncation(val) {
    try {
        if (val > 0) {
            localStorage.setItem(LS_KEY, String(val));
        } else {
            localStorage.removeItem(LS_KEY);
        }
    } catch (e) {}
}

async function restoreLimitation() {
    const saved = getSavedTruncation();
    if (saved > 0) {
        const $input = $('#chat_truncation');
        if ($input.length) {
            $input.val(saved).trigger('input');
            setSavedTruncation(0);
            
            const context = SillyTavern.getContext();
            if (context.reloadCurrentChat) {
                await context.reloadCurrentChat();
                toastr.info('已恢复消息加载限制', '', { timeOut: 3000 });
            }
        } else {
            setSavedTruncation(0);
        }
    }
}

async function copyToClipboard(text) {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch (e) {}
    
    try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;inset:0;opacity:0;pointer-events:none;z-index:-1;';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
    } catch (e) {
        return false;
    }
}

/* =========================
   魔棒菜单注入
========================= */
function injectWandMenu() {
    const tryInject = () => {
        const $menu = $('#extensionsMenu');
        if ($menu.length === 0) return false;
        if ($menu.find('#chat-search-menu-item').length > 0) return true;

        const $item = $(`
            <div class="list-group-item flex-container flexGap5 interactable" id="chat-search-menu-item">
                <div class="fa-solid fa-search fa-flip-horizontal fa-fw extensions-icon" style="width:20px;height:20px;display:flex;align-items:center;justify-content:center;flex-shrink:0;"></div>
                聊天记录搜索
            </div>
        `);
        $item.on('click', () => {
            toggleToolbar();
        });
        $menu.append($item);
        return true;
    };

    if (!tryInject()) {
        const interval = setInterval(() => {
            if (tryInject()) clearInterval(interval);
        }, 1000);
        setTimeout(() => clearInterval(interval), 30000);
    }
}

/* =========================
   横条工具栏
========================= */
function toggleToolbar() {
    const existing = document.querySelector('#chat-search-toolbar');
    if (existing) {
        existing.remove();
        return;
    }
    createToolbar();
}

function createToolbar() {
    const toolbar = document.createElement('div');
    toolbar.id = 'chat-search-toolbar';
    toolbar.innerHTML = `
        <button id="ht-search" class="menu_button" title="搜索聊天记录"><i class="fa-solid fa-search fa-flip-horizontal"></i></button>
        <button id="ht-top" class="menu_button" title="跳转至聊天顶部（顶部取决于你设置加载了多少条消息）"><i class="fa-solid fa-arrow-up"></i></button>
        <button id="ht-bottom" class="menu_button" title="回到底部最新消息末尾"><i class="fa-solid fa-arrow-down"></i></button>
    `;
    document.body.appendChild(toolbar);

    setTimeout(() => {
        const closeToolbar = (e) => {
            if (!toolbar.contains(e.target) && !e.target.closest('#chat-search-menu-item')) {
                toolbar.remove();
                document.removeEventListener('click', closeToolbar);
            }
        };
        document.addEventListener('click', closeToolbar);
    }, 0);

    toolbar.querySelector('#ht-search').onclick = () => {
        toolbar.remove();
        openSearchPanel();
    };
    toolbar.querySelector('#ht-top').onclick = () => {
        let chat = document.querySelector("#chat");
        if (chat) chat.scrollTop = 0;
        toolbar.remove();
    };
    toolbar.querySelector('#ht-bottom').onclick = async () => {
        let chat = document.querySelector("#chat");
        if (chat) chat.scrollTop = chat.scrollHeight;
        await restoreLimitation();
        toolbar.remove();
    };
}

/* =========================
   搜索面板
========================= */
function openSearchPanel() {
    updateMarkColor();
    let old = document.querySelector("#chat-search-panel");
    if (old) { old.remove(); return; }

    let total = 0;
    try { total = SillyTavern.getContext().chat.length; } catch (e) {}

    let panel = document.createElement("div");
    panel.id = "chat-search-panel";

    panel.innerHTML = `
        <div class="search-header">
            <span><i class="fa-solid fa-search fa-flip-horizontal" style="margin-right:6px;"></i>聊天记录搜索</span>
            <button id="search-close">&times;</button>
        </div>
        
        <div class="search-divider"></div>

        <div class="search-total">当前对话：共0 ~ ${total > 0 ? total - 1 : 0}楼，跳转早期楼层需等待加载片刻</div>
        
        <div class="search-input-row">
            <input id="search-jump-input" type="number" placeholder="输入指定楼层 (如: 13)">
            <button id="search-jump-btn">跳转</button>
        </div>

        <div class="search-input-row">
            <input id="search-keyword" placeholder="输入关键词">
            <button id="search-start-btn">搜索</button>
        </div>
    `;

    document.body.appendChild(panel);

    panel.querySelector("#search-close").onclick = () => { panel.remove(); };
    panel.querySelector("#search-start-btn").onclick = () => { performSearch(); };
    
    panel.querySelector("#search-keyword").addEventListener("keypress", function(e) {
        if (e.key === "Enter") performSearch();
    });

    panel.querySelector("#search-jump-btn").onclick = () => { 
        let floor = panel.querySelector("#search-jump-input").value;
        if (floor !== "") {
            jumpToFloor(Number(floor));
        }
    };
    panel.querySelector("#search-jump-input").addEventListener("keypress", function(e) {
        if (e.key === "Enter") {
            let floor = this.value;
            if (floor !== "") jumpToFloor(Number(floor));
        }
    });
}

function sanitizeHtml(str) {
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function markKeywords(text, keys) {
    let safe = sanitizeHtml(text);
    if (!Array.isArray(keys)) keys = [keys];
    keys = keys.filter(k => k.length > 0);
    if (keys.length === 0) return safe;
    let reg = new RegExp('(' + keys.map(escapeRegex).join('|') + ')', 'gi');
    return safe.replace(reg, "<mark>$&</mark>");
}

function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    } else {
        h = s = 0;
    }
    return [h * 360, s * 100, l * 100];
}

function hslToRgb(h, s, l) {
    h /= 360; s /= 100; l /= 100;
    let r, g, b;
    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function updateMarkColor() {
    try {
        const root = getComputedStyle(document.documentElement);
        let bg = root.getPropertyValue('--SmartThemeBlurTintColor').trim();
        if (!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') {
            bg = getComputedStyle(document.body).backgroundColor;
        }
        const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (!m) return;
        const r = parseInt(m[1]), g = parseInt(m[2]), b = parseInt(m[3]);
        const [h] = rgbToHsl(r, g, b);
        const newH = (h + 180) % 360;
        const [nr, ng, nb] = hslToRgb(newH, 85, 64);
        document.documentElement.style.setProperty('--chat-search-mark-bg', `rgb(${nr}, ${ng}, ${nb})`);
    } catch (e) {
        document.documentElement.style.setProperty('--chat-search-mark-bg', '#ffd54a');
    }
}

async function jumpToFloor(id, visualItem = null) {
    id = Number(id);
    let total = 0;
    try { total = SillyTavern.getContext().chat.length; } catch (e) {}
    
    if (id < 0 || id >= total) {
        toastr.error(`楼层输入错误，当前仅有 0 到 ${total > 0 ? total - 1 : 0} 楼。`);
        return;
    }

    let chatDOM = document.querySelector("#chat");
    if (!chatDOM) return;

    let target = document.querySelector(`.mes[mesid="${id}"]`);    
    if (!target) {
        const context = SillyTavern.getContext();
        
        const $truncationInput = $('#chat_truncation');
        let currentLimit = 0;
        if ($truncationInput.length) {
            currentLimit = Number($truncationInput.val()) || 0;
        }
        
        if (currentLimit > 0 && context.reloadCurrentChat) {
            if (getSavedTruncation() === 0) {
                setSavedTruncation(currentLimit);
            }
            
            let needLoad = (total - id) + 5;
            let tempLimit = needLoad >= total ? 0 : needLoad;
            
            $truncationInput.val(tempLimit).trigger('input');
            await new Promise(r => setTimeout(r, 300)); 
            
            await context.reloadCurrentChat();
            
            let pollCount = 0;
            while (!target && pollCount < 30) {
                await new Promise(r => setTimeout(r, 100));
                target = document.querySelector(`.mes[mesid="${id}"]`);
                pollCount++;
            }
            
            if (target) {
                if (tempLimit === 0) {
                    toastr.info('已临时加载全部消息，后续请使用「回底」恢复加载限制', '', { timeOut: 5000 });
                } else {
                    toastr.info(`已临时加载 ${needLoad} 条消息，后续请使用「回底」恢复加载限制`, '', { timeOut: 5000 });
                }
            }
        }
    }

    if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        
        const markColor = getComputedStyle(document.documentElement).getPropertyValue('--chat-search-mark-bg').trim() || '#ffd54a';
        target.style.transition = "background-color 0.3s ease, color 0.3s ease";
        target.style.backgroundColor = markColor;
        target.style.color = "#000";
        setTimeout(() => { 
            target.style.backgroundColor = "";
            target.style.color = "";
        }, 2500);
        
        document.querySelector("#chat-search-panel")?.remove();
        document.querySelector("#search-results-panel")?.remove();
        document.querySelector("#message-preview-panel")?.remove();
    } else {
        toastr.error(`搜索超时：第 ${id} 楼的记录过于早期，请向上滚动加载更多记录后重试。`);
    }
}

function performSearch() {
    let input = document.querySelector("#search-keyword");
    let rawKey = input.value.trim();
    
    if (!rawKey) {
        toastr.error("请输入关键词");
        return;
    }
    
    let keys = rawKey.split(/\s+/).filter(k => k.length > 0);
    if (keys.length === 0) {
        toastr.error("请输入关键词");
        return;
    }
    
    let chat = SillyTavern.getContext().chat;
    let found = [];
    
    chat.forEach((msg, index) => {
        let text = msg.mes || "";
        let lowerText = text.toLowerCase();
        if (keys.every(k => lowerText.includes(k.toLowerCase()))) {
            found.push({ index: index, name: msg.name || "未知", text: text });
        }
    });
    
    if (found.length === 0) {
        toastr.info("未搜索到：" + rawKey);
        return;
    }
    
    openSearchResults(found, keys, rawKey);
}

function openSearchResults(found, keys, rawKey) {
    const searchPanel = document.querySelector("#chat-search-panel");
    if (searchPanel) searchPanel.style.display = 'none';
    
    let old = document.querySelector("#search-results-panel");
    if (old) old.remove();
    
    let panel = document.createElement("div");
    panel.id = "search-results-panel";
    
    panel.innerHTML = `
        <div class="results-header">
            <button class="results-back" title="返回搜索面板">&lt;</button>
            <div class="results-title-group">
                <span class="results-title">搜索到 ${found.length} 条消息</span>
                <span class="results-hint">点击消息内容可跳转至该楼层</span>
            </div>
            <button class="results-close" title="关闭">&times;</button>
        </div>
        <div class="results-content">
            ${found.map((item) => `
                <div class="results-item" data-id="${item.index}">
                    <div class="results-item-header">
                        <div class="results-meta">
                            <div class="results-number">${item.index} 楼</div>
                            <div class="results-name">${sanitizeHtml(item.name)}</div>
                        </div>
                        <div class="results-actions">
                            <button class="results-copy">复制</button>
                            <button class="results-preview">预览相邻楼层</button>
                        </div>
                    </div>
                    <div class="results-message">${markKeywords(item.text, keys)}</div>
                </div>
            `).join("")}
        </div>
    `;
    
    document.body.appendChild(panel);
    
    panel.querySelector(".results-back").onclick = () => {
        panel.remove();
        if (searchPanel) searchPanel.style.display = '';
    };
    
    panel.querySelector(".results-close").onclick = () => {
        panel.remove();
        searchPanel?.remove();
    };
    
    panel.querySelectorAll(".results-copy").forEach((btn) => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            let id = Number(btn.closest('.results-item').dataset.id);
            let chat = SillyTavern.getContext().chat;
            let msg = chat[id];
            if (msg) {
                const success = await copyToClipboard(msg.mes || "");
                btn.innerText = success ? "已复制" : "失败";
                setTimeout(() => { btn.innerText = "复制"; }, 1500);
            }
        };
    });
    
    panel.querySelectorAll(".results-preview").forEach((btn) => {
        btn.onclick = (e) => {
            e.stopPropagation();
            let id = Number(btn.closest('.results-item').dataset.id);
            panel.style.display = 'none';
            openMessagePreview(id, panel);
        };
    });
    
    panel.querySelectorAll(".results-item").forEach(item => {
        item.onclick = (e) => {
            if (e.target.closest('button')) return;
            let id = item.dataset.id;
            jumpToFloor(id, item);
        };
    });
}

function openMessagePreview(centerId, parentPanel = null) {
    let old = document.querySelector("#message-preview-panel");
    if (old) old.remove();

    let chat = SillyTavern.getContext().chat;
    if (!chat || chat.length === 0) return;

    let start = Math.max(0, centerId - 2);
    let end = Math.min(chat.length - 1, centerId + 2);

    let panel = document.createElement("div");
    panel.id = "message-preview-panel";

    let html = `
        <div class="preview-header">
            <button class="preview-back" title="返回">&lt;</button>
            <span>预览 ${start} ~ ${end} 楼</span>
            <button class="preview-close" title="关闭">&times;</button>
        </div>
        <div class="preview-content">
    `;

    for (let i = start; i <= end; i++) {
        let msg = chat[i];
        html += `
            <div class="preview-item" data-index="${i}">
                <div class="preview-item-header">
                    <div class="preview-number">${i} 楼</div>
                    <button class="preview-copy" title="复制该消息"><i class="fa-regular fa-copy"></i></button>
                </div>
                <div class="preview-name">${sanitizeHtml(msg.name || "未知")}</div>
                <div class="preview-message">${sanitizeHtml(msg.mes || "")}</div>
            </div>
        `;
    }

    html += `</div>`;
    panel.innerHTML = html;
    document.body.appendChild(panel);

    panel.querySelector(".preview-back").onclick = () => {
        panel.remove();
        if (parentPanel) {
            parentPanel.style.display = '';
        }
    };

    panel.querySelector(".preview-close").onclick = () => {
        panel.remove();
        document.querySelector("#chat-search-panel")?.remove();
        document.querySelector("#search-results-panel")?.remove();
    };

    panel.querySelectorAll(".preview-copy").forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            let idx = Number(btn.closest('.preview-item').dataset.index);
            let msg = chat[idx];
            if (msg) {
                const success = await copyToClipboard(msg.mes || "");
                let original = btn.innerHTML;
                btn.innerHTML = success ? '<i class="fa-solid fa-check"></i>' : '<i class="fa-solid fa-xmark"></i>';
                setTimeout(() => { btn.innerHTML = original; }, 1500);
            }
        };
    });
}

/* =========================
   初始化
========================= */
(function initExtension() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            injectWandMenu();
        });
    } else {
        injectWandMenu();
    }
    
    setTimeout(() => {
        const saved = getSavedTruncation();
        if (saved > 0) {
            const $input = $('#chat_truncation');
            const current = $input.length ? Number($input.val()) || 0 : 0;
            if (current === 0) {
                $input.val(saved).trigger('input');
                setSavedTruncation(0);
            } else {
                setSavedTruncation(0);
            }
        }
    }, 3000);
    
    if (window.visualViewport) {
        const handleViewport = () => {
            const panels = document.querySelectorAll('#chat-search-panel, #search-results-panel, #message-preview-panel');
            if (panels.length === 0) return;            
            const keyboardHeight = window.innerHeight - window.visualViewport.height;
            const isMobile = window.innerWidth <= 600;
            panels.forEach(p => p.classList.toggle('keyboard-open', isMobile && keyboardHeight > 100));
        };
        window.visualViewport.addEventListener('resize', handleViewport);
    }
})();
