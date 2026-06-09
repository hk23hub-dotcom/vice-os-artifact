#!/usr/bin/env node
// run.js — VICE SELLER CLI.
//   node run.js --dry        plan the next wave (no network, no fees)
//   node run.js --status     show ledger summary
//   node run.js              run one live wave (needs Etsy token)
//   node run.js --wave 25    override wave size
import { dryRun, runWave } from './lib/orchestrator.js';
import { loadItems } from './lib/sources.js';
import { summary } from './lib/state.js';
import { captioner } from './lib/caption.js';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f, d) => { const i = args.indexOf(f); return i >= 0 ? Number(args[i + 1]) : d; };
const waveSize = val('--wave', undefined);

if (has('--status')) {
  console.log(JSON.stringify(summary(loadItems()), null, 2));
} else if (has('--dry')) {
  dryRun(waveSize);
} else {
  runWave({ waveSize, captionFn: captioner() }).then((r) => process.exit(r.fail && !r.ok ? 1 : 0));
}
