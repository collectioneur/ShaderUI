import type { CSSProperties } from "react";
import type { UniformControlSpec } from "../presets/types";

type UniformControlsProps = {
  controls: UniformControlSpec[];
  values: Record<string, unknown>;
  onValueChange: (uniformKey: string, value: number) => void;
};

const labelStyle: CSSProperties = {
  fontSize: "0.8rem",
  color: "var(--text-muted)",
  marginBottom: 4,
  display: "block",
};

function formatControlValue(value: number, decimals?: number): string {
  if (decimals !== undefined) return value.toFixed(decimals);
  if (Math.abs(value) >= 100) return value.toFixed(0);
  if (Math.abs(value) >= 1) return value.toFixed(2);
  return value.toFixed(3);
}

function groupControls(
  controls: UniformControlSpec[],
): Array<{ groupName: string; items: UniformControlSpec[] }> {
  const grouped = new Map<string, UniformControlSpec[]>();
  for (const control of controls) {
    const groupName = control.group ?? "Uniforms";
    const items = grouped.get(groupName);
    if (items) {
      items.push(control);
    } else {
      grouped.set(groupName, [control]);
    }
  }
  return Array.from(grouped.entries()).map(([groupName, items]) => ({
    groupName,
    items,
  }));
}

export function UniformControls({
  controls,
  values,
  onValueChange,
}: UniformControlsProps) {
  const groupedControls = groupControls(controls);
  if (groupedControls.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {groupedControls.map(({ groupName, items }) => (
        <div key={groupName} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h3 style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", margin: 0 }}>
            {groupName}
          </h3>
          {items.map((control) => {
            const rawValue = values[control.uniformKey];
            const value = typeof rawValue === "number" ? rawValue : control.min;
            return (
              <div key={control.uniformKey}>
                <label style={labelStyle}>{control.label}</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="range"
                    min={control.min}
                    max={control.max}
                    step={control.step ?? 0.01}
                    value={value}
                    onChange={(e) => onValueChange(control.uniformKey, Number(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", minWidth: 48 }}>
                    {formatControlValue(value, control.decimals)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
