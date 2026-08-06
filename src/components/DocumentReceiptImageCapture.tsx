import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import ViewShot from "react-native-view-shot";
import type { ViewShotRef } from "react-native-view-shot";

import type { BillDocumentData, StatementDocumentData } from "../repositories/documentRepository";
import { BillReceiptImage, RECEIPT_IMAGE_WIDTH, StatementReceiptImage } from "./DocumentReceiptImage";

type Content =
  | { kind: "bill"; data: BillDocumentData }
  | { kind: "statement"; data: StatementDocumentData }
  | null;

export interface DocumentReceiptImageCaptureHandle {
  captureBill(data: BillDocumentData): Promise<string>;
  captureStatement(data: StatementDocumentData): Promise<string>;
}

/**
 * Mount once per screen, off-screen (see the `hidden` style below) — exposes an imperative
 * `captureBill`/`captureStatement` handle that renders the given document data into
 * `DocumentReceiptImage` and screenshots it to a PNG file via `react-native-view-shot`, for
 * the WhatsApp share flow (`lib/share.ts`'s `shareImage`, see `ui.md`'s Sharing section).
 * Never shown to the user — `EntryDetailScreen`/`BillSavedScreen`/`CustomerKhataScreen` each
 * mount one and hold a ref to it alongside their existing `sharePdf`/`shareViaWhatsApp` calls.
 */
export const DocumentReceiptImageCapture = forwardRef<DocumentReceiptImageCaptureHandle>(
  function DocumentReceiptImageCapture(_props, ref) {
    const shotRef = useRef<ViewShotRef>(null);
    const [content, setContent] = useState<Content>(null);
    const pendingRef = useRef<{ resolve: (uri: string) => void; reject: (error: unknown) => void } | null>(
      null,
    );

    function requestCapture(next: Content): Promise<string> {
      return new Promise((resolve, reject) => {
        pendingRef.current = { resolve, reject };
        setContent(next);
      });
    }

    useEffect(() => {
      if (!content || !pendingRef.current) return;
      const { resolve, reject } = pendingRef.current;
      pendingRef.current = null;
      // Let layout/paint (and a local `logoUri` image decode, if the business set one) settle
      // before capturing — same reasoning as the `--virtual-time-budget` settle delay used for
      // headless-browser dev-time asset generation (see skills.md).
      const timer = setTimeout(() => {
        shotRef.current
          ?.capture?.()
          .then(resolve, reject)
          .finally(() => setContent(null));
      }, 150);
      return () => clearTimeout(timer);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [content]);

    useImperativeHandle(ref, () => ({
      captureBill: (data: BillDocumentData) => requestCapture({ kind: "bill", data }),
      captureStatement: (data: StatementDocumentData) => requestCapture({ kind: "statement", data }),
    }));

    return (
      <View style={styles.hidden} pointerEvents="none">
        <ViewShot ref={shotRef} options={{ format: "png", quality: 1, result: "tmpfile" }}>
          <View style={{ width: RECEIPT_IMAGE_WIDTH }} collapsable={false}>
            {content?.kind === "bill" ? <BillReceiptImage data={content.data} /> : null}
            {content?.kind === "statement" ? <StatementReceiptImage data={content.data} /> : null}
          </View>
        </ViewShot>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  // Off-screen, not `display:none`/`opacity:0` — some Android renderers skip drawing
  // zero-opacity views, which would capture blank. Positioning it far outside the visible
  // viewport keeps it fully rendered (RN doesn't virtualize by viewport) without ever being
  // seen or intercepting touches.
  hidden: {
    position: "absolute",
    left: -10000,
    top: 0,
  },
});
