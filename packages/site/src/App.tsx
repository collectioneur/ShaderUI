import { useState, useCallback } from "react";
import {
  ShaderText,
  getShadersByType,
  getShaderDef,
  type ShaderConfig,
  type FontConfig,
  type ShaderDef,
} from "@shaderui/lib";

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

function ShaderControl({
  def,
  enabled,
  props,
  onToggle,
  onPropsChange,
}: {
  def: ShaderDef;
  enabled: boolean;
  props: Record<string, unknown>;
  onToggle: (v: boolean) => void;
  onPropsChange: (props: Record<string, unknown>) => void;
}) {
  return (
    <div
      style={{
        marginBottom: "1rem",
        padding: "0.75rem",
        background: "#f0f0f0",
        borderRadius: 8,
      }}
    >
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: enabled ? 8 : 0,
        }}
      >
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
        />
        <span style={{ fontWeight: 600 }}>{def.label}</span>
      </label>
      {enabled &&
        def.propSchema.map(
          (schema: {
            key: string;
            label: string;
            min?: number;
            max?: number;
            step?: number;
          }) => {
            const key = schema.key as string;
            const value = props[key];
            if (schema.min !== undefined && typeof value === "number") {
              return (
                <div key={key} style={{ marginTop: 6 }}>
                  <label
                    style={{ display: "block", fontSize: 12, marginBottom: 2 }}
                  >
                    {schema.label}
                  </label>
                  <input
                    type="range"
                    min={schema.min}
                    max={schema.max ?? 1}
                    step={schema.step ?? 0.01}
                    value={value}
                    onChange={(e) =>
                      onPropsChange({
                        ...props,
                        [key]: Number(e.target.value),
                      })
                    }
                  />
                  <span style={{ marginLeft: 8, fontSize: 12 }}>{value}</span>
                </div>
              );
            }
            if (
              (key === "color0" || key === "color1") &&
              Array.isArray(value) &&
              value.length === 3
            ) {
              const hex = rgbToHex(
                value[0] as number,
                value[1] as number,
                value[2] as number,
              );
              return (
                <div key={key} style={{ marginTop: 6 }}>
                  <label
                    style={{ display: "block", fontSize: 12, marginBottom: 2 }}
                  >
                    {schema.label}
                  </label>
                  <input
                    type="color"
                    value={hex}
                    onChange={(e) =>
                      onPropsChange({
                        ...props,
                        [key]: hexToRgb(e.target.value),
                      })
                    }
                  />
                </div>
              );
            }
            return null;
          },
        )}
    </div>
  );
}

export default function App() {
  const [text, setText] = useState("Hello");
  const [font, setFont] = useState<FontConfig>({
    family: "Helvetica",
    size: 120,
    weight: 600,
  });
  const [shaders, setShaders] = useState<ShaderConfig[]>([
    // { id: "wave", type: "shape", props: { speed: 1, amplitude: 0.02 } },
    // {
    //   id: "gradient",
    //   type: "color",
    //   props: {
    //     angle: 45,
    //     color0: [0.1, 0.1, 0.4],
    //     color1: [0.9, 0.4, 0.2],
    //   },
    // },
    {
      id: "neonBlur",
      type: "color",
      props: {
        intensity: 1.5,
        radius: 8,
        aberration: 2,
        colorPrimary: [0.2, 0.8, 1],
        colorSecondary: [0.6, 0.2, 0.9],
      },
    },
    // { id: "cursorGlow", type: "interaction", props: { radius: 0.3 } },
  ]);

  const toggleShader = useCallback((id: string, enabled: boolean) => {
    const def = getShaderDef(id);
    if (!def) return;
    if (enabled) {
      setShaders((prev) => [
        ...prev.filter((s) => s.id !== id),
        { id: def.id, type: def.type, props: { ...def.defaultProps } },
      ]);
    } else {
      setShaders((prev) => prev.filter((s) => s.id !== id));
    }
  }, []);

  const updateShaderProps = useCallback(
    (id: string, props: Record<string, unknown>) => {
      setShaders((prev) =>
        prev.map((s) => (s.id === id ? { ...s, props } : s)),
      );
    },
    [],
  );

  const copyComponent = useCallback(() => {
    const shadersStr = JSON.stringify(shaders, null, 2);
    const code = `<ShaderText
  text="${text.replace(/"/g, '\\"')}"
  font={{ family: "${font.family}", size: ${font.size}, weight: ${font.weight} }}
  shaders={${shadersStr}}
/>`;
    const full = `import { ShaderText } from "@shaderui/lib";

${code}`;
    void navigator.clipboard.writeText(full);
    alert("Copied to clipboard!");
  }, [text, font, shaders]);

  const shapeShaders = getShadersByType("shape");
  const colorShaders = getShadersByType("color");
  const interactionShaders = getShadersByType("interaction");

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
          ShaderText Playground
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
                  setFont((f: FontConfig) => ({ ...f, family: e.target.value }))
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
                    setFont((f: FontConfig) => ({
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
                    setFont((f: FontConfig) => ({
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
            <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>Shape</h3>
            {shapeShaders.map((def: ShaderDef) => (
              <ShaderControl
                key={def.id}
                def={def}
                enabled={shaders.some((s) => s.id === def.id)}
                props={
                  (shaders.find((s) => s.id === def.id)?.props as Record<
                    string,
                    unknown
                  >) ?? (def.defaultProps as Record<string, unknown>)
                }
                onToggle={(v) => toggleShader(def.id, v)}
                onPropsChange={(props) => updateShaderProps(def.id, props)}
              />
            ))}
          </section>

          <section style={{ marginBottom: 16 }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>Color</h3>
            {colorShaders.map((def: ShaderDef) => (
              <ShaderControl
                key={def.id}
                def={def}
                enabled={shaders.some((s) => s.id === def.id)}
                props={
                  (shaders.find((s) => s.id === def.id)?.props as Record<
                    string,
                    unknown
                  >) ?? (def.defaultProps as Record<string, unknown>)
                }
                onToggle={(v) => toggleShader(def.id, v)}
                onPropsChange={(props) => updateShaderProps(def.id, props)}
              />
            ))}
          </section>

          <section style={{ marginBottom: 16 }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>Interaction</h3>
            {interactionShaders.map((def: ShaderDef) => (
              <ShaderControl
                key={def.id}
                def={def}
                enabled={shaders.some((s) => s.id === def.id)}
                props={
                  (shaders.find((s) => s.id === def.id)?.props as Record<
                    string,
                    unknown
                  >) ?? (def.defaultProps as Record<string, unknown>)
                }
                onToggle={(v) => toggleShader(def.id, v)}
                onPropsChange={(props) => updateShaderProps(def.id, props)}
              />
            ))}
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
            <ShaderText
              text={text}
              font={font}
              shaders={shaders}
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
