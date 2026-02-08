import React, { useRef, useEffect, useCallback, useState } from "react";
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

const PADDING = 150;

function measureTextSize(
  text: string,
  font: FontConfig,
): { width: number; height: number } {
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
  font: FontConfig,
): Uint32Array {
  const textCanvas = document.createElement("canvas");
  textCanvas.width = width;
  textCanvas.height = height;
  const textCtx = textCanvas.getContext("2d") as CanvasRenderingContext2D;
  const dpr = window.devicePixelRatio ?? 1;
  textCtx.scale(dpr, dpr);
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
  neonBlurEnabled: number;
  neonBlur: {
    intensity: number;
    radius: number;
    aberration: number;
    colorPrimary: ReturnType<typeof d.vec3f>;
    colorSecondary: ReturnType<typeof d.vec3f>;
  };
}

function buildCompositionParams(shaders: ShaderConfig[]): CompositionParamsValue {
  const neonBlur = shaders.find((s) => s.id === "neonBlur");
  const neonBlurDef = getShaderDef("neonBlur");
  const neonBlurProps = (neonBlur?.props ?? neonBlurDef?.defaultProps) as {
    intensity?: number;
    radius?: number;
    aberration?: number;
    colorPrimary?: [number, number, number];
    colorSecondary?: [number, number, number];
  };

  return {
    neonBlurEnabled: shaders.some((s) => s.id === "neonBlur") ? 1 : 0,
    neonBlur: {
      intensity: neonBlurProps?.intensity ?? 1.5,
      radius: neonBlurProps?.radius ?? 8,
      aberration: neonBlurProps?.aberration ?? 2,
      colorPrimary: d.vec3f(
        neonBlurProps?.colorPrimary?.[0] ?? 0.2,
        neonBlurProps?.colorPrimary?.[1] ?? 0.8,
        neonBlurProps?.colorPrimary?.[2] ?? 1.0,
      ),
      colorSecondary: d.vec3f(
        neonBlurProps?.colorSecondary?.[0] ?? 0.6,
        neonBlurProps?.colorSecondary?.[1] ?? 0.2,
        neonBlurProps?.colorSecondary?.[2] ?? 0.9,
      ),
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
  const [containerSize, setContainerSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const rootRef = useRef<Awaited<ReturnType<typeof tgpu.init>> | null>(null);
  const sdfPipelineRef = useRef<ReturnType<typeof createSDFPipeline> | null>(
    null,
  );
  const timeUniformRef = useRef<{ write: (v: number) => void } | null>(null);
  const compositionUniformRef = useRef<{
    write: (v: CompositionParamsValue) => void;
  } | null>(null);
  const renderPipelineRef = useRef<unknown>(null);
  const shadersRef = useRef<ShaderConfig[]>(shaders);
  shadersRef.current = shaders;
  const rafRef = useRef<number>(0);

  const runPipeline = useCallback(
    async (
      root: Awaited<ReturnType<typeof tgpu.init>>,
      width: number,
      height: number,
    ) => {
      if (sdfPipelineRef.current) {
        sdfPipelineRef.current.destroy();
      }
      const pipeline = createSDFPipeline(root, width, height);
      sdfPipelineRef.current = pipeline;
      const maskData = createMaskFromText(width, height, text, font);
      pipeline.run(maskData);
    },
    [text, font],
  );

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const { width: measuredW, height: measuredH } = measureTextSize(text, font);
    console.log(measuredW, measuredH);
    const cssW = measuredW + 2 * PADDING;
    const cssH = measuredH + 2 * PADDING;
    console.log(cssW, cssH);
    setContainerSize({ width: cssW, height: cssH });

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
        buildCompositionParams(shaders),
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
        compositionUniform.write(buildCompositionParams(shadersRef.current));
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
    compositionUniformRef.current?.write?.(buildCompositionParams(shaders));
  }, [shaders]);

  return (
    <div
      ref={containerRef}
      style={{
        display: "inline-block",
        ...style,
        ...(containerSize && {
          width: containerSize.width,
          height: containerSize.height,
        }),
      }}
      className={className}
    >
      <canvas ref={canvasRef} style={{ display: "block" }} />
    </div>
  );
}
