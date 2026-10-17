import * as Sharing from "expo-sharing";

export async function sharePng(uri: string): Promise<boolean> {
  const available = await Sharing.isAvailableAsync();
  if (!available) return false;
  await Sharing.shareAsync(uri, {
    mimeType: "image/png",
    UTI: "public.png",
    dialogTitle: "Share constellation",
  });
  return true;
}
