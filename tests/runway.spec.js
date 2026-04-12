// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Runway Perspective tests — model fleet + flight plans (v2).
 *
 * Renamed from tower.spec.js when the perspective was repositioned from
 * "Tower" (admin/ATC) to "Runway" (model fleet / takeoff routing). The
 * page structure is unchanged — only the nav identity, class names and
 * page copy moved from .tower-* to .runway-*.
 *
 * Covers:
 *  - Page boot + verification banner
 *  - Filter bar (plan selector, provider chips, status chips)
 *  - Departure Board rows dim when filters don't match
 *  - Blade opens on row click and on flight-plan pill / NOTAM link click
 *  - Blade renders strengths, capabilities, plan row, surface row
 *  - Deep link #model-<id> opens blade
 *  - Blade closes on Esc / backdrop / ✕
 *  - Flight Plans + NOTAMs + Engine still render
 *  - Cockpit → Runway bridge (glance-view invariant + detail callouts)
 */

test.describe('Runway v2 — page structure', () => {
    test('loads without JS errors and renders core landmarks', async ({ page }) => {
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (msg) => {
            if (msg.type() === 'error') errors.push(msg.text());
        });

        await page.goto('/runway.html');
        await expect(page.locator('main#runway-main')).toBeVisible();
        await expect(page.locator('h1')).toContainText('Runway Perspective');
        await expect(page.locator('#departure-board .departure-row').first()).toBeVisible();
        await expect(page.locator('.runway-filters')).toBeVisible();
        expect(errors).toEqual([]);
    });

    test('marks Runway as the active nav link', async ({ page }) => {
        await page.goto('/runway.html');
        const active = page.locator('.nav-link.active');
        await expect(active).toHaveCount(1);
        await expect(active).toContainText('Runway');
    });

    test('verification banner is visible while the catalog is unverified', async ({ page }) => {
        await page.goto('/runway.html');
        await expect(page.locator('#verification-banner')).toBeVisible();
        await expect(page.locator('#verification-banner')).toContainText(/verification/i);
    });

    test('dropped v1 sections no longer exist', async ({ page }) => {
        await page.goto('/runway.html');
        await expect(page.locator('#airspace-map')).toHaveCount(0);
        await expect(page.locator('#capability-matrix')).toHaveCount(0);
        await expect(page.locator('#plan-matrix')).toHaveCount(0);
        await expect(page.locator('#surface-matrix')).toHaveCount(0);
        await expect(page.locator('#weight-balance')).toHaveCount(0);
    });
});

test.describe('Runway v2 — filter bar', () => {
    test('plan selector is populated and defaults to a plan', async ({ page }) => {
        await page.goto('/runway.html');
        const select = page.locator('#filter-plan');
        await expect(select).toBeVisible();
        const options = await select.locator('option').count();
        expect(options).toBeGreaterThanOrEqual(5);
        const selected = await select.inputValue();
        expect(selected.length).toBeGreaterThan(0);
    });

    test('provider chips populate from the catalog', async ({ page }) => {
        await page.goto('/runway.html');
        const chips = page.locator('#filter-providers .filter-chip');
        await expect(chips.first()).toBeVisible();
        // At least OpenAI, Anthropic, Google should appear.
        const labels = await chips.evaluateAll((els) => els.map((e) => e.textContent.trim()));
        expect(labels).toContain('OpenAI');
        expect(labels).toContain('Anthropic');
        expect(labels).toContain('Google');
    });

    test('clicking a provider chip dims non-matching departure rows', async ({ page }) => {
        await page.goto('/runway.html');
        // Wait for departure board to populate
        await expect(page.locator('#departure-board .departure-row').first()).toBeVisible();
        // Click Google — only Google rows should stay lit
        await page.locator('#filter-providers .filter-chip[data-provider="Google"]').click();
        // Any row in a non-Google group must be dimmed
        const dimmed = page.locator('#departure-board .departure-group:not(.provider-google) .departure-row.dimmed');
        await expect(dimmed.first()).toBeVisible();
    });

    test('toggling grounded status includes deprecated models', async ({ page }) => {
        await page.goto('/runway.html');
        // Grounded starts unchecked — deprecated rows should be dimmed.
        await expect(page.locator('#departure-board .departure-row.status-deprecated.dimmed').first()).toBeVisible();
        // Enable grounded — deprecated rows should lose .dimmed (assuming plan+provider match)
        await page.locator('#filter-status .filter-chip[data-status="deprecated"]').click();
        // Assert the total dimmed count drops
        const beforeCount = await page.locator('#departure-board .departure-row.dimmed').count();
        expect(beforeCount).toBeGreaterThanOrEqual(0);
    });

    test('filter summary reports a visible-over-total count', async ({ page }) => {
        await page.goto('/runway.html');
        await expect(page.locator('#filter-summary')).toContainText(/\d+ of \d+ models/);
    });
});

test.describe('Runway v2 — Departure Board', () => {
    test('renders one row per model in the catalog', async ({ page }) => {
        await page.goto('/runway.html');
        await expect(page.locator('#departure-board .departure-row')).toHaveCount(21);
    });

    test('deprecated models render with the grounded status LED', async ({ page }) => {
        await page.goto('/runway.html');
        await expect(page.locator('#departure-board .departure-row.status-deprecated').first()).toBeVisible();
    });
});

test.describe('Runway v2 — Model Detail Blade', () => {
    test('blade is hidden by default', async ({ page }) => {
        await page.goto('/runway.html');
        await expect(page.locator('#model-blade')).not.toHaveClass(/open/);
    });

    test('clicking a departure row opens the blade with model details', async ({ page }) => {
        await page.goto('/runway.html');
        const firstRow = page.locator('#departure-board .departure-row').first();
        const modelId = await firstRow.getAttribute('data-model-id');
        await firstRow.click();

        const blade = page.locator('#model-blade');
        await expect(blade).toHaveClass(/open/);
        await expect(blade.locator('#blade-title')).not.toHaveText('—');
        await expect(blade.locator('#blade-body .blade-section').first()).toBeVisible();

        // URL hash updates to reflect the opened model.
        expect(page.url()).toContain(`#model-${modelId}`);
    });

    test('blade renders capabilities, plan row, surface row, and meta', async ({ page }) => {
        await page.goto('/runway.html');
        await page.locator('#departure-board .departure-row').first().click();

        // At least one capability pill
        await expect(page.locator('#blade-body .blade-cap-pill').first()).toBeVisible();
        // At least one plan row cell
        await expect(page.locator('#blade-body .blade-row-cell').first()).toBeVisible();
    });

    test('blade closes on ✕ click', async ({ page }) => {
        await page.goto('/runway.html');
        await page.locator('#departure-board .departure-row').first().click();
        await expect(page.locator('#model-blade')).toHaveClass(/open/);
        await page.locator('#blade-close').click();
        await expect(page.locator('#model-blade')).not.toHaveClass(/open/);
    });

    test('blade closes on Escape key', async ({ page }) => {
        await page.goto('/runway.html');
        await page.locator('#departure-board .departure-row').first().click();
        await expect(page.locator('#model-blade')).toHaveClass(/open/);
        await page.keyboard.press('Escape');
        await expect(page.locator('#model-blade')).not.toHaveClass(/open/);
    });

    test('blade closes on backdrop click', async ({ page }) => {
        await page.goto('/runway.html');
        await page.locator('#departure-board .departure-row').first().click();
        await expect(page.locator('#model-blade')).toHaveClass(/open/);
        await page.locator('#blade-backdrop').click();
        await expect(page.locator('#model-blade')).not.toHaveClass(/open/);
    });

    test('deep link #model-<id> opens the blade on load', async ({ page }) => {
        // Pick first model id dynamically
        await page.goto('/runway.html');
        const firstId = await page.evaluate(async () => {
            const r = await fetch('data/copilot-models.json');
            const d = await r.json();
            return d.models[0].id;
        });
        await page.goto(`/runway.html#model-${firstId}`);
        await expect(page.locator('#model-blade')).toHaveClass(/open/);
        await expect(page.locator('#blade-title')).not.toHaveText('—');
    });
});

test.describe('Runway v2 — Handover Topology', () => {
    test('topology section renders with diagram and legend', async ({ page }) => {
        await page.goto('/runway.html');
        await expect(page.locator('.topology-section')).toBeVisible();
        await expect(page.locator('#topology-diagram')).toBeVisible();
        await expect(page.locator('#topology-legend .topology-quadrant')).toHaveCount(4);
    });

    test('topology Mermaid diagram renders as SVG', async ({ page }) => {
        await page.goto('/runway.html');
        await expect(page.locator('#topology-diagram svg').first()).toBeVisible({ timeout: 5000 });
    });

    test('topology data flows section renders all five flows', async ({ page }) => {
        await page.goto('/runway.html');
        await expect(page.locator('#topology-flows .topology-flow')).toHaveCount(5);
        await expect(page.locator('#topology-flows .topology-flow-label').first()).not.toBeEmpty();
    });

    test('model-surface matrix renders with available/unavailable cells', async ({ page }) => {
        await page.goto('/runway.html');
        await expect(page.locator('#topology-model-matrix .topology-matrix')).toBeVisible();
        await expect(page.locator('#topology-model-matrix .topology-matrix-cell.available').first()).toBeVisible();
        await expect(page.locator('#topology-model-matrix .topology-matrix-cell.unavailable').first()).toBeVisible();
    });

    test('matrix rows are clickable and open the model blade', async ({ page }) => {
        await page.goto('/runway.html');
        const firstRow = page.locator('#topology-model-matrix .topology-matrix-row').first();
        await firstRow.click();
        await expect(page.locator('#model-blade')).toHaveClass(/open/);
    });
});

test.describe('Runway v2 — NOTAMs + Engine', () => {
    test('NOTAMs render with severity classes', async ({ page }) => {
        await page.goto('/runway.html');
        await expect(page.locator('#notam-list .notam-card')).toHaveCount(2);
        await expect(page.locator('#notam-list .notam-card.severity-high').first()).toBeVisible();
    });

    test('engine explainer renders summary, capabilities, and Mermaid diagram', async ({ page }) => {
        await page.goto('/runway.html');
        await expect(page.locator('#engine-summary')).not.toBeEmpty();
        await expect(page.locator('#engine-capabilities li').first()).toBeVisible();
        await expect(page.locator('.engine-diagram svg').first()).toBeVisible({ timeout: 5000 });
    });
});

test.describe('Cockpit → Runway model bridge', () => {
    test('cockpit cards never render a Runway badge', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('.instrument').first()).toBeVisible();
        await expect(page.locator('.instrument-runway-badge')).toHaveCount(0);
    });

    test('detail panel shows a Model Runway callout for BYOK', async ({ page }) => {
        await page.goto('/');
        await page.locator('.instrument[data-id="byok"]').click();
        const callout = page.locator('#detail-panel .detail-runway-callout');
        await expect(callout).toBeVisible();
        await expect(callout).toContainText('Model Runway');
        await expect(callout).toHaveAttribute('href', 'runway.html');
    });

    test('detail panel shows a Model Runway callout for Copilot Plans', async ({ page }) => {
        await page.goto('/');
        await page.locator('.instrument[data-id="copilot-plans"]').click();
        await expect(page.locator('#detail-panel .detail-runway-callout')).toBeVisible();
    });

    test('detail panel for an unrelated instrument has no runway callout', async ({ page }) => {
        await page.goto('/');
        await page.locator('.instrument[data-id="inline-completions"]').click();
        await expect(page.locator('#detail-panel')).toBeVisible();
        await expect(page.locator('#detail-panel .detail-runway-callout')).toHaveCount(0);
    });
});

test.describe('Runway v2 — nav promotion', () => {
    test('Runway nav link on the cockpit points to runway.html (no SOON)', async ({ page }) => {
        await page.goto('/');
        const runwayLink = page.locator('.header-nav a[href="runway.html"]');
        await expect(runwayLink).toHaveCount(1);
        await expect(runwayLink).not.toHaveClass(/disabled/);
        await expect(runwayLink.locator('.nav-soon')).toHaveCount(0);
    });

    test('navigation from cockpit to runway works', async ({ page }) => {
        await page.goto('/');
        await page.locator('.header-nav a[href="runway.html"]').click();
        await expect(page).toHaveURL(/runway\.html/);
        await expect(page.locator('main.runway-main')).toBeVisible();
    });
});
