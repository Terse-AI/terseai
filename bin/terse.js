#!/usr/bin/env node
import { main } from '../src/cli/index.js';

main(process.argv.slice(2)).then(
  (code) => { if (typeof code === 'number') process.exitCode = code; },
  (err) => {
    process.stderr.write(`terse: ${err && err.message ? err.message : err}\n`);
    process.exitCode = 1;
  },
);
