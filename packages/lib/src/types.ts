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
export const NeonBlurParams = d.struct({
  intensity: d.f32,
  radius: d.f32,
  aberration: d.f32,
  colorPrimary: d.vec3f,
  colorSecondary: d.vec3f,
});
export const ShaderCompositionParams = d.struct({
  neonBlurEnabled: d.u32,
  neonBlur: NeonBlurParams,
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
