import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MyceliumConfig } from "@mycelium/contracts";
import { openDb } from "./db.js";
import { loop } from "./scheduler.js";
import { seedFleet } from "./seed.js";

const cfg = MyceliumConfig.parse(
  JSON.parse(readFileSync(join(process.cwd(), "mycelium.config.json"), "utf8")),
);

seedFleet();
const db = openDb();
await loop(db, cfg);
