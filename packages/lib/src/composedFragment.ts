import tgpu from "typegpu";
import * as d from "typegpu/data";
import * as std from "typegpu/std";
import {
  distSampleLayout,
  shaderCompositionAccessor,
  timeAccessor,
} from "./types.ts";

/**
 * Single fragment that composes shape (wave), color (gradient), and
 * interaction (cursor glow) in order: uv' = wave(uv), dist = SDF(uv'),
 * color = gradient(uv', dist), color = cursorGlow(color, cursor).
 */
export const composedFrag = tgpu["~unstable"].fragmentFn({
  in: { uv: d.vec2f },
  out: d.vec4f,
})(({ uv }) => {
  "use gpu";
  const t = timeAccessor.$;
  const p = shaderCompositionAccessor.$;

  // Shape: wave distortion (copy uv so we can reassign; arg refs can't be let)
  let sampleUV = d.vec2f(uv.x, uv.y);
  if (p.waveEnabled > 0) {
    const wave = p.wave;
    sampleUV = d.vec2f(
      uv.x + wave.amplitude * std.sin(uv.y * 50.0 + t * wave.speed),
      uv.y + wave.amplitude * std.cos(uv.x * 40.0 + t * wave.speed * 0.7),
    );
  }

  const dist = std.textureSample(
    distSampleLayout.$.distTexture,
    distSampleLayout.$.sampler,
    sampleUV,
  ).x;

  // SDF to alpha (inside text)
  const edge = 0.02;
  const alpha = std.smoothstep(d.f32(-edge), d.f32(edge), -dist);

  // Background: fully transparent (gradient only on text)
  if (alpha < 0.005) {
    return d.vec4f(0.0, 0.0, 0.0, 0.0);
  }

  // Color: gradient only inside text
  let color = d.vec3f(0.5, 0.5, 0.9);
  if (p.gradientEnabled > 0) {
    const g = p.gradient;
    const angleRad = (g.angle * 3.14159) / 180.0;
    const u = sampleUV.x * std.cos(angleRad) + sampleUV.y * std.sin(angleRad);
    const tGrad = std.smoothstep(d.f32(0.0), d.f32(1.0), u);
    color = std.mix(g.color0, g.color1, tGrad);
  } else {
    color = d.vec3f(0.5 + alpha * 0.5, 0.3 + alpha * 0.5, 0.8);
  }

  let outColor = d.vec4f(color.x, color.y, color.z, alpha);

  // Interaction: cursor glow
  if (p.cursorEnabled > 0 && alpha > 0.01) {
    const c = p.cursor;
    const dCursor = std.distance(sampleUV, c.cursorUV);
    const glow = std.smoothstep(c.radius, c.radius * 0.3, dCursor);
    const glowColor = d.vec3f(1.0, 0.9, 0.7);
    outColor = d.vec4f(
      std.mix(outColor.x, glowColor.x, glow * 0.8),
      std.mix(outColor.y, glowColor.y, glow * 0.8),
      std.mix(outColor.z, glowColor.z, glow * 0.8),
      std.max(outColor.w, glow * 0.5),
    );
  }

  // Premultiplied alpha for transparent canvas blending
  outColor = d.vec4f(
    outColor.x * outColor.w,
    outColor.y * outColor.w,
    outColor.z * outColor.w,
    outColor.w,
  );
  return outColor;
});
