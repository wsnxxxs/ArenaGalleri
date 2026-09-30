import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { surfaceVoxels } from './sandtable-voxels.js';

const triangles = group => group.children.reduce((sum, mesh) => sum + ((mesh.geometry?.index?.count ?? mesh.geometry?.attributes.position.count ?? 0) / 3) * (mesh.isInstancedMesh ? mesh.count : 1), 0);

// Static, opaque parts with the same material can share a draw call without
// discarding triangles, colours or textures. Keep original instances intact.
export async function batchArchitecture(group) {
  const before = group.children.length;
  const trianglesBefore = triangles(group);
  await surfaceVoxels(group);
  const buckets = new Map(), retired = new Set();
  for (const mesh of group.children) {
    const geometry = mesh.geometry, material = mesh.material;
    if (!mesh.isMesh || mesh.isInstancedMesh || mesh.isSkinnedMesh || Array.isArray(material) || material.transparent ||
        geometry.drawRange.start !== 0 || geometry.drawRange.count !== Infinity ||
        Object.keys(geometry.morphAttributes).length || mesh.matrix.determinant() < 0) continue;
    const attributes = Object.entries(geometry.attributes).sort(([a], [b]) => a.localeCompare(b));
    if (attributes.some(([, a]) => a.isInterleavedBufferAttribute || a.isInstancedBufferAttribute)) continue;
    const key = `${material.uuid}/${mesh.renderOrder}/${!!geometry.index}/` + attributes.map(([name, a]) => `${name}:${a.itemSize}:${a.normalized}:${a.array.constructor.name}`).join(',');
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(mesh);
  }
  async function merge(meshes) {
    if (meshes.length < 2) return;
    const parts = meshes.map(mesh => mesh.geometry.clone().applyMatrix4(mesh.matrix));
    const geometry = mergeGeometries(parts);
    parts.forEach(part => part.dispose());
    if (!geometry) return;
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const combined = new THREE.Mesh(geometry, meshes[0].material);
    combined.renderOrder = meshes[0].renderOrder;
    group.add(combined);
    for (const mesh of meshes) { group.remove(mesh); retired.add(mesh.geometry); }
    // Give selection, removal and camera input a turn between batches.
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  for (const meshes of buckets.values()) {
    let chunk = [], vertices = 0;
    for (const mesh of meshes) {
      const count = mesh.geometry.attributes.position.count;
      if (vertices + count > 100000) { await merge(chunk); chunk = []; vertices = 0; }
      chunk.push(mesh); vertices += count;
    }
    await merge(chunk);
  }
  const retained = new Set(group.children.map(mesh => mesh.geometry));
  for (const geometry of retired) if (!retained.has(geometry)) geometry.dispose();
  group.traverse(object => {
    if (object.matrixAutoUpdate) object.updateMatrix();
    object.matrixAutoUpdate = false;
    if (object.isMesh) { object.castShadow = false; object.receiveShadow = false; }
  });
  return { before, after: group.children.length, trianglesBefore, trianglesAfter: triangles(group) };
}
