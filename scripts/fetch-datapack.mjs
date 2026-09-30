import { closeSync, existsSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractArchive, fetchDatapack, readSource, SOURCE_FILE, validatePackage } from './datapack-client.mjs';
import { checkDatapack } from './datapack.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pinFile = resolve(root, 'datapack.json');
if (!existsSync(pinFile)) throw new Error('Missing private datapack.json. Copy datapack.example.json and configure it locally.');
const pin = JSON.parse(readFileSync(pinFile, 'utf8'));
const localSource = process.env.DATAPACK_LOCAL_DIR || null;
const target = resolve(root, '.datapack');
const validate = (packageRoot) => {
  validatePackage(packageRoot);
  const { errors } = checkDatapack(packageRoot, resolve(root, 'site'));
  if (errors.length) throw new Error(`Invalid datapack:\n${errors.join('\n')}`);
};

const cached = readSource(target);
let validCache = false;
if (!localSource && cached?.source === 'github' && cached.repo === pin.repo && cached.commit === pin.commit) {
  try { validate(target); validCache = true; } catch { /* Download and validate again. */ }
}
if (localSource || validCache) {
  await fetchDatapack({ pin, target, localSource, validate });
} else {
  if (!/^[\w.-]+\/[\w.-]+$/.test(pin.repo) || !/^[a-f\d]{40}$/.test(pin.commit)) throw new Error('Invalid datapack pin');
  // gh supplies authentication without putting a token in a URL, file or log.
  // This wrapper keeps the shared, vendored installer unchanged.
  const temporary = mkdtempSync(resolve(root, '.datapack-auth-'));
  const archive = resolve(temporary, 'archive.tar.gz');
  const unpacked = resolve(temporary, 'package');
  try {
    const archiveFd = openSync(archive, 'w');
    try {
      execFileSync('gh', ['api', `repos/${pin.repo}/tarball/${pin.commit}`],
        { stdio: ['ignore', archiveFd, 'pipe'] });
    } catch {
      throw new Error('Cannot download the private datapack. Install GitHub CLI and sign in with repository read access.');
    } finally { closeSync(archiveFd); }
    await extractArchive(archive, unpacked);
    await fetchDatapack({ pin, target, localSource: unpacked, validate });
    writeFileSync(resolve(target, SOURCE_FILE), JSON.stringify({ source: 'github', repo: pin.repo, commit: pin.commit }));
    console.log('Installed the authenticated, validated datapack.');
  } finally { rmSync(temporary, { recursive: true, force: true }); }
}
