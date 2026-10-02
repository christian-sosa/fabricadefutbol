import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Fábrica de Fútbol: grupos gratis, equipos parejos y jugadores sin registro";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const logoData = await readFile(join(process.cwd(), "public/logo.png"), "base64");

export default function SocialImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          padding: 56,
          backgroundColor: "#0b1210",
          color: "#f8fafc",
          fontFamily: "sans-serif"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            {/* ImageResponse renders this embedded asset directly, without next/image. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="" height={80} src={`data:image/png;base64,${logoData}`} width={80} />
            <div style={{ fontSize: 32, fontWeight: 700 }}>Fábrica de Fútbol</div>
          </div>
          <div style={{ display: "flex", borderRadius: 24, padding: "12px 24px", backgroundColor: "#34d399", color: "#07120d", fontSize: 24, fontWeight: 700 }}>
            Grupos gratis
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", flex: 1, gap: 40 }}>
          <div style={{ display: "flex", flexDirection: "column", width: 690 }}>
            <div style={{ display: "flex", fontSize: 70, fontWeight: 700, lineHeight: 1.08, letterSpacing: -2 }}>
              Armá equipos parejos.
            </div>
            <div style={{ display: "flex", marginTop: 24, fontSize: 32, lineHeight: 1.35, color: "#c8d3cb" }}>
              Organizá tu fútbol entre amigos y compartilo por WhatsApp.
            </div>
          </div>
          <div style={{ display: "flex", position: "relative", width: 330, height: 300, borderRadius: 28, border: "2px solid #293c31", backgroundColor: "#111a17", padding: 24 }}>
            <div style={{ display: "flex", position: "relative", width: "100%", height: "100%", border: "2px solid #536a5b", borderRadius: 8 }}>
              <div style={{ display: "flex", position: "absolute", left: 0, top: 123, width: "100%", height: 2, backgroundColor: "#536a5b" }} />
              <div style={{ display: "flex", position: "absolute", left: 107, top: 90, width: 66, height: 66, borderRadius: 33, border: "2px solid #536a5b" }} />
              {[{ x: 126, y: 22 }, { x: 52, y: 68 }, { x: 200, y: 68 }].map(({ x, y }) => (
                <div key={`green-${x}`} style={{ display: "flex", position: "absolute", left: x, top: y, width: 28, height: 28, borderRadius: 14, backgroundColor: "#34d399" }} />
              ))}
              {[{ x: 126, y: 198 }, { x: 52, y: 152 }, { x: 200, y: 152 }].map(({ x, y }) => (
                <div key={`white-${x}`} style={{ display: "flex", position: "absolute", left: x, top: y, width: 28, height: 28, borderRadius: 14, backgroundColor: "#f8fafc" }} />
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #293c31", paddingTop: 24, fontSize: 24 }}>
          <div style={{ color: "#34d399", fontWeight: 700 }}>Jugadores sin registro</div>
          <div style={{ color: "#a7b5ad" }}>fabricadefutbol.com.ar</div>
        </div>
      </div>
    ),
    size
  );
}
