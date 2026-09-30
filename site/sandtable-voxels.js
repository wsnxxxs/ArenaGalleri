import * as THREE from 'three';

const pause = () => new Promise(resolve => setTimeout(resolve, 0));
const key = (x, y, z) => `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;

// Extract only touching, axis-aligned opaque boxes. Other instances keep their
// original geometry, including rotated roofs, plants and transparent water.
export async function surfaceVoxels(group) {
  const candidates = [], grids = new Map(), retired = new Set();
  const matrix = new THREE.Matrix4(), instance = new THREE.Matrix4();
  for (const mesh of group.children) {
    const geometry = mesh.geometry, material = mesh.material;
    if (!mesh.isInstancedMesh || mesh.count < 256 || Array.isArray(material) || material.transparent || material.opacity < 1 ||
        geometry.index?.count !== 36 || geometry.attributes.position.count !== 24 || !geometry.attributes.normal ||
        Object.keys(geometry.attributes).some(name => !['position', 'normal', 'uv', 'color'].includes(name))) continue;
    geometry.computeBoundingBox();
    const box = geometry.boundingBox, center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    const position = geometry.attributes.position;
    let valid = true;
    for (let v = 0; v < 24; v++) {
      for (let axis = 0; axis < 3; axis++) {
        const value = position.getComponent(v, axis);
        if (Math.min(Math.abs(value - box.min.getComponent(axis)), Math.abs(value - box.max.getComponent(axis))) > 1e-5) valid = false;
      }
    }
    if (!valid) continue;
    const centers = new Float64Array(mesh.count * 3);
    let dimensions;
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, instance); matrix.multiplyMatrices(mesh.matrix, instance);
      const e = matrix.elements;
      if ([1, 2, 4, 6, 8, 9].some(index => Math.abs(e[index]) > 1e-6) || e[0] <= 0 || e[5] <= 0 || e[10] <= 0) { valid = false; break; }
      const current = [size.x * e[0], size.y * e[5], size.z * e[10]];
      if (!dimensions) dimensions = current;
      else if (current.some((value, axis) => Math.abs(value - dimensions[axis]) > 1e-5)) { valid = false; break; }
      centers.set([center.x * e[0] + e[12], center.y * e[5] + e[13], center.z * e[10] + e[14]], i * 3);
      if (i % 8192 === 8191) await pause();
    }
    if (!valid) continue;
    const faces = [];
    for (let face = 0; face < 6; face++) {
      const indices = Array.from(geometry.index.array.subarray(face * 6, face * 6 + 6));
      const vertices = [...new Set(indices)];
      const vertex = vertices[0], normal = geometry.attributes.normal;
      const direction = [normal.getX(vertex), normal.getY(vertex), normal.getZ(vertex)];
      if (vertices.length !== 4 || direction.filter(value => Math.abs(value) > 0.999).length !== 1) { valid = false; break; }
      faces.push({ vertices, indices: indices.map(index => vertices.indexOf(index)), direction });
    }
    if (!valid) continue;
    const gridKey = dimensions.map(value => value.toFixed(4)).join('/');
    if (!grids.has(gridKey)) grids.set(gridKey, new Set());
    const grid = grids.get(gridKey);
    for (let i = 0; i < mesh.count; i++) {
      grid.add(key(centers[i * 3], centers[i * 3 + 1], centers[i * 3 + 2]));
      if (i % 8192 === 8191) await pause();
    }
    candidates.push({ mesh, dimensions, centers, grid, faces });
  }
  for (const { mesh, dimensions, centers, grid, faces } of candidates) {
    const masks = new Uint8Array(mesh.count);
    let visibleFaces = 0;
    for (let i = 0; i < mesh.count; i++) {
      for (let face = 0; face < 6; face++) {
        const d = faces[face].direction;
        if (!grid.has(key(centers[i * 3] + d[0] * dimensions[0], centers[i * 3 + 1] + d[1] * dimensions[1], centers[i * 3 + 2] + d[2] * dimensions[2]))) {
          masks[i] |= 1 << face; visibleFaces++;
        }
      }
      if (i % 4096 === 4095) await pause();
    }
    if (visibleFaces === mesh.count * 6) continue;
    let material = mesh.material;
    if (mesh.instanceColor && !material.vertexColors) { material = material.clone(); material.vertexColors = true; }
    const attributes = { ...mesh.geometry.attributes };
    if (mesh.instanceColor && !attributes.color) attributes.color = null;
    const attributeEntries = Object.entries(attributes);
    let arrays, indices, faceCount = 0, written = 0, capacity;
    function begin() {
      capacity = Math.min(16384, visibleFaces - written);
      arrays = Object.fromEntries(Object.entries(attributes).map(([name, attr]) => [name, new Float32Array(capacity * 4 * (attr?.itemSize ?? 3))]));
      indices = new Uint32Array(capacity * 6); faceCount = 0;
    }
    function flush() {
      if (!faceCount) return;
      const geometry = new THREE.BufferGeometry();
      for (const [name, array] of Object.entries(arrays)) geometry.setAttribute(name, new THREE.BufferAttribute(array, attributes[name]?.itemSize ?? 3));
      geometry.setIndex(new THREE.BufferAttribute(indices, 1));
      geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      const surface = new THREE.Mesh(geometry, material);
      surface.renderOrder = mesh.renderOrder; group.add(surface);
    }
    if (visibleFaces) begin();
    for (let i = 0; i < mesh.count; i++) {
      if (!masks[i]) continue;
      mesh.getMatrixAt(i, instance); matrix.multiplyMatrices(mesh.matrix, instance);
      const e = matrix.elements;
      for (let face = 0; face < 6; face++) {
        if (!(masks[i] & (1 << face))) continue;
        for (let corner = 0; corner < 4; corner++) {
          const source = faces[face].vertices[corner], vertex = faceCount * 4 + corner;
          for (const [name, attribute] of attributeEntries) {
            const stride = attribute?.itemSize ?? 3;
            for (let c = 0; c < stride; c++) {
              let value = attribute ? attribute.getComponent(source, c) : 1;
              if (name === 'position') value = value * e[c * 5] + e[12 + c];
              if (name === 'color' && mesh.instanceColor) value *= mesh.instanceColor.getComponent(i, c);
              arrays[name][vertex * stride + c] = value;
            }
          }
        }
        for (let j = 0; j < 6; j++) indices[faceCount * 6 + j] = faceCount * 4 + faces[face].indices[j];
        faceCount++; written++;
        if (faceCount === capacity) { flush(); if (written < visibleFaces) begin(); }
      }
      if (i % 2048 === 2047) await pause();
    }
    group.remove(mesh); mesh.dispose(); retired.add(mesh.geometry);
    await pause();
  }
  const retained = new Set(group.children.map(mesh => mesh.geometry));
  for (const geometry of retired) if (!retained.has(geometry)) geometry.dispose();
}
