import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import * as d from "typegpu/data";

/** Sentinel UV meaning "pointer has not interacted yet". */
export const OFFSCREEN_POINTER_UV: [number, number] = [-2, -2];

export type InteractionPointerTypeCode = 0 | 1 | 2 | 3;

export interface InteractionSnapshot {
  /**
   * Local UV coordinates relative to InteractionArea host.
   * Intentionally not clamped, so values can be outside 0..1 when pointer leaves the area.
   */
  mouseUV: [number, number];
  pointerDownUV: [number, number];
  pointerDeltaUV: [number, number];
  pointerVelocityUV: [number, number];
  isPointerActive: number;
  isPointerDown: number;
  pointerType: InteractionPointerTypeCode;
  pressure: number;
}

export interface InteractionAreaProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

type InteractionContextValue = {
  snapshotRef: React.MutableRefObject<InteractionSnapshot>;
  hostRef: React.RefObject<HTMLDivElement | null>;
};

const InteractionContext = createContext<InteractionContextValue | null>(null);

function createInitialSnapshot(): InteractionSnapshot {
  return {
    mouseUV: [...OFFSCREEN_POINTER_UV],
    pointerDownUV: [...OFFSCREEN_POINTER_UV],
    pointerDeltaUV: [0, 0],
    pointerVelocityUV: [0, 0],
    isPointerActive: 0,
    isPointerDown: 0,
    pointerType: 0,
    pressure: 0,
  };
}

function pointerTypeToCode(pointerType: string): InteractionPointerTypeCode {
  switch (pointerType) {
    case "mouse":
      return 1;
    case "touch":
      return 2;
    case "pen":
      return 3;
    default:
      return 0;
  }
}

export function InteractionArea({ children, className, style }: InteractionAreaProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const snapshotRef = useRef<InteractionSnapshot>(createInitialSnapshot());
  const activePointerIdRef = useRef<number | null>(null);
  const lastEventTimestampRef = useRef<number | null>(null);

  const getLocalUV = useCallback((event: PointerEvent): [number, number] | null => {
    const host = hostRef.current;
    if (!host) return null;

    const rect = host.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    return [x, y];
  }, []);

  const isInsideHost = useCallback((event: PointerEvent) => {
    const host = hostRef.current;
    if (!host) return false;

    const rect = host.getBoundingClientRect();
    return (
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom
    );
  }, []);

  const updateFromPointer = useCallback(
    (event: PointerEvent, nextIsDown?: number) => {
      const uv = getLocalUV(event);
      if (!uv) return;

      const prev = snapshotRef.current;
      const dtSec =
        lastEventTimestampRef.current == null
          ? 0
          : Math.max((event.timeStamp - lastEventTimestampRef.current) / 1000, 1 / 240);

      const prevUv = prev.mouseUV;
      const isFirstSignal = prev.isPointerActive === 0;
      const delta: [number, number] = isFirstSignal
        ? [0, 0]
        : [uv[0] - prevUv[0], uv[1] - prevUv[1]];
      const velocity: [number, number] =
        dtSec > 0 ? [delta[0] / dtSec, delta[1] / dtSec] : [0, 0];

      const nextDown = nextIsDown ?? prev.isPointerDown;
      const pointerType = pointerTypeToCode(event.pointerType);
      const pressure =
        event.pointerType === "mouse"
          ? nextDown
            ? 1
            : 0
          : event.pressure > 0
            ? event.pressure
            : nextDown
              ? 1
              : 0;

      snapshotRef.current = {
        mouseUV: uv,
        pointerDownUV: nextDown && !prev.isPointerDown ? uv : prev.pointerDownUV,
        pointerDeltaUV: delta,
        pointerVelocityUV: velocity,
        isPointerActive: 1,
        isPointerDown: nextDown,
        pointerType,
        pressure,
      };
      lastEventTimestampRef.current = event.timeStamp;
    },
    [getLocalUV],
  );

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const activePointerId = activePointerIdRef.current;

      if (activePointerId == null) {
        if (!isInsideHost(event)) return;
        activePointerIdRef.current = event.pointerId;
      }

      if (activePointerIdRef.current !== event.pointerId) return;
      updateFromPointer(event);
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (!isInsideHost(event)) return;

      if (activePointerIdRef.current == null || activePointerIdRef.current === event.pointerId) {
        activePointerIdRef.current = event.pointerId;
        updateFromPointer(event, 1);
      }
    };

    const releasePointer = (event: PointerEvent) => {
      if (activePointerIdRef.current !== event.pointerId) return;
      updateFromPointer(event, 0);

      if (event.pointerType !== "mouse") {
        activePointerIdRef.current = null;
      }
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerdown", handlePointerDown, { passive: true });
    window.addEventListener("pointerup", releasePointer, { passive: true });
    window.addEventListener("pointercancel", releasePointer, { passive: true });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointerup", releasePointer);
      window.removeEventListener("pointercancel", releasePointer);
      snapshotRef.current = createInitialSnapshot();
      activePointerIdRef.current = null;
      lastEventTimestampRef.current = null;
    };
  }, [isInsideHost, updateFromPointer]);

  const value = useMemo<InteractionContextValue>(
    () => ({
      snapshotRef,
      hostRef,
    }),
    [],
  );

  return (
    <InteractionContext.Provider value={value}>
      <div ref={hostRef} className={className} style={style}>
        {children}
      </div>
    </InteractionContext.Provider>
  );
}

export function useInteraction() {
  const ctx = useContext(InteractionContext);
  if (!ctx) {
    throw new Error("useInteraction must be used inside <InteractionArea />.");
  }

  return {
    snapshotRef: ctx.snapshotRef,
    getSnapshot: () => ctx.snapshotRef.current,
  };
}

export function createShaderInteractionGetters(
  snapshotRef: React.MutableRefObject<InteractionSnapshot>,
) {
  return {
    mouseUV: () => {
      const [x, y] = snapshotRef.current.mouseUV;
      return d.vec2f(x, y);
    },
    pointerDownUV: () => {
      const [x, y] = snapshotRef.current.pointerDownUV;
      return d.vec2f(x, y);
    },
    pointerDeltaUV: () => {
      const [x, y] = snapshotRef.current.pointerDeltaUV;
      return d.vec2f(x, y);
    },
    pointerVelocityUV: () => {
      const [x, y] = snapshotRef.current.pointerVelocityUV;
      return d.vec2f(x, y);
    },
    isPointerActive: () => snapshotRef.current.isPointerActive,
    isPointerDown: () => snapshotRef.current.isPointerDown,
    pointerType: () => snapshotRef.current.pointerType,
    pressure: () => snapshotRef.current.pressure,
  };
}

export function useShaderInteractionUniforms() {
  const { snapshotRef } = useInteraction();

  return useMemo(() => {
    // TODO(v2): extend getters with multitouch/gesture fields.
    return createShaderInteractionGetters(snapshotRef);
  }, [snapshotRef]);
}
