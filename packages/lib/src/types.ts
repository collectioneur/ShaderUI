import tgpu, {
  type SampledFlag,
  type StorageFlag,
  type TgpuTexture,
} from "typegpu";
import * as d from "typegpu/data";

export const VisualizationParams = d.struct({
  showInside: d.u32,
  showOutside: d.u32,
});

export const SampleResult = d.struct({
  inside: d.vec2f,
  outside: d.vec2f,
});

export const paramsAccessor = tgpu["~unstable"].accessor(VisualizationParams);
export const timeAccessor = tgpu["~unstable"].accessor(d.f32);

// Shader composition uniforms
export const WaveParams = d.struct({
  speed: d.f32,
  amplitude: d.f32,
});
export const GradientParams = d.struct({
  angle: d.f32,
  color0: d.vec3f,
  color1: d.vec3f,
});
export const CursorParams = d.struct({
  cursorUV: d.vec2f,
  radius: d.f32,
});
export const ShaderCompositionParams = d.struct({
  waveEnabled: d.u32,
  gradientEnabled: d.u32,
  cursorEnabled: d.u32,
  wave: WaveParams,
  gradient: GradientParams,
  cursor: CursorParams,
});
export const shaderCompositionAccessor =
  tgpu["~unstable"].accessor(ShaderCompositionParams);

export const distSampleLayout = tgpu.bindGroupLayout({
  distTexture: { texture: d.texture2d() },
  sampler: { sampler: "filtering" },
});

export const initLayout = tgpu.bindGroupLayout({
  writeView: {
    storageTexture: d.textureStorage2d("rgba16float", "write-only"),
  },
});

export const pingPongLayout = tgpu.bindGroupLayout({
  writeView: {
    storageTexture: d.textureStorage2d("rgba16float", "write-only"),
  },
  readView: {
    storageTexture: d.textureStorage2d("rgba16float", "read-only"),
  },
});

export const distWriteLayout = tgpu.bindGroupLayout({
  distTexture: {
    storageTexture: d.textureStorage2d("rgba16float", "write-only"),
  },
});

export const initFromMaskLayout = tgpu.bindGroupLayout({
  maskTexture: {
    storageTexture: d.textureStorage2d("r32uint", "read-only"),
  },
  writeView: {
    storageTexture: d.textureStorage2d("rgba16float", "write-only"),
  },
});

export type FloodTexture = TgpuTexture<{
  size: [number, number];
  format: "rgba16float";
}> &
  StorageFlag;

export type MaskTexture = TgpuTexture<{
  size: [number, number];
  format: "r32uint";
}> &
  StorageFlag;

export type DistanceTexture = TgpuTexture<{
  size: [number, number];
  format: "rgba16float";
}> &
  SampledFlag &
  StorageFlag;
