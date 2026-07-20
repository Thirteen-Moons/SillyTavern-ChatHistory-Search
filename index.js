const LS_KEY = 'historySearchTruncation';

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
/* =========================
   窗口缩放
========================= */
function getHistoryScale() {
    return JSON.parse(localStorage.getItem('historySearchScale') || '{"size":1}');
}
function saveHistoryScale(v) { localStorage.setItem('historySearchScale', JSON.stringify(v)); }
function applyHistoryScale(panel) {
    let s = getHistoryScale();
    panel.style.setProperty('--hs-scale', s.size);
}

/* =========================
   魔棒菜单注入
========================= */
function injectWandMenu() {
    const tryInject = () => {
        const $menu = $('#extensionsMenu');
        if ($menu.length === 0) return false;
        if ($menu.find('#history-search-menu-item').length > 0) return true;

        const $item = $(`
            <div class="list-group-item flex-container flexGap5 interactable" id="history-search-menu-item">
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
    const existing = document.querySelector('#history-toolbar');
    if (existing) {
        existing.remove();
        return;
    }
    createToolbar();
}

function createToolbar() {
    const toolbar = document.createElement('div');
    toolbar.id = 'history-toolbar';
    toolbar.innerHTML = `
        <button id="ht-search" class="menu_button" title="搜索聊天记录"><i class="fa-solid fa-search fa-flip-horizontal"></i></button>
        <button id="ht-top" class="menu_button" title="跳转至聊天顶部（顶部取决于你设置加载了多少条消息）"><i class="fa-solid fa-arrow-up"></i></button>
        <button id="ht-latest" class="menu_button" title="跳转至最后一条消息开头"><i class="fa-solid fa-arrow-up-from-bracket fa-flip-vertical"></i></button>
        <button id="ht-bottom" class="menu_button" title="回到底部最新消息末尾"><i class="fa-solid fa-arrow-down"></i></button>
    `;
    document.body.appendChild(toolbar);

    // 点击外部关闭
    setTimeout(() => {
        const closeToolbar = (e) => {
            if (!toolbar.contains(e.target) && !e.target.closest('#history-search-menu-item')) {
                toolbar.remove();
                document.removeEventListener('click', closeToolbar);
            }
        };
        document.addEventListener('click', closeToolbar);
    }, 0);

    toolbar.querySelector('#ht-search').onclick = () => {
        toolbar.remove();
        openHistoryPanel();
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
    toolbar.querySelector('#ht-latest').onclick = async () => {
        let chatArr = SillyTavern.getContext().chat;
        if (!chatArr || chatArr.length === 0) return;
        let lastId = chatArr.length - 1;
        let target = document.querySelector('.mes[mesid="' + lastId + '"]');
        if (target) {
            target.scrollIntoView({ behavior: "smooth", block: "start" });
        } else {
            let chat = document.querySelector("#chat");
            if (chat) chat.scrollTop = chat.scrollHeight;
        }
        await restoreLimitation();
        toolbar.remove();
    };
}
/* =========================
   搜索面板
========================= */
function openHistoryPanel() {
    updateMarkColor();
    let old = document.querySelector("#history-search-panel");
    if (old) { old.remove(); return; }

    let total = 0;
    try { total = SillyTavern.getContext().chat.length; } catch (e) {}

    let panel = document.createElement("div");
    panel.id = "history-search-panel";

    let s = getHistoryScale();

    panel.innerHTML = `
        <div class="history-header">
            <span><i class="fa-solid fa-search fa-flip-horizontal" style="margin-right:6px;"></i>聊天记录搜索</span>
            <button id="history-close">&times;</button>
        </div>
        
        <div class="history-scale-inline">
            <label>窗口大小:</label>
            <input type="range" id="slider-size" min="0.7" max="1.8" step="0.05" value="${s.size}">
            <span id="val-size">${s.size}</span>
        </div>

        <div class="history-total">当前对话：共0 ~ ${total > 0 ? total - 1 : 0}楼，跳转早期楼层需等待加载片刻</div>
        
        <div class="history-input-box">
            <input id="history-jump-input" type="number" placeholder="输入指定楼层 (如: 13)">
            <button id="history-jump-btn">跳转</button>
        </div>

        <div class="history-input-box">
            <input id="history-keyword" placeholder="输入关键词">
            <button id="history-search-start">搜索</button>
        </div>
        <div id="history-result">待搜索...</div>
    `;

    document.body.appendChild(panel);
    applyHistoryScale(panel);

    // 窗口缩放滑块
    let sliderSize = panel.querySelector("#slider-size");
    let valSize = panel.querySelector("#val-size");
    sliderSize.oninput = () => {
        let x = getHistoryScale();
        x.size = Number(sliderSize.value);
        valSize.textContent = x.size.toFixed(2);
        saveHistoryScale(x);
        applyHistoryScale(panel);
    };

    panel.querySelector("#history-close").onclick = () => { panel.remove(); };
    panel.querySelector("#history-search-start").onclick = () => { searchHistory(); };
    
    panel.querySelector("#history-keyword").addEventListener("keypress", function(e) {
        if (e.key === "Enter") searchHistory();
    });

    panel.querySelector("#history-jump-btn").onclick = () => { 
        let floor = panel.querySelector("#history-jump-input").value;
        if (floor !== "") {
            executeJump(Number(floor));
        }
    };
    panel.querySelector("#history-jump-input").addEventListener("keypress", function(e) {
        if (e.key === "Enter") {
            let floor = this.value;
            if (floor !== "") executeJump(Number(floor));
        }
    });
}

function escapeHtml(str) {
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeReg(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightText(text, key) {
    let safe = escapeHtml(text);
    let reg = new RegExp(escapeReg(key), "gi");
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
        document.documentElement.style.setProperty('--history-mark-bg', `rgb(${nr}, ${ng}, ${nb})`);
    } catch (e) {
        document.documentElement.style.setProperty('--history-mark-bg', '#ffd54a');
    }
}

async function executeJump(id, visualItem = null) {
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
            setSavedTruncation(currentLimit);
            
            $truncationInput.val(0).trigger('input');
            await new Promise(r => setTimeout(r, 300)); 
            
            await context.reloadCurrentChat();
            await new Promise(r => setTimeout(r, 1000)); 
            
            target = document.querySelector(`.mes[mesid="${id}"]`);
            
            if (target) {
                toastr.info('已临时加载全部消息，后续请使用「回底」恢复加载限制', '', { timeOut: 5000 });
            }
        }
        
        if (!target) {
            let showMore = document.querySelector('#show_more_messages');
            let maxClicks = 30;
            if (visualItem) visualItem.style.opacity = "0.5";
            
            while (!target && showMore && showMore.offsetParent !== null && maxClicks > 0) {
                showMore.click();
                await new Promise(r => setTimeout(r, 800));
                target = document.querySelector(`.mes[mesid="${id}"]`);
                showMore = document.querySelector('#show_more_messages');
                maxClicks--;
            }            
            if (visualItem) visualItem.style.opacity = "1";
        }
    }

    if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        
        const markColor = getComputedStyle(document.documentElement).getPropertyValue('--history-mark-bg').trim() || '#ff9800';
        target.style.transition = "outline 0.3s ease";
        target.style.outline = `3px solid ${markColor}`; 
        target.style.outlineOffset = "2px";
        target.style.borderRadius = "8px";
        setTimeout(() => { 
            target.style.outline = "transparent"; 
            target.style.outlineOffset = "0px";
            target.style.borderRadius = "";
        }, 2500);
    } else {
        toastr.error(`搜索超时：第 ${id} 楼的记录过于早期，请手动向上滚动加载更多记录后重试。`);
    }
}

function searchHistory() {
    let input = document.querySelector("#history-keyword");
    let key = input.value.trim();
    let result = document.querySelector("#history-result");

    if (!key) {
        result.innerHTML = "请输入关键词";
        return;
    }

    let chat = SillyTavern.getContext().chat;
    let found = [];

    chat.forEach((msg, index) => {
        let text = msg.mes || "";
        if (text.toLowerCase().includes(key.toLowerCase())) {
            found.push({ index: index, name: msg.name || "未知", text: text });
        }
    });

    if (found.length === 0) {
        result.innerHTML = "未搜索到：" + key;
        return;
    }

    result.innerHTML = `
        <div class="history-count">搜索到 ${found.length} 条消息</div>
    ` + found.map((item) => {
        return `
            <div class="history-item" data-id="${item.index}">
                <div class="history-number">${item.index} 楼</div>
                <div class="history-name">${escapeHtml(item.name)}</div>
                <div class="history-message">${highlightText(item.text, key)}</div>
                <button class="history-copy">复制楼层</button>
            </div>
        `;
    }).join("");

    document.querySelectorAll(".history-copy").forEach((btn) => {
        btn.onclick = (e) => {
            e.stopPropagation();
            let id = Number(btn.parentElement.dataset.id);
            let msg = chat[id];
            if (msg) {
                navigator.clipboard.writeText(msg.mes || "");
                btn.innerText = "已复制";
                setTimeout(() => { btn.innerText = "复制楼层"; }, 1500);
            }
        };
    });

    document.querySelectorAll(".history-item").forEach(item => {
        item.onclick = () => {
            let id = item.dataset.id;
            executeJump(id, item);
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
    setTimeout(injectWandMenu, 2000);
    
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
})();
