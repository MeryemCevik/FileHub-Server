/**
 * CONFIGURATION ET VARIABLES GLOBALES
 */
const CONFIG = {
    endpoints: {
        files: '/api/files',     // Liste des fichiers
        download: '/download/',  // Téléchargement direct
        delete: '/api/delete',   // Suppression
        mkdir: '/api/mkdir',     // Création de dossier
        config: '/api/config',   // Informations serveur
        upload: '/api/upload',   // Envoi de fichiers
        zip: '/api/zip'          // Téléchargement groupé (ZIP)
    }
};

let currentPath = '';
let selectedPaths = new Set();   // Persiste désormais entre les dossiers
let allFilesCount = 0;
let rootName = 'Racine';
let currentUploadXHR = null;
let uploadQueue = [];
let isUploading = false;

/**
 * INITIALISATION
 */
async function initApp() {
    const isDark = localStorage.getItem('theme') === 'dark';
    document.getElementById('theme-toggle').checked = isDark;
    if (isDark) document.body.classList.add('dark');

    try {
        const res = await fetch(CONFIG.endpoints.config);
        const data = await res.json();
        rootName = data.rootName || 'Racine';
    } catch (e) { console.error("Erreur config", e); }

    loadFiles('', true);
    setupDragAndDrop();
}

window.onload = initApp;

/**
 * CHARGEMENT DES FICHIERS
 */
async function loadFiles(path, pushState = true) {
    currentPath = path;
    // selectedPaths.clear(); // SUPPRIMÉ : On ne vide plus la sélection en changeant de dossier !
    updateToolbarState();

    if (pushState) history.pushState({ path: path }, "", "");

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
        const files = await res.json();
        allFilesCount = files.length;
        renderFileList(files);
        updateBreadcrumb(path);
    } catch (e) {
        fileListEl.innerHTML = `<div class="py-20 text-center text-red-500 font-bold">Erreur de connexion</div>`;
    }
}

window.onpopstate = (e) => { if (e.state) loadFiles(e.state.path, false); };

/**
 * AFFICHAGE DE LA LISTE
 */
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
        // Vérifie si le fichier est déjà dans notre sélection globale
        const isChecked = selectedPaths.has(file.path);

        return `
        <div class="grid grid-cols-12 gap-4 px-6 py-4 items-center file-item group"
             onclick="handleItemClick(event, '${file.isDir}', '${file.path.replace(/'/g, "\\'")}')">

            <div class="col-span-1 flex items-center" onclick="event.stopPropagation()">
                <input type="checkbox" class="item-checkbox w-4 h-4 rounded border-gray-300 text-accent focus:ring-accent"
                       data-path="${file.path.replace(/'/g, "\\'")}"
                       ${isChecked ? 'checked' : ''}
                       onchange="toggleItemSelection(this)">
            </div>

            <div class="col-span-7 md:col-span-5 flex items-center">
                <div class="p-2.5 rounded-xl mr-4 ${iconClass}">${icon}</div>
                <div class="truncate">
                    <p class="font-bold text-primary group-hover:text-accent">${file.name}</p>
                    <p class="md:hidden text-[10px] text-secondary uppercase">${file.isDir ? 'Dossier' : file.size}</p>
                </div>
            </div>

            <div class="hidden md:block md:col-span-3 text-right text-sm text-secondary font-medium">${file.isDir ? 'Dossier' : file.size}</div>

            <div class="col-span-4 md:col-span-3 text-right">
                <span class="text-gray-300 group-hover:text-accent">→</span>
            </div>
        </div>
    `}).join('');
}

function handleItemClick(event, isDir, path) {
    if (isDir === 'true') loadFiles(path);
}

/**
 * GESTION DE LA SÉLECTION
 */
function toggleItemSelection(checkbox) {
    const path = checkbox.getAttribute('data-path');
    if (checkbox.checked) selectedPaths.add(path);
    else selectedPaths.delete(path);
    updateToolbarState();
}

function toggleSelectAll() {
    const checkboxes = document.querySelectorAll('.item-checkbox');
    const currentFolderFiles = Array.from(checkboxes).map(cb => cb.getAttribute('data-path'));

    // Si tout le dossier actuel est déjà sélectionné, on enlève tout
    const allChecked = currentFolderFiles.every(path => selectedPaths.has(path));

    currentFolderFiles.forEach(path => {
        if (allChecked) selectedPaths.delete(path);
        else selectedPaths.add(path);
    });

    renderFileList(lastFilesData || []); // Optionnel : rafraîchir l'UI
    loadFiles(currentPath, false); // Plus simple : recharger la vue actuelle
}

function updateToolbarState() {
    const hasSelection = selectedPaths.size > 0;
    const selectBtnText = document.querySelector('#btn-select-all span');

    // On change le texte du bouton selon la sélection
    if (selectBtnText) {
        selectBtnText.textContent = hasSelection ? `Vider la sélection (${selectedPaths.size})` : "Tout sélectionner";
    }

    const deleteBtn = document.getElementById('bulk-delete');
    const downloadBtn = document.getElementById('bulk-download');

    if (deleteBtn) deleteBtn.classList.toggle('hidden', !hasSelection);
    if (downloadBtn) downloadBtn.classList.toggle('hidden', !hasSelection);
}

/**
 * TÉLÉCHARGEMENT ZIP (SÉLECTION MULTI-DOSSIERS)
 */
function downloadSelectedAsZip() {
    if (selectedPaths.size === 0) return;

    const baseUrl = CONFIG.endpoints.zip;
    const params = new URLSearchParams();
    // On envoie TOUS les chemins stockés, peu importe le dossier
    selectedPaths.forEach(path => params.append('paths', path));

    window.open(`${baseUrl}?${params.toString()}`, '_blank');
}

/**
 * SUPPRESSION ET CRÉATION
 */
async function deleteSelected() {
    const count = selectedPaths.size;
    if (count === 0) return;
    if (!confirm(`Supprimer définitivement ${count} éléments ?`)) return;

    const overlay = document.getElementById('upload-overlay');
    const statusText = document.getElementById('upload-status');
    statusText.textContent = "Suppression en cours...";
    overlay.classList.remove('hidden');

    for (const path of selectedPaths) {
        await fetch(`${CONFIG.endpoints.delete}?path=${encodeURIComponent(path)}`, { method: 'POST' });
    }

    selectedPaths.clear();
    overlay.classList.add('hidden');
    loadFiles(currentPath, false);
}

async function createNewFolder() {
    const name = prompt("Nom du nouveau dossier :");
    if (!name) return;
    const res = await fetch(`${CONFIG.endpoints.mkdir}?parentPath=${encodeURIComponent(currentPath)}&name=${encodeURIComponent(name)}`, { method: 'POST' });
    if (res.ok) loadFiles(currentPath, false);
}

/**
 * UPLOAD ET NAVIGATION
 */
function setupDragAndDrop() {
    const dropZone = document.getElementById('drop-zone');
    if (!dropZone) return;
    window.addEventListener('dragenter', (e) => { e.preventDefault(); dropZone.classList.remove('hidden'); });
    dropZone.addEventListener('dragleave', (e) => { if (e.relatedTarget === null) dropZone.classList.add('hidden'); });
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.add('hidden');
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) handleMultipleFileUploads(files);
    });
}

function handleFileUpload(input) {
    const files = Array.from(input.files);
    if (files.length > 0) handleMultipleFileUploads(files);
    input.value = '';
}

function handleMultipleFileUploads(files) {
    uploadQueue = [...files];
    processNextInQueue(0, uploadQueue.length);
}

async function processNextInQueue(currentIndex, totalFiles) {
    if (uploadQueue.length === 0) {
        document.getElementById('upload-overlay').classList.add('hidden');
        loadFiles(currentPath, false);
        return;
    }
    const file = uploadQueue.shift();
    const overlay = document.getElementById('upload-overlay');
    document.getElementById('upload-status').textContent = "Envoi du fichier...";
    document.getElementById('upload-filename').textContent = file.name;
    document.getElementById('upload-count').textContent = `Fichier ${currentIndex + 1} sur ${totalFiles}`;
    document.getElementById('upload-count').classList.remove('hidden');
    overlay.classList.remove('hidden');

    const formData = new FormData();
    formData.append('file', file);
    const xhr = new XMLHttpRequest();
    const url = `${CONFIG.endpoints.upload}?path=${encodeURIComponent(currentPath)}&fileName=${encodeURIComponent(file.name)}`;
    xhr.open('POST', url, true);
    xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            document.getElementById('upload-progress-bar').style.width = percent + '%';
            document.getElementById('upload-percentage').textContent = percent + '%';
        }
    };
    xhr.onload = () => {
        if (xhr.status === 200) processNextInQueue(currentIndex + 1, totalFiles);
        else { alert(`Erreur envoi ${file.name}`); overlay.classList.add('hidden'); }
    };
    document.getElementById('cancel-upload').onclick = () => { xhr.abort(); uploadQueue = []; overlay.classList.add('hidden'); };
    xhr.send(formData);
}

function updateBreadcrumb(path) {
    const el = document.getElementById('breadcrumb');
    const parts = path.split('/').filter(Boolean);
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

function toggleTheme() {
    const isDark = document.getElementById('theme-toggle').checked;
    if (isDark) { document.body.classList.add('dark'); localStorage.setItem('theme', 'dark'); }
    else { document.body.classList.remove('dark'); localStorage.setItem('theme', 'light'); }
}

function switchSection(id) {
    ['explorer', 'about'].forEach(s => {
        document.getElementById('section-' + s).classList.add('hidden');
        document.getElementById('nav-' + s).classList.remove('active');
    });
    document.getElementById('section-' + id).classList.remove('hidden');
    document.getElementById('nav-' + id).classList.add('active');
}
