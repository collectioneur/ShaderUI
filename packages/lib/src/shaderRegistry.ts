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
    id: "neonBlur",
    type: "color",
    label: "Neon Blur & Glitch",
    defaultProps: {
      intensity: 1.5,
      radius: 8,
      aberration: 2,
      colorPrimary: [0.2, 0.8, 1.0] as [number, number, number],
      colorSecondary: [0.6, 0.2, 0.9] as [number, number, number],
    },
    propSchema: [
      { key: "intensity", label: "Intensity", min: 0.5, max: 3, step: 0.1 },
      { key: "radius", label: "Radius", min: 0, max: 20, step: 0.5 },
      { key: "aberration", label: "Aberration", min: 0, max: 10, step: 0.5 },
      { key: "colorPrimary", label: "Color primary" },
      { key: "colorSecondary", label: "Color secondary" },
    ],
  },
];

export function getShaderDef(id: string): ShaderDef | undefined {
  return shaderRegistry.find((s) => s.id === id);
}

export function getShadersByType<T extends ShaderType>(type: T): ShaderDef[] {
  return shaderRegistry.filter((s) => s.type === type);
}
