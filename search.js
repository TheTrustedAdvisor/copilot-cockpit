/* ============================================
   GLOBAL SEARCH — Command Palette (Ctrl+K)
   Searches across instruments, governance controls,
   models, and changelog entries.
   ============================================ */

(function() {
    'use strict';

    let searchData = null;
    let overlay = null;
    let input = null;
    let resultsList = null;

    // --- Build search index from all data sources ---
    async function buildIndex() {
        if (searchData) return;
        try {
            const [instrResp, govResp, modelsResp, logResp] = await Promise.all([
                fetch('data/copilot-instruments.json'),
                fetch('data/governance-controls.json').catch(() => null),
                fetch('data/copilot-models.json').catch(() => null),
                fetch('data/known-changelog-entries.json').catch(() => null)
            ]);

            searchData = [];

            if (instrResp.ok) {
                const d = await instrResp.json();
                (d.instruments || []).forEach(i => {
                    searchData.push({
                        type: 'instrument',
                        id: i.id,
                        title: `${i.symbol} — ${i.name}`,
                        subtitle: i.shortDescription || '',
                        zone: i.zone,
                        status: i.status,
                        url: `index.html#instrument-${i.id}`,
                        searchText: `${i.id} ${i.symbol} ${i.name} ${i.shortDescription || ''} ${i.zone}`.toLowerCase()
                    });
                });
            }

            if (govResp && govResp.ok) {
                const d = await govResp.json();
                (d.controls || []).forEach(c => {
                    searchData.push({
                        type: 'control',
                        id: c.id,
                        title: c.id.replace(/-/g, ' '),
                        subtitle: `${c.category} — ${c.scope} — ${c.defaultState}`,
                        url: `tower.html#control=${c.id}`,
                        searchText: `${c.id} ${c.category} ${c.scope} ${c.governanceNote || ''}`.toLowerCase()
                    });
                });
            }

            if (modelsResp && modelsResp.ok) {
                const d = await modelsResp.json();
                (d.models || []).filter(m => m.status !== 'deprecated').forEach(m => {
                    searchData.push({
                        type: 'model',
                        id: m.id,
                        title: m.displayName,
                        subtitle: `${m.provider} — ${m.family}`,
                        status: m.status,
                        url: `runway.html#model-${m.id}`,
                        searchText: `${m.id} ${m.displayName} ${m.provider} ${m.family} ${m.tagline || ''}`.toLowerCase()
                    });
                });
            }

            if (logResp && logResp.ok) {
                const d = await logResp.json();
                (d.entries || []).forEach(e => {
                    searchData.push({
                        type: 'changelog',
                        id: e.id,
                        title: e.title,
                        subtitle: `${e.date} — ${(d.entryTypes[e.type] || {}).label || e.type}`,
                        url: `flight-log.html`,
                        searchText: `${e.id} ${e.title} ${e.description} ${e.date}`.toLowerCase()
                    });
                });
            }

        } catch (err) {
            console.warn('Global search index failed:', err);
            searchData = [];
        }
    }

    // --- Escape HTML ---
    function esc(str) {
        return String(str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[c]);
    }

    // --- Type badges ---
    const TYPE_META = {
        instrument: { label: 'INSTRUMENT', color: '#00ff88' },
        control: { label: 'CONTROL', color: '#ffaa00' },
        model: { label: 'MODEL', color: '#aa88ff' },
        changelog: { label: 'CHANGELOG', color: '#00d4ff' }
    };

    // --- Create overlay DOM ---
    function createOverlay() {
        if (overlay) return;

        overlay = document.createElement('div');
        overlay.className = 'search-overlay';
        overlay.innerHTML = `
            <div class="search-palette" role="dialog" aria-label="Global search">
                <div class="search-palette-header">
                    <span class="search-palette-icon">⌘K</span>
                    <input type="text" class="search-palette-input" placeholder="Search instruments, controls, models, changelog…" autocomplete="off" spellcheck="false">
                    <button class="search-palette-close" aria-label="Close search">ESC</button>
                </div>
                <div class="search-palette-results" role="listbox"></div>
                <div class="search-palette-footer">
                    <span class="search-palette-hint">↑↓ navigate</span>
                    <span class="search-palette-hint">↵ open</span>
                    <span class="search-palette-hint">esc close</span>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        input = overlay.querySelector('.search-palette-input');
        resultsList = overlay.querySelector('.search-palette-results');

        // Events
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeSearch();
        });
        overlay.querySelector('.search-palette-close').addEventListener('click', closeSearch);
        input.addEventListener('input', () => renderResults(input.value));
        input.addEventListener('keydown', handleKeyNav);
    }

    // --- Render search results ---
    function renderResults(query) {
        if (!searchData || !query.trim()) {
            resultsList.innerHTML = '<div class="search-palette-empty">Type to search across all perspectives…</div>';
            return;
        }

        const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
        const matches = searchData.filter(item =>
            terms.every(t => item.searchText.includes(t))
        ).slice(0, 20);

        if (matches.length === 0) {
            resultsList.innerHTML = '<div class="search-palette-empty">No results found.</div>';
            return;
        }

        resultsList.innerHTML = matches.map((item, i) => {
            const meta = TYPE_META[item.type] || { label: item.type, color: '#888' };
            return `
                <a href="${esc(item.url)}" class="search-palette-item ${i === 0 ? 'active' : ''}" role="option" data-index="${i}">
                    <span class="search-palette-type" style="color:${meta.color};border-color:${meta.color}">${meta.label}</span>
                    <div class="search-palette-item-text">
                        <span class="search-palette-item-title">${esc(item.title)}</span>
                        <span class="search-palette-item-sub">${esc(item.subtitle)}</span>
                    </div>
                </a>
            `;
        }).join('');
    }

    // --- Keyboard navigation ---
    function handleKeyNav(e) {
        const items = resultsList.querySelectorAll('.search-palette-item');
        if (items.length === 0) return;

        const current = resultsList.querySelector('.search-palette-item.active');
        let idx = current ? parseInt(current.dataset.index) : -1;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            idx = Math.min(idx + 1, items.length - 1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            idx = Math.max(idx - 1, 0);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (current) {
                window.location.href = current.href;
                closeSearch();
            }
            return;
        } else {
            return;
        }

        items.forEach(it => it.classList.remove('active'));
        if (items[idx]) {
            items[idx].classList.add('active');
            items[idx].scrollIntoView({ block: 'nearest' });
        }
    }

    // --- Open / Close ---
    async function openSearch() {
        createOverlay();
        await buildIndex();
        overlay.classList.add('open');
        input.value = '';
        renderResults('');
        requestAnimationFrame(() => input.focus());
    }

    function closeSearch() {
        if (overlay) overlay.classList.remove('open');
    }

    // --- Global keyboard shortcut: Ctrl+K / Cmd+K ---
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            if (overlay && overlay.classList.contains('open')) {
                closeSearch();
            } else {
                openSearch();
            }
        }
        if (e.key === 'Escape' && overlay && overlay.classList.contains('open')) {
            closeSearch();
        }
    });

    // Expose for external use
    window.openGlobalSearch = openSearch;
})();
