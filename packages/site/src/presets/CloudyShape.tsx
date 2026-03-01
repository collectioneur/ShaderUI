/**
 * Cloudy shape preset.
 *
 * Inspired by https://github.com/collectioneur/cloudy-shader
 * — volumetric cloud look is approximated with 2D FBM-style noise (Perlin),
 *   then masked by the SDF so the cloud repeats the shape (text/glyph).
 *
 * No 3D raymarch or external noise texture; uses @typegpu/noise perlin2d
 * and distSampleLayout for the shape mask.
 */
import React, { useRef, useMemo, useEffect } from "react";
import tgpu from "typegpu";
import * as d from "typegpu/data";
import * as std from "typegpu/std";
import { perlin2d } from "@typegpu/noise";
import {
  InteractionArea,
  ShaderCanvas,
  defineUniforms,
  distSampleLayout,
  useShaderInteractionUniforms,
  type FontConfig,
  type Padding,
} from "shaderui";
import { collectUniformControls, type PresetMeta } from "./types";

const NOISE_SCALE = 4.0;
const FBM_LAYERS = 4;
const FWIDTH_AA_SCALE = 2.0;

const U = defineUniforms({
  time: { schema: d.f32, value: 0, control: { editable: false } },
  cloudDensity: {
    schema: d.f32,
    value: 0.55,
    control: {
      editable: true,
      kind: "range",
      label: "Cloud density",
      min: 0.1,
      max: 1,
      step: 0.01,
      group: "Cloud",
      decimals: 2,
    },
  },
  cloudSpeed: {
    schema: d.f32,
    value: 0.3,
    control: {
      editable: true,
      kind: "range",
      label: "Cloud speed",
      min: 0,
      max: 2,
      step: 0.01,
      group: "Cloud",
      decimals: 2,
    },
  },
  sunIntensity: {
    schema: d.f32,
    value: 0.6,
    control: {
      editable: true,
      kind: "range",
      label: "Sun intensity",
      min: 0,
      max: 1.5,
      step: 0.01,
      group: "Light",
      decimals: 2,
    },
  },
  skyBlend: {
    schema: d.f32,
    value: 0.15,
    control: {
      editable: true,
      kind: "range",
      label: "Sky blend",
      min: 0,
      max: 0.5,
      step: 0.01,
      group: "Light",
      decimals: 2,
    },
  },
});

const cloudyFragment = tgpu["~unstable"].fragmentFn({
  in: { uv: d.vec2f },
  out: d.vec4f,
})(({ uv }) => {
  "use gpu";
  const u = U.$;
  const time = u.time;
  const cloudDensity = u.cloudDensity;
  const cloudSpeed = u.cloudSpeed;
  const sunIntensity = u.sunIntensity;
  const skyBlend = u.skyBlend;

  // --- 2D FBM-style cloud density (no 3D raymarch, no external texture) ---
  let f = d.f32(0.0);
  let scale = d.f32(1.0);
  let freq = d.f32(1.0);
  for (let i = 0; i < FBM_LAYERS; i++) {
    const noisePos = uv
      .mul(std.mul(d.f32(NOISE_SCALE), freq))
      .add(d.vec2f(time * cloudSpeed, time * cloudSpeed * 0.3));
    f = std.add(f, std.mul(perlin2d.sample(noisePos), scale));
    scale = std.mul(scale, d.f32(0.5));
    freq = std.mul(freq, d.f32(2.0));
  }
  const cloudRaw = std.smoothstep(
    d.f32(0.2),
    std.add(d.f32(0.2), cloudDensity),
    f,
  );

  // --- Soft sun highlight (top-right bias) ---
  const sunDir = std.normalize(d.vec2f(0.6, 0.4));
  const toSun = std.normalize(
    d.vec2f(std.sub(uv.x, 0.5), std.sub(uv.y, 0.5)),
  );
  const sunDot = std.clamp(std.dot(toSun, sunDir), d.f32(0.0), d.f32(1.0));
  const sunHighlight = std.mul(std.pow(sunDot, d.f32(4.0)), sunIntensity);

  // --- Cloud color: white/gray with sun ---
  const cloudColor = d.vec3f(
    std.add(d.f32(0.95), sunHighlight),
    std.add(d.f32(0.95), std.mul(sunHighlight, d.f32(0.9))),
    std.add(d.f32(1.0), sunHighlight),
  );
  const skyColor = d.vec3f(0.6, 0.65, 0.85);
  const baseColor = std.mix(skyColor, cloudColor, cloudRaw);
  const finalCloudAlpha = cloudRaw;

  // --- SDF shape mask (same as WaterReflection) ---
  const distAbove = std.textureSample(
    distSampleLayout.$.distTexture,
    distSampleLayout.$.sampler,
    uv,
  ).x;
  const fwidthDist = std.fwidth(distAbove);
  const shapeAlpha = std.sub(
    d.f32(1.0),
    std.smoothstep(
      d.f32(0.0),
      std.mul(fwidthDist, d.f32(FWIDTH_AA_SCALE)),
      distAbove,
    ),
  );

  // --- Combine: cloud visible only inside shape; optional sky in background ---
  const alpha = std.mul(finalCloudAlpha, shapeAlpha);
  const color = std.mix(
    std.mul(skyColor, d.f32(skyBlend)),
    baseColor,
    shapeAlpha,
  );

  return d.vec4f(color.x, color.y, color.z, alpha);
});

const DEFAULT_PADDING = {
  paddingTop: 150,
  paddingRight: 150,
  paddingBottom: 150,
  paddingLeft: 150,
} satisfies Padding;

export interface CloudyShapeProps {
  text: string;
  font: FontConfig;
  padding?: Partial<Padding>;
  cloudDensity?: number;
  cloudSpeed?: number;
  sunIntensity?: number;
  skyBlend?: number;
  style?: React.CSSProperties;
  className?: string;
}

function CloudyShapeCanvas({
  text,
  font,
  padding = DEFAULT_PADDING,
  cloudDensity = 0.55,
  cloudSpeed = 0.3,
  sunIntensity = 0.6,
  skyBlend = 0.15,
  style,
  className,
}: CloudyShapeProps) {
  useShaderInteractionUniforms();
  const cloudDensityRef = useRef(cloudDensity);
  const cloudSpeedRef = useRef(cloudSpeed);
  const sunIntensityRef = useRef(sunIntensity);
  const skyBlendRef = useRef(skyBlend);
  cloudDensityRef.current = cloudDensity;
  cloudSpeedRef.current = cloudSpeed;
  sunIntensityRef.current = sunIntensity;
  skyBlendRef.current = skyBlend;

  const timeRef = useRef(0);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      timeRef.current = performance.now() / 1000;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const uniformBindings = useRef(
    U.createBindings({
      time: () => timeRef.current,
      cloudDensity: () => cloudDensityRef.current,
      cloudSpeed: () => cloudSpeedRef.current,
      sunIntensity: () => sunIntensityRef.current,
      skyBlend: () => skyBlendRef.current,
    }),
  );

  const source = useMemo(
    () => ({ type: "text" as const, text, font }),
    [text, font],
  );

  return (
    <ShaderCanvas
      source={source}
      fragment={cloudyFragment}
      uniformBindingsRef={uniformBindings}
      padding={padding}
      style={style}
      className={className}
    />
  );
}

export function CloudyShape(props: CloudyShapeProps) {
  return (
    <InteractionArea style={{ display: "inline-block" }}>
      <CloudyShapeCanvas {...props} />
    </InteractionArea>
  );
}

const DEFAULT_FONT: FontConfig = {
  family: "Helvetica",
  size: 120,
  weight: 600,
};

export const presetMeta = {
  id: "cloudy-shape",
  name: "Cloudy Shape",
  component: CloudyShape,
  defaultProps: {
    text: "Cloud",
    font: DEFAULT_FONT,
    cloudDensity: 0.55,
    cloudSpeed: 0.3,
    sunIntensity: 0.6,
    skyBlend: 0.15,
  },
  uniformControls: collectUniformControls(U.specs),
} satisfies PresetMeta<CloudyShapeProps>;
