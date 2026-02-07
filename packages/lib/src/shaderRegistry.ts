export type ShaderType = "shape" | "color" | "interaction";

export interface ShaderDef<P extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  type: ShaderType;
  label: string;
  defaultProps: P;
  propSchema: { key: keyof P; label: string; min?: number; max?: number; step?: number }[];
}

export const shaderRegistry: ShaderDef[] = [
  {
    id: "wave",
    type: "shape",
    label: "Wave",
    defaultProps: { speed: 1, amplitude: 0.02 },
    propSchema: [
      { key: "speed", label: "Speed", min: 0.1, max: 3, step: 0.1 },
      { key: "amplitude", label: "Amplitude", min: 0, max: 0.1, step: 0.005 },
    ],
  },
  {
    id: "gradient",
    type: "color",
    label: "Gradient",
    defaultProps: {
      angle: 45,
      color0: [0.1, 0.1, 0.4] as [number, number, number],
      color1: [0.9, 0.4, 0.2] as [number, number, number],
    },
    propSchema: [
      { key: "angle", label: "Angle", min: 0, max: 360, step: 5 },
      { key: "color0", label: "Color start" },
      { key: "color1", label: "Color end" },
    ],
  },
  {
    id: "cursorGlow",
    type: "interaction",
    label: "Cursor glow",
    defaultProps: { radius: 0.3 },
    propSchema: [{ key: "radius", label: "Radius", min: 0.05, max: 0.8, step: 0.05 }],
  },
];

export function getShaderDef(id: string): ShaderDef | undefined {
  return shaderRegistry.find((s) => s.id === id);
}

export function getShadersByType<T extends ShaderType>(type: T): ShaderDef[] {
  return shaderRegistry.filter((s) => s.type === type);
}
