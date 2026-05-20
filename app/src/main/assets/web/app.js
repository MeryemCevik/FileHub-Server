const CONFIG = {
    endpoints: {
        files: '/api/files',
        download: '/download/',
        delete: '/api/delete',
        mkdir: '/api/mkdir'
    }
};

let currentPath = '';
let selectedPaths = new Set();
let allFilesCount = 0;

async function loadFiles(path) {
    currentPath = path;
    selectedPaths.clear();
    updateToolbarState();

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

function renderFileList(files) {
    const fileListEl = document.getElementById('file-list');
    const emptyStateEl = document.getElementById('empty-state');

    if (!files.length) {
        fileListEl.innerHTML = '';
        emptyStateEl.classList.remove('hidden');
        return;
    }

    emptyStateEl.classList.add('hidden');

    fileListEl.innerHTML = files.map(file => `
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

                <div class="p-2.5 rounded-xl mr-4
                    ${file.isDir
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'soft-bg text-secondary'}">

                    ${file.isDir ? '📁' : '📄'}
                </div>

                <div class="truncate">
                    <p class="font-bold text-primary group-hover:text-accent">
                        ${file.name}
                    </p>
                    <p class="md:hidden text-xs text-secondary uppercase">
                        ${file.isDir ? 'Dossier' : file.size}
                    </p>
                </div>
            </div>

            <!-- SIZE -->
            <div class="hidden md:block md:col-span-3 text-right text-sm text-secondary font-medium">
                ${file.isDir ? 'Dossier' : file.size}
            </div>

            <!-- ACTION -->
            <div class="col-span-4 md:col-span-3 text-right text-gray-300 group-hover:text-accent">
                →
            </div>
        </div>
    `).join('');
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
    if (checkbox.checked) {
        selectedPaths.add(path);
    } else {
        selectedPaths.delete(path);
    }
    updateToolbarState();
}

function toggleSelectAll() {
    const btn = document.getElementById('btn-select-all');
    const checkboxes = document.querySelectorAll('.item-checkbox');

    // Si tout est déjà sélectionné, on désélectionne tout
    const shouldSelectAll = selectedPaths.size < allFilesCount;

    selectedPaths.clear();
    checkboxes.forEach(cb => {
        cb.checked = shouldSelectAll;
        if (shouldSelectAll) {
            selectedPaths.add(cb.getAttribute('data-path'));
        }
    });

    updateToolbarState();
}

function updateToolbarState() {
    // Texte du bouton Tout sélectionner
    const selectBtnText = document.querySelector('#btn-select-all span');
    if (allFilesCount > 0 && selectedPaths.size === allFilesCount) {
        selectBtnText.textContent = "Tout désélectionner";
    } else {
        selectBtnText.textContent = "Tout sélectionner";
    }
}

async function deleteSelected() {
    const count = selectedPaths.size;
    if (count === 0) {
        alert("Veuillez sélectionner au moins un élément à supprimer.");
        return;
    }

    const message = count === 1
        ? "Voulez-vous vraiment supprimer cet élément ?"
        : `Voulez-vous vraiment supprimer ces ${count} éléments ?`;

    if (!confirm(message)) return;

    for (const path of selectedPaths) {
        try {
            await fetch(`${CONFIG.endpoints.delete}?path=${encodeURIComponent(path)}`, {
                method: 'POST'
            });
        } catch (e) {
            console.error("Erreur lors de la suppression", e);
        }
    }

    loadFiles(currentPath);
}

async function createNewFolder() {
    const name = prompt("Nom du nouveau dossier :");
    if (!name) return;

    try {
        const res = await fetch(`${CONFIG.endpoints.mkdir}?parentPath=${encodeURIComponent(currentPath)}&name=${encodeURIComponent(name)}`, {
            method: 'POST'
        });
        if (res.ok) {
            loadFiles(currentPath);
        } else {
            alert("Erreur lors de la création du dossier");
        }
    } catch (e) {
        alert("Erreur de connexion");
    }
}

function updateBreadcrumb(path) {
    const el = document.getElementById('breadcrumb');
    const parts = path.split('/').filter(Boolean);

    let html = `
        <span class="text-secondary cursor-pointer hover:text-accent" onclick="loadFiles('')">Racine</span>
    `;

    let acc = '';

    parts.forEach(p => {
        acc += (acc ? '/' : '') + p;

        html += `
            <span class="mx-2 text-gray-400">›</span>
            <span class="text-secondary cursor-pointer hover:text-accent" onclick="loadFiles('${acc.replace(/'/g, "\\'")}')">
                ${p}
            </span>
        `;
    });

    el.innerHTML = html;
}

function downloadFile(path) {
    window.open(`${CONFIG.endpoints.download}${path}`, '_blank');
}