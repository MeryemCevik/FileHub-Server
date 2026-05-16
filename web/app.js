/**
 * ANDROID FILE SERVER - WEB INTERFACE
 * Logic for Dashboard and File Explorer
 */

// --- CONFIGURATION ---
const CONFIG = {
    endpoints: {
        files: '/api/files',
        start: '/api/server/start',
        stop: '/api/server/stop',
        download: '/download'
    }
};

let currentPath = '';

/**
 * SERVER CONTROL: Start the server
 */
async function startServer() {
    console.log("Attempting to start server...");
    try {
        // Envoi de la requête au backend
        // const response = await fetch(CONFIG.endpoints.start, { method: 'POST' });
        // if (response.ok) updateServerStatusUI(true);

        // Simulation pour la démo UI
        updateServerStatusUI(true);
        alert("Server start command sent successfully.");
    } catch (error) {
        console.error("Error starting server:", error);
    }
}

/**
 * SERVER CONTROL: Stop the server
 */
async function stopServer() {
    console.log("Attempting to stop server...");
    try {
        // Envoi de la requête au backend
        // const response = await fetch(CONFIG.endpoints.stop, { method: 'POST' });
        // if (response.ok) updateServerStatusUI(false);

        // Simulation pour la démo UI
        updateServerStatusUI(false);
        alert("Server stop command sent successfully.");
    } catch (error) {
        console.error("Error stopping server:", error);
    }
}

/**
 * Mise à jour visuelle du statut
 */
function updateServerStatusUI(isRunning) {
    const statusEl = document.getElementById('server-status');
    if (!statusEl) return;

    if (isRunning) {
        statusEl.innerHTML = '<span class="w-2.5 h-2.5 mr-2 rounded-full bg-green-500 animate-pulse"></span>Running';
        statusEl.className = 'inline-flex items-center px-4 py-1.5 rounded-full text-sm font-semibold bg-green-100 text-green-700 border border-green-200';
    } else {
        statusEl.innerHTML = '<span class="w-2.5 h-2.5 mr-2 rounded-full bg-red-500"></span>Stopped';
        statusEl.className = 'inline-flex items-center px-4 py-1.5 rounded-full text-sm font-semibold bg-red-100 text-red-700 border border-red-200';
    }
}

/**
 * FILE EXPLORER: Load files from a path
 */
async function loadFiles(path) {
    console.log("Loading files for path:", path);
    currentPath = path;

    const fileListEl = document.getElementById('file-list');
    if (!fileListEl) return;

    // Show loading state
    fileListEl.innerHTML = `
        <div class="p-20 text-center">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-violet-100 border-t-violet-600 mb-4"></div>
            <p class="text-gray-400 font-medium">Updating file list...</p>
        </div>
    `;

    try {
        /*
        // Appel réel au backend
        const response = await fetch(`${CONFIG.endpoints.files}?path=${encodeURIComponent(path)}`);
        const files = await response.json();
        renderFileList(files);
        updateBreadcrumb(path);
        */

        // SIMULATION de données pour le design
        setTimeout(() => {
            const mockFiles = generateMockFiles(path);
            renderFileList(mockFiles);
            updateBreadcrumb(path);
        }, 500);

    } catch (error) {
        console.error("Error loading files:", error);
        fileListEl.innerHTML = `<div class="p-10 text-center text-red-500 font-medium">Error loading files. Is the server running?</div>`;
    }
}

/**
 * Génération de données factices pour la démo de l'UI
 */
function generateMockFiles(path) {
    if (path === '/Documents') {
        return [
            { name: 'Work', isDir: true, path: '/Documents/Work' },
            { name: 'Resume.pdf', isDir: false, path: '/Documents/Resume.pdf', size: '1.2 MB' },
            { name: 'Budget.xlsx', isDir: false, path: '/Documents/Budget.xlsx', size: '450 KB' }
        ];
    }
    return [
        { name: 'Documents', isDir: true, path: '/Documents' },
        { name: 'Downloads', isDir: true, path: '/Downloads' },
        { name: 'Music', isDir: true, path: '/Music' },
        { name: 'Photos', isDir: true, path: '/Photos' },
        { name: 'system_log.txt', isDir: false, path: '/system_log.txt', size: '24 KB' },
        { name: 'backup_v1.zip', isDir: false, path: '/backup_v1.zip', size: '156 MB' }
    ];
}

/**
 * Rendu de la liste des fichiers
 */
function renderFileList(files) {
    const fileListEl = document.getElementById('file-list');
    const emptyStateEl = document.getElementById('empty-state');

    if (files.length === 0) {
        fileListEl.innerHTML = '';
        emptyStateEl.classList.remove('hidden');
        return;
    }

    emptyStateEl.classList.add('hidden');

    fileListEl.innerHTML = files.map(file => `
        <div class="grid grid-cols-12 gap-4 px-6 py-4 items-center file-item transition-colors duration-150 cursor-pointer group"
             onclick="${file.isDir ? `loadFiles('${file.path}')` : `downloadFile('${file.path}')`}">

            <div class="col-span-8 md:col-span-6 flex items-center">
                <div class="p-2.5 rounded-xl mr-4 ${file.isDir ? 'bg-violet-50 text-violet-500' : 'bg-gray-50 text-gray-400'} group-hover:scale-110 transition-transform">
                    ${file.isDir
                        ? '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg>'
                        : '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>'}
                </div>
                <span class="font-semibold text-gray-700 group-hover:text-violet-600 transition-colors truncate">${file.name}</span>
            </div>

            <div class="hidden md:block md:col-span-3 text-right text-sm text-gray-400 font-medium">
                ${file.isDir ? '--' : file.size}
            </div>

            <div class="col-span-4 md:col-span-3 text-right">
                <button class="inline-flex items-center justify-center p-2 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-all">
                    ${file.isDir
                        ? '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>'
                        : '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>'}
                </button>
            </div>
        </div>
    `).join('');
}

/**
 * Mise à jour du fil d'Ariane
 */
function updateBreadcrumb(path) {
    const breadcrumbEl = document.getElementById('breadcrumb');
    if (!breadcrumbEl) return;

    const parts = path.split('/').filter(p => p);
    let html = `<span class="breadcrumb-item cursor-pointer hover:text-violet-600 transition-colors" onclick="loadFiles('')">Root</span>`;

    let currentAcc = '';
    parts.forEach((part, index) => {
        currentAcc += '/' + part;
        html += `<span class="breadcrumb-item cursor-pointer hover:text-violet-600 transition-colors" onclick="loadFiles('${currentAcc}')">${part}</span>`;
    });

    breadcrumbEl.innerHTML = html;
}

/**
 * DOWNLOAD: Trigger file download
 */
function downloadFile(path) {
    console.log("Downloading file from:", path);
    window.location.href = `${CONFIG.endpoints.download}${path}`;
}
