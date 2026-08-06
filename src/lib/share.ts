import { Linking, Platform, Share } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import RNShare, { Social, type ShareSingleOptions } from "react-native-share";

const WHATSAPP_PACKAGE = "com.whatsapp";

// `whatsAppNumber` is a real, native-side-supported option (see WhatsAppShare.java —
// it becomes the `jid` intent extra, `<number>@s.whatsapp.net`) but react-native-share's
// own .d.ts omits it from `ShareSingleOptions`. Extending locally rather than casting to `any`.
type WhatsAppShareSingleOptions = ShareSingleOptions & { whatsAppNumber: string };

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

/**
 * Opens the OS share sheet for an already-rendered PNG file (produced by
 * `DocumentReceiptImageCapture`, see `components/`). Returns false if sharing is
 * unavailable. Kept separate from `sharePdf` since image capture happens in a component
 * (needs a live RN view to screenshot), not from raw HTML like the PDF path.
 */
export async function shareImage(uri: string, dialogTitle: string): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(uri, {
    mimeType: "image/png",
    dialogTitle,
    UTI: "public.png",
  });
  return true;
}

/**
 * Sends a PNG image (produced by `DocumentReceiptImageCapture`) straight into a specific
 * WhatsApp contact's chat, pre-attached with `message` as the caption — no generic OS share
 * sheet, no separate follow-up text. This is the one-tap "share to this customer" behavior
 * apps like DigiKhata have; it works via `whatsAppNumber` (see `WhatsAppShareSingleOptions`
 * above), an undocumented but long-standing WhatsApp intent extra that `react-native-share`
 * exposes on Android. Returns `false` (never throws) whenever the direct path isn't available
 * — no phone on file, WhatsApp not installed, or the intent itself failed/was cancelled — so
 * callers can fall back to `shareImage()` + `shareViaWhatsApp()` (generic share sheet, then a
 * text-only deep link) the same way the app did before this existed. iOS has no equivalent
 * (WhatsApp's iOS share extension doesn't accept a pre-selected recipient), so this always
 * returns `false` there.
 */
export async function shareImageToWhatsApp(
  uri: string,
  phone: string | null | undefined,
  message: string,
): Promise<boolean> {
  const digits = digitsOnly(phone);
  if (!digits || Platform.OS !== "android") return false;
  try {
    const { isInstalled } = await RNShare.isPackageInstalled(WHATSAPP_PACKAGE);
    if (!isInstalled) return false;
    const options: WhatsAppShareSingleOptions = {
      social: Social.Whatsapp,
      whatsAppNumber: digits,
      url: uri,
      type: "image/png",
      message,
    };
    await RNShare.shareSingle(options);
    return true;
  } catch {
    return false;
  }
}
