import { useTranslation } from "react-i18next";

import { PlaceholderScreen } from "../../components/PlaceholderScreen";

export function ReportsScreen() {
  const { t } = useTranslation();
  return (
    <PlaceholderScreen
      title={t("reports.title")}
      description="Totals, date-range filter, and PDF/Excel/CSV export arrive in Phase 5."
    />
  );
}
