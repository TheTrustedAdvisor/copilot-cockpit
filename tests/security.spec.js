// @ts-check
const { test, expect } = require('@playwright/test');

// ============================================================
// SECURITY PERSPECTIVE PAGE
// ============================================================

test.describe('Security - Page Load', () => {
    test('loads without console errors', async ({ page }) => {
        const errors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') errors.push(msg.text());
        });

        await page.goto('/security.html');
        await expect(page.locator('.security-main')).toBeVisible();
        expect(errors).toEqual([]);
    });

    test('renders posture score card', async ({ page }) => {
        await page.goto('/security.html');
        await expect(page.locator('.posture-score-card')).toBeVisible();
        await expect(page.locator('#posture-score')).toContainText('%');
    });

    test('renders posture checklist with 9 items', async ({ page }) => {
        await page.goto('/security.html');
        // Wait for JS to populate the list
        await expect(page.locator('.posture-checkbox').first()).toBeVisible();
        const count = await page.locator('.posture-checkbox').count();
        expect(count).toBe(9);
    });

    test('renders critical controls grid', async ({ page }) => {
        await page.goto('/security.html');
        await expect(page.locator('.critical-control-card').first()).toBeVisible();
        const count = await page.locator('.critical-control-card').count();
        expect(count).toBe(9);
    });

    test('renders security instruments grouped by zone', async ({ page }) => {
        await page.goto('/security.html');
        await expect(page.locator('.security-zone-group').first()).toBeVisible();

        // Should have multiple zones (data has 7 zones with security-relevant instruments)
        const zones = await page.locator('.security-zone-group').count();
        expect(zones).toBeGreaterThan(3);

        // Should have many instrument chips (34 total in data)
        const chips = await page.locator('.security-instrument-chip').count();
        expect(chips).toBeGreaterThan(20);
    });

    test('renders compliance table', async ({ page }) => {
        await page.goto('/security.html');
        await expect(page.locator('.compliance-table')).toBeVisible();
        await expect(page.locator('.compliance-table')).toContainText('SOC 2');
        await expect(page.locator('.compliance-table')).toContainText('GDPR');
        await expect(page.locator('.compliance-table')).toContainText('HIPAA');
    });
});


// ============================================================
// POSTURE SCORE INTERACTIVITY
// ============================================================

test.describe('Security - Posture Score', () => {
    test('starts at 0% with "At Risk" status', async ({ page }) => {
        // Clear any existing posture state
        await page.goto('/security.html');
        await page.evaluate(() => localStorage.removeItem('cockpit-security-posture'));
        await page.reload();

        await expect(page.locator('#posture-score')).toHaveText('0%');
        await expect(page.locator('#posture-status')).toContainText('At Risk');
    });

    test('increases when checkboxes are ticked', async ({ page }) => {
        await page.goto('/security.html');
        await page.evaluate(() => localStorage.removeItem('cockpit-security-posture'));
        await page.reload();

        // Tick first checkbox
        await page.locator('.posture-checkbox').first().check();
        // 1/9 = 11% rounded
        await expect(page.locator('#posture-score')).toHaveText('11%');
    });

    test('reaches 100% when all checked — shows "Cleared for Flight"', async ({ page }) => {
        await page.goto('/security.html');
        await page.evaluate(() => localStorage.removeItem('cockpit-security-posture'));
        await page.reload();

        const checkboxes = page.locator('.posture-checkbox');
        const count = await checkboxes.count();
        for (let i = 0; i < count; i++) {
            await checkboxes.nth(i).check();
        }
        await expect(page.locator('#posture-score')).toHaveText('100%');
        await expect(page.locator('#posture-status')).toContainText('Cleared for Flight');
    });

    test('persists posture state in localStorage', async ({ page }) => {
        await page.goto('/security.html');
        await page.evaluate(() => localStorage.removeItem('cockpit-security-posture'));
        await page.reload();

        await page.locator('.posture-checkbox').first().check();
        await page.locator('.posture-checkbox').nth(1).check();

        const state = await page.evaluate(() =>
            JSON.parse(localStorage.getItem('cockpit-security-posture') || '{}')
        );
        expect(Object.values(state).filter(Boolean).length).toBe(2);

        // Reload → state should persist
        await page.reload();
        await expect(page.locator('#posture-score')).toHaveText('22%');
    });
});


// ============================================================
// CRITICAL CONTROLS NAVIGATION
// ============================================================

test.describe('Security - Critical Controls', () => {
    test('critical control card links to cockpit deep link', async ({ page }) => {
        await page.goto('/security.html');

        const firstCard = page.locator('.critical-control-card').first();
        await expect(firstCard).toBeVisible();
        const href = await firstCard.getAttribute('href');
        expect(href).toMatch(/^index\.html#instrument-/);
    });

    test('clicking a security instrument chip opens cockpit with deep link', async ({ page }) => {
        await page.goto('/security.html');
        const chip = page.locator('.security-instrument-chip').first();
        const href = await chip.getAttribute('href');
        expect(href).toMatch(/^index\.html#instrument-/);

        await chip.click();
        // Should navigate to cockpit with the hash
        await expect(page).toHaveURL(/index\.html#instrument-/);
        await expect(page.locator('#cockpit-body')).toHaveClass(/blade-open/);
    });
});


// ============================================================
// PERSPECTIVE NAVIGATION BAR
// ============================================================

test.describe('Perspective Navigation Bar', () => {
    test('shows all 5 perspectives + Flight Log on cockpit', async ({ page }) => {
        await page.goto('/');
        const nav = page.locator('.header-nav');
        await expect(nav).toBeVisible();
        await expect(nav).toContainText('Terminal');
        await expect(nav).toContainText('Security');
        await expect(nav).toContainText('Gangway');
        await expect(nav).toContainText('Cockpit');
        await expect(nav).toContainText('Tower');
        await expect(nav).toContainText('Flight Log');
    });

    test('marks Cockpit active on index.html', async ({ page }) => {
        await page.goto('/');
        const active = page.locator('.nav-link.active');
        await expect(active).toHaveCount(1);
        await expect(active).toContainText('Cockpit');
    });

    test('marks Security active on security.html', async ({ page }) => {
        await page.goto('/security.html');
        const active = page.locator('.nav-link.active');
        await expect(active).toHaveCount(1);
        await expect(active).toContainText('Security');
    });

    test('marks Flight Log active on flight-log.html', async ({ page }) => {
        await page.goto('/flight-log.html');
        const active = page.locator('.nav-link.active');
        await expect(active).toHaveCount(1);
        await expect(active).toContainText('Flight Log');
    });

    test('disabled perspectives have SOON badge and are not clickable', async ({ page }) => {
        await page.goto('/');
        const disabled = page.locator('.nav-link.disabled');
        await expect(disabled).toHaveCount(3); // Terminal, Gangway, Tower

        // SOON badges visible
        const soonBadges = page.locator('.nav-soon');
        await expect(soonBadges).toHaveCount(3);
        await expect(soonBadges.first()).toContainText('SOON');
    });

    test('navigation from cockpit to security works', async ({ page }) => {
        await page.goto('/');
        await page.locator('.header-nav a[href="security.html"]').click();
        await expect(page).toHaveURL(/security\.html/);
        await expect(page.locator('.security-main')).toBeVisible();
    });

    test('navigation from security back to cockpit works', async ({ page }) => {
        await page.goto('/security.html');
        await page.locator('.header-nav a[href="index.html"]').click();
        await expect(page).toHaveURL(/\/$|index\.html/);
        await expect(page.locator('.cockpit-grid')).toBeVisible();
    });
});


// ============================================================
// THEME PERSISTENCE ACROSS PAGES
// ============================================================

test.describe('Security - Theme', () => {
    test('theme toggle works on security page', async ({ page }) => {
        await page.goto('/security.html');
        await expect(page.locator('body')).not.toHaveClass(/light-theme/);

        await page.locator('#theme-toggle').click();
        await expect(page.locator('body')).toHaveClass(/light-theme/);
        await expect(page.locator('#theme-toggle')).toContainText('NIGHT');
    });

    test('theme persists between Security and Cockpit', async ({ page }) => {
        await page.goto('/security.html');
        await page.locator('#theme-toggle').click(); // → light

        await page.goto('/');
        await expect(page.locator('body')).toHaveClass(/light-theme/);
    });
});
