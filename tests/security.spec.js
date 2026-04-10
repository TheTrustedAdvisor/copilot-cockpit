// @ts-check
const { test, expect } = require('@playwright/test');

// ============================================================
// SECURITY PERSPECTIVE PAGE — X-Ray Scanner
// ============================================================

test.describe('Security - Page Load', () => {
    test('loads without console errors', async ({ page }) => {
        const errors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') errors.push(msg.text());
        });

        await page.goto('/security.html');
        await expect(page.locator('.security-main')).toBeVisible();
        // Wait for the scanner to populate (data fetch + render)
        await expect(page.locator('.scanner-title')).not.toBeEmpty({ timeout: 5000 });
        expect(errors).toEqual([]);
    });

    test('renders compliance table', async ({ page }) => {
        await page.goto('/security.html');
        await expect(page.locator('.compliance-table')).toBeVisible();
        await expect(page.locator('.compliance-table')).toContainText('SOC 2');
        await expect(page.locator('.compliance-table')).toContainText('GDPR');
        await expect(page.locator('.compliance-table')).toContainText('HIPAA');
    });

    test('renders posture checklist with 9 items', async ({ page }) => {
        await page.goto('/security.html');
        await expect(page.locator('.posture-checkbox').first()).toBeVisible();
        expect(await page.locator('.posture-checkbox').count()).toBe(9);
    });
});


// ============================================================
// X-RAY SCANNER
// ============================================================

test.describe('X-Ray Scanner', () => {
    test('luggage lane renders with all available threats', async ({ page }) => {
        await page.goto('/security.html');
        await expect(page.locator('.luggage-item').first()).toBeVisible();
        // We ship with 5 threat entries
        expect(await page.locator('.luggage-item').count()).toBeGreaterThanOrEqual(5);
    });

    test('scanner loads with a control pre-selected on first visit', async ({ page }) => {
        // Clear persisted scan state
        await page.goto('/security.html');
        await page.evaluate(() => localStorage.removeItem('cockpit-last-scan'));
        await page.reload();

        // Scanner header should be populated
        await expect(page.locator('.scanner-title')).not.toBeEmpty({ timeout: 5000 });
        await expect(page.locator('.scanner-symbol')).not.toBeEmpty();

        // First luggage item should be active
        await expect(page.locator('.luggage-item.active')).toHaveCount(1);
    });

    test('clicking a luggage item loads a different threat', async ({ page }) => {
        await page.goto('/security.html');
        await expect(page.locator('.scanner-title')).not.toBeEmpty({ timeout: 5000 });

        const firstTitle = await page.locator('.scanner-title').textContent();

        // Click a different luggage item
        await page.locator('.luggage-item').nth(1).click();

        // Wait for scan animation to complete
        await page.waitForTimeout(400);

        const secondTitle = await page.locator('.scanner-title').textContent();
        expect(secondTitle).not.toBe(firstTitle);
    });

    test('scanner renders threat model mermaid diagram', async ({ page }) => {
        await page.goto('/security.html');
        // Mermaid renders as an SVG once the scan loads
        await expect(page.locator('.threat-model-diagram svg').first()).toBeVisible({ timeout: 8000 });
    });

    test('scanner shows attack scenario with severity and likelihood badges', async ({ page }) => {
        await page.goto('/security.html');
        await expect(page.locator('.scenario-narrative')).not.toBeEmpty({ timeout: 5000 });
        await expect(page.locator('.severity-badge')).toBeVisible();
        await expect(page.locator('.likelihood-badge')).toBeVisible();
    });

    test('scanner shows before/after demo panels', async ({ page }) => {
        await page.goto('/security.html');
        await expect(page.locator('.demo-panel.vulnerable')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('.demo-panel.hardened')).toBeVisible();
        // Both panels should have code content
        await expect(page.locator('.demo-panel.vulnerable pre')).not.toBeEmpty();
        await expect(page.locator('.demo-panel.hardened pre')).not.toBeEmpty();
    });

    test('scanner shows countermeasures list', async ({ page }) => {
        await page.goto('/security.html');
        await expect(page.locator('.countermeasures-list li').first()).toBeVisible({ timeout: 5000 });
        expect(await page.locator('.countermeasures-list li').count()).toBeGreaterThan(2);
    });

    test('scanner shows blast radius indicator', async ({ page }) => {
        await page.goto('/security.html');
        const blast = page.locator('.blast-radius');
        await expect(blast).toBeVisible({ timeout: 5000 });
        const level = await blast.getAttribute('data-level');
        expect(['low', 'medium', 'high']).toContain(level);
    });

    test('"Open in Cockpit" link navigates to instrument deep link', async ({ page }) => {
        await page.goto('/security.html');
        await expect(page.locator('.scanner-open-cockpit')).toBeVisible({ timeout: 5000 });
        const href = await page.locator('.scanner-open-cockpit').getAttribute('href');
        expect(href).toMatch(/^index\.html#instrument-/);
    });

    test('deep link #scan=agent-mode loads that control', async ({ page }) => {
        await page.goto('/security.html#scan=agent-mode');
        await expect(page.locator('.scanner-title')).toContainText(/Agent/i, { timeout: 5000 });
        // The luggage item for agent-mode should be active
        await expect(page.locator('.luggage-item[data-scan-id="agent-mode"]')).toHaveClass(/active/);
    });

    test('hash updates when switching scans', async ({ page }) => {
        await page.goto('/security.html');
        await expect(page.locator('.luggage-item').first()).toBeVisible();

        // Click a specific item
        await page.locator('.luggage-item[data-scan-id="content-exclusion"]').click();
        await page.waitForTimeout(300);

        await expect(page).toHaveURL(/#scan=content-exclusion/);
    });

    test('last scanned control persists in localStorage across reloads', async ({ page }) => {
        await page.goto('/security.html');
        await expect(page.locator('.luggage-item').first()).toBeVisible();

        await page.locator('.luggage-item[data-scan-id="mcp"]').click();
        await page.waitForTimeout(300);

        const stored = await page.evaluate(() => localStorage.getItem('cockpit-last-scan'));
        expect(stored).toBe('mcp');

        // Reload without hash — should restore last scan
        await page.goto('/security.html');
        await expect(page.locator('.luggage-item[data-scan-id="mcp"]')).toHaveClass(/active/);
    });
});


// ============================================================
// POSTURE SCORE INTERACTIVITY
// ============================================================

test.describe('Security - Posture Score', () => {
    test('starts at 0% with "At Risk" status', async ({ page }) => {
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

        await page.reload();
        await expect(page.locator('#posture-score')).toHaveText('22%');
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
// THEME PERSISTENCE
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
