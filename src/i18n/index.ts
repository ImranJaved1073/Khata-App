import * as Localization from "expo-localization";
import i18next from "i18next";
import { I18nManager } from "react-native";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import ur from "./locales/ur.json";
import type { AppLanguage } from "../types/models";

export const RTL_LANGUAGES: AppLanguage[] = ["ur"];

const deviceLanguage = Localization.getLocales()[0]?.languageCode;
const initialLanguage: AppLanguage = deviceLanguage === "ur" ? "ur" : "en";

void i18next.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ur: { translation: ur },
  },
  lng: initialLanguage,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export function isRtlLanguage(language: AppLanguage): boolean {
  return RTL_LANGUAGES.includes(language);
}

/**
 * Switches the active language and flips layout direction for Urdu.
 * I18nManager RTL changes only take full effect after the app reloads/restarts,
 * so callers (Settings, first-run setup) should prompt/trigger a reload after this.
 */
export async function setAppLanguage(language: AppLanguage): Promise<boolean> {
  const shouldBeRtl = isRtlLanguage(language);
  const rtlChanged = shouldBeRtl !== I18nManager.isRTL;

  await i18next.changeLanguage(language);

  if (rtlChanged) {
    I18nManager.allowRTL(shouldBeRtl);
    I18nManager.forceRTL(shouldBeRtl);
  }

  return rtlChanged;
}

export default i18next;
