import { useState, useCallback } from "react";
import { type FontConfig } from "shaderui";
import { NeonText } from "../presets/NeonText";

const FONT_FAMILIES = [
  "Inter",
  "Helvetica",
  "Georgia",
  "Arial",
  "system-ui",
  "sans-serif",
];

const EXAMPLES = [
  { id: "neon", name: "Neon Text", text: "Hello", font: { family: "Helvetica", size: 120, weight: 600 } as FontConfig },
] as const;

const panelStyle: React.CSSProperties = {
  width: 280,
  padding: 20,
  overflowY: "auto",
  background: "var(--bg-elevated)",
  borderLeft: "1px solid rgba(255,255,255,0.06)",
  display: "flex",
  flexDirection: "column",
  gap: 24,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontWeight: 600,
  marginBottom: 8,
  fontSize: "0.875rem",
  color: "var(--text)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "var(--radius-sm)",
  border: "1px solid rgba(255,255,255,0.12)",
  background: "var(--bg)",
  color: "var(--text)",
  boxSizing: "border-box",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  fontWeight: 600,
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
  color: "var(--text-muted)",
  margin: "0 0 12px",
};

const exampleItemStyle = (active: boolean): React.CSSProperties => ({
  padding: "12px 14px",
  borderRadius: "var(--radius-sm)",
  background: "transparent",
  border: "1px solid transparent",
  color: active ? undefined : "var(--text)",
  cursor: "pointer",
  fontWeight: 500,
  marginBottom: 6,
});

export function Examples() {
  const [text, setText] = useState("Hello");
  const [font, setFont] = useState<FontConfig>({
    family: "Helvetica",
    size: 120,
    weight: 600,
  });
  const [waterLevel, setWaterLevel] = useState(0.5);
  const [liquefaction, setLiquefaction] = useState(0.03);
  const [hoverSpread, setHoverSpread] = useState(0.02);
  const [activeExampleId, setActiveExampleId] = useState<string>("neon");

  const selectExample = useCallback((id: string) => {
    const ex = EXAMPLES.find((e) => e.id === id);
    if (ex) {
      setActiveExampleId(id);
      setText(ex.text);
      setFont(ex.font);
    }
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flex: 1,
        minHeight: "calc(100vh - 60px)",
        minWidth: 0,
      }}
    >
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg)",
          padding: 24,
        }}
      >
        <div style={{ width: "100%", height: "100%", maxWidth: 800 }}>
          <NeonText
            text={text}
            font={font}
            waterLevel={waterLevel}
            liquefaction={liquefaction}
            hoverSpread={hoverSpread}
            style={{
              width: "100%",
              height: "100%",
              backgroundColor: "transparent",
            }}
          />
        </div>
      </div>

      <aside style={panelStyle}>
        <div>
          <h3 style={sectionTitleStyle}>Examples</h3>
          {EXAMPLES.map((ex) => {
            const active = activeExampleId === ex.id;
            return (
              <button
                key={ex.id}
                type="button"
                className={active ? "example-active" : ""}
                style={exampleItemStyle(active)}
                onClick={() => selectExample(ex.id)}
              >
                <span className={active ? "example-active-text" : ""}>
                  {ex.name}
                </span>
              </button>
            );
          })}
        </div>

        <div>
          <h3 style={sectionTitleStyle}>Text</h3>
          <label style={labelStyle}>Content</label>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div>
          <h3 style={sectionTitleStyle}>Font</h3>
          <label style={labelStyle}>Family</label>
          <select
            value={font.family}
            onChange={(e) => setFont((f: FontConfig) => ({ ...f, family: e.target.value }))}
            style={inputStyle}
          >
            {FONT_FAMILIES.map((f: string) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <div style={{ display: "flex", gap: 12, marginTop: 12, alignItems: "center" }}>
            <div>
              <label style={{ ...labelStyle, marginBottom: 4 }}>Size</label>
              <input
                type="number"
                value={font.size}
                onChange={(e) =>
                  setFont((f: FontConfig) => ({ ...f, size: Number(e.target.value) || 48 }))
                }
                min={12}
                max={400}
                style={{ ...inputStyle, width: 80 }}
              />
            </div>
            <div>
              <label style={{ ...labelStyle, marginBottom: 4 }}>Weight</label>
              <input
                type="number"
                value={font.weight}
                onChange={(e) =>
                  setFont((f: FontConfig) => ({ ...f, weight: Number(e.target.value) || 400 }))
                }
                min={100}
                max={900}
                step={100}
                style={{ ...inputStyle, width: 80 }}
              />
            </div>
          </div>
        </div>

        <div>
          <h3 style={sectionTitleStyle}>Water reflection</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 4, display: "block" }}>
                Water level
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={waterLevel}
                  onChange={(e) => setWaterLevel(Number(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", minWidth: 36 }}>
                  {waterLevel.toFixed(2)}
                </span>
              </div>
            </div>
            <div>
              <label style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 4, display: "block" }}>
                Liquefaction
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="range"
                  min={0}
                  max={0.15}
                  step={0.005}
                  value={liquefaction}
                  onChange={(e) => setLiquefaction(Number(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", minWidth: 36 }}>
                  {liquefaction.toFixed(3)}
                </span>
              </div>
            </div>
            <div>
              <label style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 4, display: "block" }}>
                Hover spread
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="range"
                  min={0}
                  max={0.1}
                  step={0.005}
                  value={hoverSpread}
                  onChange={(e) => setHoverSpread(Number(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", minWidth: 36 }}>
                  {hoverSpread.toFixed(3)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
