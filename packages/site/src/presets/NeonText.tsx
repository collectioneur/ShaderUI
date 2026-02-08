import React, { useRef, useMemo } from "react";
import tgpu from "typegpu";
import * as d from "typegpu/data";
import * as std from "typegpu/std";
import {
  ShaderCanvas,
  distSampleLayout,
  type FontConfig,
  type UniformBinding,
} from "@shaderui/lib";

const intensityAccessor = tgpu["~unstable"].accessor(d.f32);
const radiusAccessor = tgpu["~unstable"].accessor(d.f32);
const aberrationAccessor = tgpu["~unstable"].accessor(d.f32);
const colorPrimaryAccessor = tgpu["~unstable"].accessor(d.vec3f);
const colorSecondaryAccessor = tgpu["~unstable"].accessor(d.vec3f);

const neonFragment = tgpu["~unstable"].fragmentFn({
  in: { uv: d.vec2f },
  out: d.vec4f,
})(({ uv }) => {
  "use gpu";
  const intensity = intensityAccessor.$;
  const radius = radiusAccessor.$;
  const aberration = aberrationAccessor.$;
  const colorPrimary = colorPrimaryAccessor.$;
  const colorSecondary = colorSecondaryAccessor.$;

  const aberrationUV = aberration * d.f32(0.02);

  const distR = std.textureSample(
    distSampleLayout.$.distTexture,
    distSampleLayout.$.sampler,
    d.vec2f(uv.x + aberrationUV, uv.y),
  ).x;
  const distG = std.textureSample(
    distSampleLayout.$.distTexture,
    distSampleLayout.$.sampler,
    uv,
  ).x;
  const distB = std.textureSample(
    distSampleLayout.$.distTexture,
    distSampleLayout.$.sampler,
    d.vec2f(uv.x - aberrationUV, uv.y),
  ).x;

  const coreMask = std.smoothstep(d.f32(1.0), d.f32(0.0), distG * 0.02);
  const glowRadius = std.max(radius * d.f32(0.1), d.f32(0.001));

  const glowR =
    (d.f32(1.0) - std.smoothstep(d.f32(0.0), glowRadius, distR * 0.001)) *
    intensity;
  const glowG =
    (d.f32(1.0) - std.smoothstep(d.f32(0.0), glowRadius, distG * 0.001)) *
    intensity;
  const glowB =
    (d.f32(1.0) - std.smoothstep(d.f32(0.0), glowRadius, distB * 0.001)) *
    intensity;

  const colorMixFactor = std.smoothstep(glowRadius, d.f32(0.0), distG * 0.001);
  const neonColor = std.mix(colorSecondary, colorPrimary, colorMixFactor);

  const finalGlow = d.vec3f(
    glowR * neonColor.x,
    glowG * neonColor.y,
    glowB * neonColor.z,
  );
  const resultColor = std.mix(finalGlow, d.vec3f(1.0, 1.0, 1.0), coreMask);

  let alpha = std.max(glowR, std.max(glowG, glowB));
  alpha = std.pow(alpha, d.f32(0.8));

  return d.vec4f(resultColor, alpha);
});

export interface NeonTextProps {
  text: string;
  font: FontConfig;
  intensity?: number;
  radius?: number;
  aberration?: number;
  colorPrimary?: [number, number, number];
  colorSecondary?: [number, number, number];
  style?: React.CSSProperties;
  className?: string;
}

const DEFAULT_COLOR_PRIMARY: [number, number, number] = [0.2, 0.8, 1.0];
const DEFAULT_COLOR_SECONDARY: [number, number, number] = [0.6, 0.2, 0.9];

export function NeonText({
  text,
  font,
  intensity = 1.5,
  radius = 8,
  aberration = 2,
  colorPrimary = DEFAULT_COLOR_PRIMARY,
  colorSecondary = DEFAULT_COLOR_SECONDARY,
  style,
  className,
}: NeonTextProps) {
  const intensityRef = useRef(intensity);
  intensityRef.current = intensity;
  const radiusRef = useRef(radius);
  radiusRef.current = radius;
  const aberrationRef = useRef(aberration);
  aberrationRef.current = aberration;
  const colorPrimaryRef = useRef(colorPrimary);
  colorPrimaryRef.current = colorPrimary;
  const colorSecondaryRef = useRef(colorSecondary);
  colorSecondaryRef.current = colorSecondary;

  const uniformBindings = useRef<UniformBinding[]>([
    {
      accessor: intensityAccessor,
      struct: d.f32,
      getValue: () => intensityRef.current,
    },
    {
      accessor: radiusAccessor,
      struct: d.f32,
      getValue: () => radiusRef.current,
    },
    {
      accessor: aberrationAccessor,
      struct: d.f32,
      getValue: () => aberrationRef.current,
    },
    {
      accessor: colorPrimaryAccessor,
      struct: d.vec3f,
      getValue: () => {
        const c = colorPrimaryRef.current;
        return d.vec3f(c[0], c[1], c[2]);
      },
    },
    {
      accessor: colorSecondaryAccessor,
      struct: d.vec3f,
      getValue: () => {
        const c = colorSecondaryRef.current;
        return d.vec3f(c[0], c[1], c[2]);
      },
    },
  ]);

  const source = useMemo(
    () => ({ type: "text" as const, text, font }),
    [text, font],
  );

  return (
    <ShaderCanvas
      source={source}
      fragment={neonFragment}
      uniformBindingsRef={uniformBindings}
      style={style}
      className={className}
    />
  );
}
