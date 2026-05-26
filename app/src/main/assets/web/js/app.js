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
        zip: '/api/zip',         // Téléchargement groupé (ZIP)
        rename: '/api/rename'    // Renommer
    }
};

let currentPath = '';
let selectedPaths = new Set();   // Persiste désormais entre les dossiers
let allFilesCount = 0;
let rootName = 'Racine';
let currentUploadXHR = null;
let uploadQueue = [];
let isUploading = false;
let renameTarget = null;

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
    updateToolbarState();

    if (pushState) history.pushState({ path: path }, "", "");

    const isGalleryVisible = !document.getElementById('section-gallery').classList.contains('hidden');

    if (isGalleryVisible) {
        loadGallery(path);
        updateBreadcrumb(path); // Update breadcrumb even in gallery
        return;
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
        const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(file.name.split('.').pop().toLowerCase()) && !file.isDir;
        const icon = getFileIcon(file);
        const iconClass = file.isDir ? 'bg-green-100 text-green-700' : getIconBgClass(file.name);
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

            <div class="col-span-4 md:col-span-3 text-right flex items-center justify-end space-x-2">
                ${isImage ? `
                    <button onclick="event.stopPropagation(); openImageChoice('${file.path.replace(/'/g, "\\'")}')"
                            class="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                            title="Options galerie">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                        </svg>
                    </button>
                ` : ''}
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
    if (checkboxes.length === 0) return;

    const currentFolderFiles = Array.from(checkboxes).map(cb => cb.getAttribute('data-path'));
    const allChecked = currentFolderFiles.every(path => selectedPaths.has(path));

    currentFolderFiles.forEach(path => {
        if (allChecked) selectedPaths.delete(path);
        else selectedPaths.add(path);
    });

    // Mise à jour visuelle immédiate
    checkboxes.forEach(cb => {
        cb.checked = !allChecked;
    });

    updateToolbarState();
}

function updateToolbarState() {
    const hasSelection = selectedPaths.size > 0;
    const isSingleSelection = selectedPaths.size === 1;
    const selectBtnText = document.querySelector('#btn-select-all span');

    // On calcule si tous les fichiers du dossier ACTUEL sont cochés
    const checkboxes = document.querySelectorAll('.item-checkbox');
    const currentFolderFiles = Array.from(checkboxes).map(cb => cb.getAttribute('data-path'));
    const allInFolderChecked = currentFolderFiles.length > 0 && currentFolderFiles.every(path => selectedPaths.has(path));

    if (selectBtnText) {
        selectBtnText.textContent = allInFolderChecked ? "Tout désélectionner" : "Tout sélectionner";
    }

    const deleteBtn = document.getElementById('bulk-delete');
    const downloadBtn = document.getElementById('bulk-download');
    const renameBtn = document.getElementById('bulk-rename');

    if (deleteBtn) deleteBtn.classList.toggle('hidden', !hasSelection);
    if (downloadBtn) downloadBtn.classList.toggle('hidden', !hasSelection);
    if (renameBtn) renameBtn.classList.toggle('hidden', !isSingleSelection);
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
 * RENOMMAGE
 */
function renameSelected() {
    if (selectedPaths.size !== 1) return;

    const path = Array.from(selectedPaths)[0];
    const name = path.split('/').pop();

    openRenameModal(path, name);
}

function openRenameModal(path, name) {
    renameTarget = path;
    const modal = document.getElementById('rename-modal');
    const input = document.getElementById('rename-input');
    input.value = name;
    modal.classList.remove('hidden');
    input.focus();
    input.select();

    // Support de la touche Entrée
    input.onkeydown = (e) => {
        if (e.key === 'Enter') confirmRename();
    };

    document.getElementById('confirm-rename-btn').onclick = confirmRename;
}

function closeRenameModal() {
    document.getElementById('rename-modal').classList.add('hidden');
    renameTarget = null;
}

async function confirmRename() {
    const newName = document.getElementById('rename-input').value.trim();
    if (!newName || !renameTarget) return;

    try {
        const res = await fetch(`${CONFIG.endpoints.rename}?old=${encodeURIComponent(renameTarget)}&new=${encodeURIComponent(newName)}`, { method: 'POST' });
        if (res.ok) {
            closeRenameModal();
            loadFiles(currentPath, false);
        } else {
            const errorText = await res.text();
            alert(errorText || "Erreur lors du renommage. Le nom existe peut-être déjà.");
        }
    } catch (e) {
        alert("Erreur de connexion au serveur.");
    }
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
    ['explorer', 'gallery', 'about'].forEach(s => {
        document.getElementById('section-' + s).classList.add('hidden');
        document.getElementById('nav-' + s).classList.remove('active');
    });
    document.getElementById('section-' + id).classList.remove('hidden');
    document.getElementById('nav-' + id).classList.add('active');

    // Hide/Show breadcrumb for About section
    document.getElementById('breadcrumb').classList.toggle('hidden', id === 'about');

    if (id === 'gallery') loadGallery(currentPath);
    if (id === 'explorer') loadFiles(currentPath, false);
}

/**
 * GALERIE PHOTOS
 */
async function loadGallery(path) {
    const gridEl = document.getElementById('gallery-grid');
    const emptyEl = document.getElementById('gallery-empty');
    const titleEl = document.querySelector('#section-gallery h2');
    const descEl = document.querySelector('#section-gallery p');

    gridEl.innerHTML = '<div class="col-span-full py-20 text-center"><div class="inline-block loader rounded-full h-10 w-10 border-4 border-gray-200 border-t-accent mb-4"></div><p class="text-secondary">Scan des images...</p></div>';
    emptyEl.classList.add('hidden');

    const isGlobal = path === '';
    titleEl.textContent = isGlobal ? "Galerie Globale" : "Galerie Photos";
    descEl.textContent = isGlobal ? "Affichage de toutes les images du téléphone (recherche récursive)." : "Visualisez toutes les images du dossier actuel.";

    try {
        const url = isGlobal
            ? `${CONFIG.endpoints.files}?path=&recursive=true`
            : `${CONFIG.endpoints.files}?path=${encodeURIComponent(path)}`;

        const res = await fetch(url);
        const files = await res.json();

        // Si c'est global, le backend renvoie déjà uniquement les images si recursive=true (dans ma modif FileManager)
        // Mais par sécurité et pour le mode local, on filtre ici aussi
        const images = files.filter(f => !f.isDir && ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(f.name.split('.').pop().toLowerCase()));

        if (images.length === 0) {
            gridEl.innerHTML = '';
            emptyEl.classList.remove('hidden');
            return;
        }

        gridEl.innerHTML = images.map(img => `
            <div id="gallery-img-${img.path.replace(/[/.]/g, '-')}"
                 class="aspect-square relative group overflow-hidden rounded-2xl cursor-pointer bg-gray-100 dark:bg-zinc-800 shadow-sm hover:shadow-xl transition-all"
                 onclick="openLightbox('${CONFIG.endpoints.download}${encodeURIComponent(img.path)}', '${img.path.replace(/'/g, "\\'")}', true)">
                <img src="${CONFIG.endpoints.download}${encodeURIComponent(img.path)}"
                     alt="${img.name}"
                     loading="lazy"
                     class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500">
                <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                    <p class="text-[10px] text-white font-bold truncate">${img.name}</p>
                    <p class="text-[8px] text-gray-300 truncate">${isGlobal ? img.path : img.size}</p>
                </div>
            </div>
        `).join('');
    } catch (e) {
        gridEl.innerHTML = '<div class="col-span-full py-20 text-center text-red-500 font-bold">Erreur de chargement</div>';
    }
}

function openImageChoice(path) {
    const modal = document.getElementById('image-choice-modal');
    modal.classList.remove('hidden');

    document.getElementById('choice-preview-btn').onclick = () => {
        closeImageChoice();
        openLightbox(`${CONFIG.endpoints.download}${encodeURIComponent(path)}`, path, false);
    };

    document.getElementById('choice-gallery-btn').onclick = () => {
        closeImageChoice();
        switchSection('gallery');
        // On attend que la galerie charge puis on scrolle vers l'image si possible
        setTimeout(() => {
            const target = document.getElementById(`gallery-img-${path.replace(/[/.]/g, '-')}`);
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 800);
    };
}

function closeImageChoice() {
    document.getElementById('image-choice-modal').classList.add('hidden');
}

function openLightbox(url, path, showGoto) {
    const lb = document.getElementById('lightbox');
    const img = document.getElementById('lightbox-img');
    const gotoBtn = document.getElementById('lightbox-goto-btn');

    img.src = url;

    // Afficher ou masquer le bouton selon le contexte
    if (gotoBtn) {
        gotoBtn.classList.toggle('hidden', !showGoto);
    }

    // Gérer la redirection vers l'emplacement du fichier
    if (showGoto && gotoBtn) {
        gotoBtn.onclick = () => {
            const parts = path.split('/');
            parts.pop(); // Retirer le nom du fichier pour avoir le dossier
            const folderPath = parts.join('/');

            closeLightbox();
            switchSection('explorer');
            loadFiles(folderPath);
        };
    }

    lb.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeLightbox() {
    document.getElementById('lightbox').classList.add('hidden');
    document.body.style.overflow = '';
}
