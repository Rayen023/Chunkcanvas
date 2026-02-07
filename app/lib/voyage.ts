/**
 * Voyage AI embedding client — browser-side fetch.
 */

export async function generateEmbeddings(
  apiKey: string,
  model: string,
  texts: string[],
): Promise<number[][]> {
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, input: texts }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`Voyage AI ${res.status}: ${errText}`);
  }

  const json = await res.json();
  return (json.data as { embedding: number[] }[]).map((d) => d.embedding);
}
