let currentCode = '';
let currentLanguage = 'python';

// Update temperature display
document.getElementById('temperature').addEventListener('input', (e) => {
    document.getElementById('tempValue').textContent = e.target.value;
});

// Generate code function
async function generateCode() {
    const prompt = document.getElementById('prompt').value.trim();
    const language = document.getElementById('language').value;
    const temperature = parseFloat(document.getElementById('temperature').value);

    if (!prompt) {
        alert('Please enter a code prompt');
        return;
    }

    const btn = document.querySelector('.btn-generate');
    const loading = document.getElementById('loadingIndicator');
    const codeOutput = document.getElementById('codeOutput');

    btn.disabled = true;
    loading.style.display = 'flex';
    codeOutput.textContent = '';
    currentCode = '';
    currentLanguage = language;

    try {
        const response = await fetch('/api/generate-code', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt: prompt,
                language: language,
                temperature: temperature
            })
        });

        if (!response.ok) {
            throw new Error('Failed to generate code');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            currentCode += chunk;
            codeOutput.textContent = currentCode;

            // Update highlight.js
            hljs.highlightElement(codeOutput);
        }

    } catch (error) {
        alert('Error: ' + error.message);
        codeOutput.textContent = 'Error generating code. Please try again.';
    } finally {
        btn.disabled = false;
        loading.style.display = 'none';
    }
}

// Copy to clipboard
function copyToClipboard() {
    if (!currentCode) {
        alert('No code to copy');
        return;
    }

    navigator.clipboard.writeText(currentCode).then(() => {
        const btn = document.querySelector('.btn-copy');
        const originalText = btn.textContent;
        btn.textContent = '✓ Copied!';
        setTimeout(() => {
            btn.textContent = originalText;
        }, 2000);
    }).catch(() => {
        alert('Failed to copy to clipboard');
    });
}

// Save code modal
function saveCode() {
    if (!currentCode) {
        alert('No code to save');
        return;
    }
    document.getElementById('saveModal').style.display = 'flex';
}

function closeSaveModal() {
    document.getElementById('saveModal').style.display = 'none';
}

async function confirmSave() {
    const title = document.getElementById('saveTitle').value.trim() || 'Untitled Code';
    const prompt = document.getElementById('prompt').value;

    try {
        const response = await fetch('/api/save-code', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                code: currentCode,
                prompt: prompt,
                language: currentLanguage,
                title: title
            })
        });

        if (!response.ok) {
            throw new Error('Failed to save code');
        }

        alert('Code saved successfully!');
        closeSaveModal();
        document.getElementById('saveTitle').value = '';
        loadHistory();

    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// Download code
function downloadCode() {
    if (!currentCode) {
        alert('No code to download');
        return;
    }

    const extensions = {
        'python': 'py',
        'javascript': 'js',
        'java': 'java',
        'cpp': 'cpp',
        'csharp': 'cs',
        'go': 'go',
        'rust': 'rs',
        'sql': 'sql',
        'html': 'html',
        'css': 'css'
    };

    const ext = extensions[currentLanguage] || 'txt';
    const filename = `generated_code_${new Date().getTime()}.${ext}`;

    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(currentCode));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

// Load and display history
async function loadHistory() {
    try {
        const response = await fetch('/api/history');
        const data = await response.json();
        const historyList = document.getElementById('historyList');

        if (data.data.length === 0) {
            historyList.innerHTML = '<p class="empty-message">No saved code yet</p>';
            return;
        }

        historyList.innerHTML = data.data.map(item => `
            <div class="history-item">
                <div class="history-item-title">${item.title}</div>
                <div class="history-item-lang">📝 ${item.language}</div>
                <div class="history-item-date">${new Date(item.created_at).toLocaleDateString()}</div>
                <div style="margin-top: 8px; display: flex; gap: 8px;">
                    <button class="history-item-delete" style="flex: 1;" onclick="loadCodeToEditor('${item.id}')">Load</button>
                    <button class="history-item-delete" style="flex: 1;" onclick="deleteHistory('${item.id}')">Delete</button>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error loading history:', error);
    }
}

// Load code from history to editor
async function loadCodeToEditor(codeId) {
    try {
        const response = await fetch('/api/history');
        const data = await response.json();
        const item = data.data.find(i => i.id === codeId);

        if (item) {
            document.getElementById('language').value = item.language;
            document.getElementById('prompt').value = item.prompt;
            currentCode = item.code;
            currentLanguage = item.language;

            const codeOutput = document.getElementById('codeOutput');
            codeOutput.textContent = currentCode;
            codeOutput.className = `language-${item.language}`;
            hljs.highlightElement(codeOutput);

            // Scroll to output
            document.querySelector('.output-section').scrollIntoView({ behavior: 'smooth' });
        }
    } catch (error) {
        alert('Error loading code: ' + error.message);
    }
}

// Delete history item
async function deleteHistory(codeId) {
    if (!confirm('Are you sure you want to delete this code?')) {
        return;
    }

    try {
        const response = await fetch(`/api/history/${codeId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('Failed to delete code');
        }

        loadHistory();
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// Clear all history
async function clearAllHistory() {
    if (!confirm('Are you sure you want to delete ALL saved code? This cannot be undone.')) {
        return;
    }

    try {
        const response = await fetch('/api/history');
        const data = await response.json();

        for (const item of data.data) {
            await fetch(`/api/history/${item.id}`, { method: 'DELETE' });
        }

        loadHistory();
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// Allow Enter key in prompt (Shift+Enter for newline)
document.getElementById('prompt').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        generateCode();
    }
});

// Load history on page load
window.addEventListener('load', loadHistory;