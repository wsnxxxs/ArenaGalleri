// Group explicitly tagged versions without changing individual work identities.
export const variantsOf = (task) => task.promptVariants ?? [];
const hasPromptVariant = (task, result) => Boolean(result.promptVariant)
  && variantsOf(task).some((variant) => variant.id === result.promptVariant);
export const variantKey = (result) => JSON.stringify([
  result.model, result.effort ?? '', result.status, result.harness ?? '',
  result.harnessName ?? '', result.provider ?? '',
  result.providerName ?? '', result.author?.role === 'user' ? result.author.name : '',
]);
// A switch keeps the first catalog work for each version. Additional submissions have their own cards.
function choicesForKey(task, key) {
  return variantsOf(task).map((variant) => ({ ...variant,
    result: task.results.find((item) => item.promptVariant === variant.id && variantKey(item) === key),
  }));
}
export function variantChoices(task, result) {
  if (!hasPromptVariant(task, result)) return [];
  const choices = choicesForKey(task, variantKey(result));
  return choices.some((choice) => choice.result?.id === result.id) ? choices : [];
}
export function groupVariantResults(task, results, selections) {
  const choicesByKey = new Map();
  const seen = new Set();
  return results.flatMap((result) => {
    if (!hasPromptVariant(task, result)) return [result];
    const key = variantKey(result);
    if (!choicesByKey.has(key)) {
      choicesByKey.set(key, choicesForKey(task, key).map((choice) => choice.result).filter(Boolean));
    }
    const choices = choicesByKey.get(key);
    if (!choices.some((work) => work.id === result.id)) return [result];
    if (seen.has(key)) return [];
    seen.add(key);
    return [choices.find((work) => work.id === selections.get(key)) ?? choices[0]];
  });
}
