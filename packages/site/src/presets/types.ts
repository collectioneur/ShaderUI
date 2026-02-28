import type React from "react";
import type { FontConfig, Padding } from "shaderui";

export type ExamplePresetCommonProps = {
  text: string;
  font: FontConfig;
  padding?: Partial<Padding>;
};

export type UniformRangeControlSpec = {
  kind: "range";
  uniformKey: string;
  label: string;
  min: number;
  max: number;
  step?: number;
  group?: string;
  decimals?: number;
};

export type UniformControlSpec = UniformRangeControlSpec;

export type PresetMeta<P extends object = any> = {
  id?: string;
  name: string;
  component: React.ComponentType<P>;
  defaultProps: P;
  uniformControls: UniformControlSpec[];
};

export type ExamplePresetModule = {
  presetMeta: PresetMeta;
};

type UniformControlMetaLike = {
  editable?: boolean;
  kind?: "range";
  label?: string;
  min?: number;
  max?: number;
  step?: number;
  group?: string;
  decimals?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isUniformControlSpec(value: unknown): value is UniformControlSpec {
  if (!isRecord(value)) return false;
  if (value.kind !== "range") return false;
  if (typeof value.uniformKey !== "string") return false;
  if (typeof value.label !== "string") return false;
  if (typeof value.min !== "number") return false;
  if (typeof value.max !== "number") return false;
  if (value.step !== undefined && typeof value.step !== "number") return false;
  if (value.group !== undefined && typeof value.group !== "string") return false;
  if (value.decimals !== undefined && typeof value.decimals !== "number") return false;
  return true;
}

export function isPresetMeta(value: unknown): value is PresetMeta {
  if (!isRecord(value)) return false;
  if (typeof value.name !== "string" || value.name.length === 0) return false;
  if (value.id !== undefined && typeof value.id !== "string") return false;
  if (typeof value.component !== "function") return false;
  if (!isRecord(value.defaultProps)) return false;
  if (!Array.isArray(value.uniformControls)) return false;
  return value.uniformControls.every(isUniformControlSpec);
}

function titleCaseFromKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, (match) => match.toUpperCase());
}

export function collectUniformControls(
  specs: Record<string, unknown>,
): UniformControlSpec[] {
  const controls: UniformControlSpec[] = [];
  for (const [uniformKey, spec] of Object.entries(specs)) {
    if (!isRecord(spec)) continue;
    const control = spec.control as UniformControlMetaLike | undefined;
    if (!control?.editable) continue;
    if (control.min === undefined || control.max === undefined) continue;
    controls.push({
      kind: "range",
      uniformKey,
      label: control.label ?? titleCaseFromKey(uniformKey),
      min: control.min,
      max: control.max,
      step: control.step,
      group: control.group,
      decimals: control.decimals,
    });
  }
  return controls;
}
