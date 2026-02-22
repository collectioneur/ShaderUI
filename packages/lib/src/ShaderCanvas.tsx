import React, { useRef, useEffect, useCallback, useState } from "react";
import tgpu from "typegpu";
import { fullScreenTriangle } from "typegpu/common";
import { createSDFPipeline } from "./sdfPipeline.ts";
import type { FontConfig, MaskSource } from "./types.ts";

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
  padding: number,
): Uint32Array {
  const textCanvas = document.createElement("canvas");
  textCanvas.width = width;
  textCanvas.height = height;
  const textCtx = textCanvas.getContext("2d") as CanvasRenderingContext2D;
  const dpr = window.devicePixelRatio ?? 1;
  textCtx.scale(dpr, dpr);
  const fontStr = `${font.weight ?? 600} ${font.size}px ${font.family}, sans-serif`;
  textCtx.font = fontStr;
  textCtx.fillText(text, padding, padding + font.size);
  const imageData = textCtx.getImageData(0, 0, width, height);
  const maskData = new Uint32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    maskData[i] = imageData.data[i * 4 + 3] > 128 ? 1 : 0;
  }
  return maskData;
}

export function getSize(
  source: MaskSource,
  padding: number = 150,
): { width: number; height: number } {
  switch (source.type) {
    case "text": {
      const { width, height } = measureTextSize(source.text, source.font);
      return {
        width: width + 2 * padding,
        height: height + 2 * padding,
      };
    }
    case "image":
    case "svg":
      return { width: 0, height: 0 };
    default:
      return { width: 0, height: 0 };
  }
}

export function getMaskData(
  source: MaskSource,
  width: number,
  height: number,
  padding: number = 150,
): Uint32Array {
  switch (source.type) {
    case "text":
      return createMaskFromText(
        width,
        height,
        source.text,
        source.font,
        padding,
      );
    case "image":
    case "svg":
      return new Uint32Array(width * height);
    default:
      return new Uint32Array(width * height);
  }
}

/** Single uniform binding: accessor + struct type + getter for current value. */
export interface UniformBinding {
  accessor: unknown;
  struct: unknown;
  getValue: () => unknown;
}

export interface ShaderCanvasProps {
  /** Mask source (text, image URL, or SVG). Only text is implemented. */
  source: MaskSource;
  /** Fragment shader (TypeGPU fragmentFn). Must sample SDF from distSampleLayout. */
  fragment: unknown;
  /** Ref to uniform bindings array. getValue() is called each frame on the GPU loop. */
  uniformBindingsRef: React.RefObject<UniformBinding[]>;
  /** Padding around the mask content (e.g. text). Default 150. */
  padding?: number;
  style?: React.CSSProperties;
  className?: string;
}

export const ShaderCanvas = React.memo(function ShaderCanvas({
  source,
  fragment,
  uniformBindingsRef,
  padding = 150,
  style = {},
  className,
}: ShaderCanvasProps) {
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
  const uniformsRef = useRef<{ write: (v: unknown) => void }[]>([]);
  const renderPipelineRef = useRef<unknown>(null);
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
      const maskData = getMaskData(source, width, height, padding);
      pipeline.run(maskData);
    },
    [source, padding],
  );

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const { width: cssW, height: cssH } = getSize(source, padding);
    if (cssW <= 0 || cssH <= 0) return;
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

      const bindings = uniformBindingsRef.current ?? [];
      const uniforms: { write: (v: unknown) => void }[] = [];
      let builder: unknown = root["~unstable"];
      for (let i = 0; i < bindings.length; i++) {
        const b = bindings[i];
        const uniform = (
          root.createUniform(
            b.struct as Parameters<typeof root.createUniform>[0],
            b.getValue() as Parameters<typeof root.createUniform>[1],
          ) as { write: (v: unknown) => void; $name: (n: string) => unknown }
        ).$name(`u_${i}`) as { write: (v: unknown) => void };
        uniforms.push({ write: uniform.write.bind(uniform) });
        builder = (
          builder as { with: (accessor: unknown, resource: unknown) => unknown }
        ).with(b.accessor, uniform);
      }
      uniformsRef.current = uniforms;

      await runPipeline(root, width, height);
      if (cancelled) return;

      const pipelineBuilder = builder as {
        withVertex: (v: unknown) => {
          withFragment: (
            f: unknown,
            opts: { format: GPUTextureFormat },
          ) => { createPipeline: () => unknown };
        };
      };

      root.device.pushErrorScope("validation");
      const renderPipeline = pipelineBuilder
        .withVertex(fullScreenTriangle)
        .withFragment(fragment, { format: presentationFormat })
        .createPipeline();
      const gpuError = await root.device.popErrorScope();
      if (gpuError) {
        console.error(
          "[ShaderCanvas] Pipeline creation error:",
          gpuError.message,
        );
      }
      renderPipelineRef.current = renderPipeline;

      function render() {
        if (cancelled || !sdfPipelineRef.current || !renderPipelineRef.current)
          return;
        const rootVal = rootRef.current;
        if (!rootVal) return;
        const bindingsNow = uniformBindingsRef.current ?? [];
        const uniformsNow = uniformsRef.current;
        for (let i = 0; i < uniformsNow.length && i < bindingsNow.length; i++) {
          uniformsNow[i].write(bindingsNow[i].getValue());
        }
        const colorAttachment = {
          view: ctx.getCurrentTexture().createView(),
          loadOp: "clear" as const,
          clearValue: [0, 0, 0, 0],
          storeOp: "store" as const,
        };
        const rp = renderPipelineRef.current as {
          with: (a: unknown) => {
            withColorAttachment: (c: unknown) => { draw: (n: number) => void };
          };
        };
        const rp1 = rp.with(sdfPipelineRef.current.renderBindGroup);
        rp1.withColorAttachment(colorAttachment).draw(3);
        rafRef.current = requestAnimationFrame(render);
      }
      requestAnimationFrame(render);
    };

    init();
    return () => {
      uniformsRef.current = [];
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
  }, [runPipeline, source, fragment]);

  return (
    <div
      ref={containerRef}
      style={{
        display: "inline-block",
        backgroundColor: "transparent",
        ...style,
        ...(containerSize && {
          width: containerSize.width,
          height: containerSize.height,
        }),
      }}
      className={className}
    >
      <canvas
        ref={canvasRef}
        style={{ display: "block", backgroundColor: "transparent" }}
      />
    </div>
  );
});
