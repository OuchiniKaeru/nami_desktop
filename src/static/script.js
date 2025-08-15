// ========================================
// GLOBAL VARIABLES & INITIALIZATION
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    // DOM要素の取得
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const newChatBtn = document.getElementById('new-chat-btn');
    const searchChatInput = document.getElementById('search-chat-input');
    const chatHistoryList = document.getElementById('chat-history-list');
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const settingsForm = document.getElementById('settings-form');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const memoryModal = document.getElementById('memories-modal')
    const memoryBtn = document.getElementById('memory-btn');
    const memoryList = document.getElementById('memory-list');
    const deleteAllMemoriesBtn = document.getElementById('all-delete-btn')
    const uploadedFilesPreview = document.getElementById('uploaded-files-preview');
    const closeButtons = document.querySelectorAll('.modal .close-button');
    const mcpBtn = document.getElementById('mcp-btn');
    const mcpModal = document.getElementById('mcp-modal');
    const mcpList = document.getElementById('mcp-list');
    const mcpStatusEl = document.getElementById('mcp-status');
    const mcpReloadBtn = document.getElementById('mcp-reload-btn');
    const editSettingsJsonBtn = document.getElementById('edit-settings-json-btn');
    const chatWindow = document.getElementById('chat-window');
    const chatContainer = document.getElementById('chat-container');
    const scrollToBottomBtn = document.getElementById('scroll-to-bottom-btn');
    const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const stopBtn = document.getElementById('stop-btn');
    const fileUploadBtn = document.getElementById('file-upload-btn');
    const fileInput = document.getElementById('file-input');
    const atBtn = document.getElementById('at-btn');
    const templateSuggestions = document.getElementById('template-suggestions');
    const systemPromptBtn = document.getElementById('system-prompt-btn');
    const rulesModal = document.getElementById('rules-modal');
    const rulesList = document.getElementById('rules-list');
    const saveRulesBtn = document.getElementById('save-rules-btn');
    const addRuleBtn = document.getElementById('add-rule-btn');
    const modelSelect = document.getElementById('model-select');

    // グローバル状態変数
    let sessionId = localStorage.getItem('sessionId') || generateSessionId();
    localStorage.setItem('sessionId', sessionId);
    console.log(`initial: ${sessionId}`)

    let isUserScrolling = false;
    let lastScrollTop = 0;
    let isLoadingMessages = false;
    let highlightedIndex = -1;
    let scrollEventTimer = null;
    let uploadedFiles = []; // { id: uniqueId, file: File } の形式で保持

    // ========================================
    // UTILITY FUNCTIONS
    // ========================================

    function generateSessionId() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0,
                v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    function generateUniqueId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function decodeUnicodeForDisplay(input) {
        if (typeof input !== 'string') return input;
        try {
            const wrapped = `"${input.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
            return JSON.parse(wrapped);
        } catch (e) {
            const unescaped = input
                .replace(/\\n/g, '\n')
                .replace(/\\r/g, '\r')
                .replace(/\\t/g, '\t');
            return unescaped.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
                String.fromCharCode(parseInt(hex, 16))
            );
        }
    }

    async function fetchSettings() {
        try {
            const res = await fetch('/settings');
            if (!res.ok) throw new Error('Failed to fetch settings');
            return await res.json();
        } catch (err) {
            console.error('Error fetching settings:', err);
            return {};
        }
    }

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 4px;
            color: white;
            font-weight: 500;
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        
        switch(type) {
            case 'success':
                toast.style.backgroundColor = '#4CAF50';
                break;
            case 'error':
                toast.style.backgroundColor = '#f44336';
                break;
            case 'info':
            default:
                toast.style.backgroundColor = '#2196F3';
                break;
        }
        
        document.body.appendChild(toast);
        
        setTimeout(() => { toast.style.opacity = '1'; }, 100);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }

    // ========================================
    // FILE HANDLING
    // ========================================

    function getFileIconClass(fileType) {
        if (fileType.startsWith('image/')) return 'fas fa-image';
        if (fileType.startsWith('video/')) return 'fas fa-video';
        if (fileType.startsWith('audio/')) return 'fas fa-music';
        if (fileType === 'application/pdf') return 'fas fa-file-pdf';
        if (fileType === 'application/msword' || fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'fas fa-file-word';
        if (fileType === 'application/vnd.ms-excel' || fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return 'fas fa-file-excel';
        if (fileType === 'application/vnd.ms-powerpoint' || fileType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') return 'fas fa-file-powerpoint';
        if (fileType === 'application/zip' || fileType === 'application/x-rar-compressed') return 'fas fa-file-archive';
        if (fileType === 'text/plain') return 'fas fa-file-alt';
        if (fileType === 'application/json' || fileType === 'application/xml' || fileType.startsWith('text/')) return 'fas fa-file-code';
        return 'fas fa-file';
    }

    function truncateFileName(fileName, maxLength) {
        if (fileName.length <= maxLength) return fileName;
        const extensionIndex = fileName.lastIndexOf('.');
        if (extensionIndex === -1 || fileName.length - extensionIndex > 5) {
            return fileName.substring(0, maxLength - 3) + '...';
        }
        const name = fileName.substring(0, extensionIndex);
        const ext = fileName.substring(extensionIndex);
        const charsToShow = maxLength - ext.length - 3;
        if (charsToShow <= 0) return '...' + ext;
        return name.substring(0, charsToShow) + '...' + ext;
    }

    function generateUniqueFileName(file) {
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 8);
        
        const originalName = file.name || 'pasted_file';
        const lastDotIndex = originalName.lastIndexOf('.');
        
        let extension = '';
        let baseName = originalName;
        
        if (lastDotIndex !== -1) {
            extension = originalName.substring(lastDotIndex);
            baseName = originalName.substring(0, lastDotIndex);
        } else {
            if (file.type) {
                const typeMap = {
                    'image/png': '.png',
                    'image/jpeg': '.jpg',
                    'image/gif': '.gif',
                    'image/bmp': '.bmp',
                    'image/webp': '.webp',
                    'text/plain': '.txt',
                    'application/pdf': '.pdf'
                };
                extension = typeMap[file.type] || '';
            }
        }
        
        if (file.type && file.type.startsWith('image/') && (originalName === 'image.png' || originalName === 'pasted_file')) {
            baseName = 'pasted_image';
        }
        
        return `${baseName}_${timestamp}_${randomStr}${extension}`;
    }

    function renderUploadedFiles() {
        uploadedFilesPreview.innerHTML = '';
        if (uploadedFiles.length > 0) {
            uploadedFilesPreview.style.display = 'flex';
        } else {
            uploadedFilesPreview.style.display = 'none';
        }

        uploadedFiles.forEach(item => {
            const file = item.file;
            const fileItem = document.createElement('div');
            fileItem.className = 'uploaded-file-item';
            fileItem.dataset.fileId = item.id;

            const fileIcon = document.createElement('i');
            fileIcon.className = getFileIconClass(file.type);
            fileIcon.classList.add('file-icon');
            fileItem.appendChild(fileIcon);

            const fileNameSpan = document.createElement('span');
            fileNameSpan.className = 'file-name';
            fileNameSpan.textContent = truncateFileName(file.name, 15);
            fileItem.appendChild(fileNameSpan);

            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-file-btn';
            removeBtn.innerHTML = '&times;';
            removeBtn.title = 'ファイルを削除';
            removeBtn.addEventListener('click', () => {
                removeFile(item.id);
            });
            fileItem.appendChild(removeBtn);

            uploadedFilesPreview.appendChild(fileItem);
        });
    }

    function removeFile(fileIdToRemove) {
        uploadedFiles = uploadedFiles.filter(item => item.id !== fileIdToRemove);
        renderUploadedFiles();
        adjustChatAreaLayout();
    }

    function handleFiles(files) {
        Array.from(files).forEach(file => {
            uploadedFiles.push({ id: generateUniqueId(), file: file });
        });
        renderUploadedFiles();
        showToast(`${files.length} 個のファイルが追加されました`, 'info');
        adjustChatAreaLayout();
    }

    // ========================================
    // UI LAYOUT & TEXTAREA MANAGEMENT
    // ========================================

    function adjustTextareaHeight() {
        messageInput.style.height = 'auto';
        
        const computedStyle = getComputedStyle(messageInput);
        const fontSize = parseFloat(computedStyle.fontSize) || 14;
        const lineHeight = computedStyle.lineHeight === 'normal' ? fontSize * 1.5 : parseFloat(computedStyle.lineHeight) || (fontSize * 1.5);
        const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
        const paddingBottom = parseFloat(computedStyle.paddingBottom) || 0;
        const borderTop = parseFloat(computedStyle.borderTopWidth) || 0;
        const borderBottom = parseFloat(computedStyle.borderBottomWidth) || 0;
        
        const maxHeight = (lineHeight * 5) + paddingTop + paddingBottom + borderTop + borderBottom;
        const minHeight = 40;
        const currentHeight = messageInput.scrollHeight;
        
        if (currentHeight <= maxHeight) {
            messageInput.style.height = Math.max(minHeight, currentHeight) + 'px';
            messageInput.style.overflowY = 'hidden';
            messageInput.classList.remove('scrollable');
        } else {
            messageInput.style.height = maxHeight + 'px';
            messageInput.style.overflowY = 'auto';
            messageInput.classList.add('scrollable');
        }
    }

    function adjustChatAreaLayout() {
        const chatFormHeight = chatForm.offsetHeight;
        const uploadedFilesPreview = document.getElementById('uploaded-files-preview');
        
        if (uploadedFilesPreview && uploadedFiles.length > 0) {
            const bottomPosition = chatFormHeight + 5;
            uploadedFilesPreview.style.bottom = `${bottomPosition}px`;
        }
    }

    // ========================================
    // SCROLL MANAGEMENT
    // ========================================

    function isAtBottom() {
        const threshold = 50;
        const scrollBottom = chatWindow.scrollHeight - chatWindow.clientHeight - chatWindow.scrollTop;
        return scrollBottom <= threshold;
    }

    function scrollToBottom() {
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }

    function updateScrollButtonVisibility() {
        if (isAtBottom()) {
            isUserScrolling = false;
            hideScrollButton();
        } else {
            showScrollButton();
        }
    }

    function showScrollButton() {
        scrollToBottomBtn.style.display = 'block';
        scrollToBottomBtn.classList.add('show');
        scrollToBottomBtn.style.opacity = '1';
        scrollToBottomBtn.style.transform = 'translateY(0)';
    }

    function hideScrollButton() {
        scrollToBottomBtn.classList.remove('show');
        scrollToBottomBtn.style.opacity = '0';
        scrollToBottomBtn.style.transform = 'translateY(10px)';
        setTimeout(() => {
            if (!scrollToBottomBtn.classList.contains('show')) {
                scrollToBottomBtn.style.display = 'none';
            }
        }, 300);
    }

    function handleContentUpdate(isStreaming = false) {
        setTimeout(() => {
            if ((isStreaming && !isUserScrolling) || (!isStreaming && !isUserScrolling) || isLoadingMessages) {
                scrollToBottom();
            }
            updateScrollButtonVisibility();
        }, 100);
    }

    // ========================================
    // TEMPLATE SYSTEM
    // ========================================

    async function loadTemplateJson() {
        try {
            const res = await fetch('/base_dir/.nami/template.json');
            if (!res.ok) throw new Error('template.json load failed');
            const data = await res.json();
            
            templateSuggestions.innerHTML = '';
            templateSuggestions.style.display = 'block';
            
            if (typeof data === 'object' && !Array.isArray(data)) {
                for (const key in data) {
                    const templateItem = document.createElement('div');
                    templateItem.className = 'template-suggestion-item';
                    templateItem.textContent = key;
                    templateItem.dataset.value = JSON.stringify(data[key]);
                    templateItem.addEventListener('click', () => {
                        messageInput.value = JSON.parse(templateItem.dataset.value);
                        templateSuggestions.style.display = 'none';
                        messageInput.focus();
                        adjustTextareaHeight();
                    });
                    templateSuggestions.appendChild(templateItem);
                }
            } else {
                templateSuggestions.innerHTML = '<div>テンプレートファイルが不正な形式です。</div>';
            }
        } catch (err) {
            console.error(err);
            alert('template.jsonの読み込みに失敗しました');
        }
    }

    function updateHighlightedItem(items) {
        items.forEach((item, index) => {
            if (index === highlightedIndex) {
                item.classList.add('highlighted');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('highlighted');
            }
        });
    }

    // ========================================
    // MODEL MANAGEMENT
    // ========================================

    async function loadModels() {
        try {
            const res = await fetch('/settings');
            if (!res.ok) throw new Error('Failed to fetch settings');
            const settings = await res.json();
            const modelList = settings.model_list || [];

            modelSelect.innerHTML = '';
            const defaultOption = document.createElement('option');
            defaultOption.value = 'select_model';
            defaultOption.textContent = 'モデル選択';
            modelSelect.appendChild(defaultOption);

            modelList.forEach(model => {
                const option = document.createElement('option');
                option.value = model;
                option.textContent = model;
                modelSelect.appendChild(option);
            });

            modelSelect.value = settings.select_model || 'select_model';
        } catch (err) {
            console.error('Error loading models:', err);
            alert('モデルリストの読み込みに失敗しました');
        }
    }

    // ========================================
    // SETTINGS MANAGEMENT
    // ========================================

    function renderSettingsForm(settings) {
        if (!settingsForm) return;
        settingsForm.innerHTML = '';
        const entries = Object.entries(settings);
        if (entries.length === 0) {
            const empty = document.createElement('div');
            empty.textContent = '設定がありません。';
            settingsForm.appendChild(empty);
            return;
        }
        
        entries.forEach(([key, value]) => {
            if (key === 'rules' || key === 'model_list') return;

            const row = document.createElement('div');
            row.className = 'setting-row';
            row.dataset.key = key;

            const label = document.createElement('label');
            label.className = 'setting-label';
            label.textContent = key;

            let control;
            if (key === 'select_model') {
                let modelList = [];
                if (typeof settings.model_list === 'string') {
                    try {
                        modelList = JSON.parse(settings.model_list);
                    } catch (e) {
                        modelList = [];
                    }
                } else if (Array.isArray(settings.model_list)) {
                    modelList = settings.model_list;
                }
                control = document.createElement('select');
                control.dataset.type = 'string';
                const defaultOption = document.createElement('option');
                defaultOption.value = '';
                defaultOption.textContent = 'モデルを選択';
                control.appendChild(defaultOption);
                modelList.forEach(model => {
                    const option = document.createElement('option');
                    option.value = model;
                    option.textContent = model;
                    if (model === value) option.selected = true;
                    control.appendChild(option);
                });
            } else {
                control = createControlForValue(key, value);
            }

            row.appendChild(label);
            row.appendChild(control);
            settingsForm.appendChild(row);
        });
    }

    function createControlForValue(key, value) {
        if (typeof value === 'boolean') {
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = Boolean(value);
            input.dataset.type = 'boolean';
            return input;
        }
        if (typeof value === 'number') {
            const input = document.createElement('input');
            input.type = 'number';
            input.value = String(value);
            input.step = 'any';
            input.dataset.type = 'number';
            return input;
        }
        if (typeof value === 'string') {
            const input = document.createElement('input');
            input.type = 'text';
            input.value = value;
            input.dataset.type = 'string';
            return input;
        }
        const textarea = document.createElement('textarea');
        textarea.rows = 4;
        textarea.value = JSON.stringify(value, null, 2);
        textarea.dataset.type = 'json';
        return textarea;
    }

    function collectSettingsFromForm(baseSettings) {
        if (!settingsForm) return baseSettings || {};
        const result = { ...(baseSettings || {}) };
        const rows = settingsForm.querySelectorAll('.setting-row');
        rows.forEach(row => {
            const key = row.dataset.key;
            const control = row.querySelector('input, textarea, select');
            if (!control) return;
            const type = control.dataset.type;
            if (type === 'boolean') {
                result[key] = control.checked;
            } else if (type === 'number') {
                const num = Number(control.value);
                result[key] = isNaN(num) ? control.value : num;
            } else if (type === 'string') {
                result[key] = control.value;
            } else if (type === 'json') {
                try {
                    result[key] = JSON.parse(control.value || 'null');
                } catch (e) {
                    throw new Error(`キー "${key}" のJSONが不正です`);
                }
            }
        });
        return result;
    }

    // ========================================
    // MEMORY MANAGEMENT
    // ========================================

    function renderMemoriesList(memories) {
        memoryList.innerHTML = '';
        if (memories.length === 0) {
            memoryList.innerHTML = '<div>メモリが設定されていません。</div>';
            return;
        }
        memories.forEach(memory => {
            const memoryRow = document.createElement('div');
            memoryRow.className = 'memory-row';
            memoryRow.innerHTML = `
                <span class="memory-content">${escapeHtml(memory.memory)}</span>
                <button class="delete-memory-btn" data-memory-id="${memory.id}" title="削除">🗑️</button>
            `;
            memoryList.appendChild(memoryRow);
        });
        
        const deleteButtons = memoryList.querySelectorAll('.delete-memory-btn');
        deleteButtons.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const memoryId = e.target.getAttribute('data-memory-id');
                if (confirm('このメモリを削除しますか？')) {
                    try {
                        const response = await fetch(`/memory/${memoryId}`, {
                            method: 'DELETE'
                        });
                        if (response.ok) {
                            const res = await fetch('/memory');
                            if (res.ok) {
                                const memories = await res.json();
                                renderMemoriesList(memories);
                            }
                        } else {
                            throw new Error('Failed to delete memory');
                        }
                    } catch (err) {
                        console.error('Error deleting memory:', err);
                        alert('メモリの削除に失敗しました');
                    }
                }
            });
        });
    }

    // ========================================
    // MCP MANAGEMENT
    // ========================================

    function renderMcpList(data) {
        mcpList.innerHTML = '';

        let servers = [];
        if (Array.isArray(data)) {
            servers = data;
        } else if (data && typeof data === 'object') {
            servers = Object.entries(data).map(([name, info]) => ({ name, ...info }));
        } else {
            mcpList.innerHTML = '<div>MCP情報を取得できませんでした。</div>';
            return;
        }

        if (servers.length === 0) {
            mcpList.innerHTML = '<div>MCPサーバーが設定されていません。</div>';
            return;
        }

        servers.forEach(server => {
            const mcpRow = document.createElement('div');
            mcpRow.className = 'mcp-row';

            const mcpNameSpan = document.createElement('span');
            mcpNameSpan.className = 'mcp-host';
            mcpNameSpan.textContent = `${server.name} `;
            mcpRow.appendChild(mcpNameSpan);

            const toggleLabel = document.createElement('label');
            toggleLabel.className = 'switch';
            const toggleInput = document.createElement('input');
            toggleInput.type = 'checkbox';
            toggleInput.dataset.serverName = server.name;
            toggleInput.checked = !server.disabled;
            const sliderSpan = document.createElement('span');
            sliderSpan.className = 'slider round';
            toggleLabel.appendChild(toggleInput);
            toggleLabel.appendChild(sliderSpan);
            mcpRow.appendChild(toggleLabel);

            const statusDot = document.createElement('span');
            statusDot.className = `mcp-status-dot ${server.disabled ? 'status-unknown' : `status-${server.status || 'unknown'}`}`;
            mcpRow.appendChild(statusDot);

            mcpList.appendChild(mcpRow);

            toggleInput.addEventListener('change', async (event) => {
                const serverName = event.target.dataset.serverName;
                const isDisabled = !event.target.checked;
                const currentStatusDot = event.target.closest('.mcp-row').querySelector('.mcp-status-dot');

                if (isDisabled) {
                    currentStatusDot.className = 'mcp-status-dot status-unknown';
                }

                try {
                    const res = await fetch('/mcp_settings', {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            mcpServers: {
                                [serverName]: { disabled: isDisabled }
                            }
                        })
                    });
                    if (!res.ok) throw new Error('Failed to update MCP setting');
                    console.log(`MCP server ${serverName} disabled status updated to ${isDisabled}`);
                    const updatedRes = await fetch('/mcp_status');
                    if (!updatedRes.ok) throw new Error('Failed to fetch updated MCP status');
                    const updatedData = await updatedRes.json();
                    renderMcpList(updatedData);
                    updateMcpStatus();
                } catch (err) {
                    console.error('Error updating MCP setting:', err);
                    showToast('MCP設定の更新に失敗しました', 'error');
                }
            });
        });
    }

    async function updateMcpStatus() {
        try {
            const res = await fetch('/mcp_status');
            if (!res.ok) throw new Error('Failed to fetch MCP status');
            const statuses = await res.json();
            
            let overallStatus = 'unknown';
            if (statuses && Object.keys(statuses).length > 0) {
                const allOk = Object.values(statuses).every(s => s.status === 'ok');
                const anyError = Object.values(statuses).some(s => s.status === 'error');
                const anyWarn = Object.values(statuses).some(s => s.status === 'warn');

                if (allOk) {
                    overallStatus = 'ok';
                } else if (anyError) {
                    overallStatus = 'error';
                } else if (anyWarn) {
                    overallStatus = 'warn';
                }
            }
            mcpStatusEl.className = `mcp-status ${overallStatus}`;
        } catch (err) {
            console.error('Error updating MCP status:', err);
            mcpStatusEl.className = 'mcp-status unknown';
        }
    }

    // ========================================
    // RULES MANAGEMENT
    // ========================================

    function renderRulesList(rules) {
        rulesList.innerHTML = '';
        if (rules.length === 0) {
            rulesList.innerHTML = '<div>ルールが設定されていません。</div>';
            return;
        }

        rules.forEach(rule => {
            const ruleRow = document.createElement('div');
            ruleRow.className = 'rule-row';
            
            const ruleFileSpan = document.createElement('span');
            ruleFileSpan.className = 'rule-file clickable-rule-file';
            ruleFileSpan.textContent = rule.file;
            ruleFileSpan.title = 'クリックしてファイルを開く';
            ruleFileSpan.style.cursor = 'pointer';
            ruleFileSpan.addEventListener('click', () => {
                openRuleFile(rule.file);
            });
            
            const toggleLabel = document.createElement('label');
            toggleLabel.className = 'switch';
            const toggleInput = document.createElement('input');
            toggleInput.type = 'checkbox';
            toggleInput.dataset.ruleFile = rule.file;
            toggleInput.checked = !rule.disabled;
            const sliderSpan = document.createElement('span');
            sliderSpan.className = 'slider round';
            toggleLabel.appendChild(toggleInput);
            toggleLabel.appendChild(sliderSpan);

            const deleteButton = document.createElement('button');
            deleteButton.className = 'delete-rule-btn';
            deleteButton.innerHTML = '🗑️';
            deleteButton.title = 'ルールを削除';
            deleteButton.addEventListener('click', () => deleteRule(rule.file));

            ruleRow.appendChild(ruleFileSpan);
            ruleRow.appendChild(toggleLabel);
            ruleRow.appendChild(deleteButton);
            rulesList.appendChild(ruleRow);
        });
    }

    function addRuleRow(filePath) {
        const ruleRow = document.createElement('div');
        ruleRow.className = 'rule-row';

        const ruleFileSpan = document.createElement('span');
        ruleFileSpan.className = 'rule-file clickable-rule-file';
        ruleFileSpan.textContent = filePath;
        ruleFileSpan.title = 'クリックしてファイルを開く';
        ruleFileSpan.style.cursor = 'pointer';
        ruleFileSpan.addEventListener('click', () => openRuleFile(filePath));

        const toggleLabel = document.createElement('label');
        toggleLabel.className = 'switch';
        const toggleInput = document.createElement('input');
        toggleInput.type = 'checkbox';
        toggleInput.dataset.ruleFile = filePath;
        toggleInput.checked = true;
        const sliderSpan = document.createElement('span');
        sliderSpan.className = 'slider round';

        toggleLabel.appendChild(toggleInput);
        toggleLabel.appendChild(sliderSpan);

        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-rule-btn';
        deleteButton.innerHTML = '🗑️';
        deleteButton.title = 'ルールを削除';
        deleteButton.addEventListener('click', () => deleteRule(filePath));

        ruleRow.appendChild(ruleFileSpan);
        ruleRow.appendChild(toggleLabel);
        ruleRow.appendChild(deleteButton);
        rulesList.appendChild(ruleRow);
    }

    async function deleteRule(filePath) {
        if (!confirm(`ルール "${filePath}" を削除しますか？`)) {
            return;
        }

        try {
            const res = await fetch('/delete_rule', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ file: filePath })
            });

            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }

            const result = await res.json();
            showToast(result.message, 'success');

            const ruleRowToRemove = rulesList.querySelector(`.rule-row .rule-file[data-rule-file="${filePath}"]`)?.closest('.rule-row');
            if (ruleRowToRemove) {
                ruleRowToRemove.remove();
            }
            
            try {
                const res = await fetch('/settings');
                if (!res.ok) throw new Error('Failed to fetch settings');
                const settings = await res.json();
                renderRulesList(settings.rules || []);
                rulesModal.style.display = 'flex';
            } catch (err) {
                console.error('Error loading rules:', err);
                alert('ルール設定の読み込みに失敗しました');
            }
        } catch (error) {
            console.error('Error deleting rule:', error);
            showToast(`ルールの削除に失敗しました: ${error.message}`, 'error');
        }
    }

    async function openRuleFile(fileName) {
        try {
            const response = await fetch('/open_rule_file', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ file_path: fileName })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log(result.message);
            
        } catch (error) {
            console.error('Error opening file:', error);
            alert(`ファイルを開けませんでした: ${error.message}`);
        }
    }

    // ========================================
    // THREAD MANAGEMENT
    // ========================================

    async function loadThreads() {
        try {
            const res = await fetch('/threads');
            if (!res.ok) throw new Error('threads fetch failed');
            const threads = await res.json();
            renderChatHistory(threads);
        } catch (err) {
            console.error(err);
        }
    }

    function renderChatHistory(threads) {
        chatHistoryList.innerHTML = '';
        threads.forEach(thread => {
            const li = document.createElement('li');
            li.className = 'history-item';
            li.dataset.sessionId = thread.session_id;

            const titleSpan = document.createElement('span');
            titleSpan.textContent = thread.title || 'New Chat';
            titleSpan.className = 'history-title';
            titleSpan.addEventListener('click', () => {
                document.querySelectorAll('.history-item.active').forEach(el => el.classList.remove('active'));
                li.classList.add('active');
                loadThreadMessages(thread.session_id);
            });

            const delBtn = document.createElement('button');
            delBtn.className = 'thread-delete-btn';
            delBtn.title = '削除';
            delBtn.textContent = '✖';
            delBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!confirm('このスレッドを削除しますか？')) return;
                try {
                    const dres = await fetch(`/threads/${thread.session_id}`, { method: 'DELETE' });
                    if (!dres.ok) throw new Error('delete failed');
                    li.remove();
                } catch (err) {
                    console.error(err);
                    alert('削除に失敗しました');
                }
            });

            li.appendChild(titleSpan);
            li.appendChild(delBtn);
            chatHistoryList.appendChild(li);

            if (localStorage.getItem('sessionId') === thread.session_id) {
                li.classList.add('active');
            }
        });
    }

    async function searchThreads(query) {
        try {
            const res = await fetch('/chat-search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            });
            if (!res.ok) throw new Error('search failed');
            const threads = await res.json();
            renderChatHistory(threads);
        } catch (err) {
            console.error(err);
        }
    }

    async function loadThreadMessages(newSessionId) {
        try {
            isLoadingMessages = true;

            if (localStorage.getItem('sessionId') !== newSessionId) {
                chatContainer.innerHTML = '';
            }
            localStorage.setItem('sessionId', newSessionId);
            sessionId = localStorage.getItem('sessionId')
            console.log(`thread: ${sessionId}`)

            const res = await fetch(`/threads/${newSessionId}`);
            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(`messages fetch failed: ${res.status} ${res.statusText} - ${errorText}`);
            }
            const messages = await res.json();

            chatContainer.innerHTML = '';

            let i = 0;
            while (i < messages.length) {
                const msg = messages[i];

                if (msg.sender === 'user') {
                    await appendMessage(msg.content, msg.sender);
                    i++;
                } 
                else if (msg.sender === 'thinking') {
                    let thoughtTexts = [];
                    while (i < messages.length && messages[i].sender === 'thinking') {
                        thoughtTexts.push(messages[i].content);
                        i++;
                    }

                    if (i < messages.length && messages[i].sender === 'assistant') {
                        const assistantMsg = messages[i];
                        await appendThinkingAndAssistant(thoughtTexts, assistantMsg.content);
                        i++;
                    } else {
                        await appendThinkingOnly(thoughtTexts);
                    }
                } 
                else if (msg.sender === 'assistant') {
                    await appendMessage(msg.content, msg.sender);
                    i++;
                } 
                else {
                    await appendMessage(msg.content, msg.sender);
                    i++;
                }
                await new Promise(resolve => setTimeout(resolve, 10));
            }

            showToast('チャット履歴を読み込みました', 'success');

        } catch (err) {
            console.error('Error loading thread messages:', err);
            showToast(`チャット履歴の読み込みに失敗しました: ${err.message}`, 'error');
        } finally {
            isLoadingMessages = false;
            setTimeout(() => {
                scrollToBottom();
            }, 100);
        }
    }

    // ========================================
    // MESSAGE DISPLAY & COPY FUNCTIONALITY
    // ========================================

    function createCopyButton(text) {
        const copyButton = document.createElement('button');
        copyButton.classList.add('copy-button');
        copyButton.innerHTML = '📄';
        
        copyButton.style.cssText = `
            position: absolute;
            top: 8px;
            right: 8px;
            background: transparent;
            border: 1px solid #3b82f680;
            border-radius: 6px;
            padding: 4px 4px;
            cursor: pointer;
            opacity: 0;
            transition: all 0.2s ease;
            color: #1d4ed8;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            z-index: 10;
            font-size: 12px;
        `;

        copyButton.addEventListener('click', async () => {
            try {
                const textToCopy = Array.isArray(text) ? text.join('\n') : text;
                await navigator.clipboard.writeText(textToCopy);
                
                copyButton.innerHTML = '✅';
                
                setTimeout(() => {
                    copyButton.innerHTML = '📄';
                }, 1500);
                
            } catch (err) {
                console.error('コピーに失敗しました:', err);
                
                copyButton.innerHTML = '❌';
                setTimeout(() => {
                    copyButton.innerHTML = '📄';
                }, 1500);
            }
        });

        return copyButton;
    }

    function addCodeCopyButton(preElement) {
        const codeElement = preElement.querySelector('code');
        if (!codeElement) return;
        
        preElement.style.position = 'relative';
        
        const copyButton = document.createElement('button');
        copyButton.classList.add('code-copy-button');
        copyButton.innerHTML = '📄';
        
        copyButton.style.cssText = `
            position: absolute;
            top: 8px;
            right: 8px;
            background: transparent;
            color: #1d4ed8;
            border: 1px solid #3b82f680;
            border-radius: 6px;
            padding: 4px 4px;
            cursor: pointer;
            opacity: 0;
            transition: opacity 0.2s ease;
            font-size: 12px;
            z-index: 10;
        `;
        
        preElement.addEventListener('mouseenter', () => {
            copyButton.style.opacity = '1';
        });
        
        preElement.addEventListener('mouseleave', () => {
            copyButton.style.opacity = '0';
        });
        
        copyButton.addEventListener('click', async () => {
            try {
                const codeText = codeElement.textContent;
                await navigator.clipboard.writeText(codeText);
                
                copyButton.innerHTML = '✅';
                setTimeout(() => {
                    copyButton.innerHTML = '📄';
                }, 1500);
                
            } catch (err) {
                console.error('コピーに失敗しました:', err);
            }
        });
        
        preElement.appendChild(copyButton);
    }

    function addCopyButtonVisibility() {
        document.addEventListener('mouseover', (e) => {
            const messageBubble = e.target.closest('.message-bubble');
            if (messageBubble) {
                const copyButton = messageBubble.querySelector('.copy-button');
                if (copyButton) {
                    copyButton.style.opacity = '1';
                }
            }
        });

        document.addEventListener('mouseout', (e) => {
            const messageBubble = e.target.closest('.message-bubble');
            if (messageBubble) {
                const copyButton = messageBubble.querySelector('.copy-button');
                if (copyButton) {
                    copyButton.style.opacity = '0';
                }
            }
        });
    }

    function createMessageContainer(sender) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message-container');
        
        const normalizedSender = sender.toLowerCase();
        
        if (normalizedSender === 'user') {
            messageElement.classList.add('user-message');
        } else if (normalizedSender === 'assistant' || normalizedSender === 'ai' || normalizedSender === 'tool') {
            messageElement.classList.add('ai-message');
        } else {
            messageElement.classList.add('ai-message');
        }
        return messageElement;
    }

    // ========================================
    // MARKDOWN RENDERING & MESSAGE CREATION
    // ========================================

    window["markdown"].ready.then(md => {

        function renderMarkdown(text) {
            return md.parse(decodeUnicodeForDisplay(text), {
                parseFlags: markdown.ParseFlags.DEFAULT | markdown.ParseFlags.NO_HTML
            });
        }

        function updateCodeHighlight() {
            if (typeof hljs === "undefined") return;
            document.querySelectorAll('pre code').forEach(block => {
                hljs.highlightBlock(block);
                
                if (!block.closest('pre').querySelector('.code-copy-button')) {
                    addCodeCopyButton(block.closest('pre'));
                }
            });
        }

        async function appendThinkingAndAssistant(thoughtTexts, assistantText) {
            const aiMessageContainer = createMessageContainer('assistant');
            const messageBubble = document.createElement('div');
            messageBubble.classList.add('message-bubble');
            messageBubble.style.position = 'relative';

            const iconElement = document.createElement('img');
            iconElement.classList.add('icon');
            iconElement.src = '/static/icon.png';
            iconElement.alt = 'AI Icon';
            messageBubble.appendChild(iconElement);

            const messageContent = document.createElement('div');
            messageContent.classList.add('message-content');

            const thinkingSection = document.createElement('div');
            thinkingSection.style.position = 'relative';
            thinkingSection.style.marginBottom = '16px';

            const details = document.createElement('details');
            const summary = document.createElement('summary');
            summary.textContent = '思考過程';
            summary.style.position = 'relative';
            summary.style.paddingRight = '40px';

            const thoughtProcess = document.createElement('div');
            thoughtProcess.className = 'thought-process-output';
            thoughtProcess.innerHTML = renderMarkdown(thoughtTexts.join('\n'));

            details.appendChild(summary);
            details.appendChild(thoughtProcess);
            
            const copyButtonThinking = createCopyButton(thoughtTexts.join('\n'));
            copyButtonThinking.classList.add('thinking-copy-button');
            copyButtonThinking.style.cssText = `
                position: absolute;
                top: 8px;
                right: 8px;
                background: transparent;
                border: 1px solid #3b82f680;
                border-radius: 6px;
                padding: 4px 4px;
                cursor: pointer;
                opacity: 0;
                transition: all 0.2s ease;
                color: #1d4ed8;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                z-index: 15;
                font-size: 12px;
            `;
            
            thinkingSection.appendChild(details);
            thinkingSection.appendChild(copyButtonThinking);

            const answerSection = document.createElement('div');
            answerSection.style.position = 'relative';
            
            const finalAnswer = document.createElement('div');
            finalAnswer.className = 'chat-output';
            finalAnswer.style.position = 'relative';
            finalAnswer.innerHTML = renderMarkdown(assistantText);
            
            const copyButtonAnswer = createCopyButton(assistantText);
            copyButtonAnswer.classList.add('answer-copy-button');
            copyButtonAnswer.style.cssText = `
                position: absolute;
                top: 0px;
                right: 5px;
                background: rgba(240, 253, 244, 0.95);
                border: 1px solid #3b82f680;
                border-radius: 6px;
                padding: 4px 4px;
                cursor: pointer;
                opacity: 0;
                transition: all 0.2s ease;
                color: #1d4ed8;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                z-index: 50;
                font-size: 12px;
                pointer-events: auto;
            `;

            finalAnswer.appendChild(copyButtonAnswer);

            const showButton = () => {
                copyButtonAnswer.style.opacity = '1';
                copyButtonAnswer.style.transform = 'scale(1.05)';
            };
            
            const hideButton = () => {
                copyButtonAnswer.style.opacity = '0';
                copyButtonAnswer.style.transform = 'scale(1)';
            };

            finalAnswer.addEventListener('mouseenter', showButton);
            finalAnswer.addEventListener('mouseleave', hideButton);
            answerSection.addEventListener('mouseenter', showButton);
            answerSection.addEventListener('mouseleave', hideButton);
            copyButtonAnswer.addEventListener('mouseenter', showButton);
            copyButtonAnswer.addEventListener('mouseleave', hideButton);

            answerSection.appendChild(finalAnswer);

            messageContent.appendChild(thinkingSection);
            messageContent.appendChild(answerSection);
            messageBubble.appendChild(messageContent);
            
            aiMessageContainer.appendChild(messageBubble);
            chatContainer.appendChild(aiMessageContainer);

            handleContentUpdate(false);
            updateCodeHighlight();
        }

        async function appendThinkingOnly(thoughtTexts) {
            const aiMessageContainer = createMessageContainer('assistant');
            const messageBubble = document.createElement('div');
            messageBubble.classList.add('message-bubble');
            messageBubble.style.position = 'relative';

            const iconElement = document.createElement('img');
            iconElement.classList.add('icon');
            iconElement.src = '/static/icon.png';
            iconElement.alt = 'AI Icon';
            messageBubble.appendChild(iconElement);

            const messageContent = document.createElement('div');
            messageContent.classList.add('message-content');

            const details = document.createElement('details');
            details.style.position = 'relative';
            
            const summary = document.createElement('summary');
            summary.textContent = '思考過程';

            const thoughtProcess = document.createElement('div');
            thoughtProcess.className = 'thought-process-output';
            thoughtProcess.innerHTML = renderMarkdown(thoughtTexts.join('\n'));

            details.appendChild(summary);
            details.appendChild(thoughtProcess);

            messageContent.appendChild(details);
            messageBubble.appendChild(messageContent);
            
            const copyButton = createCopyButton(thoughtTexts.join('\n'));
            messageBubble.appendChild(copyButton);
            
            aiMessageContainer.appendChild(messageBubble);
            chatContainer.appendChild(aiMessageContainer);

            handleContentUpdate(true);
            updateCodeHighlight();
        }

        async function appendMessage(text, sender) {
            const messageContainer = createMessageContainer(sender);
            const messageBubble = document.createElement('div');
            messageBubble.classList.add('message-bubble');
            messageBubble.style.position = 'relative';

            const iconElement = document.createElement('img');
            iconElement.classList.add('icon');

            if (sender.toLowerCase() === 'user') {
                const settings = await fetchSettings();
                const userIconPath = settings.user_icon ? `/base_dir/img/${settings.user_icon}` : '/base_dir/img/default_user.png';
                iconElement.src = userIconPath;
                iconElement.alt = 'User Icon';
                messageBubble.appendChild(iconElement);

                messageBubble.appendChild(document.createTextNode(text));

            } else {
                iconElement.src = '/static/icon.png';
                iconElement.alt = 'AI Icon';
                messageBubble.appendChild(iconElement);

                const aiMessage = document.createElement('div');
                aiMessage.className = 'chat-output';
                aiMessage.innerHTML = renderMarkdown(text);

                messageBubble.appendChild(aiMessage);
            }

            const copyButton = createCopyButton(text);
            messageBubble.appendChild(copyButton);

            messageContainer.appendChild(messageBubble);
            chatContainer.appendChild(messageContainer);
            handleContentUpdate(true);
            updateCodeHighlight();
        }

        window.appendThinkingAndAssistant = appendThinkingAndAssistant;
        window.appendThinkingOnly = appendThinkingOnly;
        window.appendMessage = appendMessage;
        window.updateCodeHighlight = updateCodeHighlight;
    });

    // ========================================
    // EVENT LISTENERS SETUP
    // ========================================

    // Textarea Management
    messageInput.addEventListener('input', () => {
        adjustTextareaHeight();
        adjustChatAreaLayout();
        if (messageInput.value.startsWith('@')) {
            loadTemplateJson();
        } else {
            templateSuggestions.style.display = 'none';
        }
    });
    
    messageInput.addEventListener('focus', adjustTextareaHeight);

    // File Drag & Drop
    messageInput.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        messageInput.classList.add('drag-over');
    });

    messageInput.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        messageInput.classList.remove('drag-over');
    });

    messageInput.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        messageInput.classList.remove('drag-over');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFiles(files);
        }
    });

    // File Paste
    messageInput.addEventListener('paste', (e) => {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        const files = [];
        
        for (const item of items) {
            if (item.kind === 'file') {
                const file = item.getAsFile();
                if (file) {
                    const uniqueFileName = generateUniqueFileName(file);
                    const renamedFile = new File([file], uniqueFileName, { type: file.type });
                    files.push(renamedFile);
                }
            }
        }
        
        if (files.length > 0) {
            handleFiles(files);
        }
    });

    // Template System
    atBtn.addEventListener('click', () => {
        if (templateSuggestions.style.display === 'block') {
            templateSuggestions.style.display = 'none';
        } else {
            loadTemplateJson();
        }
    });

    messageInput.addEventListener('blur', (event) => {
        setTimeout(() => {
            if (!templateSuggestions.contains(document.activeElement) && document.activeElement !== atBtn) {
                templateSuggestions.style.display = 'none';
                const currentHighlighted = templateSuggestions.querySelector('.highlighted');
                if (currentHighlighted) {
                    currentHighlighted.classList.remove('highlighted');
                }
            }
        }, 100);
    });

    messageInput.addEventListener('keydown', (event) => {
        const items = Array.from(templateSuggestions.children);
        if (items.length === 0 || templateSuggestions.style.display === 'none') {
            return;
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (highlightedIndex < items.length - 1) {
                highlightedIndex++;
            } else {
                highlightedIndex = 0;
            }
            updateHighlightedItem(items);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (highlightedIndex > 0) {
                highlightedIndex--;
            } else {
                highlightedIndex = items.length - 1;
            }
            updateHighlightedItem(items);
        } else if (event.key === 'Enter') {
            if (highlightedIndex !== -1) {
                event.preventDefault();
                const selectedItem = items[highlightedIndex];
                messageInput.value = JSON.parse(selectedItem.dataset.value);
                templateSuggestions.style.display = 'none';
                highlightedIndex = -1;
                messageInput.focus();
                adjustTextareaHeight();
            }
        } else if (event.key === 'Escape') {
            templateSuggestions.style.display = 'none';
            highlightedIndex = -1;
        }
    });

    // Sidebar
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        document.querySelector('.app-container').classList.toggle('sidebar-collapsed');
    });

    // New Chat
    newChatBtn.addEventListener('click', () => {
        localStorage.removeItem('sessionId');
        location.reload();
    });

    // File Upload
    fileUploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (files.length) {
            files.forEach(file => {
                uploadedFiles.push({ id: generateUniqueId(), file: file });
            });
            renderUploadedFiles();
            showToast(`${files.length} 個のファイルが選択されました`, 'info');
        }
        e.target.value = '';
    });

    // Model Selection
    modelSelect.addEventListener('change', async () => {
        const selectedModel = modelSelect.value;
        try {
            const res = await fetch('/settings', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ select_model: selectedModel })
            });
            if (!res.ok) throw new Error('Failed to save model selection');
            console.log('Model selection saved to settings.json');
        } catch (err) {
            console.error('Error saving model selection:', err);
            alert('モデル選択の保存に失敗しました');
        }
    });

    // Settings Modal
    settingsBtn.addEventListener('click', async () => {
        try {
            const res = await fetch('/settings');
            if (!res.ok) throw new Error('settings fetch failed');
            const settings = await res.json();
            document.getElementById('settings-json').value = JSON.stringify(settings, null, 4);
            renderSettingsForm(settings);
            settingsModal.style.display = 'flex';
        } catch (err) {
            console.error(err);
            alert('設定を取得できませんでした');
        }
    });

    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', async () => {
            try {
                const baseText = document.getElementById('settings-json').value || '{}';
                let baseSettings = {};
                try { baseSettings = JSON.parse(baseText); } catch(_) { baseSettings = {}; }
                const payload = collectSettingsFromForm(baseSettings);
                const res = await fetch('/settings', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (!res.ok) throw new Error('failed to save settings');
                const theme = (payload.theme || 'dark').toLowerCase();
                document.documentElement.setAttribute('data-theme', theme === 'lite' ? 'light' : theme);
                showToast('設定を保存しました', 'success');
                settingsModal.style.display = 'none';
            } catch (err) {
                console.error(err);
                alert('設定の保存に失敗しました');
            }
        });
    }

    // Memory Modal
    memoryBtn.addEventListener('click', async () => {
        try {
            const res = await fetch('/memory');
            if (!res.ok) throw new Error('Failed to fetch memories');
            const memories = await res.json();
            renderMemoriesList(memories || []);
            memoryModal.style.display = 'flex';
        } catch (err) {
            console.error('Error loading memories:', err);
            alert('メモリの読み込みに失敗しました');
        }
    });

    deleteAllMemoriesBtn?.addEventListener('click', async () => {
        if (!confirm('すべてのメモリを削除しますか？')) return;
        try {
            const res = await fetch('/all_memory');
            if (!res.ok) throw new Error('メモリ削除に失敗しました');
            const afterRes = await fetch('/memory');
            if (afterRes.ok) {
                const afterMemories = await afterRes.json();
                renderMemoriesList(afterMemories);
            }
            showToast('すべてのメモリを削除しました', 'success');
        } catch (err) {
            console.error('すべてのメモリ削除エラー:', err);
            showToast('すべてのメモリの削除に失敗しました', 'error');
        }
    });

    // MCP Modal
    mcpBtn.addEventListener('click', async () => {
        try {
            let res = await fetch('/mcp_status');
            if (!res.ok) res = await fetch('/mcp_settings');
            if (!res.ok) throw new Error('mcp fetch failed');

            const data = await res.json();
            renderMcpList(data);
            mcpModal.style.display = 'flex';
        } catch (err) {
            console.error(err);
            mcpList.innerHTML = '<div>通信エラー: MCP情報を取得できませんでした</div>';
            mcpModal.style.display = 'flex';
        }
    });

    mcpReloadBtn.addEventListener('click', async () => {
        try {
            const res = await fetch('/mcp_reload', { method: 'POST' });
            if (!res.ok) throw new Error('MCP reload failed');
            const result = await res.json();
            showToast(result.message, 'info');
            updateMcpStatus();
            mcpBtn.click();
        } catch (err) {
            console.error('Error reloading MCP:', err);
            showToast('MCPのリロードに失敗しました', 'error');
        }
    });

    if (editSettingsJsonBtn) {
        editSettingsJsonBtn.addEventListener('click', () => {
            openRuleFile('.nami/mcp_setting.json');
        });
    }

    // Rules Modal
    systemPromptBtn.addEventListener('click', async () => {
        try {
            const res = await fetch('/settings');
            if (!res.ok) throw new Error('Failed to fetch settings');
            const settings = await res.json();
            renderRulesList(settings.rules || []);
            rulesModal.style.display = 'flex';
        } catch (err) {
            console.error('Error loading rules:', err);
            alert('ルール設定の読み込みに失敗しました');
        }
    });

    saveRulesBtn.addEventListener('click', async () => {
        const updatedRules = [];
        rulesList.querySelectorAll('.rule-row').forEach(row => {
            const file = row.querySelector('.rule-file').textContent;
            const isDisabled = !row.querySelector('input[type="checkbox"]').checked;
            updatedRules.push({ file: file, disabled: isDisabled });
        });

        try {
            const res = await fetch('/settings', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ rules: updatedRules })
            });
            if (!res.ok) throw new Error('Failed to save rules');
            alert('ルール設定が保存されました');
            rulesModal.style.display = 'none';
        } catch (err) {
            console.error('Error saving rules:', err);
            alert('ルール設定の保存に失敗しました');
        }
    });

    addRuleBtn?.addEventListener('click', () => {
        const path = (prompt('追加するルールファイルのパスを入力してください（相対/絶対）') || '').trim();
        if (!path) return;
        const exists = Array.from(rulesList.querySelectorAll('.rule-file')).some(el => el.textContent === path);
        if (exists) {
            alert('同じパスのルールが既にあります');
            return;
        }
        addRuleRow(path);
    });

    // Modal Close
    closeButtons.forEach(b => b.addEventListener('click', (e) => {
        e.target.closest('.modal').style.display = 'none';
    }));

    window.addEventListener('click', (event) => {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    });

    // Thread Search
    if (searchChatInput) {
        searchChatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const q = searchChatInput.value.trim();
                if (q) {
                    searchThreads(q);
                } else {
                    loadThreads();
                }
            }
        });
        searchChatInput.addEventListener('input', () => {
            if (searchChatInput.value.trim() === '') {
                loadThreads();
            }
        });
    }

    // Scroll Management
    scrollToBottomBtn.addEventListener('click', () => {
        isUserScrolling = false;
        scrollToBottom();
        hideScrollButton();
    });
    
    chatWindow.addEventListener('scroll', function(e) {
        const currentScrollTop = chatWindow.scrollTop;
        
        if (Math.abs(currentScrollTop - lastScrollTop) > 1) {
            isUserScrolling = true;
            lastScrollTop = currentScrollTop;
        }        
        scrollEventTimer = setTimeout(() => {
            updateScrollButtonVisibility();
        }, 50);
    });

    chatWindow.addEventListener('wheel', function(e) {
        if (Math.abs(e.deltaY) > 0) {
            isUserScrolling = true;
            updateScrollButtonVisibility()
        }
    }, { passive: true });

    let touchStartY = 0;
    
    chatWindow.addEventListener('touchstart', function(e) {
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    chatWindow.addEventListener('touchmove', function(e) {
        const touchCurrentY = e.touches[0].clientY;
        if (Math.abs(touchCurrentY - touchStartY) > 10) {
            isUserScrolling = true;
            updateScrollButtonVisibility()
        }
    }, { passive: true });

    document.addEventListener('keydown', function(e) {
        if (document.activeElement === chatContainer || chatContainer.contains(document.activeElement)) {
            if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', 'Space'].includes(e.key)) {
                isUserScrolling = true;
                updateScrollButtonVisibility()
            }
        }
    });

    // Stop Button
    stopBtn.addEventListener('click', async () => {
        console.log('STOP button clicked');
        try {
            const response = await fetch('/stop_agent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ session_id: sessionId }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            console.log('Agent stop request sent.');
            sendBtn.style.display = 'block';
            stopBtn.style.display = 'none';

        } catch (error) {
            console.error('Error sending stop request:', error);
            appendMessage('Error: Could not stop agent.', 'ai');
        }
    });

    // ========================================
    // CHAT FORM SUBMISSION
    // ========================================

    window["markdown"].ready.then(md => {
        chatForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const message = messageInput.value.trim();
            if (!message && uploadedFiles.length === 0) return;

            await appendMessage(message, 'user');

            try {
                sessionId = localStorage.getItem('sessionId')
                console.log(`submit: ${sessionId}`)
                const formData = new FormData();
                formData.append('task', message);
                formData.append('session_id', sessionId);

                uploadedFiles.forEach(item => {
                    formData.append('files', item.file, item.file.name);
                });

                const response = await fetch('/task', {
                    method: 'POST',
                    body: formData
                });

                messageInput.value = '';
                adjustTextareaHeight();
                uploadedFiles = [];
                renderUploadedFiles();
                adjustChatAreaLayout();

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                if (response.headers.get('content-type')?.includes('text/event-stream')) {
                    const reader = response.body.getReader();
                    const decoder = new TextDecoder();

                    const aiMessageContainer = createMessageContainer('ai');
                    const messageBubble = document.createElement('div');
                    messageBubble.classList.add('message-bubble');

                    const iconElement = document.createElement('img');
                    iconElement.classList.add('icon');
                    iconElement.src = '/static/icon.png';
                    iconElement.alt = 'AI Icon';
                    messageBubble.appendChild(iconElement);

                    const messageContent = document.createElement('div');
                    messageContent.className = 'message-content';
                    messageBubble.appendChild(messageContent);

                    const details = document.createElement('details');
                    const summary = document.createElement('summary');
                    summary.textContent = '思考過程';
                    const thoughtProcess = document.createElement('div');
                    thoughtProcess.className = 'thought-process-output';
                    const finalAnswer = document.createElement('div');
                    finalAnswer.className = 'chat-output';

                    details.appendChild(summary);
                    details.appendChild(thoughtProcess);
                    messageContent.appendChild(details);
                    messageContent.appendChild(finalAnswer);
                    aiMessageContainer.appendChild(messageBubble);
                    chatContainer.appendChild(aiMessageContainer);

                    details.open = true;
                    sendBtn.style.display = 'none';
                    stopBtn.style.display = 'block';

                    let thoughtMarkdownBuffer = "";
                    let answerMarkdownBuffer = "";

                    try {
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;

                            const chunk = decoder.decode(value);
                            const lines = chunk.split('\n');

                            for (const line of lines) {
                                if (line.startsWith('event: ')) {
                                    const eventType = line.substring(7);
                                    const nextLine = lines[lines.indexOf(line) + 1];
                                    if (nextLine && nextLine.startsWith('data: ')) {
                                        let data;
                                        const jsonString = nextLine.substring(6);
                                        try {
                                            data = JSON.parse(jsonString);
                                        } catch (e) {
                                            if (e instanceof SyntaxError) {
                                                const fixedJsonString = jsonString.replace(/\\(?!["\\\/bfnrtu])/g, '\\\\');
                                                try {
                                                    data = JSON.parse(fixedJsonString);
                                                } catch (e2) {
                                                    console.error("JSON parse failed after fixing:", e2);
                                                    continue;
                                                }
                                            } else {
                                                throw e;
                                            }
                                        }

                                        if (!data) continue;
                                        
                                        if (eventType === 'thought') {
                                            thoughtMarkdownBuffer += decodeUnicodeForDisplay(data.thought);
                                            thoughtProcess.innerHTML = md.parse(thoughtMarkdownBuffer, {
                                                parseFlags: markdown.ParseFlags.DEFAULT | markdown.ParseFlags.NO_HTML
                                            });
                                            handleContentUpdate(true);
                                        } else if (eventType === 'content') {
                                            answerMarkdownBuffer += decodeUnicodeForDisplay(data.content);
                                            finalAnswer.innerHTML = md.parse(answerMarkdownBuffer, {
                                                parseFlags: markdown.ParseFlags.DEFAULT | markdown.ParseFlags.NO_HTML
                                            });
                                            handleContentUpdate(true);
                                        } else if (eventType === 'end') {
                                            details.open = false;
                                            sendBtn.style.display = 'block';
                                            stopBtn.style.display = 'none';
                                            break;
                                        } else if (eventType === 'error') {
                                            appendMessage(`Error: ${data.error}`, 'ai');
                                            details.open = false;
                                            sendBtn.style.display = 'block';
                                            stopBtn.style.display = 'none';
                                            handleContentUpdate(false);
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                    } catch (error) {
                        console.error('Error reading stream:', error);
                        appendMessage('Error: Could not read response stream.', 'ai');
                    } finally {
                        sendBtn.style.display = 'block';
                        stopBtn.style.display = 'none';
                    }
                } else {
                    const responseData = await response.json();
                    sessionId = responseData.session_id;
                    localStorage.setItem('sessionId', sessionId);
                }

            } catch (error) {
                console.error('Error sending message:', error);
                appendMessage('Error: Could not send message.', 'ai');
            } finally {
                location.reload()
            }
        });
    });

    // ========================================
    // DOM MUTATION OBSERVER
    // ========================================

    const observer = new MutationObserver(function(mutations) {
        let shouldUpdate = false;
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                shouldUpdate = true;
            }
            if (mutation.type === 'characterData') {
                shouldUpdate = true;
            }
        });
        
        if (shouldUpdate) {
            handleContentUpdate();
        }
    });

    observer.observe(chatContainer, {
        childList: true,
        subtree: true,
        characterData: true
    });

    // ========================================
    // RESIZE OBSERVER
    // ========================================

    const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
            if (entry.target === chatForm) {
                adjustChatAreaLayout();
            }
        }
    });
    resizeObserver.observe(chatForm);

    // ========================================
    // INITIAL SETUP
    // ========================================

    // Apply initial theme
    (async function applyInitialTheme(){
        try{
            const settings = await fetchSettings();
            const theme = (settings.theme || 'dark').toLowerCase();
            document.documentElement.setAttribute('data-theme', theme === 'lite' ? 'light' : theme);
        }catch(e){
            document.documentElement.setAttribute('data-theme', 'dark');
        }
    })();

    // Initial setup
    hideScrollButton();
    lastScrollTop = chatWindow.scrollTop;
    adjustChatAreaLayout();
    adjustTextareaHeight();
    addCopyButtonVisibility();

    // Initial loads
    loadThreads();
    loadModels();
    loadThreadMessages(sessionId);
    
    // Page load scroll to bottom
    window.addEventListener('load', () => {
        setTimeout(() => {
            if (chatWindow.children.length > 0) {
                scrollToBottom();
            }
        }, 100);
    });
    
    updateMcpStatus();
    setInterval(updateMcpStatus, 10000);
});

// ========================================
// GLOBAL TOAST FUNCTION (outside DOMContentLoaded)
// ========================================

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 4px;
        color: white;
        font-weight: 500;
        z-index: 1000;
        opacity: 0;
        transition: opacity 0.3s ease;
    `;
    
    switch(type) {
        case 'success':
            toast.style.backgroundColor = '#4CAF50';
            break;
        case 'error':
            toast.style.backgroundColor = '#f44336';
            break;
        case 'info':
        default:
            toast.style.backgroundColor = '#2196F3';
            break;
    }
    
    document.body.appendChild(toast);
    
    setTimeout(() => { toast.style.opacity = '1'; }, 100);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 3000);
}