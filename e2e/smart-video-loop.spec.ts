import { test, expect } from '@playwright/test';

const TEST_VIDEO = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

test.describe('Smart Video Loop Extension', () => {
  test('Set A and Set B buttons appear in YouTube player', async ({ page }) => {
    await page.goto(TEST_VIDEO, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('video.html5-main-video', { timeout: 15000 });

    // Wait for extension to inject
    await page.waitForSelector('[data-svl-button]', { timeout: 10000 });

    // Verify buttons exist
    const toggleBtn = page.locator('[data-svl-action="toggle"]');
    await expect(toggleBtn).toBeVisible();

    const setABtn = page.locator('[data-svl-action="set-start"]');
    await expect(setABtn).toBeVisible();

    const setBBtn = page.locator('[data-svl-action="set-end"]');
    await expect(setBBtn).toBeVisible();
  });

  test('setting loop points updates time display', async ({ page }) => {
    await page.goto(TEST_VIDEO, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-svl-button]', { timeout: 10000 });

    // Click Set A (video starts at 0:00)
    await page.locator('[data-svl-action="set-start"]').click();

    // Seek forward
    const video = page.locator('video.html5-main-video');
    await video.evaluate((el) => {
      (el as HTMLVideoElement).currentTime = 30;
    });
    // Simulate timeupdate event
    await video.dispatchEvent('timeupdate');

    // Click Set B
    await page.locator('[data-svl-action="set-end"]').click();

    // Verify time display shows loop range
    const timeDisplay = page.locator('[data-svl-display="time"]');
    await expect(timeDisplay).toContainText('0:00');
    await expect(timeDisplay).toContainText('0:30');
  });

  test('toggle button activates/deactivates loop', async ({ page }) => {
    await page.goto(TEST_VIDEO, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-svl-button]', { timeout: 10000 });

    // Set loop points
    await page.locator('[data-svl-action="set-start"]').click();
    const video = page.locator('video.html5-main-video');
    await video.evaluate((el) => {
      (el as HTMLVideoElement).currentTime = 30;
    });
    await page.locator('[data-svl-action="set-end"]').click();

    // Toggle loop on
    const toggle = page.locator('[data-svl-action="toggle"]');
    await toggle.click();

    // Verify button shows active styling (pink background)
    const bgColor = await toggle.evaluate((el) =>
      getComputedStyle(el).backgroundColor,
    );
    expect(bgColor).toBe('rgb(255, 64, 129)');
  });

  test('progress bar markers appear after setting loop points', async ({ page }) => {
    await page.goto(TEST_VIDEO, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-svl-button]', { timeout: 10000 });

    // Set A at current time
    await page.locator('[data-svl-action="set-start"]').click();

    // Seek and set B
    const video = page.locator('video.html5-main-video');
    await video.evaluate((el) => {
      (el as HTMLVideoElement).currentTime = 30;
    });
    await page.locator('[data-svl-action="set-end"]').click();

    // Verify markers exist
    const startMarker = page.locator('[data-svl-marker="start"]');
    await expect(startMarker).toBeVisible();

    const endMarker = page.locator('[data-svl-marker="end"]');
    await expect(endMarker).toBeVisible();

    const region = page.locator('[data-svl-loop-region]');
    await expect(region).toBeVisible();
  });

  test('SPA navigation resets the UI', async ({ page }) => {
    await page.goto(TEST_VIDEO, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-svl-button]', { timeout: 10000 });

    // Verify initial state exists
    await expect(page.locator('[data-svl-button]').first()).toBeVisible();

    // Navigate to another video via YouTube SPA
    await page.evaluate(() => {
      window.history.pushState(
        {},
        '',
        'https://www.youtube.com/watch?v=9bZkp7q19f0',
      );
      window.dispatchEvent(new CustomEvent('yt-navigate-finish'));
    });

    // Wait for re-initialization
    await page.waitForTimeout(2000);

    // UI should be present for new video
    await expect(page.locator('[data-svl-button]').first()).toBeVisible();
  });
});
