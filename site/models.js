// Models outside the registry: uploads and leaderboard rows may name any model. The vendor
// is the one the uploader declared, else the one every registered model of the same family
// (the leading word of the name: claude, gemini, hy…) shares; a family split between vendors
// names none. Such models carry `unlisted`, and the vendor's mark when it is a registered vendor.
const familyOf = (name) => String(name ?? '').normalize('NFKC').toLowerCase().match(/^[a-z]{2,}/)?.[0] ?? '';
const generic = (m) => !m.logo || m.logo.endsWith('/generic.svg');
// Uploads made before a model was registered carry only its name; an entry with that name or alias claims them.
const nameKey = (name) => String(name ?? '').normalize('NFKC').toLowerCase().replace(/[\s_-]+/g, '');

export function modelResolver(models) {
  const byId = new Map(models.map((m) => [m.id, m]));
  const byName = new Map(models.flatMap((m) => [...(m.aliases ?? []), m.name].map((name) => [nameKey(name), m])));
  const families = new Map();
  const vendors = new Map();
  for (const m of models) {
    if (!m.vendor) continue;
    const key = familyOf(m.name);
    const seen = families.get(key);
    if (key && (seen === undefined || (seen?.vendor === m.vendor && generic(seen)))) families.set(key, m);
    else if (key && seen && seen.vendor !== m.vendor) families.set(key, null);
    const v = vendors.get(m.vendor.toLowerCase());
    if (!v || generic(v)) vendors.set(m.vendor.toLowerCase(), m);
  }
  return ({ model, modelName, vendor } = {}) => {
    if (byId.has(model)) return byId.get(model);
    const name = modelName ?? model ?? '';
    if (byName.has(nameKey(name))) return byName.get(nameKey(name));
    const family = families.get(familyOf(name));
    const declared = String(vendor ?? '').trim();
    const brand = declared ? vendors.get(declared.toLowerCase()) : family;
    return {
      name,
      vendor: brand?.vendor ?? declared,
      logo: brand && brand.vendor === family?.vendor ? family.logo : brand?.logo ?? '',
      unlisted: declared ? 'declared' : brand ? 'inferred' : 'unknown',
    };
  };
}
