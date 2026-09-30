import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const posterManifestPath = (root) => join(root, 'assets', 'scenes', 'posters.json');

export function readPosterManifest(root) {
  const path = posterManifestPath(root);
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : { version: 2, posters: {} };
}

export function rendererFingerprint({ datapackRoot, siteRoot, recipe }) {
  const hash = createHash('sha256').update(recipe);
  for (const [base, file] of [
    [siteRoot, 'result-previews.js'],
    [siteRoot, 'preview-model.js'],
    [siteRoot, 'scene-resources.js'],
    [datapackRoot, 'vendor/three.module.js'],
    [datapackRoot, 'vendor/three.core.js'],
  ]) hash.update(file).update(readFileSync(join(base, file), 'utf8').replaceAll('\r\n', '\n'));
  return hash.digest('hex');
}

export function createPosterFingerprint({ datapackRoot, siteRoot, manifest = readPosterManifest(datapackRoot) }) {
  const renderer = siteRoot ? rendererFingerprint({ datapackRoot, siteRoot, recipe: manifest.recipe ?? '' }) : manifest.renderer ?? '';
  return (task, result) => createHash('sha256').update(renderer).update(task.sceneProfile ?? '')
    .update(readFileSync(join(datapackRoot, result.previewModel))).digest('hex');
}

export function posterIsCurrent({ datapackRoot, task, result, manifest, fingerprint }) {
  if (!result.previewModel) return false;
  const key = `${task.id}/${result.id}`;
  return existsSync(join(datapackRoot, 'assets', 'scenes', task.id, `${result.id}.webp`))
    && manifest.version === 2 && Boolean(manifest.renderer) && Boolean(manifest.recipe)
    && manifest.posters?.[key] === (typeof fingerprint === 'string' ? fingerprint : (fingerprint ?? createPosterFingerprint({ datapackRoot, manifest }))(task, result));
}
