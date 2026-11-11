/** `data` as file text: a string as it is, anything else as formatted JSON. */
function fileText(data: unknown): string {
  if (typeof data === "string") return data;
  try {
    return JSON.stringify(data, null, 2) ?? String(data);
  } catch {
    return String(data); // e.g. a circular structure, which IndexedDB can hold
  }
}

/** Hand `data` to the browser as a JSON file download. */
export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([fileText(data)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
