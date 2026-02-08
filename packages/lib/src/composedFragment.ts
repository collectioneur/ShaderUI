import tgpu from "typegpu";
import * as d from "typegpu/data";
import * as std from "typegpu/std";
import { distSampleLayout, shaderCompositionAccessor } from "./types.ts";

/**
 * Single fragment: SDF sample then neonBlur when enabled, else minimal solid text.
 */
export const composedFrag = tgpu["~unstable"].fragmentFn({
  in: { uv: d.vec2f },
  out: d.vec4f,
})(({ uv }) => {
  "use gpu";
  const p = shaderCompositionAccessor.$;

  // Neon Blur path (when enabled)
  if (p.neonBlurEnabled > 0) {
    const nb = p.neonBlur;
    const aberrationUV = nb.aberration * d.f32(0.02);

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

    // --- ИСПРАВЛЕННАЯ МАТЕМАТИКА СВЕЧЕНИЯ ---

    // 1. Core (Белая сердцевина текста)
    // Используем жесткий smoothstep для четкого центра
    const coreMask = std.smoothstep(d.f32(1.0), d.f32(0.0), distG * 0.02);

    // 2. Glow (Свечение)
    // Используем экспоненту или инвертированный smoothstep для внешнего свечения
    // Трюк: берем smoothstep от radius до 0.0. Чем ближе к тексту (0.0), тем ярче (1.0).
    const glowRadius = std.max(nb.radius * d.f32(0.1), d.f32(0.001)); // Защита от 0

    // Считаем интенсивность для каждого канала отдельно (Inside + Outside)
    // Если dist < 0 (внутри), glow будет 1.0. Если dist > 0 (снаружи), он затухает.
    const glowR =
      (d.f32(1.0) - std.smoothstep(d.f32(0.0), glowRadius, distR * 0.001)) *
      nb.intensity;
    const glowG =
      (d.f32(1.0) - std.smoothstep(d.f32(0.0), glowRadius, distG * 0.001)) *
      nb.intensity;
    const glowB =
      (d.f32(1.0) - std.smoothstep(d.f32(0.0), glowRadius, distB * 0.001)) *
      nb.intensity;

    // // --- ЦВЕТА ---

    // // Градиент цвета самого неона (меняется от центра к краю)
    // // distG < 0 (внутри) -> 1.0, distG > 0 (снаружи) -> 0.0
    const colorMixFactor = std.smoothstep(
      glowRadius,
      d.f32(0.0),
      distG * 0.001,
    );
    const neonColor = std.mix(
      nb.colorSecondary,
      nb.colorPrimary,
      colorMixFactor,
    );

    // // Собираем итоговый цвет свечения
    const finalGlow = d.vec3f(
      glowR * neonColor.x,
      glowG * neonColor.y,
      glowB * neonColor.z,
    );

    // // // Смешиваем: Белый центр + Цветное свечение
    const resultColor = std.mix(finalGlow, d.vec3f(1.0, 1.0, 1.0), coreMask);

    // return d.vec4f(resultColor.x, resultColor.y, resultColor.z, 1.0);

    // // --- ИСПРАВЛЕННАЯ ПРОЗРАЧНОСТЬ ---

    // Альфа зависит от самого сильного канала свечения
    let alpha = std.max(glowR, std.max(glowG, glowB));

    // // Усиливаем альфу, чтобы свечение было видно
    alpha = std.pow(alpha, d.f32(0.8)); // Гамма-коррекция для мягкости

    // // ВАЖНО: Возвращаем полную прозрачность, если альфа слишком мала
    // if (alpha < d.f32(0.01)) {
    //   return d.vec4f(0.0); // <--- БЫЛО vec4f(0,0,0,1)
    // }

    // return d.vec4f(resultColor.x, resultColor.y, resultColor.z, alpha);

    const outColor = d.vec4f(resultColor, alpha);
    return outColor;
  }

  // Fallback when neonBlur disabled: SDF-based alpha, single color, premultiplied
  const dist = std.textureSample(
    distSampleLayout.$.distTexture,
    distSampleLayout.$.sampler,
    uv,
  ).x;
  const edge = 0.02;
  const alpha = std.smoothstep(d.f32(-edge), d.f32(edge), -dist);
  if (alpha < 0.005) {
    return d.vec4f(0.0, 0.0, 0.0, 0.0);
  }
  const color = d.vec3f(0.5 + alpha * 0.5, 0.3 + alpha * 0.5, 0.8);
  const outColor = d.vec4f(
    color.x * alpha,
    color.y * alpha,
    color.z * alpha,
    alpha,
  );
  return outColor;
});
