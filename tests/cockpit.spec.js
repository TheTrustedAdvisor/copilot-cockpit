// @ts-check
const { test, expect } = require('@playwright/test');

// ============================================================
// PAGE LOAD & RENDERING
// ============================================================

test.describe('Page Load', () => {
    test('loads without console errors', async ({ page }) => {
        const errors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') errors.push(msg.text());
        });

        await page.goto('/');
        await expect(page.locator('.cockpit-grid')).toBeVisible();

        expect(errors).toEqual([]);
    });

    test('renders instruments from JSON', async ({ page }) => {
        await page.goto('/');
        const instruments = page.locator('.instrument[data-id]');
        await expect(instruments.first()).toBeVisible();

        const count = await instruments.count();
        expect(count).toBeGreaterThan(30); // We have ~42 instruments
    });

    test('renders all 8 cockpit zones', async ({ page }) => {
        await page.goto('/');
        const zones = ['pfd', 'nd', 'glareshield', 'eicas', 'pedestal', 'overhead', 'side', 'fms'];
        for (const zone of zones) {
            await expect(page.locator(`.zone[data-zone="${zone}"]`)).toBeVisible();
        }
    });

    test('shows instrument count in header after filter interaction', async ({ page }) => {
        await page.goto('/');
        // Counter is populated when a filter is activated
        await page.locator('.filter-btn[data-filter-value="beginner"]').click();
        const counter = page.locator('#visible-count');
        await expect(counter).not.toBeEmpty();
    });
});


// ============================================================
// BLADE DETAIL PANEL
// ============================================================

test.describe('Blade Detail Panel', () => {
    test('opens when clicking an instrument card', async ({ page }) => {
        await page.goto('/');
        const card = page.locator('.instrument[data-id="agent-mode"]');
        await expect(card).toBeVisible();

        await card.click();

        const body = page.locator('#cockpit-body');
        await expect(body).toHaveClass(/blade-open/);
        await expect(page.locator('#detail-panel')).toBeVisible();
        await expect(page.locator('.detail-name')).toContainText('Agent Mode');
    });

    test('shows correct instrument details', async ({ page }) => {
        await page.goto('/');
        await page.locator('.instrument[data-id="agent-mode"]').click();

        // Should show symbol, name, and zone badge
        await expect(page.locator('.detail-symbol')).toContainText('AGT');
        await expect(page.locator('.detail-name')).toContainText('Agent Mode');
        await expect(page.locator('.detail-zone-badge')).toBeVisible();
    });

    test('closes when clicking dimmed main area', async ({ page }) => {
        await page.goto('/');

        // Open blade
        await page.locator('.instrument[data-id="agent-mode"]').click();
        await expect(page.locator('#cockpit-body')).toHaveClass(/blade-open/);

        // Click the dimmed main area (the zone header, not an instrument)
        await page.locator('.cockpit-main .zone-header').first().click();

        await expect(page.locator('#cockpit-body')).not.toHaveClass(/blade-open/);
    });

    test('closes on Escape key', async ({ page }) => {
        await page.goto('/');

        await page.locator('.instrument[data-id="agent-mode"]').click();
        await expect(page.locator('#cockpit-body')).toHaveClass(/blade-open/);

        await page.keyboard.press('Escape');

        await expect(page.locator('#cockpit-body')).not.toHaveClass(/blade-open/);
    });

    test('closes via [ESC] button', async ({ page }) => {
        await page.goto('/');

        await page.locator('.instrument[data-id="agent-mode"]').click();
        await expect(page.locator('#cockpit-body')).toHaveClass(/blade-open/);

        await page.locator('.detail-close').click();

        await expect(page.locator('#cockpit-body')).not.toHaveClass(/blade-open/);
    });

    test('does NOT close when clicking inside the detail panel', async ({ page }) => {
        await page.goto('/');

        await page.locator('.instrument[data-id="agent-mode"]').click();
        await expect(page.locator('#cockpit-body')).toHaveClass(/blade-open/);

        // Click inside the detail panel content
        await page.locator('.detail-description').first().click();

        // Should still be open
        await expect(page.locator('#cockpit-body')).toHaveClass(/blade-open/);
    });

    test('switches to a different instrument without closing first', async ({ page }) => {
        await page.goto('/');

        // Open first instrument
        await page.locator('.instrument[data-id="agent-mode"]').click();
        await expect(page.locator('.detail-name')).toContainText('Agent Mode');

        // Click a different instrument (should switch, not close)
        await page.locator('.instrument[data-id="code-review"]').click();
        await expect(page.locator('#cockpit-body')).toHaveClass(/blade-open/);
        await expect(page.locator('.detail-name')).toContainText('Code Review');
    });

    test('has working tabs', async ({ page }) => {
        await page.goto('/');

        // Open an instrument that has diagrams and code
        await page.locator('.instrument[data-id="agent-mode"]').click();

        // Overview tab should be active by default
        await expect(page.locator('.detail-tab.active')).toContainText('Overview');
        await expect(page.locator('.detail-tab-content.active')).toBeVisible();

        // Click Resources tab
        const resourcesTab = page.locator('.detail-tab', { hasText: 'Resources' });
        if (await resourcesTab.isVisible()) {
            await resourcesTab.click();
            await expect(resourcesTab).toHaveClass(/active/);
        }
    });
});


// ============================================================
// DEEP LINKING
// ============================================================

test.describe('Deep Linking', () => {
    test('opens instrument from URL hash', async ({ page }) => {
        await page.goto('/#instrument-agent-mode');

        // Wait for the blade to open
        await expect(page.locator('#cockpit-body')).toHaveClass(/blade-open/, { timeout: 5000 });
        await expect(page.locator('.detail-name')).toContainText('Agent Mode');
    });

    test('updates URL hash when opening instrument', async ({ page }) => {
        await page.goto('/');
        await page.locator('.instrument[data-id="mcp"]').click();

        await expect(page).toHaveURL(/.*#instrument-mcp/);
    });

    test('clears URL hash when closing panel', async ({ page }) => {
        await page.goto('/');
        await page.locator('.instrument[data-id="agent-mode"]').click();
        await expect(page).toHaveURL(/.*#instrument-agent-mode/);

        await page.keyboard.press('Escape');
        await expect(page).not.toHaveURL(/.*#instrument-/);
    });
});


// ============================================================
// THEME TOGGLE
// ============================================================

test.describe('Theme Toggle', () => {
    test('switches to light theme', async ({ page }) => {
        await page.goto('/');

        // Default should be dark (no light-theme class)
        await expect(page.locator('body')).not.toHaveClass(/light-theme/);

        // Click DAY button to switch to light
        await page.locator('#theme-toggle').click();

        await expect(page.locator('body')).toHaveClass(/light-theme/);
        await expect(page.locator('#theme-toggle')).toContainText('NIGHT');
    });

    test('toggles back to dark theme', async ({ page }) => {
        await page.goto('/');
        await page.locator('#theme-toggle').click(); // to light
        await page.locator('#theme-toggle').click(); // back to dark

        await expect(page.locator('body')).not.toHaveClass(/light-theme/);
        await expect(page.locator('#theme-toggle')).toContainText('DAY');
    });

    test('persists theme in localStorage', async ({ page }) => {
        await page.goto('/');
        await page.locator('#theme-toggle').click();

        const theme = await page.evaluate(() => localStorage.getItem('cockpit-theme'));
        expect(theme).toBe('light');
    });
});


// ============================================================
// FILTERS
// ============================================================

test.describe('Filters', () => {
    test('flight mode filter dims non-matching instruments', async ({ page }) => {
        await page.goto('/');

        // Click "VFR · Beginner" filter
        await page.locator('.filter-btn[data-filter-value="beginner"]').click();

        // Some instruments should be dimmed
        const dimmed = page.locator('.instrument.dimmed');
        const visible = page.locator('.instrument:not(.dimmed)');

        expect(await dimmed.count()).toBeGreaterThan(0);
        expect(await visible.count()).toBeGreaterThan(0);
    });

    test('toggling filter off restores all instruments', async ({ page }) => {
        await page.goto('/');
        const totalBefore = await page.locator('.instrument[data-id]').count();

        // Activate then deactivate
        await page.locator('.filter-btn[data-filter-value="beginner"]').click();
        await page.locator('.filter-btn[data-filter-value="beginner"]').click();

        const dimmedAfter = await page.locator('.instrument.dimmed').count();
        expect(dimmedAfter).toBe(0);
    });

    test('plan filter works', async ({ page }) => {
        await page.goto('/');

        await page.locator('.filter-btn[data-filter-value="free"]').click();

        // Should dim instruments not available on free plan
        const dimmed = page.locator('.instrument.dimmed');
        expect(await dimmed.count()).toBeGreaterThan(0);
    });

    test('status filter shows only GA or Preview', async ({ page }) => {
        await page.goto('/');

        await page.locator('.filter-btn[data-filter-value="preview"]').click();

        // Non-preview instruments should be dimmed
        const visible = page.locator('.instrument:not(.dimmed)');
        const visibleCount = await visible.count();
        expect(visibleCount).toBeGreaterThan(0);

        // All visible should have status=preview
        for (let i = 0; i < visibleCount; i++) {
            const status = await visible.nth(i).getAttribute('data-status');
            expect(status).toBe('preview');
        }
    });
});


// ============================================================
// SEARCH
// ============================================================

test.describe('Search', () => {
    test('filters instruments by name', async ({ page }) => {
        await page.goto('/');

        await page.locator('#search-input').fill('Agent');

        // Wait for filtering
        await page.waitForTimeout(200);

        const visible = page.locator('.instrument:not(.dimmed)');
        const visibleCount = await visible.count();
        expect(visibleCount).toBeGreaterThan(0);
        expect(visibleCount).toBeLessThan(42);
    });

    test('/ focuses search when page has focus', async ({ page }) => {
        await page.goto('/');

        // Click body first to give the page focus (required for keyboard events)
        await page.locator('body').click();
        await page.keyboard.press('/');
        await expect(page.locator('#search-input')).toBeFocused();
    });

    test('clearing search shows all instruments', async ({ page }) => {
        await page.goto('/');

        await page.locator('#search-input').fill('Agent');
        await page.waitForTimeout(200);
        await page.locator('#search-input').fill('');
        await page.waitForTimeout(200);

        const dimmed = await page.locator('.instrument.dimmed').count();
        expect(dimmed).toBe(0);
    });
});
