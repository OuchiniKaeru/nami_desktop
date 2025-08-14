// script.js
    
document.addEventListener('DOMContentLoaded', () => {
    // Sidebar
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

    // MCP-MCP-Modal
    const closeButtons = document.querySelectorAll('.modal .close-button');
    const mcpBtn = document.getElementById('mcp-btn');
    const mcpModal = document.getElementById('mcp-modal');
    const mcpList = document.getElementById('mcp-list');
    const mcpStatusEl = document.getElementById('mcp-status');
    const mcpReloadBtn = document.getElementById('mcp-reload-btn');
    const editSettingsJsonBtn = document.getElementById('edit-settings-json-btn');

    // Chat-Window
    const chatWindow = document.getElementById('chat-window');
    const chatContainer = document.getElementById('chat-container');
    const scrollToBottomBtn = document.getElementById('scroll-to-bottom-btn');
    
    // Input-Area
    const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const stopBtn = document.getElementById('stop-btn');
    const fileUploadBtn = document.getElementById('file-upload-btn');
    const fileInput = document.getElementById('file-input');
    const atBtn = document.getElementById('at-btn');
    const templateSuggestions = document.getElementById('template-suggestions'); // 新しい要素を追加
    const systemPromptBtn = document.getElementById('system-prompt-btn');
    const rulesModal = document.getElementById('rules-modal');
    const rulesList = document.getElementById('rules-list');
    const saveRulesBtn = document.getElementById('save-rules-btn');
    const addRuleBtn = document.getElementById('add-rule-btn');
    const modelSelect = document.getElementById('model-select');

    let sessionId = localStorage.getItem('sessionId') || generateSessionId();
    localStorage.setItem('sessionId', sessionId);
    console.log(`initial: ${sessionId}`)

    let isUserScrolling = false;
    let lastScrollTop = 0;
    let isLoadingMessages = false;

    // ファイルオブジェクトを保持するための配列
    let uploadedFiles = []; // { id: uniqueId, file: File } の形式で保持

    // アップロードされたファイルを表示する関数
    function renderUploadedFiles() {
        uploadedFilesPreview.innerHTML = ''; // 一度クリア
        if (uploadedFiles.length > 0) {
            uploadedFilesPreview.style.display = 'flex'; // ファイルがある場合のみ表示
        } else {
            uploadedFilesPreview.style.display = 'none'; // ファイルがない場合は非表示
        }

        uploadedFiles.forEach(item => {
            const file = item.file;
            const fileItem = document.createElement('div');
            fileItem.className = 'uploaded-file-item';
            fileItem.dataset.fileId = item.id; // 削除用にIDを設定

            const fileIcon = document.createElement('i');
            fileIcon.className = getFileIconClass(file.type); // ファイルタイプに応じたアイコン
            fileIcon.classList.add('file-icon');
            fileItem.appendChild(fileIcon);

            const fileNameSpan = document.createElement('span');
            fileNameSpan.className = 'file-name';
            fileNameSpan.textContent = truncateFileName(file.name, 15); // ファイル名を短縮
            fileItem.appendChild(fileNameSpan);

            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-file-btn';
            removeBtn.innerHTML = '&times;'; // ×ボタン
            removeBtn.title = 'ファイルを削除';
            removeBtn.addEventListener('click', () => {
                removeFile(item.id);
            });
            fileItem.appendChild(removeBtn);

            uploadedFilesPreview.appendChild(fileItem);
        });
    }

    // ファイルタイプに応じたFont Awesomeアイコンを返すヘルパー関数
    function getFileIconClass(fileType) {
        if (fileType.startsWith('image/')) {
            return 'fas fa-image';
        } else if (fileType.startsWith('video/')) {
            return 'fas fa-video';
        } else if (fileType.startsWith('audio/')) {
            return 'fas fa-music';
        } else if (fileType === 'application/pdf') {
            return 'fas fa-file-pdf';
        } else if (fileType === 'application/msword' || fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            return 'fas fa-file-word';
        } else if (fileType === 'application/vnd.ms-excel' || fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
            return 'fas fa-file-excel';
        } else if (fileType === 'application/vnd.ms-powerpoint' || fileType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
            return 'fas fa-file-powerpoint';
        } else if (fileType === 'application/zip' || fileType === 'application/x-rar-compressed') {
            return 'fas fa-file-archive';
        } else if (fileType === 'text/plain') {
            return 'fas fa-file-alt';
        } else if (fileType === 'application/json' || fileType === 'application/xml' || fileType.startsWith('text/')) {
            return 'fas fa-file-code';
        }
        return 'fas fa-file'; // デフォルトのファイルアイコン
    }

    // ファイル名を短縮するヘルパー関数
    function truncateFileName(fileName, maxLength) {
        if (fileName.length <= maxLength) {
            return fileName;
        }
        const extensionIndex = fileName.lastIndexOf('.');
        if (extensionIndex === -1 || fileName.length - extensionIndex > 5) { // 拡張子が短い場合やない場合
            return fileName.substring(0, maxLength - 3) + '...';
        }
        const name = fileName.substring(0, extensionIndex);
        const ext = fileName.substring(extensionIndex);
        const charsToShow = maxLength - ext.length - 3; // ...と拡張子の分を引く
        if (charsToShow <= 0) { // 拡張子だけでmaxLengthを超える場合
            return '...' + ext;
        }
        return name.substring(0, charsToShow) + '...' + ext;
    }

    // ファイルを配列から削除する関数
    function removeFile(fileIdToRemove) {
        uploadedFiles = uploadedFiles.filter(item => item.id !== fileIdToRemove);
        renderUploadedFiles(); // 表示を更新
        adjustChatAreaLayout(); // ファイル削除時にレイアウトを調整
    }

    // ユニークなIDを生成するヘルパー関数
    function generateUniqueId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
    }
    
    // テキスト入力エリアの自動高さ調整（5行対応版）
    function adjustTextareaHeight() {
        // 一度高さをリセット
        messageInput.style.height = 'auto';
        
        // より正確な行の高さを計算
        const computedStyle = getComputedStyle(messageInput);
        const fontSize = parseFloat(computedStyle.fontSize) || 14;
        const lineHeight = computedStyle.lineHeight === 'normal' ? fontSize * 1.5 : parseFloat(computedStyle.lineHeight) || (fontSize * 1.5);
        const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
        const paddingBottom = parseFloat(computedStyle.paddingBottom) || 0;
        const borderTop = parseFloat(computedStyle.borderTopWidth) || 0;
        const borderBottom = parseFloat(computedStyle.borderBottomWidth) || 0;
        
        // 5行分の高さを計算（パディングとボーダーを含む）
        const maxHeight = (lineHeight * 5) + paddingTop + paddingBottom + borderTop + borderBottom;
        const minHeight = 40; // 最小高さ
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

    // inputイベントリスナー（5行対応）, 初期ロード時に高さを調整, フォーカス時にも調整（念のため）
    messageInput.addEventListener('input', adjustTextareaHeight);    
    adjustTextareaHeight();    
    messageInput.addEventListener('focus', adjustTextareaHeight);

    // chat-formの高さに基づいてuploaded-files-previewの位置を調整する関数
    function adjustChatAreaLayout() {
        const chatFormHeight = chatForm.offsetHeight;
    }

    // ファイルを処理し、uploadedFiles配列に追加する共通関数
    function handleFiles(files) {
        Array.from(files).forEach(file => {
            uploadedFiles.push({ id: generateUniqueId(), file: file });
        });
        renderUploadedFiles();
        showToast(`${files.length} 個のファイルが追加されました`, 'info');
        adjustChatAreaLayout(); // ファイル追加時にレイアウトを調整
    }
    // inputイベントリスナー（5行対応）, 初期ロード時に高さを調整, フォーカス時にも調整（念のため）
    messageInput.addEventListener('input', () => {
        adjustTextareaHeight();
        adjustChatAreaLayout();
    });    
    adjustTextareaHeight();    
    messageInput.addEventListener('focus', adjustTextareaHeight);

    // ファイルを処理し、uploadedFiles配列に追加する共通関数
    function handleFiles(files) {
        Array.from(files).forEach(file => {
            uploadedFiles.push({ id: generateUniqueId(), file: file });
        });
        renderUploadedFiles();
        showToast(`${files.length} 個のファイルが追加されました`, 'info');
    }

    // ドラッグ&ドロップ機能
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

    // ペースト機能
    messageInput.addEventListener('paste', (e) => {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        const files = [];
        
        for (const item of items) {
            if (item.kind === 'file') {
                const file = item.getAsFile();
                if (file) {
                    // ユニークなファイル名を生成
                    const uniqueFileName = generateUniqueFileName(file);
                    // File オブジェクトのnameプロパティを変更するために新しいFileオブジェクトを作成
                    const renamedFile = new File([file], uniqueFileName, { type: file.type });
                    files.push(renamedFile);
                }
            }
        }
        
        if (files.length > 0) {
            handleFiles(files);
        }
    });

    // ユニークなファイル名を生成する関数（新規追加）
    function generateUniqueFileName(file) {
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 8);
        
        // 元のファイル名から拡張子を取得
        const originalName = file.name || 'pasted_file';
        const lastDotIndex = originalName.lastIndexOf('.');
        
        let extension = '';
        let baseName = originalName;
        
        if (lastDotIndex !== -1) {
            extension = originalName.substring(lastDotIndex);
            baseName = originalName.substring(0, lastDotIndex);
        } else {
            // 拡張子がない場合、ファイルタイプから推測
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
        
        // ペーストされた画像の場合は特別な命名規則を使用
        if (file.type && file.type.startsWith('image/') && (originalName === 'image.png' || originalName === 'pasted_file')) {
            baseName = 'pasted_image';
        }
        
        return `${baseName}_${timestamp}_${randomStr}${extension}`;
    }

    // Model selection
    async function loadModels() {
        try {
            const res = await fetch('/settings');
            if (!res.ok) throw new Error('Failed to fetch settings');
            const settings = await res.json();
            const modelList = settings.model_list || [];

            modelSelect.innerHTML = ''; // Clear existing options
            const defaultOption = document.createElement('option');
            defaultOption.value = 'select_model'; // 初期値を"select_model"に設定
            defaultOption.textContent = 'モデル選択';
            modelSelect.appendChild(defaultOption);

            modelList.forEach(model => {
                const option = document.createElement('option');
                option.value = model;
                option.textContent = model;
                modelSelect.appendChild(option);
            });

            // Set saved model from settings.json or default
            modelSelect.value = settings.select_model || 'select_model';
        } catch (err) {
            console.error('Error loading models:', err);
            alert('モデルリストの読み込みに失敗しました');
        }
    }

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

    // 初期テーマ適用
    (async function applyInitialTheme(){
        try{
            const settings = await fetchSettings();
            const theme = (settings.theme || 'dark').toLowerCase();
            document.documentElement.setAttribute('data-theme', theme === 'lite' ? 'light' : theme);
        }catch(e){
            document.documentElement.setAttribute('data-theme', 'dark');
        }
    })();

    // @ボタンを押したときに template.json 読み込み
    async function loadTemplateJson() {
        try {
            const res = await fetch('/base_dir/.nami/template.json'); // 2つ上の階層を指定
            if (!res.ok) throw new Error('template.json load failed');
            const data = await res.json();
            
            templateSuggestions.innerHTML = ''; // Clear existing list
            templateSuggestions.style.display = 'block'; // Show the suggestions container
            if (typeof data === 'object' && !Array.isArray(data)) {
                for (const key in data) {
                    const templateItem = document.createElement('div');
                    templateItem.className = 'template-suggestion-item'; // クラス名を変更
                    templateItem.textContent = key;
                    templateItem.dataset.value = JSON.stringify(data[key]); // Store the value as a string
                    templateItem.addEventListener('click', () => {
                        messageInput.value = JSON.parse(templateItem.dataset.value);
                        templateSuggestions.style.display = 'none'; // Hide suggestions after selection
                        messageInput.focus(); // フォーカスを戻す
                        adjustTextareaHeight(); // 高さを再調整
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
    
    // @ボタンを押したときに template.json 読み込み/非表示をトグル
    atBtn.addEventListener('click', () => {
        if (templateSuggestions.style.display === 'block') {
            templateSuggestions.style.display = 'none';
        } else {
            loadTemplateJson();
        }
    });
    
    // メッセージ入力が @ で始まったら自動読み込み
    messageInput.addEventListener('input', () => {
        adjustTextareaHeight(); // 高さ調整を追加
        if (messageInput.value.startsWith('@')) {
            loadTemplateJson();
        } else {
            templateSuggestions.style.display = 'none'; // @がなくなったら非表示
        }
    });
    
    // メッセージ入力欄からフォーカスが外れたら候補を非表示にする
    messageInput.addEventListener('blur', (event) => {
        // クリックイベントが先に処理されるように、少し遅延させる
        setTimeout(() => {
            if (!templateSuggestions.contains(document.activeElement) && document.activeElement !== atBtn) {
                templateSuggestions.style.display = 'none';
                // ハイライトをリセット
                const currentHighlighted = templateSuggestions.querySelector('.highlighted');
                if (currentHighlighted) {
                    currentHighlighted.classList.remove('highlighted');
                }
            }
        }, 100); // 100msの遅延
    });

    // キーボード操作でテンプレートを選択
    let highlightedIndex = -1;
    messageInput.addEventListener('keydown', (event) => {
        const items = Array.from(templateSuggestions.children);
        if (items.length === 0 || templateSuggestions.style.display === 'none') {
            return;
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault(); // カーソル移動を防ぐ
            if (highlightedIndex < items.length - 1) {
                highlightedIndex++;
            } else {
                highlightedIndex = 0; // 最後に到達したら最初に戻る
            }
            updateHighlightedItem(items);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault(); // カーソル移動を防ぐ
            if (highlightedIndex > 0) {
                highlightedIndex--;
            } else {
                highlightedIndex = items.length - 1; // 最初に到達したら最後に戻る
            }
            updateHighlightedItem(items);
        } else if (event.key === 'Enter') {
            if (highlightedIndex !== -1) {
                event.preventDefault(); // Enterキーでの改行を防ぐ
                const selectedItem = items[highlightedIndex];
                messageInput.value = JSON.parse(selectedItem.dataset.value); // 直接値を代入
                templateSuggestions.style.display = 'none'; // リストを非表示
                highlightedIndex = -1; // リセット
                messageInput.focus(); // フォーカスを戻す
                adjustTextareaHeight(); // 高さを再調整
            }
        } else if (event.key === 'Escape') {
            templateSuggestions.style.display = 'none';
            highlightedIndex = -1; // リセット
        }
    });

    function updateHighlightedItem(items) {
        items.forEach((item, index) => {
            if (index === highlightedIndex) {
                item.classList.add('highlighted');
                item.scrollIntoView({ block: 'nearest' }); // スクロールして表示
            } else {
                item.classList.remove('highlighted');
            }
        });
    }

    // Sidebar toggle
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        document.querySelector('.app-container').classList.toggle('sidebar-collapsed');
    });

    // New chat: reset session
    newChatBtn.addEventListener('click', () => {
        localStorage.removeItem('sessionId');
        location.reload();
    });


    // File upload (既存のイベントリスナーを修正)
    fileUploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (files.length) {
            files.forEach(file => {
                uploadedFiles.push({ id: generateUniqueId(), file: file });
            });
            renderUploadedFiles(); // 表示を更新
            showToast(`${files.length} 個のファイルが選択されました`, 'info');
        }
        e.target.value = ''; // 同じファイルを再度選択できるようにinputをクリア
    });

    // Settings modal
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

    // 設定保存 -> 画面にも即反映（特にtheme）
    if (saveSettingsBtn){
        saveSettingsBtn.addEventListener('click', async () => {
            try{
                // フォームから値を収集
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
                // テーマ即時反映
                const theme = (payload.theme || 'dark').toLowerCase();
                document.documentElement.setAttribute('data-theme', theme === 'lite' ? 'light' : theme);
                showToast('設定を保存しました', 'success');
                settingsModal.style.display = 'none';
            }catch(err){
                console.error(err);
                alert('設定の保存に失敗しました');
            }
        });
    }

    // 設定フォーム描画
    function renderSettingsForm(settings){
        if (!settingsForm) return;
        settingsForm.innerHTML = '';
        const entries = Object.entries(settings);
        if (entries.length === 0){
            const empty = document.createElement('div');
            empty.textContent = '設定がありません。';
            settingsForm.appendChild(empty);
            return;
        }
        entries.forEach(([key, value]) => {
            // "rules"と"model_list"はスキップ
            if (key === 'rules' || key === 'model_list') return;

            const row = document.createElement('div');
            row.className = 'setting-row';
            row.dataset.key = key;

            const label = document.createElement('label');
            label.className = 'setting-label';
            label.textContent = key;

            let control;
            // select_modelの場合は、settingsのmodel_listから選択肢を作成
            if (key === 'select_model') {
                // model_listはsettingsから取得
                let modelList = [];
                // model_listが文字列の場合はJSONパースを試みる
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
                // デフォルトの選択肢
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

    function createControlForValue(key, value){
        if (typeof value === 'boolean'){
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = Boolean(value);
            input.dataset.type = 'boolean';
            return input;
        }
        if (typeof value === 'number'){
            const input = document.createElement('input');
            input.type = 'number';
            input.value = String(value);
            input.step = 'any';
            input.dataset.type = 'number';
            return input;
        }
        if (typeof value === 'string'){
            const input = document.createElement('input');
            input.type = 'text';
            input.value = value;
            input.dataset.type = 'string';
            return input;
        }
        // 配列・オブジェクト・null はJSONテキストで編集
        const textarea = document.createElement('textarea');
        textarea.rows = 4;
        textarea.value = JSON.stringify(value, null, 2);
        textarea.dataset.type = 'json';
        return textarea;
    }

    function collectSettingsFromForm(baseSettings){
        if (!settingsForm) return baseSettings || {};
        const result = { ...(baseSettings || {}) };
        const rows = settingsForm.querySelectorAll('.setting-row');
        rows.forEach(row => {
            const key = row.dataset.key;
            const control = row.querySelector('input, textarea, select');
            if (!control) return;
            const type = control.dataset.type;
            if (type === 'boolean'){
                result[key] = control.checked;
            } else if (type === 'number'){
                const num = Number(control.value);
                result[key] = isNaN(num) ? control.value : num;
            } else if (type === 'string'){
                result[key] = control.value;
            } else if (type === 'json'){
                try {
                    result[key] = JSON.parse(control.value || 'null');
                } catch(e){
                    throw new Error(`キー "${key}" のJSONが不正です`);
                }
            }
        });
        return result;
    }

    // Memory modal: open and fetch memories
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

    function renderMemoriesList(memories) {
        memoryList.innerHTML = '';
        if (memories.length === 0) {
            mcpList.innerHTML = '<div>メモリが設定されていません。</div>';
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
        
        // Add event listeners for delete buttons
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
                            // Refresh the memories list
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

    // Helper function to escape HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 「すべてのメモリを削除」ボタンのクリックイベント
    deleteAllMemoriesBtn?.addEventListener('click', async () => {
        if (!confirm('すべてのメモリを削除しますか？')) return;
        try {
            const res = await fetch('/all_memory');
            if (!res.ok) throw new Error('メモリ削除に失敗しました');
            // 削除後にリストを再描画
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

    closeButtons.forEach(b => b.addEventListener('click', (e) => {
        e.target.closest('.modal').style.display = 'none';
    }));

    window.addEventListener('click', (event) => {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    });

    // Load threads
    async function loadThreads() {
        try {
            const res = await fetch('/threads');
            if (!res.ok) throw new Error('threads fetch failed');
            const threads = await res.json();
            renderChatHistory(threads); // ← 置き換え
        } catch (err) {
            console.error(err);
        }
    }

    // 共通: スレッド一覧の描画
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

            // 既存セッションと一致するスレッドを初期選択表示
            if (localStorage.getItem('sessionId') === thread.session_id) {
                li.classList.add('active');
            }
        });
    }

    // 検索API呼び出し
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

    // Enterで検索実行、空に戻したら全件表示
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
    
    async function loadThreadMessages(newSessionId) {
        try {
            isLoadingMessages = true; // ロード判定

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
                    // ユーザーの発言はそのまま追加
                    await appendMessage(msg.content, msg.sender);
                    i++;
                } 
                else if (msg.sender === 'thinking') {
                    // thinking の塊をまとめて取得
                    let thoughtTexts = [];
                    while (i < messages.length && messages[i].sender === 'thinking') {
                        thoughtTexts.push(messages[i].content);
                        i++;
                    }
    
                    // 次のメッセージが assistant なら思考過程＋最終回答として追加
                    if (i < messages.length && messages[i].sender === 'assistant') {
                        const assistantMsg = messages[i];
                        await appendThinkingAndAssistant(thoughtTexts, assistantMsg.content);
                        i++;
                    } else {
                        // assistant が無い場合は思考過程だけ
                        await appendThinkingOnly(thoughtTexts);
                    }
                } 
                else if (msg.sender === 'assistant') {
                    // 普通に assistant を追加（thinking が無い場合）
                    await appendMessage(msg.content, msg.sender);
                    i++;
                } 
                else {
                    // 未知のsenderはそのまま
                    await appendMessage(msg.content, msg.sender);
                    i++;
                }
                // 各メッセージ追加後に少し待機 - この行を追加
                await new Promise(resolve => setTimeout(resolve, 10));
            }
    
            showToast('チャット履歴を読み込みました', 'success');
    
        } catch (err) {
            console.error('Error loading thread messages:', err);
            showToast(`チャット履歴の読み込みに失敗しました: ${err.message}`, 'error');
        } finally {
            isLoadingMessages = false; // この行を追加
            // 読み込み完了後に最下部にスクロール - 以下3行を追加
            setTimeout(() => {
                scrollToBottom();
            }, 100);
        }
    }
    
    // 文字列内の \\uXXXX などのエスケープを実体化して表示用に整える
    function decodeUnicodeForDisplay(input) {
        if (typeof input !== 'string') return input;
        try {
            // JSON を使って包括的にアンエスケープ（\\n 等も含む）
            const wrapped = `"${input.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
            return JSON.parse(wrapped);
        } catch (e) {
            // フォールバック: よくある制御文字と \uXXXX を個別に処理
            const unescaped = input
                .replace(/\\n/g, '\n')
                .replace(/\\r/g, '\r')
                .replace(/\\t/g, '\t');
            return unescaped.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
                String.fromCharCode(parseInt(hex, 16))
            );
        }
    }


    // MCP modal: open and fetch statuses (on demand)
    mcpBtn.addEventListener('click', async () => {
        try {
            // Try /mcp_status first, fallback to /mcp_settings
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

    // MCP status update function
    async function updateMcpStatus() {
        try {
            const res = await fetch('/mcp_status');
            if (!res.ok) throw new Error('Failed to fetch MCP status');
            const statuses = await res.json();
            
            // Overall status for the small dot
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
            mcpStatusEl.className = 'mcp-status unknown'; // Set to unknown on error
        }
    };

    function renderMcpList(data) {
        mcpList.innerHTML = ''; // Clear existing list

        let servers = [];
        if (Array.isArray(data)) {
            servers = data;
        } else if (data && typeof data === 'object') {
            // dataが直接MCPサーバーのステータスオブジェクトである場合を処理
            servers = Object.entries(data).map(([name, info]) => ({ name, ...info }));
        } else {
            // それ以外の予期しない形式の場合
            mcpList.innerHTML = '<div>MCP情報を取得できませんでした。</div>';
            return;
        }

        if (servers.length === 0) {
            mcpList.innerHTML = '<div>MCPサーバーが設定されていません。</div>';
            return;
        }

        servers.forEach(server => {
            const mcpRow = document.createElement('div');
            mcpRow.className = 'mcp-row'; // Use mcp-row for the combined display

            // MCP名
            const mcpNameSpan = document.createElement('span');
            mcpNameSpan.className = 'mcp-host';
            mcpNameSpan.textContent = `${server.name} `;
            mcpRow.appendChild(mcpNameSpan);

            // トグルスイッチ
            const toggleLabel = document.createElement('label');
            toggleLabel.className = 'switch';
            const toggleInput = document.createElement('input');
            toggleInput.type = 'checkbox';
            toggleInput.dataset.serverName = server.name;
            toggleInput.checked = !server.disabled; // disabledがfalseならchecked
            const sliderSpan = document.createElement('span');
            sliderSpan.className = 'slider round';
            toggleLabel.appendChild(toggleInput);
            toggleLabel.appendChild(sliderSpan);
            mcpRow.appendChild(toggleLabel);

            // 通信状況
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
                    // MCP設定更新後、再度MCPステータスを取得してリストを再描画
                    const updatedRes = await fetch('/mcp_status');
                    if (!updatedRes.ok) throw new Error('Failed to fetch updated MCP status');
                    const updatedData = await updatedRes.json();
                    renderMcpList(updatedData); // リスト全体を再描画
                    updateMcpStatus(); // 全体のステータスドットも更新
                } catch (err) {
                    console.error('Error updating MCP setting:', err);
                    showToast('MCP設定の更新に失敗しました', 'error');
                }
            });
        });
    }

    // MCP Reload button
    mcpReloadBtn.addEventListener('click', async () => {
        try {
            const res = await fetch('/mcp_reload', { method: 'POST' });
            if (!res.ok) throw new Error('MCP reload failed');
            const result = await res.json();
            showToast(result.message, 'info');
            updateMcpStatus(); // Update status after reload
            mcpBtn.click(); // Re-open MCP modal to show updated list
        } catch (err) {
            console.error('Error reloading MCP:', err);
            showToast('MCPのリロードに失敗しました', 'error');
        }
    });

    // Edit mcp_setting.json button -> open in Notepad via backend
    if (editSettingsJsonBtn) {
        editSettingsJsonBtn.addEventListener('click', () => {
            openRuleFile('mcp_setting.json');
        });
    }

    // Rules modal: open and fetch rules
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

    // + add rule
    addRuleBtn?.addEventListener('click', () => {
        const path = (prompt('追加するルールファイルのパスを入力してください（相対/絶対）') || '').trim();
        if (!path) return;
        // 重複チェック
        const exists = Array.from(rulesList.querySelectorAll('.rule-file')).some(el => el.textContent === path);
        if (exists) {
            alert('同じパスのルールが既にあります');
            return;
        }
        addRuleRow(path); // DOMに行追加（disabled: false → チェックON）
    });

    newChatBtn.addEventListener('click', () => {
        localStorage.removeItem('sessionId');
        location.reload();
    });

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
    
                    // 追加: Markdownテキスト蓄積用
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
                                            handleContentUpdate(false); // ストリーミング終了
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
    

    function createMessageContainer(sender) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message-container');
        
        // senderの値を正規化
        const normalizedSender = sender.toLowerCase();
        
        if (normalizedSender === 'user') {
            messageElement.classList.add('user-message');
        } else if (normalizedSender === 'assistant' || normalizedSender === 'ai' || normalizedSender === 'tool') {
            messageElement.classList.add('ai-message');
        } else {
            // 予期しない値の場合はAIメッセージとして処理
            messageElement.classList.add('ai-message');
        }
        return messageElement;
    }

    window["markdown"].ready.then(md => {

        /** MarkdownテキストをHTMLに変換 */
        function renderMarkdown(text) {
            return md.parse(decodeUnicodeForDisplay(text), {
                parseFlags: markdown.ParseFlags.DEFAULT | markdown.ParseFlags.NO_HTML
            });
        }
    
        /** コードハイライト */
        function updateCodeHighlight() {
            if (typeof hljs === "undefined") return;
            document.querySelectorAll('pre code').forEach(block => {
                hljs.highlightBlock(block);
            });
        }
    
        /** 思考過程 + 最終回答 */
        async function appendThinkingAndAssistant(thoughtTexts, assistantText) {
            const aiMessageContainer = createMessageContainer('assistant');
            const messageBubble = document.createElement('div');
            messageBubble.classList.add('message-bubble');
    
            const iconElement = document.createElement('img');
            iconElement.classList.add('icon');
            iconElement.src = '/static/icon.png';
            iconElement.alt = 'AI Icon';
            messageBubble.appendChild(iconElement);
    
            const messageContent = document.createElement('div');
            messageContent.classList.add('message-content');
    
            // 思考過程
            const details = document.createElement('details');
            const summary = document.createElement('summary');
            summary.textContent = '思考過程';
    
            const thoughtProcess = document.createElement('div');
            thoughtProcess.className = 'thought-process-output';
            thoughtProcess.innerHTML = renderMarkdown(thoughtTexts.join('\n'));
    
            details.appendChild(summary);
            details.appendChild(thoughtProcess);
    
            // 最終回答
            const finalAnswer = document.createElement('div');
            finalAnswer.className = 'chat-output';
            finalAnswer.innerHTML = renderMarkdown(assistantText);
    
            messageContent.appendChild(details);
            messageContent.appendChild(finalAnswer);
    
            messageBubble.appendChild(messageContent);
            aiMessageContainer.appendChild(messageBubble);
            chatContainer.appendChild(aiMessageContainer);
    
            handleContentUpdate(false);
            updateCodeHighlight();
        }
    
        /** 思考過程のみ */
        async function appendThinkingOnly(thoughtTexts) {
            const aiMessageContainer = createMessageContainer('assistant');
            const messageBubble = document.createElement('div');
            messageBubble.classList.add('message-bubble');
    
            const iconElement = document.createElement('img');
            iconElement.classList.add('icon');
            iconElement.src = '/static/icon.png';
            iconElement.alt = 'AI Icon';
            messageBubble.appendChild(iconElement);
    
            const messageContent = document.createElement('div');
            messageContent.classList.add('message-content');
    
            const details = document.createElement('details');
            const summary = document.createElement('summary');
            summary.textContent = '思考過程';
    
            const thoughtProcess = document.createElement('div');
            thoughtProcess.className = 'thought-process-output';
            thoughtProcess.innerHTML = renderMarkdown(thoughtTexts.join('\n'));
    
            details.appendChild(summary);
            details.appendChild(thoughtProcess);
    
            messageContent.appendChild(details);
            messageBubble.appendChild(messageContent);
            aiMessageContainer.appendChild(messageBubble);
            chatContainer.appendChild(aiMessageContainer);
    
            handleContentUpdate(true);
            updateCodeHighlight();
        }
    
        /** 通常メッセージ */
        async function appendMessage(text, sender) {
            const messageContainer = createMessageContainer(sender);
            const messageBubble = document.createElement('div');
            messageBubble.classList.add('message-bubble');
    
            const iconElement = document.createElement('img');
            iconElement.classList.add('icon');
    
            if (sender.toLowerCase() === 'user') {
                const settings = await fetchSettings();
                const userIconPath = settings.user_icon ? `/base_dir/img/${settings.user_icon}` : '/base_dir/img/default_user.png';
                iconElement.src = userIconPath;
                iconElement.alt = 'User Icon';
                messageBubble.appendChild(iconElement);
    
                // ユーザー発言はMarkdownなしで表示（必要ならここもrenderMarkdownに）
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
    
            messageContainer.appendChild(messageBubble);
            chatContainer.appendChild(messageContainer);
            handleContentUpdate(true);
            updateCodeHighlight();
        }
    
        // グローバルに公開
        window.appendThinkingAndAssistant = appendThinkingAndAssistant;
        window.appendThinkingOnly = appendThinkingOnly;
        window.appendMessage = appendMessage;
    
    });
    

    async function fetchSettings() {
        try {
            const res = await fetch('/settings');
            if (!res.ok) throw new Error('Failed to fetch settings');
            return await res.json();
        } catch (err) {
            console.error('Error fetching settings:', err);
            return {}; // エラー時は空のオブジェクトを返す
        }
    }

    // 1. 変数の追加（既存の変数宣言部分に追加）
    // この行を追加

    // 2. handleContentUpdate関数の修正
    function handleContentUpdate(isStreaming = false) {
        setTimeout(() => {
            // isStreaming=true かつ isUserScrolling=true の場合はスクロールしない
            if ((isStreaming && !isUserScrolling) || (!isStreaming && !isUserScrolling) || isLoadingMessages) {
                scrollToBottom();
            }
            updateScrollButtonVisibility();
        }, 100);
    }

    // より確実な最下部判定
    function isAtBottom() {
        const threshold = 50; // より大きな閾値で判定
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
        // Edge対応：強制的にスタイルを適用
        scrollToBottomBtn.style.opacity = '1';
        scrollToBottomBtn.style.transform = 'translateY(0)';
    }

    function hideScrollButton() {
        scrollToBottomBtn.classList.remove('show');
        scrollToBottomBtn.style.opacity = '0';
        scrollToBottomBtn.style.transform = 'translateY(10px)';
        // アニメーション後に完全に非表示にする
        setTimeout(() => {
            if (!scrollToBottomBtn.classList.contains('show')) {
                scrollToBottomBtn.style.display = 'none';
            }
        }, 300);
    }

    // スクロールボタンのクリックイベント
    scrollToBottomBtn.addEventListener('click', () => {
        isUserScrolling = false; // 手動スクロール状態をリセット
        scrollToBottom();
        hideScrollButton();
    });
    
    chatWindow.addEventListener('scroll', function(e) {
        const currentScrollTop = chatWindow.scrollTop;
        
        // スクロール位置が変化した場合のみ処理
        if (Math.abs(currentScrollTop - lastScrollTop) > 1) {
            isUserScrolling = true;
            lastScrollTop = currentScrollTop;
        }        
        scrollEventTimer = setTimeout(() => {
            updateScrollButtonVisibility();
        }, 50);
    });

    // ホイールイベントの検出
    chatWindow.addEventListener('wheel', function(e) {
        if (Math.abs(e.deltaY) > 0) {
            isUserScrolling = true;
            updateScrollButtonVisibility()
        }
    }, { passive: true });

    // タッチイベントの検出（モバイル対応）
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

    // キーボードイベントの検出
    document.addEventListener('keydown', function(e) {
        if (document.activeElement === chatContainer || chatContainer.contains(document.activeElement)) {
            if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', 'Space'].includes(e.key)) {
                isUserScrolling = true;
                updateScrollButtonVisibility()
            }
        }
    });

    // MutationObserverでDOM変更を監視（フォールバック）
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

    // chatContainerとその子要素の変更を監視
    observer.observe(chatContainer, {
        childList: true,
        subtree: true,
        characterData: true
    });

    function generateSessionId() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0,
                v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    stopBtn.addEventListener('click', async () => {
        console.log('STOP button clicked');
        // ここにエージェント停止処理を実装
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
            // STOPボタンが押されたら、Sendボタンに戻す
            sendBtn.style.display = 'block';
            stopBtn.style.display = 'none';

        } catch (error) {
            console.error('Error sending stop request:', error);
            appendMessage('Error: Could not stop agent.', 'ai');
        }
    });

    // Function to open rule file in notepad
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
            
            // Optional: Show a brief success message to the user
            // You could add a small toast notification here if desired
            
        } catch (error) {
            console.error('Error opening file:', error);
            alert(`ファイルを開けませんでした: ${error.message}`);
        }
    }

    // DOMにルール行を追加する（デフォルト: disabled=false → チェックON）
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
        toggleInput.checked = true; // disabled: false
        const sliderSpan = document.createElement('span');
        sliderSpan.className = 'slider round';

        toggleLabel.appendChild(toggleInput);
        toggleLabel.appendChild(sliderSpan);

        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-rule-btn';
        deleteButton.innerHTML = '🗑️'; // ゴミ箱アイコン
        deleteButton.title = 'ルールを削除';
        deleteButton.addEventListener('click', () => deleteRule(filePath)); // 新しいルールにも削除イベントを追加

        ruleRow.appendChild(ruleFileSpan);
        ruleRow.appendChild(toggleLabel);
        ruleRow.appendChild(deleteButton);
        rulesList.appendChild(ruleRow);
    }

    // ルールを削除する関数
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

            // DOMから該当するルール行を削除
            const ruleRowToRemove = rulesList.querySelector(`.rule-row .rule-file[data-rule-file="${filePath}"]`)?.closest('.rule-row');
            if (ruleRowToRemove) {
                ruleRowToRemove.remove();
            }
            // 再取得
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

    // Update the renderRulesList function to make rule files clickable
    function renderRulesList(rules) {
        rulesList.innerHTML = '';
        if (rules.length === 0) {
            rulesList.innerHTML = '<div>ルールが設定されていません。</div>';
            return;
        }

        rules.forEach(rule => {
            const ruleRow = document.createElement('div');
            ruleRow.className = 'rule-row';
            // Create clickable file name element
            const ruleFileSpan = document.createElement('span');
            ruleFileSpan.className = 'rule-file clickable-rule-file';
            ruleFileSpan.textContent = rule.file;
            ruleFileSpan.title = 'クリックしてファイルを開く';
            ruleFileSpan.style.cursor = 'pointer';
            // Add click event to open file
            ruleFileSpan.addEventListener('click', () => {
                openRuleFile(rule.file);
            });
            // Create toggle switch
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
            deleteButton.innerHTML = '🗑️'; // ゴミ箱アイコン
            deleteButton.title = 'ルールを削除';
            deleteButton.addEventListener('click', () => deleteRule(rule.file)); // 削除イベントを追加

            ruleRow.appendChild(ruleFileSpan);
            ruleRow.appendChild(toggleLabel);
            ruleRow.appendChild(deleteButton); // 削除ボタンを追加
            rulesList.appendChild(ruleRow);
        });
    }

    // 初期化
    hideScrollButton();
    lastScrollTop = chatWindow.scrollTop;
    adjustChatAreaLayout(); // 初期ロード時にレイアウトを調整
    
    // chat-formのサイズ変更を監視し、レイアウトを調整
    const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
            if (entry.target === chatForm) {
                adjustChatAreaLayout();
            }
        }
    });
    resizeObserver.observe(chatForm);

    

    // Initial loads
    loadThreads();
    loadModels();
    loadThreadMessages(sessionId)
    // ページ読み込み完了後に最下部にスクロール
    window.addEventListener('load', () => {
        setTimeout(() => {
            if (chatWindow.children.length > 0) {
                scrollToBottom();
            }
        }, 100);
    });
    updateMcpStatus(); // Initial MCP status check
    setInterval(updateMcpStatus, 10000); // Update every 5 seconds
});


// トースト表示関数
function showToast(message, type = 'info') {
    // 簡単なトースト実装
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    // スタイルを設定
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
    
    // タイプ別の色設定
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
    
    // フェードイン
    setTimeout(() => {
        toast.style.opacity = '1';
    }, 100);
    
    // 3秒後にフェードアウトして削除
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 3000);
}
