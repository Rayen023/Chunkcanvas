/**
 * Text chunking using LangChain RecursiveCharacterTextSplitter.
 */
import type { ChunkingParams } from "./types";

export async function chunkText(
  text: string,
  params: ChunkingParams,
  filename: string,
): Promise<string[]> {
  const { RecursiveCharacterTextSplitter } = await import(
    "@langchain/textsplitters"
  );

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: params.chunkSize,
    chunkOverlap: params.chunkOverlap,
    lengthFunction: (t: string) => t.length,
    separators: params.separators,
  });

  const docs = await splitter.createDocuments([text], [{ filename }]);
  return docs.map((d) => d.pageContent);
}

export async function chunkExcelRows(
  rows: string[],
  params: ChunkingParams,
  filename: string,
): Promise<string[]> {
  const { RecursiveCharacterTextSplitter } = await import(
    "@langchain/textsplitters"
  );

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: params.chunkSize,
    chunkOverlap: params.chunkOverlap,
    lengthFunction: (t: string) => t.length,
    separators: params.separators,
  });

  const allChunks: string[] = [];
  for (const row of rows) {
    const docs = await splitter.createDocuments([String(row)], [{ filename }]);
    allChunks.push(...docs.map((d) => d.pageContent));
  }
  return allChunks;
}
