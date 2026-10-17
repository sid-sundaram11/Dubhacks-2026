import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import type { SubjectImage } from "../../domain/generation";

const PHOTO_MAX_EDGE = 768;

export interface PickedSubject {
  previewUri: string;
  image: SubjectImage;
}

export async function pickSubjectPhoto(): Promise<PickedSubject | "denied" | "canceled"> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return "denied";
  const selected = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 1,
  });
  if (selected.canceled || selected.assets[0] == null) return "canceled";
  const asset = selected.assets[0];
  const width = asset.width ?? 0;
  const height = asset.height ?? 0;
  const actions = [];
  if (width >= height && width > PHOTO_MAX_EDGE) actions.push({ resize: { width: PHOTO_MAX_EDGE } });
  else if (height > width && height > PHOTO_MAX_EDGE) actions.push({ resize: { height: PHOTO_MAX_EDGE } });
  const saved = await manipulateAsync(asset.uri, actions, {
    compress: 0.7,
    format: SaveFormat.JPEG,
    base64: true,
  });
  if (!saved.base64) return "canceled";
  return {
    previewUri: saved.uri,
    image: { mimeType: "image/jpeg", data: saved.base64 },
  };
}
