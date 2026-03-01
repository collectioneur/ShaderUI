import { useState, useCallback, useMemo } from "react";
import type { CSSProperties, ComponentType } from "react";
import type { FontConfig } from "shaderui";
import { UniformControls } from "../components/UniformControls";
import { presetRegistry } from "../presets/registry";

const FONT_GROUPS: { label: string; fonts: string[] }[] = [
  {
    label: "Popular & system",
    fonts: [
      "Inter",
      "Roboto",
      "Open Sans",
      "Lato",
      "Montserrat",
      "Poppins",
      "Helvetica",
      "Arial",
      "Georgia",
      "system-ui",
      "sans-serif",
    ],
  },
  {
    label: "Display & distinctive",
    fonts: ["Bebas Neue", "Oswald", "Space Grotesk", "Syne", "DM Serif Display"],
  },
  {
    label: "Serif & elegant",
    fonts: ["Playfair Display", "Cormorant Garamond", "Cinzel", "Raleway"],
  },
  {
    label: "Script & casual",
    fonts: ["Pacifico", "Lobster"],
  },
];

const panelStyle: CSSProperties = {
  width: 280,
  padding: 20,
  overflowY: "auto",
  background: "var(--bg-elevated)",
  borderLeft: "1px solid rgba(255,255,255,0.06)",
  display: "flex",
  flexDirection: "column",
  gap: 24,
};

const labelStyle: CSSProperties = {
  display: "block",
  fontWeight: 600,
  marginBottom: 8,
  fontSize: "0.875rem",
  color: "var(--text)",
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "var(--radius-sm)",
  border: "1px solid rgba(255,255,255,0.12)",
  background: "var(--bg)",
  color: "var(--text)",
  boxSizing: "border-box",
};

const sectionTitleStyle: CSSProperties = {
  fontSize: "0.75rem",
  fontWeight: 600,
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
  color: "var(--text-muted)",
  margin: "0 0 12px",
};

const exampleItemStyle = (active: boolean): CSSProperties => ({
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
  const [activeExampleId, setActiveExampleId] = useState<string>(
    presetRegistry[0]?.id ?? "",
  );
  const [presetPropsState, setPresetPropsState] = useState<
    Record<string, Record<string, unknown>>
  >(() =>
    Object.fromEntries(
      presetRegistry.map((preset) => [preset.id, { ...preset.defaultProps }]),
    ),
  );

  const activePreset = useMemo(() => {
    if (presetRegistry.length === 0) return null;
    return (
      presetRegistry.find((preset) => preset.id === activeExampleId) ?? presetRegistry[0]
    );
  }, [activeExampleId]);

  const activeProps = useMemo<Record<string, unknown>>(() => {
    if (!activePreset) return {};
    return presetPropsState[activePreset.id] ?? activePreset.defaultProps;
  }, [activePreset, presetPropsState]);

  const font = useMemo<FontConfig>(() => {
    const fallback = { family: "Helvetica", size: 120, weight: 600 };
    const raw = activeProps.font;
    if (!raw || typeof raw !== "object") return fallback;
    const candidate = raw as Partial<FontConfig>;
    return {
      family: typeof candidate.family === "string" ? candidate.family : fallback.family,
      size: typeof candidate.size === "number" ? candidate.size : fallback.size,
      weight: typeof candidate.weight === "number" ? candidate.weight : fallback.weight,
    };
  }, [activeProps.font]);

  const text = typeof activeProps.text === "string" ? activeProps.text : "Hello";

  const updateActiveProp = useCallback(
    (key: string, value: unknown) => {
      if (!activePreset) return;
      setPresetPropsState((prev) => ({
        ...prev,
        [activePreset.id]: {
          ...(prev[activePreset.id] ?? activePreset.defaultProps),
          [key]: value,
        },
      }));
    },
    [activePreset],
  );

  const selectExample = useCallback((id: string) => {
    const preset = presetRegistry.find((entry) => entry.id === id);
    if (!preset) return;
    setActiveExampleId(id);
    setPresetPropsState((prev) => {
      if (prev[id]) return prev;
      return { ...prev, [id]: { ...preset.defaultProps } };
    });
  }, []);

  if (!activePreset) {
    return (
      <div style={{ padding: 24, color: "var(--text-muted)" }}>
        No presets found in <code>packages/site/src/presets</code>.
      </div>
    );
  }

  const ActivePreset = activePreset.component as ComponentType<Record<string, unknown>>;

  return (
    <div
      className="examples-page"
      style={{
        display: "flex",
        flex: 1,
        minHeight: "calc(100vh - 60px)",
        minWidth: 0,
      }}
    >
      <div
        className="examples-canvas-wrap"
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg)",
          padding: 24,
        }}
      >
        <div style={{ width: "100%", height: "100%", maxWidth: 800 }}>
          <ActivePreset
            {...activeProps}
            text={text}
            font={font}
            style={{
              width: "100%",
              height: "100%",
              backgroundColor: "transparent",
            }}
          />
        </div>
      </div>

      <aside className="examples-panel" style={panelStyle}>
        <div>
          <h3 style={sectionTitleStyle}>Examples</h3>
          {presetRegistry.map((ex) => {
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
            onChange={(e) => updateActiveProp("text", e.target.value)}
            style={inputStyle}
          />
        </div>

        <div>
          <h3 style={sectionTitleStyle}>Font</h3>
          <label style={labelStyle}>Family</label>
          <select
            value={font.family}
            onChange={(e) => updateActiveProp("font", { ...font, family: e.target.value })}
            style={inputStyle}
          >
            {FONT_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.fonts.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <div style={{ display: "flex", gap: 12, marginTop: 12, alignItems: "center" }}>
            <div>
              <label style={{ ...labelStyle, marginBottom: 4 }}>Size</label>
              <input
                type="number"
                value={font.size}
                onChange={(e) =>
                  updateActiveProp("font", {
                    ...font,
                    size: Number(e.target.value) || 48,
                  })
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
                  updateActiveProp("font", {
                    ...font,
                    weight: Number(e.target.value) || 400,
                  })
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
          <h3 style={sectionTitleStyle}>Uniforms</h3>
          <UniformControls
            controls={activePreset.uniformControls}
            values={activeProps}
            onValueChange={(uniformKey, value) => updateActiveProp(uniformKey, value)}
          />
        </div>
      </aside>
    </div>
  );
}
