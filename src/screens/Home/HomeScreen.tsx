import { useTranslation } from "react-i18next";

import { PlaceholderScreen } from "../../components/PlaceholderScreen";

export function HomeScreen() {
  const { t } = useTranslation();
  return (
    <PlaceholderScreen
      title={t("home.title")}
      description="Receivable/payable totals and today's activity land here in Phase 2."
    />
  );
}
