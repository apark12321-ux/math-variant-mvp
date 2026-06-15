export function surfaceSimilarityRisk(source: string, generated: string): "low" | "medium" | "high" {
  const sourceTokens = tokenize(source);
  const genTokens = tokenize(generated);

  if (sourceTokens.length === 0 || genTokens.length === 0) return "low";

  const sourceSet = new Set(sourceTokens);
  const overlap = genTokens.filter((t) => sourceSet.has(t)).length;
  const ratio = overlap / Math.max(genTokens.length, 1);

  if (ratio >= 0.55) return "high";
  if (ratio >= 0.35) return "medium";
  return "low";
}

function tokenize(text: string): string[] {
  return text
    .replace(/[0-9]+/g, " ")
    .replace(/[.,!?;:()[\]{}<>"'`~@#$%^&*_+=|\\/-]/g, " ")
    .split(/\s+/)
    .map((v) => v.trim())
    .filter((v) => v.length >= 2);
}
