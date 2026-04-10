// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Tower Perspective tests — admin & governance view.
 *
 * Covers:
 *  - Page boot + async data rendering
 *  - Radar scope hero (score, breakdown, blips)
 *  - Governance controls grid
 *  - Seat widget + regions
 *  - Adoption metrics + instrument usage table
 *  - Compliance mapping cards + secure external links
 *  - Incident runbook <details> expansion
 *  - Deep link #control=<id> highlight
 *  - GOV badge + detail callout integration in the cockpit
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
        await expect(page.locator('.radar-scope')).toBeVisible();

        // Wait for async population
        await expect(page.locator('#governance-grid .governance-card').first()).toBeVisible();
        expect(errors).toEqual([]);
    });

    test('marks Tower as the active nav link on tower.html', async ({ page }) => {
        await page.goto('/tower.html');
        const active = page.locator('.nav-link.active');
        await expect(active).toHaveCount(1);
        await expect(active).toContainText('Tower');
    });
});

test.describe('Tower — radar scope hero', () => {
    test('radar displays a governance score and status text', async ({ page }) => {
        await page.goto('/tower.html');
        const score = page.locator('#governance-score');
        await expect(score).not.toHaveText('--'); // placeholder was replaced
        await expect(score).toContainText('%');
        await expect(page.locator('#governance-status')).not.toHaveText('Scanning…');
    });

    test('radar breakdown lists the posture checks', async ({ page }) => {
        await page.goto('/tower.html');
        const checks = page.locator('#radar-breakdown .radar-check');
        await expect(checks.first()).toBeVisible();
        // Mock posture has 7 checks (see renderRadar())
        await expect(checks).toHaveCount(7);
    });

    test('radar scope renders clickable blips linked by #control=', async ({ page }) => {
        await page.goto('/tower.html');
        const blips = page.locator('#radar-blips .radar-blip');
        await expect(blips.first()).toBeVisible();
        // renderRadar slices first 8 controls
        await expect(blips).toHaveCount(8);
        // Every blip href must be an in-page control deep link
        const href = await blips.first().getAttribute('href');
        expect(href).toMatch(/^#control=[\w-]+$/);
    });
});

test.describe('Tower — governance controls grid', () => {
    test('renders a card per governance control and links to the cockpit', async ({ page }) => {
        await page.goto('/tower.html');
        const cards = page.locator('#governance-grid .governance-card');
        await expect(cards.first()).toBeVisible();
        // 14 controls in tower-governance.json
        await expect(cards).toHaveCount(14);

        // Each card must deep-link back to the instrument detail on index.html
        const hrefs = await cards.evaluateAll((els) =>
            els.map((el) => el.getAttribute('href'))
        );
        for (const href of hrefs) {
            expect(href).toMatch(/^index\.html#instrument-[\w-]+$/);
        }
    });

    test('content-exclusion card carries a rollout effort badge', async ({ page }) => {
        await page.goto('/tower.html');
        const card = page.locator('.governance-card[data-control-id="content-exclusion"]');
        await expect(card).toBeVisible();
        await expect(card.locator('.governance-card-rollout')).toBeVisible();
    });
});

test.describe('Tower — seat widget + metrics', () => {
    test('seat widget shows org name, utilization, and regions', async ({ page }) => {
        await page.goto('/tower.html');
        const widget = page.locator('#seat-widget');
        await expect(widget.locator('.seat-org-name')).toContainText('Acme Aerospace');
        await expect(widget.locator('.seat-utilization-value')).toContainText('%');
        // Mock data lists 3 regions
        await expect(widget.locator('.seat-region')).toHaveCount(3);
    });

    test('adoption metrics grid renders 4 cards and instrument usage table populates', async ({ page }) => {
        await page.goto('/tower.html');
        await expect(page.locator('#metrics-grid .metric-card')).toHaveCount(4);
        const rows = page.locator('#instrument-usage-table tbody tr');
        await expect(rows.first()).toBeVisible();
        // Each row links back to a cockpit instrument
        const firstLink = rows.first().locator('a');
        const href = await firstLink.getAttribute('href');
        expect(href).toMatch(/^index\.html#instrument-[\w-]+$/);
    });
});

test.describe('Tower — compliance + incidents', () => {
    test('renders the 6 compliance framework cards with safe external links', async ({ page }) => {
        await page.goto('/tower.html');
        const cards = page.locator('#compliance-framework-grid .compliance-card');
        await expect(cards).toHaveCount(6);

        // External links must open in a new tab with rel=noopener noreferrer
        const links = cards.locator('.compliance-card-link');
        const count = await links.count();
        for (let i = 0; i < count; i++) {
            const link = links.nth(i);
            await expect(link).toHaveAttribute('target', '_blank');
            const rel = await link.getAttribute('rel');
            expect(rel).toContain('noopener');
            expect(rel).toContain('noreferrer');
        }
    });

    test('incident runbook lists 3 squawk entries that expand on click', async ({ page }) => {
        await page.goto('/tower.html');
        const incidents = page.locator('#incident-list .incident-card');
        await expect(incidents).toHaveCount(3);

        const first = incidents.first();
        // <details> is collapsed by default
        await expect(first).not.toHaveAttribute('open', 'true');
        await first.locator('summary').click();
        await expect(first).toHaveAttribute('open', '');
        // Expanded body must show at least one phase
        await expect(first.locator('.incident-phase').first()).toBeVisible();
    });
});

test.describe('Tower — deep linking', () => {
    test('#control=<id> scrolls to and highlights the matching governance card', async ({ page }) => {
        await page.goto('/tower.html#control=content-exclusion');
        const card = page.locator('.governance-card[data-control-id="content-exclusion"]');
        await expect(card).toBeVisible();
        // The highlight class is applied by handleDeepLink() and auto-cleared after 2s
        await expect(card).toHaveClass(/highlight/);
    });
});

test.describe('Cockpit → Tower governance integration', () => {
    // Note: cockpit instrument cards deliberately do NOT show a GOV badge.
    // Same reasoning as the X-Ray scanner: the cockpit grid is a glance view
    // and must not overlay the pulsing status LED. Cross-navigation happens
    // via the detail panel callout, not the grid.

    test('cockpit cards never render a GOV badge', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('.instrument').first()).toBeVisible();
        await expect(page.locator('.instrument-gov-badge')).toHaveCount(0);
    });

    test('detail panel shows a Governance View Available callout for governed instruments', async ({ page }) => {
        await page.goto('/');
        await page.locator('.instrument[data-id="usage-metrics"]').click();
        const callout = page.locator('#detail-panel .detail-gov-callout');
        await expect(callout).toBeVisible();
        await expect(callout).toContainText('Governance View Available');
        await expect(callout).toHaveAttribute('href', 'tower.html#control=usage-metrics');
    });

    test('detail panel for an ungoverned instrument has no gov callout', async ({ page }) => {
        await page.goto('/');
        // Pick an instrument NOT in tower-governance.json — find one dynamically
        const ungovernedId = await page.evaluate(async () => {
            const [inst, gov] = await Promise.all([
                fetch('data/copilot-instruments.json').then((r) => r.json()),
                fetch('data/tower-governance.json').then((r) => r.json())
            ]);
            const govIds = new Set(gov.controls.map((c) => c.id));
            const ungoverned = inst.instruments.find((i) => !govIds.has(i.id));
            return ungoverned ? ungoverned.id : null;
        });
        expect(ungovernedId).not.toBeNull();

        await page.locator(`.instrument[data-id="${ungovernedId}"]`).click();
        await expect(page.locator('#detail-panel')).toBeVisible();
        await expect(page.locator('#detail-panel .detail-gov-callout')).toHaveCount(0);
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
