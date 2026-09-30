export function disposeObject(object) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  object.traverse((o) => {
    if (o.geometry) geometries.add(o.geometry);
    for (const material of (Array.isArray(o.material) ? o.material : [o.material])) {
      if (!material) continue;
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
    if (o.isInstancedMesh) o.dispose();
  });
  geometries.forEach((o) => o.dispose());
  materials.forEach((o) => o.dispose());
  textures.forEach((o) => o.dispose());
}
