import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { DATABASE_NAME } from "../db/schema";

// Copies the live SQLite file out to a timestamped backup and hands it to
// the system share sheet -- a real, restorable .db file, not an export
// format. Native only: on web expo-sqlite's backend is IndexedDB/WASM, not
// a real file at a filesystem path, so there's nothing to copy there.
export async function exportDatabaseFile() {
  if (Platform.OS === "web") {
    throw new Error("web-unsupported");
  }
  const source = new File(Paths.document, "SQLite", DATABASE_NAME);
  if (!source.exists) {
    throw new Error("not-found");
  }
  const filename = `second-brain-backup-${Date.now()}.db`;
  const dest = new File(Paths.cache, filename);
  if (dest.exists) dest.delete();
  source.copy(dest);

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(dest.uri, { mimeType: "application/x-sqlite3", dialogTitle: filename });
  }
  return dest;
}
