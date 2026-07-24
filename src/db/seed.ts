import type { Database } from "./client";
import { customers } from "./schema";
import { createCustomer, createEntry } from "../repositories";

/** Seeds 3 demo customers with a couple of entries each, if the DB is empty. */
export async function seedDemoData(db: Database): Promise<void> {
  const existing = await db.select().from(customers).limit(1);
  if (existing.length > 0) {
    return;
  }

  const ali = await createCustomer(db, {
    name: "Ali Garments",
    phone: "+923001234567",
    openingBalance: 0,
  });
  await createEntry(db, {
    type: "bill",
    customerId: ali.id,
    direction: "cash_out",
    lineItems: [
      { itemName: "Lawn Kurta", size: "M", color: "Navy Blue", quantity: 1, rate: 250000 },
      { itemName: "Cotton Shalwar", size: "XL", color: "Maroon", quantity: 3, rate: 120000 },
    ],
  });

  const sana = await createCustomer(db, {
    name: "Sana Textiles",
    phone: "+923004567890",
    openingBalance: 500000,
  });
  await createEntry(db, {
    type: "simple",
    customerId: sana.id,
    direction: "cash_in",
    amount: 200000,
    note: "Partial payment received",
  });

  const rehan = await createCustomer(db, {
    name: "Rehan Traders",
    phone: "+923331112233",
  });
  await createEntry(db, {
    type: "bill",
    customerId: rehan.id,
    direction: "cash_out",
    lineItems: [{ itemName: "Kameez", color: "White", quantity: 2, rate: 90000 }],
  });
}
