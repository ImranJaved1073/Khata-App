import { Linking, Platform, Share } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

function digitsOnly(phone?: string | null): string {
  return (phone ?? "").replace(/[^0-9]/g, "");
}

/** Opens the OS share sheet with a plain-text message (fallback when a specific app deep link fails). */
export async function shareTextGeneric(message: string): Promise<void> {
  await Share.share({ message });
}

export async function shareViaWhatsApp(message: string, phone?: string | null): Promise<void> {
  const digits = digitsOnly(phone);
  const url = digits
    ? `whatsapp://send?phone=${digits}&text=${encodeURIComponent(message)}`
    : `whatsapp://send?text=${encodeURIComponent(message)}`;
  try {
    await Linking.openURL(url);
  } catch {
    await shareTextGeneric(message);
  }
}

export async function shareViaSms(message: string, phone?: string | null): Promise<void> {
  const digits = digitsOnly(phone);
  // iOS wants `sms:<n>&body=`, Android `sms:<n>?body=`.
  const separator = Platform.OS === "ios" ? "&" : "?";
  const url = `sms:${digits}${separator}body=${encodeURIComponent(message)}`;
  try {
    await Linking.openURL(url);
  } catch {
    await shareTextGeneric(message);
  }
}

/** Renders HTML to a PDF and opens the OS share sheet for it. Returns false if sharing is unavailable. */
export async function sharePdf(html: string, dialogTitle: string): Promise<boolean> {
  const { uri } = await Print.printToFileAsync({ html });
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(uri, {
    mimeType: "application/pdf",
    dialogTitle,
    UTI: "com.adobe.pdf",
  });
  return true;
}
