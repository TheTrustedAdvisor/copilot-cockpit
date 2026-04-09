/* ============================================
   COPILOT COCKPIT — Data-Driven Rendering Engine
   Version 1.0.0
   ============================================ */

// --- State ---
let cockpitData = null;
let allInstruments = [];
let activeFilters = { flightMode: null, plan: null, status: null, zone: null };
let searchQuery = '';
let mermaidReady = false;

// --- Zone rendering order (matches CSS grid areas) ---
const ZONE_ORDER = ['overhead', 'glareshield', 'pfd', 'nd', 'side', 'pedestal', 'eicas', 'fms'];

// --- Zone CSS class mapping ---
const ZONE_CLASS = {
    pfd: 'zone-pfd',
    nd: 'zone-nd',
    glareshield: 'zone-glareshield',
    eicas: 'zone-engines',
    pedestal: 'zone-pedestal',
    overhead: 'zone-overhead',
    side: 'zone-side',
    fms: 'zone-fms'
};

// --- Zone short labels (derived if not in data) ---
const ZONE_LABELS = {
    pfd: 'PFD', nd: 'ND', glareshield: 'GLARESHIELD', eicas: 'EICAS',
    pedestal: 'PEDESTAL', overhead: 'OVERHEAD', side: 'SIDE PANEL', fms: 'FMS'
};

// --- Boot ---
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const resp = await fetch('data/copilot-instruments.json');
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        cockpitData = await resp.json();
        allInstruments = cockpitData.instruments || [];

        renderCockpit();
        initFilters();
        initSearch();
        handleDeepLink();

        // Browser back/forward
        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.instrumentId) {
                openDetailPanel(e.state.instrumentId, false);
            } else {
                closeDetailPanel();
            }
        });

        // Update header timestamp (handle nested metadata or top-level)
        const ts = document.getElementById('last-updated');
        if (ts) ts.textContent = cockpitData.metadata?.lastUpdated || cockpitData.lastUpdated || '';

    } catch (err) {
        console.error('Failed to load cockpit data:', err);
        document.getElementById('cockpit-grid').innerHTML =
            `<p style="color:#ff4444;padding:40px;grid-column:1/-1;">DATA LINK LOST — ${err.message}</p>`;
    }
});


// ============================================================
// RENDERING — Cockpit Grid
// ============================================================

function renderCockpit() {
    const grid = document.getElementById('cockpit-grid');
    if (!grid) return;

    const zones = cockpitData.zones || [];
    const zoneMap = Object.fromEntries(zones.map(z => [z.id, z]));

    grid.innerHTML = ZONE_ORDER.map(zoneId => {
        const zone = zoneMap[zoneId];
        if (!zone) return '';

        // EICAS zone renders models, not instrument cards
        if (zoneId === 'eicas') return renderEngineZone(zone);

        // FMS zone has a special chain layout
        if (zoneId === 'fms') return renderFmsZone(zone);

        const instruments = allInstruments.filter(i => i.zone === zoneId);
        return renderZone(zone, instruments);
    }).join('');

    // Render legend
    renderLegend();
}

function renderZone(zone, instruments) {
    const cls = ZONE_CLASS[zone.id] || '';
    const instrumentsHTML = instruments.map(i => renderInstrumentCard(i, zone)).join('');

    return `
        <div class="zone ${cls}" data-zone="${zone.id}">
            <div class="zone-header">
                <span class="zone-label">${zone.label || ZONE_LABELS[zone.id] || zone.name}</span>
                <span class="zone-line"></span>
            </div>
            <div class="instruments">
                ${instrumentsHTML || '<span style="opacity:0.2;font-size:0.55rem;">No instruments</span>'}
            </div>
        </div>
    `;
}

function renderInstrumentCard(instrument, zone) {
    const statusClass = instrument.status || 'ga';
    const meta = instrument.shortDescription || '';

    return `
        <div class="instrument"
             data-id="${instrument.id}"
             data-zone="${instrument.zone}"
             data-status="${instrument.status}"
             data-flight-modes="${(instrument.flightMode || []).join(',')}"
             data-plans="${planKeys(instrument)}"
             onclick="openDetailPanel('${instrument.id}')"
             tabindex="0"
             role="button"
             aria-label="${instrument.name}">
            <div class="instrument-top">
                <span class="instrument-symbol">${instrument.symbol}</span>
                <span class="instrument-led ${statusClass}" title="${statusLabel(statusClass)}"></span>
            </div>
            <div class="instrument-name">${instrument.name}</div>
            <div class="instrument-meta">${meta}</div>
        </div>
    `;
}

// --- Engine Zone (EICAS) — special: renders AI models ---
function renderEngineZone(zone) {
    const models = cockpitData.models || [];
    const grouped = {};
    models.forEach(m => {
        const tier = m.tier || 'other';
        if (!grouped[tier]) grouped[tier] = [];
        grouped[tier].push(m);
    });

    const clustersHTML = Object.entries(grouped).map(([tier, models]) => `
        <div class="engine-cluster">
            <div class="engine-cluster-label">${tier}</div>
            <div class="engine-models">
                ${models.map(m => `
                    <span class="engine-model ${m.included || m.tier === 'included' ? 'included' : ''}" title="${m.provider} — ${m.name}${m.description ? '\n' + m.description : ''}">
                        ${m.name}
                    </span>
                `).join('')}
            </div>
        </div>
    `).join('');

    return `
        <div class="zone zone-engines" data-zone="eicas">
            <div class="zone-header">
                <span class="zone-label">${zone.label || ZONE_LABELS.eicas || 'EICAS'}</span>
                <span class="zone-line"></span>
            </div>
            ${clustersHTML}
        </div>
    `;
}

// --- FMS Zone — special: chain layout with arrows ---
function renderFmsZone(zone) {
    const instruments = allInstruments.filter(i => i.zone === 'fms');
    const items = instruments.map(i => renderInstrumentCard(i, zone));
    const chain = items.join('<span class="fms-arrow">→</span>');

    return `
        <div class="zone zone-fms" data-zone="fms">
            <div class="zone-header">
                <span class="zone-label">${zone.label || ZONE_LABELS.fms || 'FMS'}</span>
                <span class="zone-line"></span>
            </div>
            <div class="instruments">
                <div class="fms-chain">${chain}</div>
            </div>
        </div>
    `;
}

function renderLegend() {
    const legend = document.getElementById('cockpit-legend');
    if (!legend) return;
    legend.innerHTML = `
        <div class="legend-item"><span class="legend-dot" style="background:var(--status-ga);box-shadow:0 0 4px var(--status-ga)"></span> GA</div>
        <div class="legend-item"><span class="legend-dot" style="background:var(--status-preview);box-shadow:0 0 4px var(--status-preview)"></span> Preview</div>
        <div class="legend-item"><span class="legend-dot" style="background:var(--status-deprecated);box-shadow:0 0 4px var(--status-deprecated)"></span> Deprecated</div>
    `;
}


// ============================================================
// DETAIL PANEL — Slide-in with tabs
// ============================================================

function openDetailPanel(instrumentId, pushState = true) {
    const instrument = allInstruments.find(i => i.id === instrumentId);
    if (!instrument) return;

    const zone = (cockpitData.zones || []).find(z => z.id === instrument.zone);
    const zoneColor = zone ? zone.color : '#00ff88';
    const zoneName = zone ? zone.name : instrument.zone;

    const body = document.getElementById('cockpit-body');
    const panel = document.getElementById('detail-panel');

    // Build detail content
    panel.innerHTML = `
        <div class="detail-header">
            <div>
                <div class="detail-symbol" style="color:${zoneColor}">${instrument.symbol}</div>
                <div class="detail-name">${instrument.name}</div>
                <div class="detail-zone-badge" style="color:${zoneColor}">${zoneName}</div>
            </div>
            <button class="detail-close" onclick="closeDetailPanel()" aria-label="Close">[ESC]</button>
        </div>
        ${renderDetailTabs(instrument, zoneColor)}
    `;

    body.classList.add('blade-open');

    if (pushState) {
        history.pushState({ instrumentId }, '', `#instrument-${instrumentId}`);
    }

    // Tab click handlers
    panel.querySelectorAll('.detail-tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab, panel));
    });

    // Highlight code blocks if Code tab is visible on initial render
    highlightCodeBlocks(panel);
}

function closeDetailPanel() {
    const body = document.getElementById('cockpit-body');
    body.classList.remove('blade-open');

    if (location.hash.startsWith('#instrument-')) {
        history.pushState({}, '', location.pathname);
    }
}

// Close on Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDetailPanel();
});

// Close blade when clicking the dimmed main area (but not instrument cards inside it)
document.addEventListener('click', (e) => {
    const body = document.getElementById('cockpit-body');
    if (!body || !body.classList.contains('blade-open')) return;

    const main = document.getElementById('cockpit-main');
    if (!main) return;

    // Only close if the click is inside cockpit-main but NOT on an instrument card
    if (main.contains(e.target) && !e.target.closest('.instrument')) {
        closeDetailPanel();
    }
});

function renderDetailTabs(instrument, zoneColor) {
    const tabs = [
        { id: 'overview', label: 'Overview' },
        { id: 'diagrams', label: 'Diagrams' },
        { id: 'code', label: 'Code' },
        { id: 'media', label: 'Media' },
        { id: 'resources', label: 'Resources' }
    ];

    // Only show tabs that have content
    const hasDiagrams = instrument.mermaidDiagrams && instrument.mermaidDiagrams.length > 0;
    const hasCode = instrument.codeExamples && instrument.codeExamples.length > 0;
    const hasMedia = (instrument.terminalRecordings && instrument.terminalRecordings.length > 0)
                  || (instrument.videos && instrument.videos.length > 0);
    const availableTabs = tabs.filter(t => {
        if (t.id === 'diagrams') return hasDiagrams;
        if (t.id === 'code') return hasCode;
        if (t.id === 'media') return hasMedia;
        return true;
    });

    const tabNav = availableTabs.map((t, i) =>
        `<button class="detail-tab ${i === 0 ? 'active' : ''}" data-tab="${t.id}">${t.label}</button>`
    ).join('');

    const tabPanels = availableTabs.map((t, i) =>
        `<div class="detail-tab-content ${i === 0 ? 'active' : ''}" data-tab-content="${t.id}">
            ${renderTabContent(instrument, t.id, zoneColor)}
        </div>`
    ).join('');

    return `
        <div class="detail-tabs">${tabNav}</div>
        ${tabPanels}
    `;
}

function switchTab(tabBtn, panel) {
    const tabId = tabBtn.dataset.tab;

    // Toggle active tab button
    panel.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
    tabBtn.classList.add('active');

    // Toggle active content
    panel.querySelectorAll('.detail-tab-content').forEach(c => c.classList.remove('active'));
    const content = panel.querySelector(`[data-tab-content="${tabId}"]`);
    if (content) {
        content.classList.add('active');

        // Lazy render Mermaid diagrams when tab becomes visible
        if (tabId === 'diagrams') {
            renderMermaidDiagrams(content);
        }

        // Highlight code blocks when Code tab becomes visible
        if (tabId === 'code') {
            highlightCodeBlocks(content);
        }
    }
}


// ============================================================
// TAB CONTENT RENDERERS
// ============================================================

function renderTabContent(instrument, tabId, zoneColor) {
    switch (tabId) {
        case 'overview': return renderOverviewTab(instrument, zoneColor);
        case 'diagrams': return renderDiagramsTab(instrument);
        case 'code': return renderCodeTab(instrument);
        case 'media': return renderMediaTab(instrument);
        case 'resources': return renderResourcesTab(instrument, zoneColor);
        default: return '';
    }
}

// --- Overview Tab ---
function renderOverviewTab(instrument, zoneColor) {
    let html = '';

    // Description
    if (instrument.description) {
        html += `
            <div class="detail-section">
                <div class="detail-description">${instrument.description}</div>
            </div>`;
    }

    // Status + Plan availability
    html += `
        <div class="detail-section">
            <div class="detail-section-title">Status</div>
            <div class="detail-status-row">
                <span class="detail-status-label">Status</span>
                <span class="detail-status-value">
                    <span class="instrument-led ${instrument.status}" style="display:inline-block;vertical-align:middle;margin-right:6px"></span>
                    ${statusLabel(instrument.status)}
                </span>
            </div>
            ${renderPlanRow(instrument)}
        </div>`;

    // IDE Support
    if (instrument.ideSupport) {
        html += `
            <div class="detail-section">
                <div class="detail-section-title">IDE Support</div>
                <div class="ide-grid">${renderIdeGrid(instrument.ideSupport)}</div>
            </div>`;
    }

    // Capabilities (handle both string[] and object[] formats)
    if (instrument.capabilities && instrument.capabilities.length > 0) {
        html += `
            <div class="detail-section">
                <div class="detail-section-title">Capabilities</div>
                <ul class="capability-list">
                    ${instrument.capabilities.map(c => {
                        if (typeof c === 'string') return `<li>${c}</li>`;
                        return `<li><strong>${c.name}</strong>${c.description ? ' — ' + c.description : ''}</li>`;
                    }).join('')}
                </ul>
            </div>`;
    }

    // Squawk Codes (known limitations — handle {code,title,description} and {code,severity,message})
    if (instrument.squawkCodes && instrument.squawkCodes.length > 0) {
        html += `
            <div class="detail-section">
                <div class="detail-section-title">Squawk Codes</div>
                ${instrument.squawkCodes.map(s => {
                    const title = s.title || (s.severity ? s.severity.toUpperCase() : 'NOTE');
                    const text = s.description || s.message || '';
                    return `
                    <div class="squawk-card">
                        <div class="squawk-code">SQUAWK ${s.code} — ${title}</div>
                        <div class="squawk-text">${text}</div>
                    </div>`;
                }).join('')}
            </div>`;
    }

    // Pro Tip
    if (instrument.proTip) {
        html += `
            <div class="detail-section">
                <div class="detail-section-title">Pro Tip</div>
                <div class="detail-description" style="border-left:2px solid ${zoneColor};padding-left:12px;">
                    ${instrument.proTip}
                </div>
            </div>`;
    }

    // Related instruments
    if (instrument.relatedInstruments && instrument.relatedInstruments.length > 0) {
        html += `
            <div class="detail-section">
                <div class="detail-section-title">Related Instruments</div>
                <div class="related-grid">
                    ${instrument.relatedInstruments.map(rid => {
                        const rel = allInstruments.find(i => i.id === rid);
                        if (!rel) return '';
                        return `<a class="related-chip" href="#instrument-${rid}" onclick="event.preventDefault();openDetailPanel('${rid}')">${rel.symbol} ${rel.name}</a>`;
                    }).join('')}
                </div>
            </div>`;
    }

    return html;
}

function renderPlanRow(instrument) {
    if (!instrument.planAvailability) return '';
    const plans = cockpitData.plans || [];
    return plans.map(p => {
        const val = instrument.planAvailability[p.id];
        const available = val === true;
        const limited = val === 'limited';
        const cls = available ? 'available' : limited ? 'preview-ide' : 'unavailable';
        const label = available ? p.name : limited ? `${p.name} (limited)` : p.name;
        return `<div class="detail-status-row">
            <span class="detail-status-label">${p.name}</span>
            <span class="detail-status-value" style="opacity:${available || limited ? 1 : 0.3}">${available ? '●' : limited ? '◐' : '○'} ${available ? 'Included' : limited ? 'Limited' : 'Not available'}</span>
        </div>`;
    }).join('');
}

function renderIdeGrid(ideSupport) {
    const ides = [
        { key: 'vscode', label: 'VS Code' },
        { key: 'jetbrains', label: 'JetBrains' },
        { key: 'visual-studio', label: 'Visual Studio' },
        { key: 'neovim', label: 'Neovim' },
        { key: 'eclipse', label: 'Eclipse' },
        { key: 'xcode', label: 'Xcode' },
        { key: 'github-com', label: 'GitHub.com' },
        { key: 'cli', label: 'CLI' }
    ];

    return ides.map(ide => {
        const val = ideSupport[ide.key];
        const cls = val === 'ga' ? 'available' : val === 'preview' ? 'preview-ide' : 'unavailable';
        const label = val === 'ga' ? 'GA' : val === 'preview' ? 'Preview' : '—';
        return `<div class="ide-item ${cls}">${ide.label}<br><small>${label}</small></div>`;
    }).join('');
}

// --- Diagrams Tab ---
function renderDiagramsTab(instrument) {
    if (!instrument.mermaidDiagrams || instrument.mermaidDiagrams.length === 0) {
        return '<p style="opacity:0.4">No diagrams available.</p>';
    }

    return instrument.mermaidDiagrams.map(d => `
        <div class="mermaid-container">
            <div class="mermaid-title">${d.title || ''}</div>
            <pre class="mermaid">${d.diagram}</pre>
        </div>
    `).join('');
}

// --- Code Tab ---
function renderCodeTab(instrument) {
    if (!instrument.codeExamples || instrument.codeExamples.length === 0) {
        return '<p style="opacity:0.4">No code examples available.</p>';
    }

    return instrument.codeExamples.map(ex => `
        <div class="code-block">
            <div class="code-block-header">
                <span class="code-block-title">${ex.title || ''}</span>
                <span class="code-block-lang">${ex.language || ''}</span>
                <button class="copy-btn" onclick="copyCode(this)">COPY</button>
            </div>
            <pre><code class="language-${ex.language || 'text'}">${escapeHtml(ex.code || '')}</code></pre>
        </div>
    `).join('');
}

// --- Media Tab ---
function renderMediaTab(instrument) {
    let html = '';

    // Terminal Recordings (GIFs from asciinema + agg)
    if (instrument.terminalRecordings && instrument.terminalRecordings.length > 0) {
        html += `
            <div class="detail-section">
                <div class="detail-section-title">Terminal Recordings</div>
                ${instrument.terminalRecordings.map(rec => `
                    <div class="media-recording">
                        <div class="media-recording-header">
                            <span class="media-recording-title">${rec.title || ''}</span>
                            ${rec.duration ? `<span class="media-recording-duration">${rec.duration}</span>` : ''}
                        </div>
                        <img src="${rec.gifPath}" alt="${rec.title || 'Terminal recording'}"
                             class="media-recording-gif" loading="lazy">
                    </div>
                `).join('')}
            </div>`;
    }

    // YouTube Videos
    if (instrument.videos && instrument.videos.length > 0) {
        html += `
            <div class="detail-section">
                <div class="detail-section-title">Videos</div>
                ${instrument.videos.map(vid => `
                    <div class="media-video">
                        <div class="media-recording-header">
                            <span class="media-recording-title">${vid.title || ''}</span>
                            ${vid.duration ? `<span class="media-recording-duration">${vid.duration}</span>` : ''}
                        </div>
                        <div class="media-video-embed">
                            <iframe src="https://www.youtube-nocookie.com/embed/${vid.youtubeId}"
                                    title="${vid.title || ''}" frameborder="0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowfullscreen loading="lazy"></iframe>
                        </div>
                    </div>
                `).join('')}
            </div>`;
    }

    if (!html) {
        return '<p style="opacity:0.4">No media available.</p>';
    }

    return html;
}

// --- Resources Tab ---
function renderResourcesTab(instrument, zoneColor) {
    let html = '';

    // Links (handle both object {docs,changelog,...} and array [{label,url}] formats)
    const links = instrument.links;
    let linksHTML = '';
    if (Array.isArray(links) && links.length > 0) {
        linksHTML = links.map(l => `<a class="detail-link" href="${l.url}" target="_blank" rel="noopener">${l.label || 'LINK'}</a>`).join('');
    } else if (links && typeof links === 'object') {
        const entries = Object.entries(links).filter(([, v]) => v);
        linksHTML = entries.map(([key, url]) => `<a class="detail-link" href="${url}" target="_blank" rel="noopener">${key.toUpperCase()}</a>`).join('');
    }
    if (linksHTML) {
        html += `
            <div class="detail-section">
                <div class="detail-section-title">Documentation</div>
                <div class="detail-links">${linksHTML}</div>
            </div>`;
    }

    // Security relevance (handle both string[] and object[] aspects)
    if (instrument.securityRelevance && instrument.securityRelevance.relevant) {
        const aspects = (instrument.securityRelevance.aspects || []).map(a => {
            if (typeof a === 'string') return a;
            return `<strong>${a.title}</strong> — ${a.description}`;
        });
        html += `
            <div class="detail-section">
                <div class="detail-section-title">Security Relevance</div>
                <ul class="capability-list">
                    ${aspects.map(a => `<li>${a}</li>`).join('')}
                </ul>
                ${instrument.securityRelevance.complianceNotes ? `<div class="detail-description" style="margin-top:8px;font-size:0.6rem;opacity:0.6">${instrument.securityRelevance.complianceNotes}</div>` : ''}
            </div>`;
    }

    // Confidence + last verified (only show if present)
    if (instrument.lastVerified || instrument.confidenceScore) {
        html += `
            <div class="detail-section">
                <div class="detail-section-title">Data Quality</div>
                ${instrument.lastVerified ? `<div class="detail-status-row">
                    <span class="detail-status-label">Verified</span>
                    <span class="detail-status-value">${instrument.lastVerified}</span>
                </div>` : ''}
                ${instrument.confidenceScore ? `<div class="detail-status-row">
                    <span class="detail-status-label">Confidence</span>
                    <span class="detail-status-value">${instrument.confidenceScore}%</span>
                </div>` : ''}
            </div>`;
    }

    return html || '<p style="opacity:0.4">No resources available.</p>';
}


// ============================================================
// FILTERS
// ============================================================

function initFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const filterType = btn.dataset.filterType;
            const filterValue = btn.dataset.filterValue;

            // Toggle: if already active, deactivate
            if (btn.classList.contains('active')) {
                btn.classList.remove('active');
                activeFilters[filterType] = null;
            } else {
                // Deactivate siblings of same type
                document.querySelectorAll(`.filter-btn[data-filter-type="${filterType}"]`)
                    .forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeFilters[filterType] = filterValue;
            }

            applyFilters();
        });
    });
}

function applyFilters() {
    const cards = document.querySelectorAll('.instrument[data-id]');
    let visibleCount = 0;

    cards.forEach(card => {
        const id = card.dataset.id;
        const instrument = allInstruments.find(i => i.id === id);
        if (!instrument) return;

        let visible = true;

        // Flight mode filter
        if (activeFilters.flightMode) {
            const modes = (instrument.flightMode || []);
            visible = visible && modes.includes(activeFilters.flightMode);
        }

        // Plan filter
        if (activeFilters.plan) {
            const avail = instrument.planAvailability || {};
            const val = avail[activeFilters.plan];
            visible = visible && (val === true || val === 'limited');
        }

        // Status filter
        if (activeFilters.status) {
            visible = visible && instrument.status === activeFilters.status;
        }

        // Search query
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const haystack = [
                instrument.name,
                instrument.symbol,
                instrument.shortDescription || '',
                instrument.description || '',
                ...(instrument.capabilities || [])
            ].join(' ').toLowerCase();
            visible = visible && haystack.includes(q);
        }

        card.classList.toggle('dimmed', !visible);
        if (visible) visibleCount++;
    });

    // Update count in header if element exists
    const counter = document.getElementById('visible-count');
    if (counter) counter.textContent = `${visibleCount}/${allInstruments.length}`;
}


// ============================================================
// SEARCH
// ============================================================

function initSearch() {
    const input = document.getElementById('search-input');
    if (!input) return;

    input.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim();
        applyFilters();
    });

    // Ctrl+K or / to focus search
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey && e.key === 'k') || (e.key === '/' && document.activeElement.tagName !== 'INPUT')) {
            e.preventDefault();
            input.focus();
        }
    });
}


// ============================================================
// DEEP LINKING
// ============================================================

function handleDeepLink() {
    const hash = window.location.hash;
    if (hash.startsWith('#instrument-')) {
        const id = hash.substring('#instrument-'.length);
        setTimeout(() => openDetailPanel(id, false), 150);
    }
}


// ============================================================
// MERMAID — Lazy initialization
// ============================================================

function initMermaid() {
    if (typeof mermaid === 'undefined' || mermaidReady) return;

    const isLight = document.body.classList.contains('light-theme');
    mermaid.initialize({
        startOnLoad: false,
        theme: isLight ? 'default' : 'dark',
        themeVariables: {
            primaryColor: '#1a2233',
            primaryTextColor: '#c0c8d8',
            primaryBorderColor: '#3a4a5a',
            lineColor: '#5a6a7a',
            secondaryColor: '#0d1520',
            tertiaryColor: '#07080c',
            background: '#07080c',
            mainBkg: '#1a2233',
            secondBkg: '#0d1520',
            textColor: '#c0c8d8',
            nodeTextColor: '#c0c8d8',
            nodeBorder: '#3a4a5a',
            clusterBkg: '#0d1520',
            clusterBorder: '#2a3a4a',
            defaultLinkColor: '#5a6a7a',
            titleColor: '#00ff88',
            edgeLabelBackground: '#0d1520',
            actorBkg: '#1a2233',
            actorBorder: '#3a4a5a',
            actorTextColor: '#c0c8d8',
            actorLineColor: '#5a6a7a',
            signalColor: '#5a6a7a',
            signalTextColor: '#c0c8d8',
            labelBoxBkgColor: '#0d1520',
            labelBoxBorderColor: '#2a3a4a',
            labelTextColor: '#c0c8d8',
            loopTextColor: '#c0c8d8',
            noteBorderColor: '#3a4a5a',
            noteBkgColor: '#1a2233',
            noteTextColor: '#c0c8d8',
            activationBorderColor: '#3a4a5a',
            activationBkgColor: '#1a2233',
            sequenceNumberColor: '#c0c8d8'
        },
        flowchart: { htmlLabels: true, curve: 'basis' },
        securityLevel: 'loose'
    });
    mermaidReady = true;
}

function renderMermaidDiagrams(container) {
    if (typeof mermaid === 'undefined') return;
    initMermaid();
    const nodes = container.querySelectorAll('.mermaid:not([data-processed])');
    if (nodes.length > 0) {
        mermaid.run({ nodes });
    }
}


// ============================================================
// UTILITIES
// ============================================================

function copyCode(button) {
    const block = button.closest('.code-block');
    const code = block.querySelector('code').textContent;

    navigator.clipboard.writeText(code).then(() => {
        button.textContent = 'COPIED';
        button.classList.add('copied');
        setTimeout(() => {
            button.textContent = 'COPY';
            button.classList.remove('copied');
        }, 2000);
    });
}

function highlightCodeBlocks(container) {
    if (typeof Prism === 'undefined') return;
    container.querySelectorAll('code[class*="language-"]:not(.prism-highlighted)').forEach(el => {
        Prism.highlightElement(el);
        el.classList.add('prism-highlighted');
    });
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ============================================================
// THEME TOGGLE
// ============================================================

function toggleTheme() {
    const body = document.body;
    const btn = document.getElementById('theme-toggle');
    body.classList.toggle('light-theme');

    if (body.classList.contains('light-theme')) {
        btn.textContent = 'NIGHT';
        localStorage.setItem('cockpit-theme', 'light');
    } else {
        btn.textContent = 'DAY';
        localStorage.setItem('cockpit-theme', 'dark');
    }

    // Re-initialize Mermaid with correct theme for any visible diagrams
    mermaidReady = false;
    const visibleDiagrams = document.querySelector('.detail-tab-content.active [data-tab-content="diagrams"]');
    if (visibleDiagrams) renderMermaidDiagrams(visibleDiagrams);
}

function loadSavedTheme() {
    const saved = localStorage.getItem('cockpit-theme');
    const btn = document.getElementById('theme-toggle');
    if (saved === 'light') {
        document.body.classList.add('light-theme');
        if (btn) btn.textContent = 'NIGHT';
    }
}

// Load theme immediately (before DOMContentLoaded to prevent flash)
loadSavedTheme();


function statusLabel(status) {
    const labels = { ga: 'Generally Available', preview: 'Preview', deprecated: 'Deprecated' };
    return labels[status] || status;
}

function planKeys(instrument) {
    if (!instrument.planAvailability) return '';
    return Object.entries(instrument.planAvailability)
        .filter(([, v]) => v === true || v === 'limited')
        .map(([k]) => k)
        .join(',');
}
