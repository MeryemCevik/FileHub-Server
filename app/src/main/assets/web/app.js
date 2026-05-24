const CONFIG = {
    endpoints: {
        files: '/api/files',
        download: '/download/',
        delete: '/api/delete',
        mkdir: '/api/mkdir',
        config: '/api/config',
        upload: '/api/upload'
    }
};

let currentPath = '';
let selectedPaths = new Set();
let allFilesCount = 0;
let rootName = 'Racine';
let currentUploadXHR = null;
let uploadQueue = [];
let isUploading = false;

/**
 * Initialise l'application
 */
async function initApp() {
    try {
        const res = await fetch(CONFIG.endpoints.config);
        const data = await res.json();
        rootName = data.rootName || 'Racine';
    } catch (e) {
        console.error("Erreur config", e);
    }
    loadFiles('', true);
    setupDragAndDrop();
}

window.onload = initApp;

/**
 * Charge les fichiers d'un dossier
 */
async function loadFiles(path, pushState = true) {
    currentPath = path;
    selectedPaths.clear();
    updateToolbarState();

    if (pushState) {
        history.pushState({ path: path }, "", "");
    }

    const fileListEl = document.getElementById('file-list');
    const emptyStateEl = document.getElementById('empty-state');

    fileListEl.innerHTML = `
        <div class="py-32 text-center">
            <div class="inline-block loader rounded-full h-10 w-10 border-4 border-gray-200 border-t-accent mb-4"></div>
            <p class="text-secondary font-medium">Chargement des fichiers...</p>
        </div>
    `;

    try {
        const res = await fetch(`${CONFIG.endpoints.files}?path=${encodeURIComponent(path)}`);
        if (!res.ok) throw new Error("Erreur serveur");
        const files = await res.json();

        allFilesCount = files.length;
        renderFileList(files);
        updateBreadcrumb(path);

    } catch (e) {
        fileListEl.innerHTML = `
            <div class="py-20 text-center">
                <h3 class="text-lg font-bold text-red-500 mb-1">Erreur de connexion</h3>
                <p class="text-sm text-secondary">Le serveur ne répond pas</p>
                <button onclick="loadFiles('${path}')" class="mt-6 px-6 py-2 bg-accent text-white rounded-xl">Réessayer</button>
            </div>
        `;
    }
}

window.onpopstate = function(event) {
    if (event.state && event.state.path !== undefined) {
        loadFiles(event.state.path, false);
    } else {
        loadFiles('', false);
    }
};

function renderFileList(files) {
    const fileListEl = document.getElementById('file-list');
    const emptyStateEl = document.getElementById('empty-state');

    if (!files.length) {
        fileListEl.innerHTML = '';
        emptyStateEl.classList.remove('hidden');
        return;
    }

    emptyStateEl.classList.add('hidden');

    fileListEl.innerHTML = files.map(file => {
        const icon = getFileIcon(file);
        const iconClass = file.isDir ? 'bg-green-100 text-green-700' : getIconBgClass(file.name);

        return `
        <div class="grid grid-cols-12 gap-4 px-6 py-4 items-center file-item group"
             onclick="handleItemClick(event, '${file.isDir}', '${file.path.replace(/'/g, "\\'")}')">

            <div class="col-span-1 flex items-center" onclick="event.stopPropagation()">
                <input type="checkbox" class="item-checkbox w-4 h-4 rounded border-gray-300 text-accent"
                       data-path="${file.path.replace(/'/g, "\\'")}" onchange="toggleItemSelection(this)">
            </div>

            <div class="col-span-7 md:col-span-5 flex items-center">
                <div class="p-2.5 rounded-xl mr-4 ${iconClass}">${icon}</div>
                <div class="truncate">
                    <p class="font-bold text-primary group-hover:text-accent">${file.name}</p>
                    <p class="md:hidden text-[10px] text-secondary uppercase">${file.isDir ? 'Dossier' : file.size}</p>
                </div>
            </div>

            <div class="hidden md:block md:col-span-3 text-right text-sm text-secondary font-medium">${file.isDir ? 'Dossier' : file.size}</div>
            <div class="col-span-4 md:col-span-3 text-right text-gray-300 group-hover:text-accent">→</div>
        </div>
    `}).join('');
}

function handleItemClick(event, isDir, path) {
    if (isDir === 'true') loadFiles(path);
    else window.open(`${CONFIG.endpoints.download}${path}`, '_blank');
}

function toggleItemSelection(checkbox) {
    const path = checkbox.getAttribute('data-path');
    if (checkbox.checked) selectedPaths.add(path);
    else selectedPaths.delete(path);
    updateToolbarState();
}

function toggleSelectAll() {
    const checkboxes = document.querySelectorAll('.item-checkbox');
    const shouldSelectAll = selectedPaths.size < allFilesCount;
    selectedPaths.clear();
    checkboxes.forEach(cb => {
        cb.checked = shouldSelectAll;
        if (shouldSelectAll) selectedPaths.add(cb.getAttribute('data-path'));
    });
    updateToolbarState();
}

function updateToolbarState() {
    const selectBtnText = document.querySelector('#btn-select-all span');
    if (allFilesCount > 0 && selectedPaths.size === allFilesCount) {
        selectBtnText.textContent = "Tout désélectionner";
    } else {
        selectBtnText.textContent = "Tout sélectionner";
    }
    const deleteBtn = document.getElementById('bulk-delete');
    if (deleteBtn) deleteBtn.style.opacity = selectedPaths.size > 0 ? "1" : "0.5";
}

async function deleteSelected() {
    const count = selectedPaths.size;
    if (count === 0) return alert("Sélectionnez au moins un élément.");
    if (!confirm(`Supprimer ${count} éléments ?`)) return;

    for (const path of selectedPaths) {
        try {
            await fetch(`${CONFIG.endpoints.delete}?path=${encodeURIComponent(path)}`, { method: 'POST' });
        } catch (e) { console.error("Erreur suppression", e); }
    }
    loadFiles(currentPath, false);
}

async function createNewFolder() {
    const name = prompt("Nom du nouveau dossier :");
    if (!name) return;
    const res = await fetch(`${CONFIG.endpoints.mkdir}?parentPath=${encodeURIComponent(currentPath)}&name=${encodeURIComponent(name)}`, { method: 'POST' });
    if (res.ok) loadFiles(currentPath, false);
    else alert("Erreur création dossier");
}

/**
 * CONFIGURATION DU DRAG & DROP
 */
function setupDragAndDrop() {
    const dropZone = document.getElementById('drop-zone');

    window.addEventListener('dragenter', (e) => {
        e.preventDefault();
        dropZone.classList.remove('hidden');
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.classList.add('hidden');
    });

    window.addEventListener('dragover', (e) => {
        e.preventDefault();
    });

    window.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.add('hidden');

        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            handleMultipleFileUploads(files);
        }
    });
}

/**
 * GÈRE L'UPLOAD DE PLUSIEURS FICHIERS
 */
function handleMultipleFileUploads(files) {
    uploadQueue = [...files];
    const totalFiles = uploadQueue.length;
    processNextInQueue(0, totalFiles);
}

/**
 * Gère l'envoi via l'input file classique
 */
function handleFileUpload(input) {
    const files = Array.from(input.files);
    if (files.length > 0) {
        handleMultipleFileUploads(files);
    }
    input.value = ''; // Reset
}

async function processNextInQueue(currentIndex, totalFiles) {
    if (uploadQueue.length === 0) {
        isUploading = false;
        document.getElementById('upload-overlay').classList.add('hidden');
        loadFiles(currentPath, false);
        return;
    }

    isUploading = true;
    const file = uploadQueue.shift();
    const overlay = document.getElementById('upload-overlay');
    const progressBar = document.getElementById('upload-progress-bar');
    const percentageText = document.getElementById('upload-percentage');
    const filenameText = document.getElementById('upload-filename');
    const countText = document.getElementById('upload-count');
    const cancelBtn = document.getElementById('cancel-upload');

    // UI Update
    filenameText.textContent = file.name;
    progressBar.style.width = '0%';
    percentageText.textContent = '0%';
    countText.textContent = `Fichier ${currentIndex + 1} sur ${totalFiles}`;
    countText.classList.remove('hidden');
    overlay.classList.remove('hidden');

    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    currentUploadXHR = xhr;

    const url = `${CONFIG.endpoints.upload}?path=${encodeURIComponent(currentPath)}&fileName=${encodeURIComponent(file.name)}`;

    xhr.open('POST', url, true);

    xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            progressBar.style.width = percent + '%';
            percentageText.textContent = percent + '%';
        }
    };

    xhr.onload = () => {
        if (xhr.status === 200) {
            processNextInQueue(currentIndex + 1, totalFiles);
        } else {
            overlay.classList.add('hidden');
            alert(`Erreur lors de l'envoi de ${file.name}: ${xhr.responseText}`);
            isUploading = false;
        }
    };

    xhr.onerror = () => {
        overlay.classList.add('hidden');
        alert("Erreur réseau ou serveur inaccessible.");
        isUploading = false;
    };

    cancelBtn.onclick = () => {
        xhr.abort();
        uploadQueue = [];
        isUploading = false;
        overlay.classList.add('hidden');
    };

    xhr.send(formData);
}

function updateBreadcrumb(path) {
    const el = document.getElementById('breadcrumb');
    const titleEl = document.querySelector('#section-explorer h2');
    const parts = path.split('/').filter(Boolean);
    titleEl.textContent = "Explorateur";
    let html = `<span class="text-secondary cursor-pointer hover:text-accent" onclick="loadFiles('')">${rootName}</span>`;
    let acc = '';
    parts.forEach(p => {
        acc += (acc ? '/' : '') + p;
        html += `<span class="mx-2 text-gray-400">›</span><span class="text-secondary cursor-pointer hover:text-accent" onclick="loadFiles('${acc.replace(/'/g, "\\'")}')">${p}</span>`;
    });
    el.innerHTML = html;
}

function getFileIcon(file) {
    if (file.isDir) return '📁';
    const ext = file.name.split('.').pop().toLowerCase();
    const icons = {
        'jpg': '🖼️', 'jpeg': '🖼️', 'png': '🖼️', 'gif': '🖼️', 'webp': '🖼️',
        'mp4': '🎬', 'mkv': '🎬', 'mov': '🎬', 'mp3': '🎵', 'wav': '🎵',
        'pdf': '📕', 'doc': '📄', 'docx': '📄', 'txt': '📝', 'zip': '📦', 'rar': '📦',
        'html': '💻', 'js': '💻', 'java': '💻', 'apk': '🤖'
    };
    return icons[ext] || '📄';
}

function getIconBgClass(name) {
    const ext = name.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return 'bg-blue-100 text-blue-600';
    if (['mp4', 'mkv', 'mp3'].includes(ext)) return 'bg-purple-100 text-purple-600';
    if (['pdf'].includes(ext)) return 'bg-red-100 text-red-600';
    if (['zip', 'rar'].includes(ext)) return 'bg-yellow-100 text-yellow-700';
    return 'bg-gray-100 text-gray-500';
}
