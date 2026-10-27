import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { mkdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { Schedule } from '../../src/shared/domain';
import { primaryScheduleId } from '../../src/dashboard/course-model';

const scheduleKey = 'uhd.schedule.' + primaryScheduleId;
const plannerUrl = 'https://uhd-course-planner.pages.dev/';

test('timetable survives editing, export, reload and browser restart', async ({ playwright }, testInfo) => {
  const extensionPath = path.resolve('dist');
  await stat(path.join(extensionPath, 'manifest.json')).catch(() => {
    throw new Error('Built extension missing. Run npm run build before npm run test:e2e.');
  });
  // A new test-output directory is used on every run, never a personal browser profile.
  const profile = testInfo.outputPath('profile');
  await mkdir(profile, { recursive: true });
  let context: BrowserContext | undefined;
  let page: Page;
  let extensionId = '';
  const pageErrors: string[] = [];
  const unexpectedRequests: string[] = [];
  let plannerNavigations = 0;

  async function launch() {
    context = await playwright.chromium.launchPersistentContext(profile, {
      channel: 'chromium', headless: true, acceptDownloads: true,
      viewport: { width: 1440, height: 1100 },
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });
    context.setDefaultTimeout(10_000);
    context.on('page', target => target.on('pageerror', error => pageErrors.push(error.message)));
    await context.route(/^https?:\/\//, async route => {
      const request = route.request();
      if (request.url() === plannerUrl && request.isNavigationRequest()) {
        plannerNavigations++;
        await route.fulfill({ contentType: 'text/html', body: '<title>Synthetic planner target</title><p>Planner navigation fixture</p>' });
      } else {
        unexpectedRequests.push(new URL(request.url()).origin);
        await route.abort();
      }
    });
    const worker = context.serviceWorkers().find(candidate => candidate.url().startsWith('chrome-extension://'))
      ?? await context.waitForEvent('serviceworker', { predicate: candidate => candidate.url().startsWith('chrome-extension://') });
    const foundId = new URL(worker.url()).host;
    if (extensionId) expect(foundId).toBe(extensionId);
    extensionId = foundId;
    console.log(`Isolated Chromium: ${context.browser()?.version()}; platform: ${process.platform}`);
  }

  const ready = () => expect(page.getByRole('button', { name: 'Add course', exact: true })).toBeEnabled();
  const button = (name: string) => page.getByRole('button', { name, exact: true });
  const readSchedule = () => page.evaluate(async key => (await chrome.storage.local.get(key))[key] as Schedule, scheduleKey);
  async function save() { await button('Save course').click(); await ready(); }
  async function cancel() { await button('Cancel').click(); await ready(); }
  async function openDashboard() {
    const active = context!;
    const popup = await active.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    const opened = active.waitForEvent('page');
    await popup.getByRole('button', { name: 'Open timetable', exact: true }).click();
    page = await opened;
    await expect(page).toHaveURL(`chrome-extension://${extensionId}/dashboard.html`);
    await ready();
    await popup.close();
  }

  try {
    await launch();
    await openDashboard();
    await test.step('create blank card, cancel and reload without inventing fields', async () => {
      await button('Add course').click();
      await expect(page.getByText('Saved locally.', { exact: true })).toBeVisible();
      await cancel();
      await page.reload();
      await ready();
      expect((await readSchedule()).courses.map(course => Object.keys(course))).toEqual([['id']]);
      await expect(page.getByRole('button', { name: /^Edit course, Untitled course/ })).toBeVisible();
    });

    await test.step('save optional details and two exact-time meetings', async () => {
      await page.getByRole('button', { name: /^Edit course, Untitled course/ }).click();
      await page.getByLabel('Course name', { exact: true }).fill('QA Algorithms');
      await page.getByLabel('Course code', { exact: true }).fill('TEST 3300');
      await page.getByLabel('Professor', { exact: true }).fill('Dr. Example');
      await page.getByLabel('Room', { exact: true }).fill('Demo 210');
      for (const day of ['1', '3']) {
        await button('Add meeting').click();
        const row = page.locator('.meeting-row').last();
        await row.getByLabel('Day', { exact: true }).selectOption(day);
        await row.getByLabel('Start', { exact: true }).fill('09:07');
        await row.getByLabel('End', { exact: true }).fill('10:23');
      }
      await save();
      const state = await readSchedule();
      expect(state.courses[0]).toMatchObject({ title: 'QA Algorithms', courseCode: 'TEST 3300', professorName: 'Dr. Example', room: 'Demo 210' });
      expect(state.meetings).toHaveLength(2);
      expect(state.meetings.map(({ dayOfWeek, startMinute, endMinute }) => ({ dayOfWeek, startMinute, endMinute })))
        .toEqual([{ dayOfWeek: 1, startMinute: 547, endMinute: 623 }, { dayOfWeek: 3, startMinute: 547, endMinute: 623 }]);
      for (const meeting of state.meetings) await expect(page.locator(`[data-meeting-id="${meeting.id}"]`)).toBeVisible();
    });

    await test.step('cancel a keyboard proposal, then save only one occurrence', async () => {
      const before = await readSchedule();
      const monday = before.meetings.find(meeting => meeting.dayOfWeek === 1)!;
      const wednesday = before.meetings.find(meeting => meeting.dayOfWeek === 3)!;
      const card = page.locator(`[data-meeting-id="${monday.id}"]`);
      await card.focus();
      await page.keyboard.press('ArrowDown');
      await expect(page.locator('#start-' + monday.id)).toHaveValue('09:15');
      await expect(page.locator('#end-' + monday.id)).toHaveValue('10:31');
      await cancel();
      expect(await readSchedule()).toEqual(before);
      await card.focus();
      await page.keyboard.press('ArrowDown');
      await save();
      const after = await readSchedule();
      expect(after.meetings.find(meeting => meeting.id === wednesday.id)).toEqual(wednesday);
      expect(after.meetings.find(meeting => meeting.id === monday.id)).toMatchObject({ startMinute: 555, endMinute: 631 });
    });

    await test.step('reject invalid meeting time without losing draft or saved data', async () => {
      const before = await readSchedule();
      const monday = before.meetings.find(meeting => meeting.dayOfWeek === 1)!;
      await page.locator(`[data-meeting-id="${monday.id}"]`).click();
      await page.getByLabel('Room', { exact: true }).fill('Demo 211');
      const end = page.locator('#end-' + monday.id);
      await end.fill('08:00');
      await button('Save course').click();
      await expect(page.locator('.meeting-row [role="alert"]').first()).toBeVisible();
      expect(await readSchedule()).toEqual(before);
      await expect(end).toHaveValue('08:00');
      await end.fill('10:31');
      await save();
      expect((await readSchedule()).courses[0]?.room).toBe('Demo 211');
    });

    let saved: Schedule;
    let exported: { schedule: Schedule };
    await test.step('download a real backup including blank cards and exact meetings', async () => {
      await button('Add course').click();
      await expect(page.getByText('Saved locally.', { exact: true })).toBeVisible();
      await cancel();
      saved = await readSchedule();
      expect(saved.courses).toHaveLength(2);
      expect(Object.keys(saved.courses[1]!)).toEqual(['id']);
      const pending = page.waitForEvent('download');
      await button('Download backup').click();
      const download = await pending;
      const downloadedPath = await download.path();
      expect(await download.failure()).toBeNull();
      expect(downloadedPath).not.toBeNull();
      exported = JSON.parse(await readFile(downloadedPath!, 'utf8'));
      expect(Object.keys(exported).sort()).toEqual(['exportedAt', 'kind', 'schedule', 'schemaVersion']);
      expect(exported.schedule).toEqual(saved);
    });

    await test.step('preserve data across dashboard and full browser restart', async () => {
      await page.close();
      await openDashboard();
      expect(await readSchedule()).toEqual(saved);
      await context!.close();
      context = undefined;
      await launch();
      await openDashboard();
      expect(await readSchedule()).toEqual(saved);
      await page.reload();
      await ready();
      expect(await readSchedule()).toEqual(saved);
      await expect(page.getByRole('button', { name: /^Edit course, QA Algorithms/ })).toBeVisible();
    });

    await test.step('validate exported backup and cancel import without writes', async () => {
      await button('Import backup').click();
      await page.getByLabel('Timetable JSON file', { exact: true }).setInputFiles({
        name: 'synthetic-timetable.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)),
      });
      await expect(page.getByText('File validated. Review the import before confirming.', { exact: true })).toBeVisible();
      await button('Cancel import').click();
      await ready();
      expect(await readSchedule()).toEqual(saved);
    });

    await test.step('open the planner link against an intercepted target, preserving timetable', async () => {
      await page.getByRole('navigation').getByRole('link', { name: 'Planner', exact: true }).click();
      const link = page.getByRole('link', { name: /Open course planner/ });
      await expect(link).toHaveAttribute('href', plannerUrl);
      const pending = context!.waitForEvent('page');
      await link.focus();
      await page.keyboard.press('Enter');
      const target = await pending;
      await expect(target).toHaveURL(plannerUrl);
      await expect(target.getByText('Planner navigation fixture', { exact: true })).toBeVisible();
      expect(await target.evaluate(() => window.opener)).toBeNull();
      await target.close();
      await page.getByRole('navigation').getByRole('link', { name: 'Timetable', exact: true }).click();
      await ready();
      expect(await readSchedule()).toEqual(saved);
      expect(plannerNavigations).toBe(1);
    });

    expect(pageErrors).toEqual([]);
    expect(unexpectedRequests).toEqual([]);
  } finally {
    await context?.close();
  }
});
