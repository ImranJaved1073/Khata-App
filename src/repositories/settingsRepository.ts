import { eq } from "drizzle-orm";

import type { Database } from "../db/client";
import { settings } from "../db/schema";
import type { Settings } from "../types/models";

const SETTINGS_ROW_ID = 1;

const DEFAULT_SETTINGS: Settings = {
  id: SETTINGS_ROW_ID,
  businessName: null,
  logoUri: null,
  currencySymbol: "Rs",
  language: "en",
  themeMode: "system",
  pinHash: null,
  biometricEnabled: false,
  billFooterText: null,
};

/** Settings is a single-row table; this creates the row with defaults on first read. */
export async function getSettings(db: Database): Promise<Settings> {
  const rows = await db
    .select()
    .from(settings)
    .where(eq(settings.id, SETTINGS_ROW_ID))
    .limit(1);

  if (rows[0]) {
    return rows[0];
  }

  await db.insert(settings).values(DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}

export async function updateSettings(
  db: Database,
  patch: Partial<Omit<Settings, "id">>,
): Promise<Settings> {
  await getSettings(db); // ensure the row exists
  await db.update(settings).set(patch).where(eq(settings.id, SETTINGS_ROW_ID));
  return getSettings(db);
}
