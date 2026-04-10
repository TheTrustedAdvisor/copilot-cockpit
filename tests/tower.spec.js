// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Tower Perspective tests — model control tower view.
 *
 * Covers:
 *  - Page boot + async data rendering
 *  - Verification banner (shown while freshness pipeline is pending)
 *  - Departure Board (every model grouped by provider)
 *  - Airspace Map (reasoning × speed scatter plot)
 *  - Capability / Plan / Surface matrices
 *  - Weight & Balance (pricing multipliers)
 *  - Flight Plans (recommended vs avoid)
 *  - NOTAMs (deprecation + preview notices)
 *  - Copilot Engine explainer + Mermaid diagram
 *  - Deep link #model=<id> highlight
 *  - Cockpit → Tower bridge: detail callout for model-related instruments,
 *    and the glance-view invariant (no badges on cockpit cards).
 *  - Nav bar: Tower is promoted (no longer "SOON")
 */

test.describe('Tower Perspective — page structure', () => {
    test('loads tower.html without JS errors and renders main landmarks', async ({ page }) => {
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (msg) => {
            if (msg.type() === 'error') errors.push(msg.text());
        });

        await page.goto('/tower.html');
        await expect(page.locator('main#tower-main')).toBeVisible();
        await expect(page.locator('h1')).toContainText('Tower Perspective');
        await expect(page.locator('.subtitle')).toContainText('every model');

        // Wait for async population
        await expect(page.locator('#departure-board .departure-row').first()).toBeVisible();
        expect(errors).toEqual([]);
    });

    test('marks Tower as the active nav link on tower.html', async ({ page }) => {
        await page.goto('/tower.html');
        const active = page.locator('.nav-link.active');
        await expect(active).toHaveCount(1);
        await expect(active).toContainText('Tower');
    });

    test('verification banner is visible while the catalog is unverified', async ({ page }) => {
        await page.goto('/tower.html');
        // copilot-models.json ships with verificationRequired: true until issue #20 lands.
        await expect(page.locator('#verification-banner')).toBeVisible();
        await expect(page.locator('#verification-banner')).toContainText(/verification/i);
    });
});

test.describe('Tower — Departure Board', () => {
    test('renders one row per model in the catalog, grouped by provider', async ({ page }) => {
        await page.goto('/tower.html');
        const rows = page.locator('#departure-board .departure-row');
        await expect(rows.first()).toBeVisible();
        // Catalog currently holds 21 models.
        await expect(rows).toHaveCount(21);

        // Every row must deep-link to an in-page model anchor.
        const hrefs = await rows.evaluateAll((els) => els.map((el) => el.getAttribute('href')));
        for (const href of hrefs) {
            expect(href).toMatch(/^#model-[\w.-]+$/);
        }
    });

    test('departure groups exist for each major provider', async ({ page }) => {
        await page.goto('/tower.html');
        const groups = page.locator('#departure-board .departure-group');
        await expect(groups.first()).toBeVisible();
        // At least OpenAI, Anthropic, Google must be present.
        await expect(page.locator('.departure-group.provider-openai')).toHaveCount(1);
        await expect(page.locator('.departure-group.provider-anthropic')).toHaveCount(1);
        await expect(page.locator('.departure-group.provider-google')).toHaveCount(1);
    });

    test('deprecated models render with the grounded status LED', async ({ page }) => {
        await page.goto('/tower.html');
        // GPT-5.1 is marked deprecated in copilot-models.json (closing 2026-04-15).
        const grounded = page.locator('#departure-board .departure-row.status-deprecated');
        await expect(grounded.first()).toBeVisible();
    });
});

test.describe('Tower — Airspace Map', () => {
    test('scatters one dot per model with provider color class', async ({ page }) => {
        await page.goto('/tower.html');
        const dots = page.locator('#airspace-plots .airspace-dot');
        await expect(dots.first()).toBeVisible();
        await expect(dots).toHaveCount(21);
    });
});

test.describe('Tower — matrices', () => {
    test('capability matrix has a row per model and a header per capability', async ({ page }) => {
        await page.goto('/tower.html');
        const rows = page.locator('#capability-matrix tbody tr');
        await expect(rows.first()).toBeVisible();
        await expect(rows).toHaveCount(21);

        // Header row: Model column + N capability columns (>= 4)
        const headers = page.locator('#capability-matrix thead th');
        expect(await headers.count()).toBeGreaterThanOrEqual(5);

        // At least one strong mark exists somewhere in the matrix.
        await expect(page.locator('#capability-matrix .cap-mark.strong').first()).toBeVisible();
    });

    test('plan matrix has a row per model and a column per plan', async ({ page }) => {
        await page.goto('/tower.html');
        await expect(page.locator('#plan-matrix tbody tr')).toHaveCount(21);
        const headers = page.locator('#plan-matrix thead th');
        // Model column + plans (5 plans in catalog)
        expect(await headers.count()).toBeGreaterThanOrEqual(5);
    });

    test('surface matrix has a row per model and a column per surface', async ({ page }) => {
        await page.goto('/tower.html');
        await expect(page.locator('#surface-matrix tbody tr')).toHaveCount(21);
        const headers = page.locator('#surface-matrix thead th');
        expect(await headers.count()).toBeGreaterThanOrEqual(5);
    });
});

test.describe('Tower — Weight & Balance + Flight Plans + NOTAMs', () => {
    test('weight & balance renders a card per model, unverified cards marked', async ({ page }) => {
        await page.goto('/tower.html');
        const cards = page.locator('#weight-balance .weight-card');
        await expect(cards.first()).toBeVisible();
        await expect(cards).toHaveCount(21);

        // All pricing multipliers are null for now → every card is .unknown
        // until the freshness pipeline lands. Assert at least one .unknown exists.
        await expect(page.locator('#weight-balance .weight-card.unknown').first()).toBeVisible();
    });

    test('flight plans render with recommended pills and deep links', async ({ page }) => {
        await page.goto('/tower.html');
        const cards = page.locator('#flight-plans .flight-plan-card');
        await expect(cards.first()).toBeVisible();
        // 5 flight plans in catalog
        await expect(cards).toHaveCount(5);

        // Each card has at least one recommended pill.
        await expect(page.locator('#flight-plans .flight-plan-pill.recommended').first()).toBeVisible();
        // Recommended pills link to #model-<id>
        const href = await page.locator('#flight-plans .flight-plan-pill.recommended').first().getAttribute('href');
        expect(href).toMatch(/^#model-[\w.-]+$/);
    });

    test('notams list renders each notice with a severity class', async ({ page }) => {
        await page.goto('/tower.html');
        const notams = page.locator('#notam-list .notam-card');
        await expect(notams.first()).toBeVisible();
        // 2 NOTAMs in catalog (GPT-5.1 deprecation + Opus 4.6 fast preview caveat)
        await expect(notams).toHaveCount(2);

        // At least one high-severity NOTAM exists (GPT-5.1 deprecation).
        await expect(page.locator('#notam-list .notam-card.severity-high').first()).toBeVisible();
    });
});

test.describe('Tower — Copilot Engine explainer', () => {
    test('renders summary, capability list, and Mermaid diagram', async ({ page }) => {
        await page.goto('/tower.html');
        await expect(page.locator('#engine-summary')).not.toBeEmpty();
        await expect(page.locator('#engine-capabilities li').first()).toBeVisible();

        // Mermaid replaces the <pre class="mermaid"> with an <svg> once rendered.
        await expect(page.locator('.engine-diagram svg').first()).toBeVisible({ timeout: 5000 });
    });
});

test.describe('Tower — deep linking', () => {
    test('#model-<id> scrolls to and highlights the matching matrix row', async ({ page }) => {
        // Pick the first model id dynamically so this test is resilient to catalog changes.
        await page.goto('/tower.html');
        const firstId = await page.evaluate(async () => {
            const resp = await fetch('data/copilot-models.json');
            const data = await resp.json();
            return data.models[0].id;
        });
        await page.goto(`/tower.html#model-${firstId}`);
        const row = page.locator(`#capability-matrix tr#model-${firstId}`);
        await expect(row).toBeVisible();
        // highlight class is applied by handleDeepLink() and auto-cleared after 2s
        await expect(row).toHaveClass(/highlight/);
    });
});

test.describe('Cockpit → Tower model bridge', () => {
    // The cockpit is a glance view — no cross-perspective badges on cards.
    // Cross-navigation happens via the detail panel callout, not the grid.

    test('cockpit cards never render a Tower badge', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('.instrument').first()).toBeVisible();
        await expect(page.locator('.instrument-tower-badge')).toHaveCount(0);
    });

    test('detail panel shows a Model Control Tower callout for BYOK', async ({ page }) => {
        await page.goto('/');
        await page.locator('.instrument[data-id="byok"]').click();
        const callout = page.locator('#detail-panel .detail-tower-callout');
        await expect(callout).toBeVisible();
        await expect(callout).toContainText('Model Control Tower');
        await expect(callout).toHaveAttribute('href', 'tower.html');
    });

    test('detail panel shows a Model Control Tower callout for Copilot Plans', async ({ page }) => {
        await page.goto('/');
        await page.locator('.instrument[data-id="copilot-plans"]').click();
        await expect(page.locator('#detail-panel .detail-tower-callout')).toBeVisible();
    });

    test('detail panel for an unrelated instrument has no tower callout', async ({ page }) => {
        await page.goto('/');
        // inline-completions is clearly not about choosing/gating a model family
        await page.locator('.instrument[data-id="inline-completions"]').click();
        await expect(page.locator('#detail-panel')).toBeVisible();
        await expect(page.locator('#detail-panel .detail-tower-callout')).toHaveCount(0);
    });
});

test.describe('Cockpit → Tower governance bridge (still present)', () => {
    // The governance dataset (governance-controls.json) is unchanged and still
    // powers the .detail-gov-callout. Guard against accidental breakage.

    test('detail panel shows the Governance View callout for usage-metrics', async ({ page }) => {
        await page.goto('/');
        await page.locator('.instrument[data-id="usage-metrics"]').click();
        const callout = page.locator('#detail-panel .detail-gov-callout');
        await expect(callout).toBeVisible();
        await expect(callout).toHaveAttribute('href', /tower\.html#control=usage-metrics/);
    });
});

test.describe('Tower — nav promotion', () => {
    test('Tower nav link on the cockpit points to tower.html (no SOON badge)', async ({ page }) => {
        await page.goto('/');
        const towerLink = page.locator('.header-nav a[href="tower.html"]');
        await expect(towerLink).toHaveCount(1);
        await expect(towerLink).not.toHaveClass(/disabled/);
        await expect(towerLink.locator('.nav-soon')).toHaveCount(0);
    });

    test('navigation from cockpit to tower works', async ({ page }) => {
        await page.goto('/');
        await page.locator('.header-nav a[href="tower.html"]').click();
        await expect(page).toHaveURL(/tower\.html/);
        await expect(page.locator('main.tower-main')).toBeVisible();
    });
});
