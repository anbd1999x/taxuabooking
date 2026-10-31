import { ImageResponse } from "next/og";

// Icon web (favicon) logo Tà Xùa — vòng tròn xanh núi rừng, chữ "TX" trắng.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#235c46",
          color: "#ffffff",
          fontSize: 16,
          fontWeight: 800,
          letterSpacing: "-0.04em",
          borderRadius: "50%",
        }}
      >
        TX
      </div>
    ),
    { ...size },
  );
}
