import tgpu from "typegpu";
import * as d from "typegpu/data";
import type { AnyWgslData } from "typegpu/data";
import type { UniformBinding } from "./ShaderCanvas.tsx";

export type UniformSpec<S extends AnyWgslData = AnyWgslData> = {
  schema: S;
  value: unknown;
  control?: UniformControlMeta;
};

type UniformSpecs = Record<string, UniformSpec>;

export type UniformControlMeta = {
  /** Set to true to expose this uniform in UI controls. */
  editable?: boolean;
  /** Control widget kind. */
  kind?: "range";
  label?: string;
  min?: number;
  max?: number;
  step?: number;
  group?: string;
  decimals?: number;
};

type GettersOf<S extends UniformSpecs> = Partial<{
  [K in keyof S]: () => unknown;
}>;

type StructAccessor = ReturnType<(typeof tgpu)["~unstable"]["accessor"]>;

export type DefineUniformsResult<S extends UniformSpecs> = {
  /**
   * The struct accessor's `.$` field — use directly in `"use gpu"` code to
   * read individual uniform fields.
   *
   * @example
   * const fragment = tgpu["~unstable"].fragmentFn(...)(() => {
   *   "use gpu";
   *   const u = U.$;
   *   const speed = u.SPIRAL_SPEED;
   * });
   */
  $: StructAccessor["$"];
  /**
   * Original uniform specs passed to `defineUniforms` (read-only reference).
   * Useful for generating UI controls from a single source of truth.
   */
  readonly specs: Readonly<S>;

  /**
   * Builds the single-entry `UniformBinding[]` for `uniformBindingsRef`.
   *
   * Provide a getter only for keys whose value changes at runtime (e.g. time,
   * mouseUV). All other keys return their static default value from the spec.
   *
   * One struct = one GPU buffer = one bind group slot — well within WebGPU
   * limits regardless of how many fields you define.
   *
   * @example
   * const uniformBindings = useRef(
   *   U.createBindings({
   *     time:    () => timeRef.current,
   *     mouseUV: () => d.vec2f(...mouseUVRef.current),
   *   }),
   * );
   */
  createBindings(getters?: GettersOf<S>): UniformBinding[];
};

/**
 * Packs a flat record of `{ key: { schema, value } }` into a single WGSL
 * struct uniform. Returns the struct accessor (for use inside the fragment
 * shader) and a `createBindings()` helper (for the React component).
 *
 * All fields share ONE GPU buffer → ONE bind group slot, so this approach
 * scales to any number of constants without hitting WebGPU limits.
 *
 * Call at **module level** — TypeGPU requires accessors to exist before the
 * fragment function that references them.
 *
 * @example
 * // --- module level ---
 * const U = defineUniforms({
 *   SPIRAL_SPEED:  { schema: d.f32,   value: 7.0 },
 *   COLOR_PRIMARY: { schema: d.vec4f, value: d.vec4f(0.87, 0.27, 0.23, 1) },
 *   time:          { schema: d.f32,   value: 0 },
 * });
 *
 * const fragment = tgpu["~unstable"].fragmentFn(...)(() => {
 *   "use gpu";
 *   const u = U.$;
 *   const speed = u.SPIRAL_SPEED;
 *   const color = u.COLOR_PRIMARY;
 * });
 *
 * // --- inside component ---
 * const uniformBindings = useRef(
 *   U.createBindings({ time: () => timeRef.current }),
 * );
 */
export function defineUniforms<S extends UniformSpecs>(
  specs: S,
): DefineUniformsResult<S> {
  const schemaFields = Object.fromEntries(
    Object.entries(specs).map(([k, v]) => [k, v.schema]),
  ) as { [K in keyof S]: S[K]["schema"] };

  const structSchema = d.struct(schemaFields);
  const accessor: StructAccessor = tgpu["~unstable"].accessor(structSchema);

  function buildValue(getters?: GettersOf<S>): Record<string, unknown> {
    const value: Record<string, unknown> = {};
    for (const [key, spec] of Object.entries(specs)) {
      const getter = getters?.[key as keyof S];
      value[key] = getter ? getter() : spec.value;
    }
    return value;
  }

  function createBindings(getters?: GettersOf<S>): UniformBinding[] {
    return [
      {
        accessor,
        struct: structSchema,
        getValue: () => buildValue(getters),
      },
    ];
  }

  return {
    get $() {
      return accessor.$;
    },
    specs,
    createBindings,
  };
}
