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

  /** Spec for a single uniform: GPU schema + default value used when no getter is provided. */
  export interface UniformControlMeta {
    editable?: boolean;
    kind?: "range";
    label?: string;
    min?: number;
    max?: number;
    step?: number;
    group?: string;
    decimals?: number;
  }

  /** Spec for a single uniform: GPU schema + default value used when no getter is provided. */
  export interface UniformSpec<S = unknown> {
    schema: S;
    value: unknown;
    control?: UniformControlMeta;
  }

  export interface DefineUniformsResult<S extends Record<string, UniformSpec>> {
    /** Struct accessor `.$` — use inside `"use gpu"` code to read fields. */
    $: { [K in keyof S]: any };
    /** Original specs passed to defineUniforms (read-only reference). */
    readonly specs: Readonly<S>;
    /** Returns a single-entry UniformBinding[] (one GPU buffer for all fields). */
    createBindings(
      getters?: Partial<{ [K in keyof S]: () => unknown }>,
    ): UniformBinding[];
  }

  /**
   * Converts a flat record of `{ key: { schema, value } }` into TypeGPU
   * accessors (for the fragment shader) and a `createBindings()` helper
   * (for the React component).
   *
   * Call at **module level** — accessors must exist before the fragment fn.
   *
   * @example
   * const U = defineUniforms({
   *   SPIRAL_SPEED: { schema: d.f32,   value: 7.0 },
   *   COLOR_PRIMARY: { schema: d.vec4f, value: d.vec4f(0.87, 0.27, 0.23, 1) },
   *   time:          { schema: d.f32,   value: 0 },
   * });
   *
   * // In the shader:  const speed = U.SPIRAL_SPEED.$;
   * // In the component:
   * const uniformBindings = useRef(
   *   U.createBindings({ time: () => timeRef.current }),
   * );
   */
  export function defineUniforms<S extends Record<string, UniformSpec>>(
    specs: S,
  ): DefineUniformsResult<S>;

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
