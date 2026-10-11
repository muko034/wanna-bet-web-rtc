import { expect, test as base, type Page } from '@playwright/test';

/**
 * A Host and a Guest, each in its own browser context, so their `localStorage` (identity,
 * saved Room) is separate like two real devices.
 */
const test = base.extend<{ host: Page; guest: Page }>({
  host: async ({ browser }, use) => {
    const context = await browser.newContext();
    // The first Challenger is a random pick. Halving every `Math.random` result makes the Host
    // the Challenger, so the Guest is the Bettor. Ids stay unique: only the top bit is lost.
    await context.addInitScript(() => {
      const random = Math.random.bind(Math);
      Math.random = () => random() / 2;
    });
    await use(await context.newPage());
    await context.close();
  },
  guest: async ({ browser }, use) => {
    const context = await browser.newContext();
    await use(await context.newPage());
    await context.close();
  },
});

async function createRoom(host: Page, name: string): Promise<string> {
  await host.goto('.');
  await host.getByRole('link', { name: 'Create' }).click();
  await host.getByPlaceholder('Your name').fill(name);
  await host.getByRole('button', { name: 'Create' }).click();
  await expect(host.getByText('Room code', { exact: true })).toBeVisible();
  return (await host.locator('.vb-code-giant span').first().innerText()).trim();
}

async function joinRoom(guest: Page, code: string, name: string): Promise<void> {
  await guest.goto('.');
  await guest.getByRole('link', { name: 'Join' }).click();
  await guest.getByPlaceholder('Room code').fill(code);
  await guest.getByRole('button', { name: 'Continue' }).click();
  await guest.getByPlaceholder('Your name').fill(name);
  await guest.getByRole('button', { name: 'Join' }).click();
}

test('Host creates a Room, Guest joins by Room Code, both see each other', async ({ host, guest }) => {
  const code = await createRoom(host, 'Hanna');
  expect(code).toMatch(/^[A-Z0-9]+$/);

  await joinRoom(guest, code, 'Gus');

  await expect(host.getByText('Hanna (you)')).toBeVisible();
  await expect(host.getByText('Gus', { exact: true })).toBeVisible();
  await expect(guest.getByText('Hanna', { exact: true })).toBeVisible();
  await expect(guest.getByText('Gus (you)')).toBeVisible();
});

test('Host starts the Game, Guest places a Bet', async ({ host, guest }) => {
  const code = await createRoom(host, 'Hanna');
  await joinRoom(guest, code, 'Gus');
  await expect(host.getByText('Gus', { exact: true })).toBeVisible();

  await host.getByRole('button', { name: 'Start game' }).click();

  await guest.getByRole('button', { name: 'YES', exact: true }).click();
  await guest.getByRole('button', { name: 'Lock in bet' }).click();

  await expect(guest.getByText('Locked in 🔒')).toBeVisible();
  await expect(guest.getByText(/You bet \d+ pts on YES/)).toBeVisible();
  // The Host is the Challenger: once the Guest's Bet arrives, every Bet is in and the Host judges.
  await expect(host.getByText('Did Hanna pull it off?')).toBeVisible();
});

test('the two contexts keep separate localStorage', async ({ host, guest }) => {
  const code = await createRoom(host, 'Hanna');
  await joinRoom(guest, code, 'Gus');
  await expect(guest.getByText('Gus (you)')).toBeVisible();

  const keys = (page: Page) => page.evaluate(() => Object.keys(localStorage));

  expect(await keys(guest)).toContain(`wanna-bet:identity:${code}`);
  expect(await keys(host)).not.toContain(`wanna-bet:identity:${code}`);
});
