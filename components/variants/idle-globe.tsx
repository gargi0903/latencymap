"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { GlobeProps } from "react-globe.gl";

const Globe = dynamic<GlobeProps>(() => import("react-globe.gl"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-[#6f8491]">Loading globe</div>,
});

type Props = {
  className?: string;
  label?: string;
};

export function IdleGlobe({ className, label = "Waiting for a URL" }: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = frameRef.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.floor(width), height: Math.floor(height) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={frameRef} className={cn("idle-globe", className)}>
      {size.width > 0 ? (
        <Globe
          width={size.width}
          height={size.height}
          backgroundColor="rgba(0,0,0,0)"
          globeImageUrl="/earth-texture.svg"
          bumpImageUrl="/earth-bump.svg"
          showAtmosphere
          atmosphereColor="#f6821f"
          atmosphereAltitude={0.14}
          pointsData={[]}
        />
      ) : null}
      <p className="idle-globe__label">{label}</p>
    </div>
  );
}
