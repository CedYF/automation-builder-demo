import { writeFileSync } from "node:fs";
import { generateFixtureEvents, toNdjson } from "../lib/logging/fixture-generator.ts";

const target = new URL("../fixtures/axiom-events.ndjson", import.meta.url);
const events = generateFixtureEvents();
writeFileSync(target, toNdjson(events));
process.stdout.write(`Wrote ${events.length} events to fixtures/axiom-events.ndjson\n`);
