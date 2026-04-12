// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Tower Perspective tests — Admin & Governance stub.
 *
 * When the old Tower (which was the model catalog) was renamed to Runway,
 * a new thin Tower admin page took over at /tower.html. It renders
 * data/governance-controls.json as a compliance framework legend plus a
 * list of governance controls, and supports #control=<id> deep links
 * from the Cockpit detail panel's governance callout.
 *
 * Covers:
 *  - Page boot + core landmarks
 *  - Verification banner
 *  - Compliance framework legend
 *  - Governance control list
 *  - Deep link highlight via #control=<id>
 *  - Cockpit → Tower governance bridge
 */

test.describe('Tower — page structure', () => {
    test('loads without JS errors and renders core landmarks', async ({ page }) => {
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (msg) => {
            if (msg.type() === 'error') errors.push(msg.text());
        });

        await page.goto('/tower.html');
        await expect(page.locator('main#tower-main')).toBeVisible();
        await expect(page.locator('h1')).toContainText('Tower Perspective');
        expect(errors).toEqual([]);
    });

    test('marks Tower as the active nav link', async ({ page }) => {
        await page.goto('/tower.html');
        const active = page.locator('.nav-link.active');
        await expect(active).toHaveCount(1);
        await expect(active).toContainText('Tower');
    });

    test('verification banner is hidden now that controls are verified', async ({ page }) => {
        await page.goto('/tower.html');
        await expect(page.locator('#verification-banner')).toBeHidden();
    });
});

test.describe('Tower — compliance frameworks', () => {
    test('renders one chip per framework from the catalog', async ({ page }) => {
        await page.goto('/tower.html');
        const chips = page.locator('#framework-list .framework-chip');
        await expect(chips.first()).toBeVisible();
        // soc2, iso27001, gdpr, hipaa, fedramp, euAiAct
        await expect(chips).toHaveCount(6);
    });

    test('framework chips link out to the official standard', async ({ page }) => {
        await page.goto('/tower.html');
        const firstChip = page.locator('#framework-list .framework-chip').first();
        await expect(firstChip).toHaveAttribute('href', /.+/);
        await expect(firstChip).toHaveAttribute('target', '_blank');
        await expect(firstChip).toHaveAttribute('rel', /noopener/);
    });
});

test.describe('Tower — governance controls', () => {
    test('renders one row per control in the catalog', async ({ page }) => {
        await page.goto('/tower.html');
        await expect(page.locator('#control-list .control-row').first()).toBeVisible();
        // 19 controls in the verified catalog
        await expect(page.locator('#control-list .control-row')).toHaveCount(19);
    });

    test('control rows carry compliance badges', async ({ page }) => {
        await page.goto('/tower.html');
        await expect(page.locator('#control-list .control-row .control-badge').first()).toBeVisible();
    });

    test('control rows expose their id for deep linking', async ({ page }) => {
        await page.goto('/tower.html');
        const row = page.locator('#control-list .control-row').first();
        await expect(row).toHaveAttribute('data-control-id', /.+/);
        const id = await row.getAttribute('data-control-id');
        await expect(page.locator(`#control-${id}`)).toBeVisible();
    });

    test('deep link #control=<id> highlights the target row on load', async ({ page }) => {
        await page.goto('/tower.html#control=usage-metrics');
        const target = page.locator('#control-usage-metrics');
        await expect(target).toBeVisible();
        await expect(target).toHaveClass(/highlight/);
    });

    test('changing the hash at runtime updates the highlight', async ({ page }) => {
        await page.goto('/tower.html');
        await page.evaluate(() => { window.location.hash = '#control=audit-logs'; });
        await expect(page.locator('#control-audit-logs')).toHaveClass(/highlight/);
    });
});

test.describe('Tower — flight plans', () => {
    test('flight plans render with recommended pills', async ({ page }) => {
        await page.goto('/tower.html');
        await expect(page.locator('#flight-plans .flight-plan-card')).toHaveCount(5);
        await expect(page.locator('#flight-plans .flight-plan-pill.recommended').first()).toBeVisible();
    });

    test('flight plan cards show task context and rationale', async ({ page }) => {
        await page.goto('/tower.html');
        const firstCard = page.locator('#flight-plans .flight-plan-card').first();
        await expect(firstCard.locator('.flight-plan-title')).not.toBeEmpty();
        await expect(firstCard.locator('.flight-plan-context')).not.toBeEmpty();
        await expect(firstCard.locator('.flight-plan-rationale').first()).not.toBeEmpty();
    });
});

test.describe('Tower — roadmap stub', () => {
    test('on-final-approach roadmap lists planned expansions', async ({ page }) => {
        await page.goto('/tower.html');
        await expect(page.locator('.tower-roadmap li').first()).toBeVisible();
    });
});

test.describe('Cockpit → Tower governance bridge', () => {
    test('detail panel shows a governance callout pointing at tower.html', async ({ page }) => {
        await page.goto('/');
        // Feature Policies is a classic governance-relevant instrument
        await page.locator('.instrument[data-id="feature-policies"]').click();
        const callout = page.locator('#detail-panel .detail-gov-callout');
        await expect(callout).toBeVisible();
        await expect(callout).toHaveAttribute('href', /tower\.html#control=/);
    });
});
