// Group explicitly tagged versions without changing individual work identities.
export const variantsOf = (task) => task.promptVariants ?? [];
export const variantKey = (result) => JSON.stringify([
  result.model, result.effort ?? '', result.status, result.harness ?? '',
  result.harnessName ?? '', result.harnessVersion ?? '', result.provider ?? '',
  result.providerName ?? '', result.upload ? result.owner : '',
]);
export function variantChoices(task, result) {
  if (!result.promptVariant) return [];
  const key = variantKey(result);
  return variantsOf(task).map((variant) => ({ ...variant,
    result: task.results.find((item) => item.promptVariant === variant.id && variantKey(item) === key),
  }));
}
export function groupVariantResults(task, results, selections) {
  const seen = new Set();
  return results.flatMap((result) => {
    if (!result.promptVariant || !variantsOf(task).length) return [result];
    const key = variantKey(result);
    if (seen.has(key)) return [];
    seen.add(key);
    const choices = variantChoices(task, result).map((choice) => choice.result).filter(Boolean);
    return [choices.find((item) => item.id === selections.get(key)) ?? choices[0]];
  });
}
