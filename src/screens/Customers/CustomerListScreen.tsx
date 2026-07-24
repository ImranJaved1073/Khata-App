import { useTranslation } from "react-i18next";

import { PlaceholderScreen } from "../../components/PlaceholderScreen";

export function CustomerListScreen() {
  const { t } = useTranslation();
  return (
    <PlaceholderScreen
      title={t("customers.title")}
      description="Searchable, sortable customer list arrives in Phase 1."
    />
  );
}
