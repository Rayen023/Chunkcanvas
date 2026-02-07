/**
 * Browser download utilities — trigger file saves with dynamic imports.
 */

export async function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const { saveAs } = await import("file-saver");
  saveAs(blob, filename);
}

export async function downloadZip(
  files: Record<string, string>,
  zipFilename: string,
) {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();

  for (const [name, content] of Object.entries(files)) {
    zip.file(name, content);
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const { saveAs } = await import("file-saver");
  saveAs(blob, zipFilename);
}
