import { useTranslation } from "react-i18next";

import { PlaceholderScreen } from "../../components/PlaceholderScreen";

/** Not yet wired into the navigator — PIN/biometric gating arrives in Phase 6. */
export function LockScreen() {
  const { t } = useTranslation();
  return <PlaceholderScreen title={t("lock.enterPin")} />;
}
