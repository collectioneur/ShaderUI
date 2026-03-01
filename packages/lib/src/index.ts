export { createSDFPipeline, type SDFPipelineRoot } from "./sdfPipeline.ts";
export {
  defineUniforms,
  type UniformSpec,
  type UniformControlMeta,
  type DefineUniformsResult,
} from "./defineUniforms.ts";
export {
  ShaderCanvas,
  getSize,
  getMaskData,
  type ShaderCanvasProps,
  type UniformBinding,
} from "./ShaderCanvas.tsx";
export { distanceFrag } from "./visualization.ts";
export {
  paramsAccessor,
  timeAccessor,
  distSampleLayout,
  type VisualizationParams,
  type FontConfig,
  type MaskSource,
} from "./types.ts";
export {
  InteractionArea,
  useInteraction,
  createShaderInteractionGetters,
  useShaderInteractionUniforms,
  OFFSCREEN_POINTER_UV,
  type InteractionAreaProps,
  type InteractionSnapshot,
  type InteractionPointerTypeCode,
} from "./interaction.tsx";
