declare module "@shaderui/lib" {
  import type { CSSProperties } from "react";

  export type ShaderType = "shape" | "color" | "interaction";

  export interface ShaderConfig<
    T extends ShaderType = ShaderType,
    P = Record<string, unknown>
  > {
    id: string;
    type: T;
    props: P;
  }

  export interface FontConfig {
    family: string;
    size: number;
    weight?: number;
  }

  export interface ShaderTextProps {
    text: string;
    font: FontConfig;
    shaders?: ShaderConfig[];
    style?: CSSProperties;
    className?: string;
  }

  export interface ShaderDef<P = Record<string, unknown>> {
    id: string;
    type: ShaderType;
    label: string;
    defaultProps: P;
    propSchema: {
      key: keyof P & string;
      label: string;
      min?: number;
      max?: number;
      step?: number;
    }[];
  }

  export function ShaderText(props: ShaderTextProps): JSX.Element;
  export const shaderRegistry: ShaderDef[];
  export function getShaderDef(id: string): ShaderDef | undefined;
  export function getShadersByType<T extends ShaderType>(type: T): ShaderDef[];
}
