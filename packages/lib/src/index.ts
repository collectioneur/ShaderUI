export { createSDFPipeline, type SDFPipelineRoot } from "./sdfPipeline.ts";
export { ShaderText, type ShaderTextProps } from "./ShaderText.tsx";
export { distanceFrag } from "./visualization.ts";
export { composedFrag } from "./composedFragment.ts";
export {
  paramsAccessor,
  timeAccessor,
  distSampleLayout,
  shaderCompositionAccessor,
  type VisualizationParams,
} from "./types.ts";
export {
  shaderRegistry,
  getShaderDef,
  getShadersByType,
  type ShaderDef,
  type ShaderType,
} from "./shaderRegistry.ts";

import type { ShaderType } from "./shaderRegistry.ts";

export interface ShaderConfig<
  T extends ShaderType = ShaderType,
  P extends Record<string, unknown> = Record<string, unknown>,
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

export interface ShaderTextConfig {
  text: string;
  font: FontConfig;
  shaders: ShaderConfig[];
}
