import type { DeviceIdentity } from "@writersnook/sync/deviceRoster";
import { Platform } from "react-native";

/** Names this device for its peers' sync device list.
 *
 *  Deliberately dependency-free: `Platform.constants` is part of React Native,
 *  so naming a device does not cost an `expo-device` install and a prebuild.
 *  Android exposes the marketing model ("Pixel 3 XL", or "sdk_gphone64_x86_64"
 *  on an emulator, which is exactly the distinction that makes a roster worth
 *  reading). iOS exposes no model name to JS, so it gets its form factor.
 */
export function mobileDeviceIdentity(): DeviceIdentity {
  if (Platform.OS === "android") {
    return { name: androidModel(), platform: "Android" };
  }
  if (Platform.OS === "ios") {
    return { name: Platform.isPad ? "iPad" : "iPhone", platform: "iOS" };
  }
  return { name: null, platform: null };
}

function androidModel(): string | null {
  const constants: Record<string, unknown> = Platform.constants;
  const model = typeof constants.Model === "string" ? constants.Model.trim() : "";
  if (!model) return null;
  const brand = typeof constants.Brand === "string" ? constants.Brand.trim() : "";
  // "Google Pixel 3 XL", not "google Pixel 3 XL" — and never "Pixel Pixel 3 XL"
  // for the manufacturers that already prefix the brand onto the model.
  if (!brand || model.toLowerCase().startsWith(brand.toLowerCase())) return model;
  return `${brand.charAt(0).toUpperCase()}${brand.slice(1)} ${model}`;
}
