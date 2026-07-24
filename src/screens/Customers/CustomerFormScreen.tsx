import { useTranslation } from "react-i18next";

import { PlaceholderScreen } from "../../components/PlaceholderScreen";

export function CustomerFormScreen() {
  const { t } = useTranslation();
  return (
    <PlaceholderScreen
      title={t("customerForm.titleNew")}
      description="Add/edit customer form arrives in Phase 1."
    />
  );
}
