import type { Browser, BrowserContext, Page } from "@playwright/test";

export type RaceClient = {
  context: BrowserContext;
  page: Page;
};

export async function createRaceClients(
  browser: Browser,
  count: number
): Promise<RaceClient[]> {
  const clients: RaceClient[] = [];

  for (let index = 0; index < count; index += 1) {
    const context = await browser.newContext();
    const page = await context.newPage();
    clients.push({ context, page });
  }

  return clients;
}

export async function closeRaceClients(clients: RaceClient[]): Promise<void> {
  await Promise.all(clients.map((client) => client.context.close()));
}
