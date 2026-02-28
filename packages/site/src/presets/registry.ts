import type { ExamplePresetModule, PresetMeta } from "./types";
import { isPresetMeta } from "./types";

export type ExamplePreset = Omit<PresetMeta, "id"> & { id: string };

function fallbackIdFromPath(path: string): string {
  const fileName = path.split("/").pop() ?? "preset";
  return fileName.replace(/\.[^.]+$/, "").toLowerCase();
}

function toExamplePreset(path: string, meta: PresetMeta): ExamplePreset {
  return {
    ...meta,
    id: meta.id ?? fallbackIdFromPath(path),
  };
}

function warnDev(message: string): void {
  if (import.meta.env.DEV) {
    // Keep warnings dev-only to avoid noisy production logs.
    console.warn(message);
  }
}

function loadPresets(): ExamplePreset[] {
  const modules = import.meta.glob("./*.tsx", { eager: true });
  const result: ExamplePreset[] = [];
  const usedIds = new Set<string>();

  for (const [path, mod] of Object.entries(modules)) {
    const candidate = (mod as ExamplePresetModule).presetMeta;
    if (!isPresetMeta(candidate)) continue;

    const preset = toExamplePreset(path, candidate);
    if (usedIds.has(preset.id)) {
      warnDev(
        `[examples] Duplicate preset id "${preset.id}" in ${path}. Set a unique presetMeta.id.`,
      );
      continue;
    }

    usedIds.add(preset.id);
    result.push(preset);
  }

  result.sort((a, b) => a.name.localeCompare(b.name));
  return result;
}

export const presetRegistry = loadPresets();
