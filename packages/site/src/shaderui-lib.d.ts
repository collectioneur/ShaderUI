declare module "shaderui" {
  import type { CSSProperties, RefObject } from "react";

  export interface FontConfig {
    family: string;
    size: number;
    weight?: number;
  }

  export type MaskSource =
    | { type: "text"; text: string; font: FontConfig }
    | { type: "image"; url: string }
    | { type: "svg"; node: SVGElement };

  export interface Padding {
    paddingTop: number;
    paddingRight: number;
    paddingBottom: number;
    paddingLeft: number;
  }

  export interface UniformBinding {
    accessor: unknown;
    struct: unknown;
    getValue: () => unknown;
  }

  export interface ShaderCanvasProps {
    source: MaskSource;
    fragment: unknown;
    uniformBindingsRef: RefObject<UniformBinding[]>;
    /** Padding per side: paddingTop, paddingRight, paddingBottom, paddingLeft. Partial = merged with defaults. */
    padding?: Partial<Padding>;
    style?: CSSProperties;
    className?: string;
  }

  export function getSize(
    source: MaskSource,
    padding?: Padding,
  ): { width: number; height: number };
  export function getMaskData(
    source: MaskSource,
    width: number,
    height: number,
    padding?: Padding,
  ): Uint32Array;
  export const ShaderCanvas: React.MemoExoticComponent<
    (props: ShaderCanvasProps) => JSX.Element
  >;

  /** SDF texture + sampler bind group layout; fragment shaders use distSampleLayout.$.distTexture and .$.sampler */
  export const distSampleLayout: { $: { distTexture: any; sampler: any } };

  export function createSDFPipeline(
    root: unknown,
    width: number,
    height: number,
  ): unknown;
  export type SDFPipelineRoot = unknown;

  export const distanceFrag: unknown;
  export const paramsAccessor: unknown;
  export const timeAccessor: unknown;
  export type VisualizationParams = unknown;
}
