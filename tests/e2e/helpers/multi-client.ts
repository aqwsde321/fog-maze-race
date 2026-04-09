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
  const results = await Promise.allSettled(clients.map((client) => closeContext(client.context)));
  const failures = results.filter((result) => result.status === "rejected");

  if (failures.length > 0) {
    throw failures[0].reason;
  }
}

async function closeContext(context: BrowserContext) {
  try {
    await context.close();
  } catch (error) {
    if (isIgnorableCloseError(error)) {
      return;
    }

    throw error;
  }
}

function isIgnorableCloseError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  return message.includes("ENOENT") || message.includes("Target page, context or browser has been closed");
}
