import { getEncoding } from "js-tiktoken";

let encoder: ReturnType<typeof getEncoding> | null = null;

function getEncoder() {
  if (!encoder) {
    encoder = getEncoding("o200k_base");
  }
  return encoder;
}

export function countTokens(text: string | null | undefined): number {
  if (!text) return 0;
  try {
    return getEncoder().encode(text).length;
  } catch (e) {
    console.error("Tokenization error:", e);
    return Math.ceil(text.length / 4);
  }
}
