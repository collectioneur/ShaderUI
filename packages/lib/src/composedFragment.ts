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

  // Neon Blur path (replaces standard color when enabled)

  if (p.neonBlurEnabled > 0) {
    const nb = p.neonBlur;
    // Увеличиваем масштаб аберрации, чтобы эффект был заметен
    const aberrationUV = nb.aberration * d.f32(0.02);

    // Сэмплируем 3 канала SDF со смещением
    const distR = std.textureSample(
      distSampleLayout.$.distTexture,
      distSampleLayout.$.sampler,
      d.vec2f(sampleUV.x + aberrationUV, sampleUV.y),
    ).x;
    const distG = std.textureSample(
      distSampleLayout.$.distTexture,
      distSampleLayout.$.sampler,
      sampleUV,
    ).x;
    const distB = std.textureSample(
      distSampleLayout.$.distTexture,
      distSampleLayout.$.sampler,
      d.vec2f(sampleUV.x - aberrationUV, sampleUV.y),
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

    let outColor = d.vec4f(resultColor, alpha);
    return outColor;

    // // ... (код курсора оставляем как есть) ...
    // if (p.cursorEnabled > 0) {
    //   const c = p.cursor;
    //   const dCursor = std.distance(sampleUV, c.cursorUV);
    //   const glowCursor = std.smoothstep(
    //     c.radius,
    //     c.radius * d.f32(0.3),
    //     dCursor,
    //   );
    //   const glowColorCursor = d.vec3f(1.0, 0.9, 0.7);

    //   outColor = d.vec4f(
    //     std.mix(outColor.x, glowColorCursor.x, glowCursor * d.f32(0.8)),
    //     std.mix(outColor.y, glowColorCursor.y, glowCursor * d.f32(0.8)),
    //     std.mix(outColor.z, glowColorCursor.z, glowCursor * d.f32(0.8)),
    //     std.max(outColor.w, glowCursor * d.f32(0.5)),
    //   );
    // }

    // // Premultiplied Alpha
    // return d.vec4f(
    //   outColor.x * outColor.w,
    //   outColor.y * outColor.w,
    //   outColor.z * outColor.w,
    //   outColor.w,
    // );
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
