const CONFIG = {
    endpoints: {
        files: '/api/files',
        download: '/download/'
    }
};

let currentPath = '';

async function loadFiles(path) {
    currentPath = path;

    const fileListEl = document.getElementById('file-list');
    const emptyStateEl = document.getElementById('empty-state');

    fileListEl.innerHTML = `
        <div class="py-32 text-center">
            <div class="inline-block loader rounded-full h-10 w-10 border-4 border-border mb-4"></div>
            <p class="text-secondary font-medium">Loading files...</p>
        </div>
    `;

    try {
        const res = await fetch(`${CONFIG.endpoints.files}?path=${encodeURIComponent(path)}`);
        const files = await res.json();

        renderFileList(files);
        updateBreadcrumb(path);

    } catch (e) {
        fileListEl.innerHTML = `
            <div class="py-20 text-center">
                <h3 class="text-lg font-bold text-primary mb-1">Connection Error</h3>
                <p class="text-sm text-secondary">Unable to reach server</p>
                <button onclick="loadFiles('${path}')"
                        class="mt-6 px-6 py-2 bg-accent text-white rounded-xl">
                    Retry
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
             onclick="${file.isDir
                ? `loadFiles('${file.path.replace(/'/g, "\\'")}')`
                : `downloadFile('${file.path.replace(/'/g, "\\'")}')`}">

            <!-- ICON -->
            <div class="col-span-8 md:col-span-6 flex items-center">

                <div class="p-2.5 rounded-xl mr-4
                    ${file.isDir
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'soft-bg text-secondary'}">

                    ${file.isDir
                        ? '📁'
                        : '📄'}
                </div>

                <!-- NAME -->
                <div class="truncate">
                    <p class="font-bold text-primary group-hover:text-accent">
                        ${file.name}
                    </p>

                    <p class="md:hidden text-xs text-secondary uppercase">
                        ${file.isDir ? 'Folder' : file.size}
                    </p>
                </div>
            </div>

            <!-- SIZE -->
            <div class="hidden md:block md:col-span-3 text-right text-sm text-secondary font-medium">
                ${file.isDir ? 'Folder' : file.size}
            </div>

            <!-- ACTION -->
            <div class="col-span-4 md:col-span-3 text-right">
                <button class="text-secondary group-hover:text-accent">
                    →
                </button>
            </div>
        </div>
    `).join('');
}

function updateBreadcrumb(path) {
    const el = document.getElementById('breadcrumb');
    const parts = path.split('/').filter(Boolean);

    let html = `
        <span class="text-secondary cursor-pointer" onclick="loadFiles('')">Root</span>
    `;

    let acc = '';

    parts.forEach(p => {
        acc += (acc ? '/' : '') + p;

        html += `
            <span class="text-secondary cursor-pointer" onclick="loadFiles('${acc.replace(/'/g, "\\'")}')">
                › ${p}
            </span>
        `;
    });

    el.innerHTML = html;
}

function downloadFile(path) {
    window.open(`${CONFIG.endpoints.download}${path}`, '_blank');
}