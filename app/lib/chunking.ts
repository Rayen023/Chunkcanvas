import type { ChunkingParams } from "./types";

export async function chunkText(
  text: string,
  params: ChunkingParams,
  filename: string,
): Promise<string[]> {
  if (params.chunkSize >= text.length) {
    const only = text.trim().length > 0 ? [text] : [];
    return only;
  }

  const { RecursiveCharacterTextSplitter } =
    await import("@langchain/textsplitters");

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: params.chunkSize,
    chunkOverlap: params.chunkOverlap,
    lengthFunction: (t: string) => t.length,
    separators: params.separators,
  });

  const docs = await splitter.createDocuments([text], [{ filename }]);
  return docs.map((d) => d.pageContent).filter((c) => c.trim().length > 0);
}

export async function chunkExcelRows(
  rows: string[],
  params: ChunkingParams,
  filename: string,
): Promise<string[]> {
  const { RecursiveCharacterTextSplitter } =
    await import("@langchain/textsplitters");

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: params.chunkSize,
    chunkOverlap: params.chunkOverlap,
    lengthFunction: (t: string) => t.length,
    separators: params.separators,
  });

  const allChunks: string[] = [];
  for (const row of rows) {
    const rowText = String(row);

    if (params.chunkSize >= rowText.length) {
      if (rowText.trim().length > 0) allChunks.push(rowText);
      continue;
    }

    const docs = await splitter.createDocuments([rowText], [{ filename }]);
    allChunks.push(
      ...docs.map((d) => d.pageContent).filter((c) => c.trim().length > 0),
    );
  }
  return allChunks;
}
