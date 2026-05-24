/**
 * CONFIGURATION ET VARIABLES GLOBALES
 */
const CONFIG = {
    endpoints: {
        files: '/api/files',     // Liste des fichiers
        download: '/download/',  // Téléchargement
        delete: '/api/delete',   // Suppression
        mkdir: '/api/mkdir',     // Création de dossier
        config: '/api/config',   // Informations serveur (nom racine)
        upload: '/api/upload'    // Envoi de fichiers
    }
};

let currentPath = '';            // Dossier actuel
let selectedPaths = new Set();   // Liste des fichiers cochés
let allFilesCount = 0;           // Nombre total de fichiers dans le dossier actuel
let rootName = 'Racine';         // Nom du point de départ (dynamique)
let currentUploadXHR = null;     // Requête d'upload en cours (pour annulation)
let uploadQueue = [];            // File d'attente pour l'upload multiple
let isUploading = false;         // État du transfert

/**
 * INITIALISATION DE L'APPLICATION
 * Appelé au chargement de la page.
 */
async function initApp() {
    // 1. Gestion du thème (Sombre/Clair)
    const isDark = localStorage.getItem('theme') === 'dark';
    document.getElementById('theme-toggle').checked = isDark;
    if (isDark) document.body.classList.add('dark');

    // 2. Récupération de la configuration du serveur
    try {
        const res = await fetch(CONFIG.endpoints.config);
        const data = await res.json();
        rootName = data.rootName || 'Racine';
    } catch (e) {
        console.error("Erreur chargement config", e);
    }

    // 3. Premier chargement des fichiers
    loadFiles('', true);

    // 4. Activation du Drag & Drop
    setupDragAndDrop();
}

// Lancement automatique au chargement du script
window.onload = initApp;

/**
 * GESTION DU THÈME
 */
function toggleTheme() {
    const isDark = document.getElementById('theme-toggle').checked;
    if (isDark) {
        document.body.classList.add('dark');
        localStorage.setItem('theme', 'dark');
    } else {
        document.body.classList.remove('dark');
        localStorage.setItem('theme', 'light');
    }
}

/**
 * NAVIGATION ENTRE SECTIONS (Explorateur / À propos)
 */
function switchSection(id) {
    ['explorer', 'about'].forEach(s => {
        document.getElementById('section-' + s).classList.add('hidden');
        document.getElementById('nav-' + s).classList.remove('active');
    });
    document.getElementById('section-' + id).classList.remove('hidden');
    document.getElementById('nav-' + id).classList.add('active');
}

/**
 * CHARGEMENT DES FICHIERS
 * @param {string} path Chemin relatif à charger
 * @param {boolean} pushState Si true, ajoute une étape dans l'historique (bouton retour)
 */
async function loadFiles(path, pushState = true) {
    currentPath = path;
    selectedPaths.clear();
    updateToolbarState();

    // Mise à jour de l'historique du navigateur (pour le bouton retour du téléphone)
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

/**
 * ÉCOUTE DU BOUTON RETOUR PHYSIQUE
 */
window.onpopstate = function(event) {
    if (event.state && event.state.path !== undefined) {
        loadFiles(event.state.path, false);
    } else {
        loadFiles('', false);
    }
};

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

        return `
        <div class="grid grid-cols-12 gap-4 px-6 py-4 items-center file-item group"
             onclick="handleItemClick(event, '${file.isDir}', '${file.path.replace(/'/g, "\\'")}')">

            <div class="col-span-1 flex items-center" onclick="event.stopPropagation()">
                <input type="checkbox" class="item-checkbox w-4 h-4 rounded border-gray-300 text-accent focus:ring-accent"
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

            <div class="col-span-4 md:col-span-3 text-right flex justify-end items-center space-x-2">
                ${!file.isDir ? `
                <button onclick="event.stopPropagation(); downloadFile('${file.path.replace(/'/g, "\\'")}')"
                        title="Télécharger"
                        class="p-2 text-secondary hover:text-accent transition-colors">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                    </svg>
                </button>
                ` : ''}
                <span class="text-gray-300 group-hover:text-accent">→</span>
            </div>
        </div>
    `}).join('');
}

/**
 * ACTIONS AU CLIC SUR UNE LIGNE
 */
function handleItemClick(event, isDir, path) {
    if (isDir === 'true') loadFiles(path);
    else downloadFile(path);
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

/**
 * SUPPRESSION
 */
async function deleteSelected() {
    const count = selectedPaths.size;
    if (count === 0) return alert("Sélectionnez au moins un élément.");
    if (!confirm(`Voulez-vous vraiment supprimer ces ${count} éléments ?`)) return;

    for (const path of selectedPaths) {
        try {
            await fetch(`${CONFIG.endpoints.delete}?path=${encodeURIComponent(path)}`, { method: 'POST' });
        } catch (e) { console.error("Erreur suppression", e); }
    }
    loadFiles(currentPath, false);
}

/**
 * CRÉATION DE DOSSIER
 */
async function createNewFolder() {
    const name = prompt("Nom du nouveau dossier :");
    if (!name) return;
    const res = await fetch(`${CONFIG.endpoints.mkdir}?parentPath=${encodeURIComponent(currentPath)}&name=${encodeURIComponent(name)}`, { method: 'POST' });
    if (res.ok) loadFiles(currentPath, false);
    else alert("Erreur création dossier");
}

/**
 * DRAG & DROP
 */
function setupDragAndDrop() {
    const dropZone = document.getElementById('drop-zone');
    if (!dropZone) return;

    window.addEventListener('dragenter', (e) => {
        e.preventDefault();
        dropZone.classList.remove('hidden');
    });

    dropZone.addEventListener('dragleave', (e) => {
        if (e.relatedTarget === null) dropZone.classList.add('hidden');
    });

    window.addEventListener('dragover', (e) => e.preventDefault());

    window.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.add('hidden');
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) handleMultipleFileUploads(files);
    });
}

/**
 * ENVOI DE FICHIERS (UPLOAD)
 */
function handleFileUpload(input) {
    const files = Array.from(input.files);
    if (files.length > 0) handleMultipleFileUploads(files);
    input.value = '';
}

function handleMultipleFileUploads(files) {
    uploadQueue = [...files];
    const totalFiles = uploadQueue.length;
    processNextInQueue(0, totalFiles);
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
        if (xhr.status === 200) processNextInQueue(currentIndex + 1, totalFiles);
        else {
            overlay.classList.add('hidden');
            alert(`Erreur envoi ${file.name}: ${xhr.responseText}`);
            isUploading = false;
        }
    };

    xhr.onerror = () => {
        overlay.classList.add('hidden');
        alert("Erreur réseau");
        isUploading = false;
    };

    document.getElementById('cancel-upload').onclick = () => {
        xhr.abort();
        uploadQueue = [];
        isUploading = false;
        overlay.classList.add('hidden');
    };

    xhr.send(formData);
}

/**
 * TÉLÉCHARGEMENT
 */
function downloadFile(path) {
    window.open(`${CONFIG.endpoints.download}${encodeURIComponent(path)}`, '_blank');
}

/**
 * INTERFACE (BREADCRUMB & FIL D'ARIANE)
 */
function updateBreadcrumb(path) {
    const el = document.getElementById('breadcrumb');
    const parts = path.split('/').filter(Boolean);
    document.querySelector('#section-explorer h2').textContent = "Explorateur";

    let html = `<span class="text-secondary cursor-pointer hover:text-accent" onclick="loadFiles('')">${rootName}</span>`;
    let acc = '';
    parts.forEach(p => {
        acc += (acc ? '/' : '') + p;
        html += `<span class="mx-2 text-gray-400">›</span><span class="text-secondary cursor-pointer hover:text-accent" onclick="loadFiles('${acc.replace(/'/g, "\\'")}')">${p}</span>`;
    });
    el.innerHTML = html;
}

/**
 * UTILITAIRES D'ICÔNES
 */
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
