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

/**
 * Initialise l'application (charge la config)
 */
async function initApp() {
    try {
        const res = await fetch(CONFIG.endpoints.config);
        const data = await res.json();
        rootName = data.rootName || 'Racine';
    } catch (e) {
        console.error("Erreur chargement config", e);
    }
    loadFiles('', true);
}

// L'initialisation est maintenant gérée par initApp() au lieu de loadFiles('') direct
window.onload = initApp;

/**
 * Gère le chargement des fichiers et l'historique du navigateur.
 * @param {string} path Chemin à charger
 * @param {boolean} pushState Si true, ajoute une entrée dans l'historique (bouton retour)
 */
async function loadFiles(path, pushState = true) {
    currentPath = path;
    selectedPaths.clear();
    updateToolbarState();

    // Gestion de l'historique pour le bouton "Retour" du téléphone
    if (pushState) {
        history.pushState({ path: path }, "", "");
    }

    const fileListEl = document.getElementById('file-list');
    const emptyStateEl = document.getElementById('empty-state');

    fileListEl.innerHTML = `
        <div class="py-32 text-center">
            <div class="inline-block loader rounded-full h-10 w-10 border-4 border-border mb-4"></div>
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
        fileListEl.innerHTML = `
            <div class="py-20 text-center">
                <h3 class="text-lg font-bold text-primary mb-1">Erreur de connexion</h3>
                <p class="text-sm text-secondary">Impossible de joindre le serveur</p>
                <button onclick="loadFiles('${path}')"
                        class="mt-6 px-6 py-2 bg-accent text-white rounded-xl">
                    Réessayer
                </button>
            </div>
        `;
    }
}

/**
 * Écoute le bouton "Retour" du navigateur/téléphone.
 */
window.onpopstate = function(event) {
    if (event.state && event.state.path !== undefined) {
        // On recharge le dossier précédent sans rajouter une étape d'historique (pushState=false)
        loadFiles(event.state.path, false);
    } else {
        // Retour à la racine si pas d'état
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
        const iconClass = file.isDir
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            : getIconBgClass(file.name);

        return `
        <div class="grid grid-cols-12 gap-4 px-6 py-4 items-center file-item group"
             onclick="handleItemClick(event, '${file.isDir}', '${file.path.replace(/'/g, "\\'")}')">

            <!-- CHECKBOX -->
            <div class="col-span-1 flex items-center" onclick="event.stopPropagation()">
                <input type="checkbox"
                       class="item-checkbox w-4 h-4 rounded border-gray-300 text-accent focus:ring-accent"
                       data-path="${file.path.replace(/'/g, "\\'")}"
                       onchange="toggleItemSelection(this)">
            </div>

            <!-- ICON + NAME -->
            <div class="col-span-7 md:col-span-5 flex items-center">

                <div class="p-2.5 rounded-xl mr-4 ${iconClass}">
                    ${icon}
                </div>

                <div class="truncate">
                    <p class="font-bold text-primary group-hover:text-accent">${file.name}</p>
                    <p class="md:hidden text-xs text-secondary uppercase">${file.isDir ? 'Dossier' : file.size}</p>
                </div>
            </div>

            <!-- SIZE -->
            <div class="hidden md:block md:col-span-3 text-right text-sm text-secondary font-medium">${file.isDir ? 'Dossier' : file.size}</div>

            <!-- ACTION -->
            <div class="col-span-4 md:col-span-3 text-right text-gray-300 group-hover:text-accent">→</div>
        </div>
    `}).join('');
}

/**
 * Retourne l'icône appropriée selon l'extension.
 */
function getFileIcon(file) {
    if (file.isDir) return '📁';

    const ext = file.name.split('.').pop().toLowerCase();

    const icons = {
        // Images
        'jpg': '🖼️', 'jpeg': '🖼️', 'png': '🖼️', 'gif': '🖼️', 'webp': '🖼️', 'svg': '🖼️',
        // Vidéos
        'mp4': '🎬', 'mkv': '🎬', 'mov': '🎬', 'avi': '🎬',
        // Audio
        'mp3': '🎵', 'wav': '🎵', 'flac': '🎵', 'ogg': '🎵',
        // Documents
        'pdf': '📕',
        'doc': '📄', 'docx': '📄', 'txt': '📝', 'md': '📝',
        // Archives
        'zip': '📦', 'rar': '📦', '7z': '📦', 'tar': '📦', 'gz': '📦',
        // Code
        'html': '💻', 'css': '💻', 'js': '💻', 'json': '💻', 'java': '💻', 'kt': '💻', 'py': '💻',
        // APK
        'apk': '🤖'
    };

    return icons[ext] || '📄';
}

/**
 * Retourne une couleur de fond différente selon le type de fichier.
 */
function getIconBgClass(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();

    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext))
        return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400';

    if (['mp4', 'mkv', 'mov', 'avi'].includes(ext))
        return 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400';

    if (['pdf'].includes(ext))
        return 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400';

    if (['zip', 'rar', '7z'].includes(ext))
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';

    if (['apk'].includes(ext))
        return 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400';

    return 'soft-bg text-secondary';
}

function handleItemClick(event, isDir, path) {
    if (isDir === 'true') {
        loadFiles(path);
    } else {
        downloadFile(path);
    }
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
    if (deleteBtn) {
        // Le bouton reste visible selon ta demande précédente,
        // mais on peut ajuster son opacité s'il n'y a rien à supprimer.
        deleteBtn.style.opacity = selectedPaths.size > 0 ? "1" : "0.5";
    }
}

async function deleteSelected() {
    const count = selectedPaths.size;
    if (count === 0) {
        alert("Veuillez sélectionner au moins un élément à supprimer.");
        return;
    }

    if (!confirm(`Voulez-vous vraiment supprimer ces ${count} éléments ?`)) return;

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

    try {
        const res = await fetch(`${CONFIG.endpoints.mkdir}?parentPath=${encodeURIComponent(currentPath)}&name=${encodeURIComponent(name)}`, { method: 'POST' });
        if (res.ok) loadFiles(currentPath, false);
        else alert("Erreur lors de la création du dossier");
    } catch (e) { alert("Erreur de connexion"); }
}

async function handleFileUpload(input) {
    const file = input.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    const uploadUrl = `${CONFIG.endpoints.upload}?path=${encodeURIComponent(currentPath)}&fileName=${encodeURIComponent(file.name)}`;

    // Affichage de l'overlay de blocage
    const overlay = document.getElementById('upload-overlay');
    overlay.classList.remove('hidden');

    try {
        const res = await fetch(uploadUrl, {
            method: 'POST',
            body: formData
        });

        if (res.ok) {
            loadFiles(currentPath, false);
        } else {
            alert("Erreur lors de l'envoi du fichier");
        }
    } catch (e) {
        alert("Erreur réseau lors de l'envoi");
    } finally {
        // Masquage de l'overlay
        overlay.classList.add('hidden');
        input.value = '';
    }
}

function updateBreadcrumb(path) {
    const el = document.getElementById('breadcrumb');
    const titleEl = document.querySelector('#section-explorer h2');
    const parts = path.split('/').filter(Boolean);

    // Le titre reste toujours "Explorateur"
    titleEl.textContent = "Explorateur";

    let html = `<span class="text-secondary cursor-pointer hover:text-accent" onclick="loadFiles('')">${rootName}</span>`;
    let acc = '';
    parts.forEach(p => {
        acc += (acc ? '/' : '') + p;
        html += `<span class="mx-2 text-gray-400">›</span><span class="text-secondary cursor-pointer hover:text-accent" onclick="loadFiles('${acc.replace(/'/g, "\\'")}')">${p}</span>`;
    });
    el.innerHTML = html;
}

function downloadFile(path) {
    window.open(`${CONFIG.endpoints.download}${path}`, '_blank');
}
