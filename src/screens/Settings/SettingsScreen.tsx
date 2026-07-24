import { useTranslation } from "react-i18next";

import { PlaceholderScreen } from "../../components/PlaceholderScreen";

export function SettingsScreen() {
  const { t } = useTranslation();
  return (
    <PlaceholderScreen
      title={t("settings.title")}
      description="Business profile, language, PIN, and backup/restore arrive in Phase 6."
    />
  );
}
