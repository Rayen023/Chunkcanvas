export async function generateEmbeddings(
  apiKey: string,
  model: string,
  texts: string[],
  signal?: AbortSignal,
): Promise<number[][]> {
  const res = await fetch("https://api.cohere.ai/v1/embed", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Request-Source": "chunkcanvas",
    },
    body: JSON.stringify({
      model,
      texts,
      input_type: "search_document",
      embedding_types: ["float"],
    }),
    signal,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`Cohere ${res.status}: ${errText}`);
  }

  const json = await res.json();

  if (json.embeddings && Array.isArray(json.embeddings.float)) {
    return json.embeddings.float;
  }

  if (Array.isArray(json.embeddings)) {
    return json.embeddings;
  }

  throw new Error("Invalid response format from Cohere API");
}
