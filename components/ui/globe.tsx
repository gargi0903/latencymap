"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Color, Fog, Group, PerspectiveCamera, Scene, Vector3 } from "three";
import ThreeGlobe from "three-globe";
import { Canvas, extend, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { cn } from "@/lib/utils";

type CountryFeature = {
  type: "Feature";
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
};

type CountryCollection = {
  features: CountryFeature[];
};

declare module "@react-three/fiber" {
  interface ThreeElements {
    threeGlobe: ThreeElements["mesh"] & {
      new (): ThreeGlobe;
    };
  }
}

extend({ ThreeGlobe });

const RING_PROPAGATION_SPEED = 3;
const aspect = 1.2;
const cameraZ = 300;

const DEFAULT_GLOBE_PROPS = {
  pointSize: 1,
  atmosphereColor: "#ffffff",
  showAtmosphere: true,
  atmosphereAltitude: 0.1,
  polygonColor: "rgba(255,255,255,0.7)",
  globeColor: "#1d072e",
  emissive: "#000000",
  emissiveIntensity: 0.1,
  shininess: 0.9,
  arcTime: 2000,
  arcLength: 0.9,
  rings: 1,
  maxRings: 3,
};

export type GlobeArc = {
  order: number;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  arcAlt: number;
  color: string;
};

export type GlobeConfig = {
  pointSize?: number;
  globeColor?: string;
  showAtmosphere?: boolean;
  atmosphereColor?: string;
  atmosphereAltitude?: number;
  emissive?: string;
  emissiveIntensity?: number;
  shininess?: number;
  polygonColor?: string;
  ambientLight?: string;
  directionalLeftLight?: string;
  directionalTopLight?: string;
  pointLight?: string;
  arcTime?: number;
  arcLength?: number;
  rings?: number;
  maxRings?: number;
  initialPosition?: {
    lat: number;
    lng: number;
  };
  autoRotate?: boolean;
  autoRotateSpeed?: number;
};

interface WorldProps {
  globeConfig: GlobeConfig;
  data: GlobeArc[];
  className?: string;
  sceneVariant?: "default" | "terminal";
}

export function Globe({ globeConfig, data, sceneVariant = "default" }: WorldProps) {
  const globeRef = useRef<ThreeGlobe | null>(null);
  const groupRef = useRef<Group>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [countries, setCountries] = useState<CountryCollection | null>(null);

  useEffect(() => {
    let cancelled = false;

    void import("@/data/globe.json").then((module) => {
      if (!cancelled) {
        setCountries(module.default as CountryCollection);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const globeProps = useMemo(
    () => ({
      ...DEFAULT_GLOBE_PROPS,
      ...globeConfig,
    }),
    [globeConfig],
  );

  useEffect(() => {
    if (!countries || globeRef.current || !groupRef.current) {
      return;
    }

    globeRef.current = new ThreeGlobe();
    groupRef.current.add(globeRef.current);

    globeRef.current
      .hexPolygonsData(countries.features)
      .hexPolygonResolution(2)
      .hexPolygonMargin(0.7)
      .showAtmosphere(globeProps.showAtmosphere)
      .atmosphereColor(globeProps.atmosphereColor)
      .atmosphereAltitude(globeProps.atmosphereAltitude)
      .hexPolygonColor(() => globeProps.polygonColor);

    setIsInitialized(true);
  }, [
    countries,
    globeProps.atmosphereAltitude,
    globeProps.atmosphereColor,
    globeProps.polygonColor,
    globeProps.showAtmosphere,
  ]);

  useEffect(() => {
    if (!globeRef.current || !isInitialized) return;

    const globeMaterial = globeRef.current.globeMaterial() as unknown as {
      color: Color;
      emissive: Color;
      emissiveIntensity: number;
      shininess: number;
    };
    globeMaterial.color = new Color(globeConfig.globeColor);
    globeMaterial.emissive = new Color(globeConfig.emissive);
    globeMaterial.emissiveIntensity = globeConfig.emissiveIntensity || 0.1;
    globeMaterial.shininess = globeConfig.shininess || 0.9;
  }, [
    isInitialized,
    globeConfig.globeColor,
    globeConfig.emissive,
    globeConfig.emissiveIntensity,
    globeConfig.shininess,
  ]);

  useEffect(() => {
    if (!globeRef.current || !isInitialized || !data) return;

    const probePoints = data.map((arc) => ({
      size: globeProps.pointSize,
      order: arc.order,
      color: arc.color,
      lat: arc.endLat,
      lng: arc.endLng,
    }));

    globeRef.current
      .arcsData(data)
      .arcStartLat((arc) => (arc as GlobeArc).startLat)
      .arcStartLng((arc) => (arc as GlobeArc).startLng)
      .arcEndLat((arc) => (arc as GlobeArc).endLat)
      .arcEndLng((arc) => (arc as GlobeArc).endLng)
      .arcColor((arc: unknown) => (arc as GlobeArc).color)
      .arcAltitude((arc) => (arc as GlobeArc).arcAlt)
      .arcStroke(() => [0.32, 0.28, 0.3][Math.round(Math.random() * 2)])
      .arcDashLength(globeProps.arcLength)
      .arcDashInitialGap((arc) => (arc as GlobeArc).order)
      .arcDashGap(15)
      .arcDashAnimateTime(() => globeProps.arcTime);

    globeRef.current
      .pointsData(probePoints)
      .pointColor((point) => (point as { color: string }).color)
      .pointsMerge(false)
      .pointAltitude(0)
      .pointRadius(sceneVariant === "terminal" ? 1.35 : 2);

    globeRef.current
      .ringsData([])
      .ringColor(() => globeProps.polygonColor)
      .ringMaxRadius(globeProps.maxRings)
      .ringPropagationSpeed(RING_PROPAGATION_SPEED)
      .ringRepeatPeriod((globeProps.arcTime * globeProps.arcLength) / globeProps.rings);
  }, [isInitialized, data, globeProps, sceneVariant]);

  useEffect(() => {
    if (sceneVariant === "terminal" || !globeRef.current || !isInitialized || !data.length) return;

    const interval = window.setInterval(() => {
      if (!globeRef.current) return;

      const ringIndexes = genRandomNumbers(0, data.length, Math.floor((data.length * 4) / 5));
      const ringsData = data
        .filter((_, index) => ringIndexes.includes(index))
        .map((arc) => ({
          lat: arc.endLat,
          lng: arc.endLng,
          color: arc.color,
        }));

      globeRef.current.ringsData(ringsData);
    }, 2000);

    return () => window.clearInterval(interval);
  }, [isInitialized, data, sceneVariant]);

  return <group ref={groupRef} />;
}

export function WebGLRendererConfig() {
  const { gl, size } = useThree();

  useEffect(() => {
    gl.setPixelRatio(window.devicePixelRatio);
    gl.setSize(size.width, size.height);
    gl.setClearColor(0x000000, 0);
  }, [gl, size.height, size.width]);

  return null;
}

export function World({ globeConfig, data, className, sceneVariant = "default" }: WorldProps) {
  const scene = useMemo(() => {
    const nextScene = new Scene();
    if (sceneVariant !== "terminal") {
      nextScene.fog = new Fog(0x000000, 400, 2000);
    }
    return nextScene;
  }, [sceneVariant]);
  const camera = useMemo(() => new PerspectiveCamera(50, aspect, 180, 1800), []);
  const ambientIntensity = sceneVariant === "terminal" ? 0.42 : 0.6;
  const pointIntensity = sceneVariant === "terminal" ? 0.18 : 0.8;

  return (
    <div className={cn("h-full w-full", className)}>
      <Canvas scene={scene} camera={camera} className="h-full w-full" gl={{ alpha: true, antialias: true }}>
        <WebGLRendererConfig />
        <ambientLight color={globeConfig.ambientLight} intensity={ambientIntensity} />
        <directionalLight color={globeConfig.directionalLeftLight} position={new Vector3(-400, 100, 400)} />
        <directionalLight color={globeConfig.directionalTopLight} position={new Vector3(-200, 500, 200)} />
        <pointLight color={globeConfig.pointLight} position={new Vector3(-200, 500, 200)} intensity={pointIntensity} />
        <Globe globeConfig={globeConfig} data={data} sceneVariant={sceneVariant} />
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          minDistance={cameraZ}
          maxDistance={cameraZ}
          autoRotateSpeed={globeConfig.autoRotateSpeed ?? 1}
          autoRotate={globeConfig.autoRotate ?? true}
          minPolarAngle={Math.PI / 3.5}
          maxPolarAngle={Math.PI - Math.PI / 3}
        />
      </Canvas>
    </div>
  );
}

export function genRandomNumbers(min: number, max: number, count: number) {
  const values: number[] = [];
  while (values.length < count) {
    const value = Math.floor(Math.random() * (max - min)) + min;
    if (!values.includes(value)) {
      values.push(value);
    }
  }

  return values;
}
