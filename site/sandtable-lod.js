import * as THREE from 'three';

const triangleCount = geometry => (geometry.index?.count ?? geometry.attributes.position.count) / 3;
const yieldFrame = () => new Promise(resolve => setTimeout(resolve, 0));

// Cluster only opaque, untextured static geometry. Keep normal/material
// boundaries and average colours so small ground tiles remain connected.
export async function clusterGeometry(source, cell) {
  const { position, normal, color } = source.attributes;
  const remap = new Uint32Array(position.count), buckets = new Map();
  const positions = new Float32Array(position.count * 3), normals = new Float32Array(position.count * 3);
  const colors = color ? new Float32Array(position.count * 3) : null;
  const extra = Object.entries(source.attributes).filter(([name]) => ['aEmit', 'aMat'].includes(name))
    .map(([name, attribute]) => ({ name, attribute, array: new Float32Array(position.count * attribute.itemSize) }));
  const weights = new Uint32Array(position.count);
  let count = 0, sliceStart = performance.now();
  async function yieldInput() {
    if (performance.now() - sliceStart < 8) return;
    await yieldFrame(); sliceStart = performance.now();
  }
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    const nx = normal.getX(i), ny = normal.getY(i), nz = normal.getZ(i);
    const r = color?.getX(i) ?? 1, g = color?.getY(i) ?? 1, b = color?.getZ(i) ?? 1;
    let key = `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}/${Math.round(nx * 16)},${Math.round(ny * 16)},${Math.round(nz * 16)}`;
    for (const { attribute } of extra) for (let c = 0; c < attribute.itemSize; c++) key += `/${Math.round(attribute.getComponent(i, c) * 16)}`;
    let vertex = buckets.get(key);
    if (vertex === undefined) { vertex = count++; buckets.set(key, vertex); }
    remap[i] = vertex;
    const offset = vertex * 3;
    positions[offset] += x; positions[offset + 1] += y; positions[offset + 2] += z;
    normals[offset] += nx; normals[offset + 1] += ny; normals[offset + 2] += nz;
    if (colors) { colors[offset] += r; colors[offset + 1] += g; colors[offset + 2] += b; }
    for (const { attribute, array } of extra) for (let c = 0; c < attribute.itemSize; c++) array[vertex * attribute.itemSize + c] += attribute.getComponent(i, c);
    weights[vertex]++;
    if (i % 2048 === 2047) await yieldInput();
  }
  const sourceCount = source.index?.count ?? position.count, indices = new Uint32Array(sourceCount);
  let indexCount = 0;
  for (let i = 0; i < sourceCount; i += 3) {
    const a = remap[source.index ? source.index.getX(i) : i];
    const b = remap[source.index ? source.index.getX(i + 1) : i + 1];
    const c = remap[source.index ? source.index.getX(i + 2) : i + 2];
    if (a !== b && b !== c && a !== c) { indices[indexCount++] = a; indices[indexCount++] = b; indices[indexCount++] = c; }
    if (i % 6144 === 6141) await yieldInput();
  }
  if (!indexCount || indexCount > sourceCount * 0.85) return null;
  for (let i = 0; i < count; i++) {
    const offset = i * 3, weight = weights[i];
    const length = Math.hypot(normals[offset], normals[offset + 1], normals[offset + 2]) || 1;
    for (let axis = 0; axis < 3; axis++) {
      positions[offset + axis] /= weight; normals[offset + axis] /= length;
      if (colors) colors[offset + axis] /= weight;
    }
    for (const { attribute, array } of extra) for (let c = 0; c < attribute.itemSize; c++) array[i * attribute.itemSize + c] /= weight;
    if (i % 4096 === 4095) await yieldInput();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions.slice(0, count * 3), 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals.slice(0, count * 3), 3));
  if (colors) geometry.setAttribute('color', new THREE.BufferAttribute(colors.slice(0, count * 3), 3));
  for (const { name, attribute, array } of extra) geometry.setAttribute(name, new THREE.BufferAttribute(array.slice(0, count * attribute.itemSize), attribute.itemSize));
  geometry.setIndex(new THREE.BufferAttribute(indices.slice(0, indexCount), 1));
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

export async function createArchitectureLod(group, scale) {
  const lods = [];
  let detailed = 0, overview = 0;
  for (const mesh of [...group.children]) {
    const geometry = mesh.geometry, material = mesh.material;
    const triangles = geometry ? triangleCount(geometry) * (mesh.isInstancedMesh ? mesh.count : 1) : 0;
    detailed += triangles; overview += triangles;
    if (!mesh.isMesh || mesh.isInstancedMesh || Array.isArray(material) || material.transparent || material.opacity < 1 ||
        Object.values(material).some(value => value?.isTexture) || triangles < 20000 || !geometry.attributes.normal ||
        (geometry.attributes.color && geometry.attributes.color.itemSize !== 3) ||
        Object.keys(geometry.attributes).some(name => !['position', 'normal', 'color', 'uv', 'aEmit', 'aMat'].includes(name)) ||
        geometry.drawRange.start !== 0 || geometry.drawRange.count !== Infinity) continue;
    const meshScale = Math.max(Math.abs(mesh.scale.x), Math.abs(mesh.scale.y), Math.abs(mesh.scale.z));
    const coarse = await clusterGeometry(geometry, 0.5 / (scale * meshScale));
    if (!coarse) continue;
    geometry.computeBoundingBox();
    const center = geometry.boundingBox.getCenter(new THREE.Vector3());
    const lod = new THREE.LOD();
    lod.matrix.copy(mesh.matrix).multiply(new THREE.Matrix4().makeTranslation(center.x, center.y, center.z));
    lod.matrix.decompose(lod.position, lod.quaternion, lod.scale);
    lod.matrixAutoUpdate = false;
    const low = new THREE.Mesh(coarse, material);
    low.renderOrder = mesh.renderOrder;
    group.remove(mesh);
    for (const level of [mesh, low]) {
      level.position.copy(center).negate(); level.quaternion.identity(); level.scale.setScalar(1);
      level.updateMatrix(); level.matrixAutoUpdate = false;
    }
    lod.addLevel(mesh, 0); lod.addLevel(low, 450, 0.12);
    low.visible = false;
    group.add(lod); lods.push(lod);
    overview -= triangles - triangleCount(coarse);
    await yieldFrame();
  }
  return { lods, detailed, overview };
}
