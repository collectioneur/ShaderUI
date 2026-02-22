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

const mouseUVAccessor = tgpu["~unstable"].accessor(d.vec2f);
const timeAccessor = tgpu["~unstable"].accessor(d.f32);

const SPIN_ROTATION = -4.0;
const SPIN_SPEED = 7.0;
const SPIN_AMOUNT = 0.1;
const SPIN_EASE = 0.7;
const CONTRAST = 15.0;
const LIGHTING = 0.0;
const NOISE_SCALE = 1.0;
const HOVER_RADIUS = 100.0;
const HOVER_BEND = 0.5;

const COLOUR_1 = d.vec4f(0.871, 0.267, 0.231, 1.0);
const COLOUR_2 = d.vec4f(0.4, 0.0, 0.706, 1.0);
const COLOUR_3 = d.vec4f(0.086, 0.137, 0.145, 1.0);

const waterFragment = tgpu["~unstable"].fragmentFn({
  in: { uv: d.vec2f },
  out: d.vec4f,
})(({ uv }) => {
  "use gpu";
  const time = timeAccessor.$;
  const mouseUV = mouseUVAccessor.$;

  const mid = d.vec2f(0.5, 0.5);
  const uvCentered = uv.sub(mid);
  const uvLen = std.length(uvCentered);
  const angle = std.atan2(uvCentered.y, uvCentered.x);

  const speedBase = d.f32(SPIN_ROTATION * SPIN_EASE * 0.2) + d.f32(302.2);
  const speedTime = time * d.f32(SPIN_SPEED);
  const newAngle =
    angle +
    speedBase -
    d.f32(SPIN_EASE * 20.0) *
      (d.f32(SPIN_AMOUNT) * uvLen + (d.f32(1.0) - d.f32(SPIN_AMOUNT)));
  let uvSpiral = d
    .vec2f(uvLen * std.cos(newAngle) + mid.x, uvLen * std.sin(newAngle) + mid.y)
    .sub(mid);
  uvSpiral = uvSpiral.mul(d.f32(30.0));

  let uv2 = d.vec2f(uvSpiral.x + uvSpiral.y, uvSpiral.x + uvSpiral.y);

  for (let i = 0; i < 0; i++) {
    uv2 = uv2.add(std.sin(std.max(uvSpiral.x, uvSpiral.y))).add(uvSpiral);
    uvSpiral = uvSpiral.add(
      d.vec2f(
        d.f32(0.5) *
          std.cos(
            d.f32(5.1123314) +
              d.f32(0.353) * uv2.y +
              speedTime * d.f32(0.131121),
          ),
        d.f32(0.5) * std.sin(uv2.x - d.f32(0.113) * speedTime),
      ),
    );
    uvSpiral = uvSpiral.sub(
      d.vec2f(
        std.cos(uvSpiral.x + uvSpiral.y),
        std.sin(uvSpiral.x * d.f32(0.711) - uvSpiral.y),
      ),
    );
  }

  const contrastMod = d.f32(0.25 * CONTRAST + 0.5 * SPIN_AMOUNT + 1.2);
  const paintRes = std.min(
    d.f32(2.0),
    std.max(d.f32(0.0), std.length(uvSpiral) * d.f32(0.035) * contrastMod),
  );
  const c1p = std.max(
    d.f32(0.0),
    d.f32(1.0) - contrastMod * std.abs(d.f32(1.0) - paintRes),
  );
  const c2p = std.max(d.f32(0.0), d.f32(1.0) - contrastMod * std.abs(paintRes));
  const c3p = d.f32(1.0) - std.min(d.f32(1.0), c1p + c2p);
  const light =
    d.f32(LIGHTING - 0.2) * std.max(c1p * d.f32(5.0) - d.f32(4.0), d.f32(0.0)) +
    d.f32(LIGHTING) * std.max(c2p * d.f32(5.0) - d.f32(4.0), d.f32(0.0));
  const fluidStrength = std.abs(uvCentered.y);

  const phase = time * d.f32(2.0) + uv.x * d.f32(3.0) + uv.y * d.f32(2.0);
  const phaseNorm = std.fract(phase * d.f32(0.2));
  const iridescent = std.mix(
    std.mix(
      COLOUR_1,
      COLOUR_2,
      std.smoothstep(d.f32(0.0), d.f32(0.5), phaseNorm),
    ),
    COLOUR_3,
    std.smoothstep(d.f32(0.5), d.f32(1.0), phaseNorm),
  );
  const highlight = d.f32(0.3) * (d.f32(1.0) + std.sin(phase));
  const contrastFactor = d.f32(0.3) / d.f32(CONTRAST);
  const oneMinusCf = d.f32(1.0) - contrastFactor;
  const c3pVec = d
    .vec4f(COLOUR_3.x, COLOUR_3.y, COLOUR_3.z, COLOUR_1.w)
    .mul(c3p);
  const blend = COLOUR_1.mul(c1p).add(COLOUR_2.mul(c2p)).add(c3pVec);
  const baseColor = COLOUR_1.mul(contrastFactor)
    .add(blend.mul(oneMinusCf))
    .add(d.vec4f(light, light, light, d.f32(0.0)));
  const rgb = std
    .mix(baseColor, iridescent, d.f32(0.6))
    .add(d.vec4f(highlight, highlight, highlight, d.f32(0.0)));

  const noiseScale = d.vec2f(5.0, 1.0);
  const noisePos = uv.mul(noiseScale);

  const timeOffset = d.vec2f(d.f32(0.0), -time * d.f32(0.3));
  const noiseVal = perlin2d.sample(noisePos.add(timeOffset));

  const distFromCenter = std.abs(d.f32(0.5) - uv.y) * d.f32(2.0);

  const distortionMask = std.smoothstep(d.f32(0.0), d.f32(0.1), distFromCenter);

  const dirToCenter = d.f32(0.5) - uv.y;

  const streakNoise = noiseVal * d.f32(0.5) + d.f32(0.5);

  const pullStrength = d.f32(2.0);

  const yDisplacement =
    dirToCenter * distortionMask * streakNoise * pullStrength;

  const noiseValX = perlin2d.sample(uv.add(timeOffset));
  const distortionMaskX = std.smoothstep(
    d.f32(0.0),
    d.f32(0.8),
    distFromCenter,
  );

  const xDisplacement = noiseValX * distortionMaskX * d.f32(0.2);

  const flareMask = std.pow(distFromCenter, d.f32(2.0));

  const flareStrength = d.f32(0.5);

  const xScale = d.f32(1.0) - flareMask * flareStrength;

  const uvXCentered = uv.x - d.f32(0.5);
  const flaredX = d.f32(0.5) + uvXCentered * xScale;

  const flaredUV = d.vec2f(flaredX, uv.y);
  let flowUV = flaredUV.add(d.vec2f(xDisplacement, yDisplacement));

  const distToCursor = std.abs(uv.sub(mouseUV));

  const repelFalloff = std.smoothstep(d.f32(0.03), d.f32(0.0), distToCursor.x);

  const toMouseDir = mouseUV.sub(uv);

  const repelForce = d.f32(1.0);
  const repelOffset = toMouseDir.mul(repelFalloff * repelForce);

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

  const alphaSDF = std.smoothstep(d.f32(0.0), d.f32(100.0), -distSDF + 30.0);

  const alphaBase = std.smoothstep(d.f32(0.0), d.f32(1.0), -distSDFBase);

  const alpha = std.max(alphaSDF, alphaBase * d.f32(0.9));

  const alphaClamped = std.saturate(alpha);

  const negativeFlareMask = 1.0 - std.pow(flareMask, d.f32(0.5));

  const premulR = rgb.x * alphaClamped * negativeFlareMask;
  const premulG = rgb.y * alphaClamped * negativeFlareMask;
  const premulB = rgb.z * alphaClamped * negativeFlareMask;
  return d.vec4f(premulR, premulG, premulB, alphaClamped * negativeFlareMask);
});

export interface WaterfallProps {
  text: string;
  font: FontConfig;
  padding?: number;
  style?: React.CSSProperties;
  className?: string;
}

export function Waterfall({
  text,
  font,
  padding = 150,
  style,
  className,
}: WaterfallProps) {
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
