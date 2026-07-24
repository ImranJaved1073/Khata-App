import { openDatabaseSync } from "expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";

import * as schema from "./schema";

export const DB_NAME = "khata.db";

export const sqliteConnection = openDatabaseSync(DB_NAME, {
  enableChangeListener: true,
});

export const db = drizzle(sqliteConnection, { schema });

export type Database = typeof db;
