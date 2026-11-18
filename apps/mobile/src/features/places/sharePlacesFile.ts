import { randomUUID } from "expo-crypto";

export async function sharePlacesFile(name: string, mime: string, contents: string) {
  const sharing = await import("expo-sharing");
  if (!await sharing.isAvailableAsync()) throw new Error("Dijeljenje datoteka nije dostupno.");
  const { Directory, File, Paths } = await import("expo-file-system");
  const cache = new Directory(Paths.cache, "tripora-exports");
  cache.create({ idempotent: true, intermediates: true });
  // Leave recent attachments available for apps that read them after the chooser closes.
  const expires = Date.now() - 24 * 60 * 60 * 1000;
  for (const item of cache.list()) {
    if (item instanceof File && (item.modificationTime ?? Infinity) < expires) item.delete();
  }
  const file = new File(cache, `${randomUUID().slice(0, 8)}-${name}`);
  try {
    file.create();
    file.write(contents);
    await sharing.shareAsync(file.uri, { mimeType: mime, dialogTitle: "Podijeli Tripora izvoz" });
  } catch (error) {
    if (file.exists) file.delete();
    throw error;
  }
}
