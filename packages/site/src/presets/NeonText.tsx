import React, { useRef, useMemo, useCallback, useEffect } from "react";
import tgpu from "typegpu";
import * as d from "typegpu/data";
import * as std from "typegpu/std";
import { perlin2d } from "@typegpu/noise";
import {
  ShaderCanvas,
  defineUniforms,
  distSampleLayout,
  type FontConfig,
  type Padding,
} from "shaderui";
import { collectUniformControls, type PresetMeta } from "./types";

const NOISE_SCALE = 12;
const HOVER_RADIUS = 0.5;
/** Scale for fwidth-based antialiasing; larger = softer edge (e.g. 2.0 ≈ 1–2 px) */
const FWIDTH_AA_SCALE = 2.0;

const U = defineUniforms({
  waterLevel: {
    schema: d.f32,
    value: 0.5,
    control: {
      editable: true,
      kind: "range",
      label: "Water level",
      min: 0,
      max: 1,
      step: 0.01,
      group: "Water reflection",
      decimals: 2,
    },
  },
  liquefaction: {
    schema: d.f32,
    value: 0.03,
    control: {
      editable: true,
      kind: "range",
      label: "Liquefaction",
      min: 0,
      max: 0.15,
      step: 0.005,
      group: "Water reflection",
      decimals: 3,
    },
  },
  hoverSpread: {
    schema: d.f32,
    value: 0.02,
    control: {
      editable: true,
      kind: "range",
      label: "Hover spread",
      min: 0,
      max: 0.1,
      step: 0.005,
      group: "Water reflection",
      decimals: 3,
    },
  },
  mouseUV: { schema: d.vec2f, value: d.vec2f(-2, -2), control: { editable: false } },
  time: { schema: d.f32, value: 0, control: { editable: false } },
});

const waterFragment = tgpu["~unstable"].fragmentFn({
  in: { uv: d.vec2f },
  out: d.vec4f,
})(({ uv }) => {
  "use gpu";
  const u = U.$;
  const waterLevel = u.waterLevel;
  const liquefaction = u.liquefaction;
  const hoverSpread = u.hoverSpread;
  const mouseUV = u.mouseUV;
  const time = u.time;

  const distAbove = std.textureSample(
    distSampleLayout.$.distTexture,
    distSampleLayout.$.sampler,
    uv,
  ).x;

  const reflectedV = d.f32(2.0) * waterLevel - uv.y;
  const noisePos = uv.mul(d.f32(NOISE_SCALE)).mul(d.vec2f(2.0, 10.0));
  const timeOffset = d.vec2f(time, 0.0);
  // const timeOffset = d.vec2f(0.0, time * d.f32(1.5));
  const n1 = perlin2d.sample(noisePos.add(timeOffset));
  const n2 = perlin2d.sample(
    d.vec2f(noisePos.x + d.f32(50.0), noisePos.y + d.f32(30.0)).add(timeOffset),
  );
  let dx = n1 * liquefaction;
  let dy = n2 * liquefaction;

  const mouseInside = 1.0;
  if (mouseInside) {
    const dist = std.distance(uv, mouseUV);
    // falloff: 1 at cursor center, fades to 0 at HOVER_RADIUS
    const falloff = std.smoothstep(d.f32(HOVER_RADIUS), d.f32(0.0), dist);
    // clearAmount: how much to reduce (clear) the distortion near the cursor
    const clearAmount = std.clamp(
      hoverSpread * falloff * d.f32(10.0),
      d.f32(0.0),
      d.f32(1.0),
    );
    dx = dx * (d.f32(1.0) - clearAmount);
    dy = dy * (d.f32(1.0) - clearAmount);
  }

  const distortedUV = d.vec2f(uv.x + dx, reflectedV + dy);
  const distBelow = std.textureSample(
    distSampleLayout.$.distTexture,
    distSampleLayout.$.sampler,
    distortedUV,
  ).x;

  // fwidth-based antialiasing: soften SDF edge by ~1-2 px using screen-space derivative
  const fwidthDistAbove = std.fwidth(distAbove);
  const fwidthDistBelow = std.fwidth(distBelow);
  // SDF is negative inside glyphs and positive outside.
  // Invert smoothstep so text is opaque and background is transparent.
  const alphaAbove =
    d.f32(1.0) -
    std.smoothstep(
      d.f32(0.0),
      fwidthDistAbove * d.f32(FWIDTH_AA_SCALE),
      distAbove,
    );
  const alphaBelow =
    d.f32(1.0) -
    std.smoothstep(
      d.f32(0.0),
      fwidthDistBelow * d.f32(FWIDTH_AA_SCALE),
      distBelow,
    );

  const aboveWater = uv.y < waterLevel;
  const alpha = std.select(alphaBelow, alphaAbove, aboveWater);

  return d.vec4f(1.0 * alpha, 1.0 * alpha, 1.0 * alpha, alpha);
});

const DEFAULT_PADDING = {
  paddingTop: 150,
  paddingRight: 150,
  paddingBottom: 150,
  paddingLeft: 150,
} satisfies Padding;

export interface NeonTextProps {
  text: string;
  font: FontConfig;
  padding?: Partial<Padding>;
  waterLevel?: number;
  liquefaction?: number;
  hoverSpread?: number;
  style?: React.CSSProperties;
  className?: string;
}

export function NeonText({
  text,
  font,
  padding = DEFAULT_PADDING,
  waterLevel = 0.5,
  liquefaction = 0.03,
  hoverSpread = 0.02,
  style,
  className,
}: NeonTextProps) {
  const waterLevelRef = useRef(waterLevel);
  waterLevelRef.current = waterLevel;
  const liquefactionRef = useRef(liquefaction);
  liquefactionRef.current = liquefaction;
  const hoverSpreadRef = useRef(hoverSpread);
  hoverSpreadRef.current = hoverSpread;

  const mouseUVRef = useRef<[number, number]>([-2, -2]);
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

  const uniformBindings = useRef(
    U.createBindings({
      waterLevel: () => waterLevelRef.current,
      liquefaction: () => liquefactionRef.current,
      hoverSpread: () => hoverSpreadRef.current,
      time: () => timeRef.current,
      mouseUV: () => {
        const [x, y] = mouseUVRef.current;
        return d.vec2f(x, y);
      },
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
  id: "neon",
  name: "Neon Text",
  component: NeonText,
  defaultProps: {
    text: "Hello",
    font: DEFAULT_FONT,
    waterLevel: 0.5,
    liquefaction: 0.03,
    hoverSpread: 0.02,
  },
  uniformControls: collectUniformControls(U.specs),
} satisfies PresetMeta<NeonTextProps>;
