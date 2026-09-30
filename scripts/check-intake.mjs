import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkDatapack } from './datapack.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { errors, warnings, works } = checkDatapack(resolve(root, '.datapack'), resolve(root, 'site'));
for (const warning of warnings) console.warn(`WARN ${warning}`);
for (const error of errors) console.error(`ERROR ${error}`);
console.log(`Intake check: ${works} result(s), ${errors.length} error(s), ${warnings.length} warning(s).`);
process.exitCode = errors.length ? 1 : 0;
