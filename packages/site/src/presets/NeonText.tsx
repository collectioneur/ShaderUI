import React, { useRef, useMemo, useCallback, useEffect } from "react";
import tgpu from "typegpu";
import * as d from "typegpu/data";
import * as std from "typegpu/std";
import { perlin2d } from "@typegpu/noise";
import {
  ShaderCanvas,
  distSampleLayout,
  type FontConfig,
  type UniformBinding,
} from "@shaderui/lib";

const waterLevelAccessor = tgpu["~unstable"].accessor(d.f32);
const liquefactionAccessor = tgpu["~unstable"].accessor(d.f32);
const hoverSpreadAccessor = tgpu["~unstable"].accessor(d.f32);
const mouseUVAccessor = tgpu["~unstable"].accessor(d.vec2f);
const timeAccessor = tgpu["~unstable"].accessor(d.f32);

const NOISE_SCALE = 12;
const HOVER_RADIUS = 0.5;

const waterFragment = tgpu["~unstable"].fragmentFn({
  in: { uv: d.vec2f },
  out: d.vec4f,
})(({ uv }) => {
  "use gpu";
  const waterLevel = waterLevelAccessor.$;
  const liquefaction = liquefactionAccessor.$;
  const hoverSpread = hoverSpreadAccessor.$;
  const mouseUV = mouseUVAccessor.$;
  const time = timeAccessor.$;

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
    const falloff =
      d.f32(1.0) - std.smoothstep(d.f32(HOVER_RADIUS), d.f32(0.0), dist);
    const hoverAmount = hoverSpread * falloff;
    dx = dx + n1 * hoverAmount * 10.0;
    dy = dy + n2 * hoverAmount * 10.0;
  }

  const distortedUV = d.vec2f(uv.x + dx, reflectedV + dy);
  const distBelow = std.textureSample(
    distSampleLayout.$.distTexture,
    distSampleLayout.$.sampler,
    distortedUV,
  ).x;

  // SDF is negative inside glyphs and positive outside.
  // Invert smoothstep so text is opaque and background is transparent.
  const alphaAbove =
    d.f32(1.0) -
    std.smoothstep(d.f32(0.0), d.f32(0.02), distAbove * d.f32(0.01));
  const alphaBelow =
    d.f32(1.0) -
    std.smoothstep(d.f32(0.0), d.f32(0.02), distBelow * d.f32(0.01));

  const aboveWater = uv.y < waterLevel;
  const alpha = std.select(alphaBelow, alphaAbove, aboveWater);

  return d.vec4f(1.0, 1.0, 1.0, alpha);
});

export interface NeonTextProps {
  text: string;
  font: FontConfig;
  padding?: number;
  waterLevel?: number;
  liquefaction?: number;
  hoverSpread?: number;
  style?: React.CSSProperties;
  className?: string;
}

export function NeonText({
  text,
  font,
  padding = 150,
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

  const uniformBindings = useRef<UniformBinding[]>([
    {
      accessor: waterLevelAccessor,
      struct: d.f32,
      getValue: () => waterLevelRef.current,
    },
    {
      accessor: liquefactionAccessor,
      struct: d.f32,
      getValue: () => liquefactionRef.current,
    },
    {
      accessor: hoverSpreadAccessor,
      struct: d.f32,
      getValue: () => hoverSpreadRef.current,
    },
    {
      accessor: mouseUVAccessor,
      struct: d.vec2f,
      getValue: () => {
        const [x, y] = mouseUVRef.current;
        return d.vec2f(x, y);
      },
    },
    {
      accessor: timeAccessor,
      struct: d.f32,
      getValue: () => timeRef.current,
    },
  ]);

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
