import React, { useRef, useEffect, useCallback } from "react";
import tgpu from "typegpu";
import * as d from "typegpu/data";
import { fullScreenTriangle } from "typegpu/common";
import { createSDFPipeline } from "./sdfPipeline.ts";
import {
  composedFrag,
  shaderCompositionAccessor,
  timeAccessor,
  getShaderDef,
  type ShaderConfig,
  type FontConfig,
} from "./index.ts";
import { ShaderCompositionParams } from "./types.ts";

const PADDING = 16;

function measureTextSize(text: string, font: FontConfig): { width: number; height: number } {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  const fontStr = `${font.weight ?? 600} ${font.size}px ${font.family}, sans-serif`;
  ctx.font = fontStr;
  const metrics = ctx.measureText(text);
  const width = Math.ceil(metrics.width);
  const height = Math.ceil((font.size ?? 48) * 1.2);
  return { width, height };
}

function createMaskFromText(
  width: number,
  height: number,
  text: string,
  font: FontConfig
): Uint32Array {
  const textCanvas = document.createElement("canvas");
  textCanvas.width = width;
  textCanvas.height = height;
  const textCtx = textCanvas.getContext("2d") as CanvasRenderingContext2D;
  const fontStr = `${font.weight ?? 600} ${font.size}px ${font.family}, sans-serif`;
  textCtx.font = fontStr;
  textCtx.fillText(text, PADDING, PADDING + font.size);
  const imageData = textCtx.getImageData(0, 0, width, height);
  const maskData = new Uint32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    maskData[i] = imageData.data[i * 4 + 3] > 128 ? 1 : 0;
  }
  return maskData;
}

interface CompositionParamsValue {
  waveEnabled: number;
  gradientEnabled: number;
  cursorEnabled: number;
  wave: { speed: number; amplitude: number };
  gradient: {
    angle: number;
    color0: ReturnType<typeof d.vec3f>;
    color1: ReturnType<typeof d.vec3f>;
  };
  cursor: { cursorUV: ReturnType<typeof d.vec2f>; radius: number };
}

function buildCompositionParams(
  shaders: ShaderConfig[],
  cursorUV: [number, number]
): CompositionParamsValue {
  const wave = shaders.find((s) => s.id === "wave");
  const gradient = shaders.find((s) => s.id === "gradient");
  const cursorGlow = shaders.find((s) => s.id === "cursorGlow");

  const waveDef = getShaderDef("wave");
  const gradientDef = getShaderDef("gradient");
  const cursorDef = getShaderDef("cursorGlow");

  const waveProps = (wave?.props ?? waveDef?.defaultProps) as {
    speed?: number;
    amplitude?: number;
  };
  const gradientProps = (gradient?.props ?? gradientDef?.defaultProps) as {
    angle?: number;
    color0?: [number, number, number];
    color1?: [number, number, number];
  };
  const cursorProps = (cursorGlow?.props ?? cursorDef?.defaultProps) as {
    radius?: number;
  };

  return {
    waveEnabled: shaders.some((s) => s.id === "wave") ? 1 : 0,
    gradientEnabled: shaders.some((s) => s.id === "gradient") ? 1 : 0,
    cursorEnabled: shaders.some((s) => s.id === "cursorGlow") ? 1 : 0,
    wave: {
      speed: waveProps?.speed ?? 1,
      amplitude: waveProps?.amplitude ?? 0.02,
    },
    gradient: {
      angle: gradientProps?.angle ?? 45,
      color0: d.vec3f(
        gradientProps?.color0?.[0] ?? 0.1,
        gradientProps?.color0?.[1] ?? 0.1,
        gradientProps?.color0?.[2] ?? 0.4
      ),
      color1: d.vec3f(
        gradientProps?.color1?.[0] ?? 0.9,
        gradientProps?.color1?.[1] ?? 0.4,
        gradientProps?.color1?.[2] ?? 0.2
      ),
    },
    cursor: {
      cursorUV: d.vec2f(cursorUV[0], cursorUV[1]),
      radius: cursorProps?.radius ?? 0.3,
    },
  };
}

export interface ShaderTextProps {
  text: string;
  font: FontConfig;
  shaders?: ShaderConfig[];
  style?: React.CSSProperties;
  className?: string;
}

export function ShaderText({
  text,
  font,
  shaders = [],
  style = {},
  className,
}: ShaderTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<Awaited<ReturnType<typeof tgpu.init>> | null>(null);
  const sdfPipelineRef = useRef<ReturnType<typeof createSDFPipeline> | null>(
    null
  );
  const timeUniformRef = useRef<{ write: (v: number) => void } | null>(null);
  const compositionUniformRef = useRef<{
    write: (v: CompositionParamsValue) => void;
  } | null>(null);
  const renderPipelineRef = useRef<unknown>(null);
  const cursorRef = useRef<[number, number]>([0.5, 0.5]);
  const shadersRef = useRef<ShaderConfig[]>(shaders);
  shadersRef.current = shaders;
  const rafRef = useRef<number>(0);

  const runPipeline = useCallback(
    async (
      root: Awaited<ReturnType<typeof tgpu.init>>,
      width: number,
      height: number
    ) => {
      if (sdfPipelineRef.current) {
        sdfPipelineRef.current.destroy();
      }
      const pipeline = createSDFPipeline(root, width, height);
      sdfPipelineRef.current = pipeline;
      const maskData = createMaskFromText(width, height, text, font);
      pipeline.run(maskData);
    },
    [text, font]
  );

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const { width: measuredW, height: measuredH } = measureTextSize(text, font);
    const cssW = measuredW + 2 * PADDING;
    const cssH = measuredH + 2 * PADDING;
    container.style.width = `${cssW}px`;
    container.style.height = `${cssH}px`;

    const dpr = window.devicePixelRatio ?? 1;
    const width = Math.max(1, Math.floor(cssW * dpr));
    const height = Math.max(1, Math.floor(cssH * dpr));
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;

    const init = async () => {
      const root = await tgpu.init();
      if (cancelled) return;
      rootRef.current = root;

      const context = canvas.getContext("webgpu") as GPUCanvasContext | null;
      if (!context) return;
      const ctx = context;
      const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
      ctx.configure({
        device: root.device,
        format: presentationFormat,
        alphaMode: "premultiplied",
      });

      const timeUniform = root.createUniform(d.f32);
      timeUniformRef.current = timeUniform;

      const compositionUniform = root.createUniform(
        ShaderCompositionParams,
        buildCompositionParams(shaders, cursorRef.current)
      );
      compositionUniformRef.current = compositionUniform;

      await runPipeline(root, width, height);
      if (cancelled) return;

      const renderPipeline = root["~unstable"]
        .with(timeAccessor, timeUniform)
        .with(shaderCompositionAccessor, compositionUniform)
        .withVertex(fullScreenTriangle)
        .withFragment(composedFrag, { format: presentationFormat })
        .createPipeline();
      renderPipelineRef.current = renderPipeline;

      function render() {
        if (cancelled || !sdfPipelineRef.current || !renderPipelineRef.current)
          return;
        const rootVal = rootRef.current;
        if (!rootVal) return;
        timeUniform.write(performance.now() / 1000);
        compositionUniform.write(
          buildCompositionParams(shadersRef.current, cursorRef.current)
        );
        const colorAttachment = {
          view: ctx.getCurrentTexture().createView(),
          loadOp: "clear" as const,
          clearValue: [0, 0, 0, 0],
          storeOp: "store" as const,
        };
        const rp = renderPipelineRef.current as {
          with: (a: unknown) => unknown;
        };
        const rp1 = rp.with(sdfPipelineRef.current.renderBindGroup) as {
          withColorAttachment: (c: unknown) => { draw: (n: number) => void };
        };
        rp1.withColorAttachment(colorAttachment).draw(3);
        rafRef.current = requestAnimationFrame(render);
      }
      requestAnimationFrame(render);
    };

    init();
    return () => {
      compositionUniformRef.current = null;
      timeUniformRef.current = null;
      renderPipelineRef.current = null;
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      if (sdfPipelineRef.current) {
        sdfPipelineRef.current.destroy();
        sdfPipelineRef.current = null;
      }
      if (rootRef.current) {
        rootRef.current.destroy();
        rootRef.current = null;
      }
    };
  }, [runPipeline, text, font]);

  useEffect(() => {
    compositionUniformRef.current?.write?.(
      buildCompositionParams(shaders, cursorRef.current)
    );
  }, [shaders]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      cursorRef.current = [x, y];
    },
    []
  );

  return (
    <div
      ref={containerRef}
      style={{ display: "inline-block", ...style }}
      className={className}
    >
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        style={{ display: "block" }}
      />
    </div>
  );
}
