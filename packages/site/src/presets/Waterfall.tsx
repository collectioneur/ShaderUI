import React, { useRef, useMemo, useCallback, useEffect } from "react";
import tgpu from "typegpu";
import * as d from "typegpu/data";
import * as std from "typegpu/std";
import { perlin2d } from "@typegpu/noise";
import {
  ShaderCanvas,
  distSampleLayout,
  defineUniforms,
  type FontConfig,
  type Padding,
} from "shaderui";
import { collectUniformControls, type PresetMeta } from "./types";

// All shader constants defined in one place.
// Static entries use their `value` as-is every frame.
// Dynamic entries (time, mouseUV) receive a runtime getter in createBindings().
// Everything is packed into ONE WGSL struct → ONE GPU buffer → no WebGPU limit issues.
const U = defineUniforms({
  // --- interaction ---
  mouseUV: { schema: d.vec2f, value: d.vec2f(-2, -2), control: { editable: false } },
  time: { schema: d.f32, value: 0, control: { editable: false } },

  // --- SPIRAL_* controls global swirl shape, speed, and micro-perturbation ---
  UV_CENTER: { schema: d.f32, value: 0.5 },
  SPIRAL_ROTATION: { schema: d.f32, value: -4.0 },
  SPIRAL_SPEED: {
    schema: d.f32,
    value: 7.0,
    control: {
      editable: true,
      kind: "range",
      label: "Spiral speed",
      min: 0.1,
      max: 20,
      step: 0.1,
      group: "Spiral",
      decimals: 2,
    },
  },
  SPIRAL_AMOUNT: {
    schema: d.f32,
    value: 3.0,
    control: {
      editable: true,
      kind: "range",
      label: "Spiral amount",
      min: 0,
      max: 8,
      step: 0.05,
      group: "Spiral",
      decimals: 2,
    },
  },
  SPIRAL_EASE: { schema: d.f32, value: 0.7 },
  SPIRAL_SPEED_EASE_FACTOR: { schema: d.f32, value: 0.2 },
  SPIRAL_SPEED_OFFSET: { schema: d.f32, value: 302.2 },
  SPIRAL_ANGLE_EASE_MULTIPLIER: { schema: d.f32, value: 20.0 },
  SPIRAL_UV_SCALE: { schema: d.f32, value: 30.0 },
  SPIRAL_STEP_AMPLITUDE: { schema: d.f32, value: 0.5 },
  SPIRAL_PHASE_OFFSET: { schema: d.f32, value: 5.1123314 },
  SPIRAL_PHASE_UV_FACTOR: { schema: d.f32, value: 0.353 },
  SPIRAL_PHASE_TIME_FACTOR: { schema: d.f32, value: 0.131121 },
  SPIRAL_WAVE_TIME_FACTOR: { schema: d.f32, value: 0.113 },
  SPIRAL_Y_SWIRL_FACTOR: { schema: d.f32, value: 0.711 },

  // --- PAINT_* controls contrast bands and lighting response ---
  PAINT_CONTRAST: {
    schema: d.f32,
    value: 28.0,
    control: {
      editable: true,
      kind: "range",
      label: "Paint contrast",
      min: 1,
      max: 60,
      step: 0.5,
      group: "Paint",
      decimals: 2,
    },
  },
  PAINT_LIGHTING: { schema: d.f32, value: 0.0 },
  PAINT_CONTRAST_BASE_FACTOR: { schema: d.f32, value: 0.25 },
  PAINT_SPIRAL_AMOUNT_FACTOR: { schema: d.f32, value: 0.5 },
  PAINT_CONTRAST_OFFSET: { schema: d.f32, value: 1.2 },
  PAINT_MAX_RES: { schema: d.f32, value: 2.0 },
  PAINT_RES_SCALE: { schema: d.f32, value: 0.035 },
  PAINT_CIRCLE_SHARPNESS: { schema: d.f32, value: 1.4 },
  PAINT_LIGHT_THRESHOLD_SCALE: { schema: d.f32, value: 5.0 },
  PAINT_LIGHT_THRESHOLD_BIAS: { schema: d.f32, value: 4.0 },
  PAINT_LIGHT_PRIMARY_BIAS: { schema: d.f32, value: 0.2 },
  PAINT_CONTRAST_FACTOR_NUMERATOR: { schema: d.f32, value: 0.3 },

  // --- IRIDESCENCE_* controls hue cycling and blend boundaries ---
  IRIDESCENCE_TIME_SPEED: { schema: d.f32, value: 0.5 },
  IRIDESCENCE_PHASE_X_FACTOR: { schema: d.f32, value: 3.0 },
  IRIDESCENCE_PHASE_Y_FACTOR: { schema: d.f32, value: 2.0 },
  IRIDESCENCE_PHASE_WRAP_SCALE: { schema: d.f32, value: 0.2 },
  IRIDESCENCE_TAU: { schema: d.f32, value: 6.283185307 },
  IRIDESCENCE_COSINE_SMOOTH_SCALE: { schema: d.f32, value: 0.5 },
  IRIDESCENCE_BLEND12_START: { schema: d.f32, value: 0.15 },
  IRIDESCENCE_BLEND12_END: { schema: d.f32, value: 0.45 },
  IRIDESCENCE_BLEND23_START: { schema: d.f32, value: 0.45 },
  IRIDESCENCE_BLEND23_END: { schema: d.f32, value: 0.75 },
  IRIDESCENCE_BLEND31_START: { schema: d.f32, value: 0.75 },
  IRIDESCENCE_HIGHLIGHT_STRENGTH: { schema: d.f32, value: 0.3 },
  IRIDESCENCE_MIX_FACTOR: {
    schema: d.f32,
    value: 0.6,
    control: {
      editable: true,
      kind: "range",
      label: "Iridescence mix",
      min: 0,
      max: 1,
      step: 0.01,
      group: "Iridescence",
      decimals: 2,
    },
  },

  // --- DISTORTION_* controls noise flow and pixel pull strength ---
  DISTORTION_NOISE_SCALE: { schema: d.vec2f, value: d.vec2f(5.0, 1.0) },
  DISTORTION_TIME_OFFSET_Y_SPEED: { schema: d.f32, value: -0.3 },
  DISTORTION_CENTER_Y: { schema: d.f32, value: 0.5 },
  DISTORTION_CENTER_SCALE: { schema: d.f32, value: 2.0 },
  DISTORTION_MASK_Y_END: { schema: d.f32, value: 0.1 },
  DISTORTION_MASK_X_END: { schema: d.f32, value: 0.9 },
  DISTORTION_STREAK_NOISE_SCALE: { schema: d.f32, value: 0.5 },
  DISTORTION_STREAK_NOISE_BIAS: { schema: d.f32, value: 0.5 },
  DISTORTION_PULL_STRENGTH: {
    schema: d.f32,
    value: 2.0,
    control: {
      editable: true,
      kind: "range",
      label: "Pull strength",
      min: 0,
      max: 5,
      step: 0.05,
      group: "Distortion",
      decimals: 2,
    },
  },
  DISTORTION_X_DISPLACEMENT_SCALE: { schema: d.f32, value: 2.0 },

  // --- FLARE_* controls horizontal pinch and edge fade shaping ---
  FLARE_MASK_POW: { schema: d.f32, value: 2.0 },
  FLARE_STRENGTH: {
    schema: d.f32,
    value: 0.5,
    control: {
      editable: true,
      kind: "range",
      label: "Flare strength",
      min: 0,
      max: 1,
      step: 0.01,
      group: "Flare",
      decimals: 2,
    },
  },
  FLARE_ALPHA_POW: { schema: d.f32, value: 0.5 },
  FLARE_CENTER_X: { schema: d.f32, value: 0.5 },

  // --- SDF_* and AA_* control edge extraction and antialias softening ---
  SDF_ALPHA_EDGE_MAX: { schema: d.f32, value: 100.0 },
  SDF_ALPHA_EDGE_OFFSET: { schema: d.f32, value: 40.0 },
  AA_FWIDTH_SCALE: { schema: d.f32, value: 1.5 },

  // --- COLOR_* defines the waterfall palette ---
  COLOR_PRIMARY: { schema: d.vec4f, value: d.vec4f(0.871, 0.267, 0.231, 1.0) },
  COLOR_SECONDARY: { schema: d.vec4f, value: d.vec4f(0.4, 0.0, 0.706, 1.0) },
  COLOR_TERTIARY: {
    schema: d.vec4f,
    value: d.vec4f(0.086, 0.137, 0.145, 1.0),
  },
});

const waterFragment = tgpu["~unstable"].fragmentFn({
  in: { uv: d.vec2f },
  out: d.vec4f,
})(({ uv }) => {
  "use gpu";
  const u = U.$;
  const time = u.time;

  const mid = d.vec2f(u.UV_CENTER, u.UV_CENTER);
  const uvCentered = uv.sub(mid);
  const uvLen = std.length(uvCentered);
  const angle = std.atan2(uvCentered.y, uvCentered.x);

  const speedBase =
    u.SPIRAL_ROTATION * u.SPIRAL_EASE * u.SPIRAL_SPEED_EASE_FACTOR +
    u.SPIRAL_SPEED_OFFSET;
  const speedTime = time * u.SPIRAL_SPEED;
  const newAngle =
    angle +
    speedBase -
    u.SPIRAL_EASE *
      u.SPIRAL_ANGLE_EASE_MULTIPLIER *
      (u.SPIRAL_AMOUNT * uvLen + (d.f32(1.0) - u.SPIRAL_AMOUNT));
  let uvSpiral = d
    .vec2f(uvLen * std.cos(newAngle) + mid.x, uvLen * std.sin(newAngle) + mid.y)
    .sub(mid);
  uvSpiral = uvSpiral.mul(u.SPIRAL_UV_SCALE);

  let uv2 = d.vec2f(uvSpiral.x + uvSpiral.y, uvSpiral.x + uvSpiral.y);

  for (let i = 0; i < 5; i++) {
    uv2 = uv2.add(std.sin(std.max(uvSpiral.x, uvSpiral.y))).add(uvSpiral);
    uvSpiral = uvSpiral.add(
      d.vec2f(
        u.SPIRAL_STEP_AMPLITUDE *
          std.cos(
            u.SPIRAL_PHASE_OFFSET +
              u.SPIRAL_PHASE_UV_FACTOR * uv2.y +
              speedTime * u.SPIRAL_PHASE_TIME_FACTOR,
          ),
        u.SPIRAL_STEP_AMPLITUDE *
          std.sin(uv2.x - u.SPIRAL_WAVE_TIME_FACTOR * speedTime),
      ),
    );
    uvSpiral = uvSpiral.sub(
      d.vec2f(
        std.cos(uvSpiral.x + uvSpiral.y),
        std.sin(uvSpiral.x * u.SPIRAL_Y_SWIRL_FACTOR - uvSpiral.y),
      ),
    );
  }

  const contrastMod =
    u.PAINT_CONTRAST_BASE_FACTOR * u.PAINT_CONTRAST +
    u.PAINT_SPIRAL_AMOUNT_FACTOR * u.SPIRAL_AMOUNT +
    u.PAINT_CONTRAST_OFFSET;
  const paintRes = std.min(
    u.PAINT_MAX_RES,
    std.max(
      d.f32(0.0),
      std.length(uvSpiral) * u.PAINT_RES_SCALE * contrastMod,
    ),
  );
  const circleSharpness = u.PAINT_CIRCLE_SHARPNESS;
  const c1p = std.max(
    d.f32(0.0),
    d.f32(1.0) - contrastMod * circleSharpness * std.abs(d.f32(1.0) - paintRes),
  );
  const c2p = std.max(
    d.f32(0.0),
    d.f32(1.0) - contrastMod * circleSharpness * std.abs(paintRes),
  );
  const c3p = d.f32(1.0) - std.min(d.f32(1.0), c1p + c2p);
  const light =
    (u.PAINT_LIGHTING - u.PAINT_LIGHT_PRIMARY_BIAS) *
      std.max(
        c1p * u.PAINT_LIGHT_THRESHOLD_SCALE - u.PAINT_LIGHT_THRESHOLD_BIAS,
        d.f32(0.0),
      ) +
    u.PAINT_LIGHTING *
      std.max(
        c2p * u.PAINT_LIGHT_THRESHOLD_SCALE - u.PAINT_LIGHT_THRESHOLD_BIAS,
        d.f32(0.0),
      );

  const phase =
    time * u.IRIDESCENCE_TIME_SPEED +
    uv.x * u.IRIDESCENCE_PHASE_X_FACTOR +
    uv.y * u.IRIDESCENCE_PHASE_Y_FACTOR;
  const phaseNorm = std.fract(phase * u.IRIDESCENCE_PHASE_WRAP_SCALE);
  const tau = u.IRIDESCENCE_TAU;
  const tSmooth =
    (d.f32(1.0) - std.cos(phaseNorm * tau)) * u.IRIDESCENCE_COSINE_SMOOTH_SCALE;
  const blend12 = std.smoothstep(
    u.IRIDESCENCE_BLEND12_START,
    u.IRIDESCENCE_BLEND12_END,
    tSmooth,
  );
  const blend23 = std.smoothstep(
    u.IRIDESCENCE_BLEND23_START,
    u.IRIDESCENCE_BLEND23_END,
    tSmooth,
  );
  const blend31 = std.smoothstep(u.IRIDESCENCE_BLEND31_START, d.f32(1.0), tSmooth);
  const colorPrimary = u.COLOR_PRIMARY;
  const colorSecondary = u.COLOR_SECONDARY;
  const colorTertiary = u.COLOR_TERTIARY;
  const iridescent = std.mix(
    std.mix(std.mix(colorPrimary, colorSecondary, blend12), colorTertiary, blend23),
    colorPrimary,
    blend31,
  );
  const highlight =
    u.IRIDESCENCE_HIGHLIGHT_STRENGTH * (d.f32(1.0) + std.sin(phase));
  const contrastFactor = u.PAINT_CONTRAST_FACTOR_NUMERATOR / u.PAINT_CONTRAST;
  const oneMinusCf = d.f32(1.0) - contrastFactor;
  const c3pVec = d
    .vec4f(colorTertiary.x, colorTertiary.y, colorTertiary.z, colorPrimary.w)
    .mul(c3p);
  const blend = colorPrimary
    .mul(c1p)
    .add(colorSecondary.mul(c2p))
    .add(c3pVec);
  const baseColor = colorPrimary
    .mul(contrastFactor)
    .add(blend.mul(oneMinusCf))
    .add(d.vec4f(light, light, light, d.f32(0.0)));
  const rgb = std
    .mix(baseColor, iridescent, u.IRIDESCENCE_MIX_FACTOR)
    .add(d.vec4f(highlight, highlight, highlight, d.f32(0.0)));

  const noiseScale = u.DISTORTION_NOISE_SCALE;
  const noisePos = uv.mul(noiseScale);

  const timeOffset = d.vec2f(d.f32(0.0), time * u.DISTORTION_TIME_OFFSET_Y_SPEED);
  const noiseVal = perlin2d.sample(noisePos.add(timeOffset));

  const distFromCenter =
    std.abs(u.DISTORTION_CENTER_Y - uv.y) * u.DISTORTION_CENTER_SCALE;

  const distortionMask = std.smoothstep(
    d.f32(0.0),
    u.DISTORTION_MASK_Y_END,
    distFromCenter,
  );

  const dirToCenter = u.DISTORTION_CENTER_Y - uv.y;

  const streakNoise =
    noiseVal * u.DISTORTION_STREAK_NOISE_SCALE + u.DISTORTION_STREAK_NOISE_BIAS;

  const pullStrength = u.DISTORTION_PULL_STRENGTH;

  const yDisplacement = dirToCenter * distortionMask * streakNoise * pullStrength;

  const noiseValX = perlin2d.sample(uv.add(timeOffset));
  const distortionMaskX = std.smoothstep(
    d.f32(0.0),
    u.DISTORTION_MASK_X_END,
    distFromCenter,
  );

  const xDisplacement = noiseValX * distortionMaskX * u.DISTORTION_X_DISPLACEMENT_SCALE;

  const flareMask = std.pow(distFromCenter, u.FLARE_MASK_POW);

  const flareStrength = u.FLARE_STRENGTH;

  const xScale = d.f32(1.0) - flareMask * flareStrength;

  const uvXCentered = uv.x - u.FLARE_CENTER_X;
  const flaredX = u.FLARE_CENTER_X + uvXCentered * xScale;

  const flaredUV = d.vec2f(flaredX, uv.y);
  let flowUV = flaredUV.add(d.vec2f(xDisplacement, yDisplacement));

  const distSDF = std.textureSample(
    distSampleLayout.$.distTexture,
    distSampleLayout.$.sampler,
    flowUV,
  ).x;

  const distSDFBase = std.textureSample(
    distSampleLayout.$.distTexture,
    distSampleLayout.$.sampler,
    uv,
  ).x;

  const fwidthDistBase = std.fwidth(distSDFBase);
  const alphaSDF = std.smoothstep(
    d.f32(0.0),
    u.SDF_ALPHA_EDGE_MAX,
    -distSDF + u.SDF_ALPHA_EDGE_OFFSET,
  );
  const alphaBase = std.smoothstep(
    d.f32(0.0),
    fwidthDistBase * u.AA_FWIDTH_SCALE,
    -distSDFBase,
  );

  const alpha = std.max(alphaSDF, alphaBase);

  const alphaClamped = std.saturate(alpha);

  const negativeFlareMask = d.f32(1.0) - std.pow(flareMask, u.FLARE_ALPHA_POW);

  const premulR = rgb.x * alphaClamped * negativeFlareMask;
  const premulG = rgb.y * alphaClamped * negativeFlareMask;
  const premulB = rgb.z * alphaClamped * negativeFlareMask;
  return d.vec4f(premulR, premulG, premulB, alphaClamped * negativeFlareMask);
});

const DEFAULT_PADDING = {
  paddingTop: 150,
  paddingRight: 150,
  paddingBottom: 150,
  paddingLeft: 150,
} satisfies Padding;

export interface WaterfallProps {
  text: string;
  font: FontConfig;
  padding?: Partial<Padding>;
  SPIRAL_SPEED?: number;
  SPIRAL_AMOUNT?: number;
  PAINT_CONTRAST?: number;
  IRIDESCENCE_MIX_FACTOR?: number;
  DISTORTION_PULL_STRENGTH?: number;
  FLARE_STRENGTH?: number;
  style?: React.CSSProperties;
  className?: string;
}

export function Waterfall({
  text,
  font,
  padding = DEFAULT_PADDING,
  SPIRAL_SPEED = 7.0,
  SPIRAL_AMOUNT = 3.0,
  PAINT_CONTRAST = 28.0,
  IRIDESCENCE_MIX_FACTOR = 0.6,
  DISTORTION_PULL_STRENGTH = 2.0,
  FLARE_STRENGTH = 0.5,
  style,
  className,
}: WaterfallProps) {
  const mouseUVRef = useRef<[number, number]>([-2, -2]);
  const timeRef = useRef(0);
  const spiralSpeedRef = useRef(SPIRAL_SPEED);
  spiralSpeedRef.current = SPIRAL_SPEED;
  const spiralAmountRef = useRef(SPIRAL_AMOUNT);
  spiralAmountRef.current = SPIRAL_AMOUNT;
  const paintContrastRef = useRef(PAINT_CONTRAST);
  paintContrastRef.current = PAINT_CONTRAST;
  const iridescenceMixFactorRef = useRef(IRIDESCENCE_MIX_FACTOR);
  iridescenceMixFactorRef.current = IRIDESCENCE_MIX_FACTOR;
  const distortionPullStrengthRef = useRef(DISTORTION_PULL_STRENGTH);
  distortionPullStrengthRef.current = DISTORTION_PULL_STRENGTH;
  const flareStrengthRef = useRef(FLARE_STRENGTH);
  flareStrengthRef.current = FLARE_STRENGTH;

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      timeRef.current = performance.now() / 1000;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    mouseUVRef.current = [x, y];
  }, []);
  const handleMouseLeave = useCallback(() => {
    mouseUVRef.current = [-2, -2];
  }, []);

  // Runtime-controlled uniforms use getters so slider changes apply immediately.
  const uniformBindings = useRef(
    U.createBindings({
      time: () => timeRef.current,
      mouseUV: () => {
        const [x, y] = mouseUVRef.current;
        return d.vec2f(x, y);
      },
      SPIRAL_SPEED: () => spiralSpeedRef.current,
      SPIRAL_AMOUNT: () => spiralAmountRef.current,
      PAINT_CONTRAST: () => paintContrastRef.current,
      IRIDESCENCE_MIX_FACTOR: () => iridescenceMixFactorRef.current,
      DISTORTION_PULL_STRENGTH: () => distortionPullStrengthRef.current,
      FLARE_STRENGTH: () => flareStrengthRef.current,
    }),
  );

  const source = useMemo(
    () => ({ type: "text" as const, text, font }),
    [text, font],
  );

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ display: "inline-block" }}
    >
      <ShaderCanvas
        source={source}
        fragment={waterFragment}
        uniformBindingsRef={uniformBindings}
        padding={padding}
        style={style}
        className={className}
      />
    </div>
  );
}

const DEFAULT_FONT: FontConfig = {
  family: "Helvetica",
  size: 120,
  weight: 600,
};

export const presetMeta = {
  id: "waterfall",
  name: "Waterfall",
  component: Waterfall,
  defaultProps: {
    text: "Hello",
    font: DEFAULT_FONT,
    SPIRAL_SPEED: 7.0,
    SPIRAL_AMOUNT: 3.0,
    PAINT_CONTRAST: 28.0,
    IRIDESCENCE_MIX_FACTOR: 0.6,
    DISTORTION_PULL_STRENGTH: 2.0,
    FLARE_STRENGTH: 0.5,
  },
  uniformControls: collectUniformControls(U.specs),
} satisfies PresetMeta<WaterfallProps>;
