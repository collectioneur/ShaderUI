import tgpu from "typegpu";
import * as d from "typegpu/data";
import * as std from "typegpu/std";
import {
  distSampleLayout,
  distWriteLayout,
  type FloodTexture,
  initFromMaskLayout,
  type MaskTexture,
  pingPongLayout,
  SampleResult,
} from "./types.ts";

export type SDFPipelineRoot = Awaited<ReturnType<typeof tgpu.init>>;

export function createSDFPipeline(
  root: SDFPipelineRoot,
  width: number,
  height: number
) {
  const offsetUniform = root.createUniform(d.i32);

  const textures = [0, 1].map(() =>
    root["~unstable"]
      .createTexture({
        size: [width, height],
        format: "rgba16float",
      })
      .$usage("storage")
  ) as [FloodTexture, FloodTexture];

  const maskTexture = root["~unstable"]
    .createTexture({
      size: [width, height],
      format: "r32uint",
    })
    .$usage("storage") as MaskTexture;

  const distanceTexture = root["~unstable"]
    .createTexture({
      size: [width, height],
      format: "rgba16float",
    })
    .$usage("storage", "sampled") as import("./types.ts").DistanceTexture;

  const filteringSampler = root["~unstable"].createSampler({
    magFilter: "linear",
    minFilter: "linear",
  });

  const initFromMaskBindGroup = root.createBindGroup(initFromMaskLayout, {
    maskTexture: maskTexture,
    writeView: textures[0],
  });

  const pingPongBindGroups = [0, 1].map((i) =>
    root.createBindGroup(pingPongLayout, {
      readView: textures[i],
      writeView: textures[1 - i],
    })
  );

  const distWriteBindGroup = root.createBindGroup(distWriteLayout, {
    distTexture: distanceTexture,
  });

  const renderBindGroup = root.createBindGroup(distSampleLayout, {
    distTexture: distanceTexture.createView(),
    sampler: filteringSampler,
  });

  const sampleWithOffset = (
    tex: d.textureStorage2d<"rgba16float", "read-only">,
    pos: d.v2i,
    offset: d.v2i
  ) => {
    "use gpu";
    const dims = std.textureDimensions(tex);
    const samplePos = pos.add(offset);

    const outOfBounds =
      samplePos.x < 0 ||
      samplePos.y < 0 ||
      samplePos.x >= d.i32(dims.x) ||
      samplePos.y >= d.i32(dims.y);

    const safePos = std.clamp(samplePos, d.vec2i(0), d.vec2i(dims.sub(1)));
    const loaded = std.textureLoad(tex, safePos);

    const inside = loaded.xy;
    const outside = loaded.zw;

    return SampleResult({
      inside: std.select(inside, d.vec2f(-1), outOfBounds),
      outside: std.select(outside, d.vec2f(-1), outOfBounds),
    });
  };

  const initFromMask = root["~unstable"].createGuardedComputePipeline(
    (x, y) => {
      "use gpu";
      const size = std.textureDimensions(initFromMaskLayout.$.writeView);
      const pos = d.vec2f(x, y);
      const uv = pos.div(d.vec2f(size));

      const mask = std.textureLoad(
        initFromMaskLayout.$.maskTexture,
        d.vec2i(x, y)
      ).x;

      const inside = mask > 0;
      const invalid = d.vec2f(-1);

      const insideCoord = std.select(invalid, uv, inside);
      const outsideCoord = std.select(uv, invalid, inside);

      std.textureStore(
        initFromMaskLayout.$.writeView,
        d.vec2i(x, y),
        d.vec4f(insideCoord, outsideCoord)
      );
    }
  );

  const jumpFlood = root["~unstable"].createGuardedComputePipeline((x, y) => {
    "use gpu";
    const offset = offsetUniform.$;
    const size = std.textureDimensions(pingPongLayout.$.readView);
    const pos = d.vec2f(x, y);

    let bestInsideCoord = d.vec2f(-1);
    let bestOutsideCoord = d.vec2f(-1);
    let bestInsideDist = 1e20;
    let bestOutsideDist = 1e20;

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const sample = sampleWithOffset(
          pingPongLayout.$.readView,
          d.vec2i(x, y),
          d.vec2i(dx * offset, dy * offset)
        );

        if (sample.inside.x >= 0) {
          const dInside = std.distance(pos, sample.inside.mul(d.vec2f(size)));
          if (dInside < bestInsideDist) {
            bestInsideDist = dInside;
            bestInsideCoord = d.vec2f(sample.inside);
          }
        }

        if (sample.outside.x >= 0) {
          const dOutside = std.distance(pos, sample.outside.mul(d.vec2f(size)));
          if (dOutside < bestOutsideDist) {
            bestOutsideDist = dOutside;
            bestOutsideCoord = d.vec2f(sample.outside);
          }
        }
      }
    }

    std.textureStore(
      pingPongLayout.$.writeView,
      d.vec2i(x, y),
      d.vec4f(bestInsideCoord, bestOutsideCoord)
    );
  });

  const createDistanceField = root["~unstable"].createGuardedComputePipeline(
    (x, y) => {
      "use gpu";
      const pos = d.vec2f(x, y);
      const size = std.textureDimensions(pingPongLayout.$.readView);
      const texel = std.textureLoad(pingPongLayout.$.readView, d.vec2i(x, y));

      const insideCoord = texel.xy;
      const outsideCoord = texel.zw;

      let insideDist = 1e20;
      let outsideDist = 1e20;

      if (insideCoord.x >= 0) {
        insideDist = std.distance(pos, insideCoord.mul(d.vec2f(size)));
      }

      if (outsideCoord.x >= 0) {
        outsideDist = std.distance(pos, outsideCoord.mul(d.vec2f(size)));
      }

      const signedDist = insideDist - outsideDist;

      std.textureStore(
        distWriteLayout.$.distTexture,
        d.vec2i(x, y),
        d.vec4f(signedDist, 0, 0, 0)
      );
    }
  );

  let sourceIdx = 0;
  function swap() {
    sourceIdx ^= 1;
  }

  function run(maskData: Uint32Array) {
    maskTexture.write(maskData);

    initFromMask.with(initFromMaskBindGroup).dispatchThreads(width, height);

    sourceIdx = 0;
    const maxRange = Math.floor(Math.max(width, height) / 2);
    let offset = maxRange;

    while (offset >= 1) {
      offsetUniform.write(offset);
      jumpFlood
        .with(pingPongBindGroups[sourceIdx])
        .dispatchThreads(width, height);
      swap();
      offset = Math.floor(offset / 2);
    }

    createDistanceField
      .with(pingPongBindGroups[sourceIdx])
      .with(distWriteBindGroup)
      .dispatchThreads(width, height);
  }

  function destroy() {
    for (const t of textures) {
      t.destroy();
    }
    maskTexture.destroy();
    distanceTexture.destroy();
  }

  return {
    run,
    renderBindGroup,
    distanceTexture,
    destroy,
  };
}
