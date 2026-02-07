import tgpu from "typegpu";
import * as d from "typegpu/data";
import * as std from "typegpu/std";
import { distSampleLayout, timeAccessor } from "./types.ts";

export const distanceFrag = tgpu["~unstable"].fragmentFn({
  in: { uv: d.vec2f },
  out: d.vec4f,
})(({ uv }) => {
  "use gpu";
  const t = timeAccessor.$;
  const newUV = d.vec2f(uv.x, uv.y);
  let dist = std.textureSample(
    distSampleLayout.$.distTexture,
    distSampleLayout.$.sampler,
    newUV
  ).x;

  let alp = -std.fract(dist * 0.03);
  const pulse = d.f32(1.0) + d.f32(0.05) * std.sin(t);
  if (dist * 0.03 < 3.0) {
    return d.vec4f(
      alp * alp * pulse + 0.5,
      alp * alp * pulse + 0.1,
      alp * alp * pulse + 0.1,
      1.0
    );
  }
  alp *= 10.0;
  return d.vec4f(1.0);
});
