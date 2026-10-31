import React, { useMemo } from "react";
import QRCode from "qrcode";

export interface QrCodeDisplayProps {
  value: string;
  size?: number;
  walletLabel?: string;
}

/**
 * Renders a real ISO/IEC 18004 camera-scannable QR code using the `qrcode` package.
 * Never embeds secrets, private keys, or seed phrases.
 */
export const QrCodeDisplay: React.FC<QrCodeDisplayProps> = ({
  value,
  size = 200,
  walletLabel,
}) => {
  const qrData = useMemo(() => {
    try {
      const qr = QRCode.create(value || "https://evalora.io", {
        errorCorrectionLevel: "M",
      });
      const moduleCount = qr.modules.size;
      const cells: boolean[][] = [];
      for (let r = 0; r < moduleCount; r++) {
        const row: boolean[] = [];
        for (let c = 0; c < moduleCount; c++) {
          row.push(Boolean(qr.modules.get(r, c)));
        }
        cells.push(row);
      }
      return { moduleCount, cells };
    } catch {
      return { moduleCount: 1, cells: [[true]] };
    }
  }, [value]);

  const quietZone = 2;
  const viewBoxSize = qrData.moduleCount + quietZone * 2;

  return (
    <div
      className="inline-flex flex-col items-center justify-center rounded-xl border border-stone-200 bg-white p-3 shadow-sm"
      style={{ width: size + 24 }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
        shapeRendering="crispEdges"
        role="img"
        aria-label={
          walletLabel
            ? `${walletLabel} Mobile Authentication QR Code`
            : "Evalora Mobile Wallet Authentication QR Code"
        }
      >
        <rect width={viewBoxSize} height={viewBoxSize} fill="#FFFFFF" />
        {qrData.cells.map((row, rIdx) =>
          row.map((cell, cIdx) =>
            cell ? (
              <rect
                key={`${rIdx}-${cIdx}`}
                x={cIdx + quietZone}
                y={rIdx + quietZone}
                width={1}
                height={1}
                fill="#1D1D1F"
              />
            ) : null
          )
        )}
      </svg>
      {walletLabel && (
        <span className="mt-1.5 text-[11px] font-semibold tracking-wide text-stone-600">
          Scan with {walletLabel}
        </span>
      )}
    </div>
  );
};
