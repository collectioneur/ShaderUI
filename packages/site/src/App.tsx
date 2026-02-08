import { useState, useCallback } from "react";
import { type FontConfig } from "@shaderui/lib";
import { NeonText } from "./presets/NeonText";

const FONT_FAMILIES = [
  "Inter",
  "Helvetica",
  "Georgia",
  "Arial",
  "system-ui",
  "sans-serif",
];

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((x) =>
        Math.round(x * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

export default function App() {
  const [text, setText] = useState("Hello");
  const [font, setFont] = useState<FontConfig>({
    family: "Helvetica",
    size: 120,
    weight: 600,
  });
  const [intensity, setIntensity] = useState(1.5);
  const [radius, setRadius] = useState(8);
  const [aberration, setAberration] = useState(2);
  const [colorPrimary, setColorPrimary] = useState<[number, number, number]>([
    0.2, 0.8, 1,
  ]);
  const [colorSecondary, setColorSecondary] = useState<[number, number, number]>([
    0.6, 0.2, 0.9,
  ]);

  const copyComponent = useCallback(() => {
    const code = `<NeonText
  text="${text.replace(/"/g, '\\"')}"
  font={{ family: "${font.family}", size: ${font.size}, weight: ${font.weight} }}
  intensity={${intensity}}
  radius={${radius}}
  aberration={${aberration}}
  colorPrimary={[${colorPrimary.join(", ")}]}
  colorSecondary={[${colorSecondary.join(", ")}]}
/>`;
    const full = `import { NeonText } from "./presets/NeonText";

${code}`;
    void navigator.clipboard.writeText(full);
    alert("Copied to clipboard!");
  }, [text, font, intensity, radius, aberration, colorPrimary, colorSecondary]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        fontFamily: "system-ui, sans-serif",
        margin: 0,
      }}
    >
      <header
        style={{
          padding: "12px 20px",
          borderBottom: "1px solid #ddd",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <h1 style={{ margin: 0, fontSize: "1.25rem" }}>
          ShaderUI Playground
        </h1>
        <button
          type="button"
          onClick={copyComponent}
          style={{
            padding: "8px 16px",
            background: "#333",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Copy component
        </button>
      </header>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <aside
          style={{
            width: 280,
            padding: 16,
            overflowY: "auto",
            borderRight: "1px solid #ddd",
            background: "#fafafa",
          }}
        >
          <section style={{ marginBottom: 20 }}>
            <label
              style={{ display: "block", fontWeight: 600, marginBottom: 6 }}
            >
              Text
            </label>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              style={{
                width: "100%",
                padding: 8,
                border: "1px solid #ccc",
                borderRadius: 6,
                boxSizing: "border-box",
              }}
            />
          </section>

          <section style={{ marginBottom: 20 }}>
            <label
              style={{ display: "block", fontWeight: 600, marginBottom: 6 }}
            >
              Font
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <select
                value={font.family}
                onChange={(e) =>
                  setFont((f) => ({ ...f, family: e.target.value }))
                }
                style={{ padding: 8, borderRadius: 6 }}
              >
                {FONT_FAMILIES.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="number"
                  value={font.size}
                  onChange={(e) =>
                    setFont((f) => ({
                      ...f,
                      size: Number(e.target.value) || 48,
                    }))
                  }
                  min={12}
                  max={400}
                  style={{ width: 80, padding: 8, borderRadius: 6 }}
                />
                <span>px</span>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="number"
                  value={font.weight}
                  onChange={(e) =>
                    setFont((f) => ({
                      ...f,
                      weight: Number(e.target.value) || 400,
                    }))
                  }
                  min={100}
                  max={900}
                  step={100}
                  style={{ width: 80, padding: 8, borderRadius: 6 }}
                />
                <span>weight</span>
              </div>
            </div>
          </section>

          <section style={{ marginBottom: 16 }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>Neon Blur</h3>
            <div
              style={{
                padding: "0.75rem",
                background: "#f0f0f0",
                borderRadius: 8,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div>
                <label
                  style={{ display: "block", fontSize: 12, marginBottom: 2 }}
                >
                  Intensity
                </label>
                <input
                  type="range"
                  min={0.5}
                  max={3}
                  step={0.1}
                  value={intensity}
                  onChange={(e) => setIntensity(Number(e.target.value))}
                />
                <span style={{ marginLeft: 8, fontSize: 12 }}>{intensity}</span>
              </div>
              <div>
                <label
                  style={{ display: "block", fontSize: 12, marginBottom: 2 }}
                >
                  Radius
                </label>
                <input
                  type="range"
                  min={0}
                  max={20}
                  step={0.5}
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                />
                <span style={{ marginLeft: 8, fontSize: 12 }}>{radius}</span>
              </div>
              <div>
                <label
                  style={{ display: "block", fontSize: 12, marginBottom: 2 }}
                >
                  Aberration
                </label>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={0.5}
                  value={aberration}
                  onChange={(e) => setAberration(Number(e.target.value))}
                />
                <span style={{ marginLeft: 8, fontSize: 12 }}>
                  {aberration}
                </span>
              </div>
              <div>
                <label
                  style={{ display: "block", fontSize: 12, marginBottom: 2 }}
                >
                  Color primary
                </label>
                <input
                  type="color"
                  value={rgbToHex(
                    colorPrimary[0],
                    colorPrimary[1],
                    colorPrimary[2],
                  )}
                  onChange={(e) =>
                    setColorPrimary(hexToRgb(e.target.value))
                  }
                />
              </div>
              <div>
                <label
                  style={{ display: "block", fontSize: 12, marginBottom: 2 }}
                >
                  Color secondary
                </label>
                <input
                  type="color"
                  value={rgbToHex(
                    colorSecondary[0],
                    colorSecondary[1],
                    colorSecondary[2],
                  )}
                  onChange={(e) =>
                    setColorSecondary(hexToRgb(e.target.value))
                  }
                />
              </div>
            </div>
          </section>
        </aside>

        <main
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#000000",
            padding: 24,
          }}
        >
          <div style={{ width: "100%", height: "100%", maxWidth: 800 }}>
            <NeonText
              text={text}
              font={font}
              intensity={intensity}
              radius={radius}
              aberration={aberration}
              colorPrimary={colorPrimary}
              colorSecondary={colorSecondary}
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
