import type { ComponentType } from "react";
import { Variant1OmniBar } from "@/components/variants/variant-1-omnibar";
import { Variant2Split } from "@/components/variants/variant-2-split";
import { Variant3GlobeCanvas } from "@/components/variants/variant-3-globe-canvas";
import { Variant4Cli } from "@/components/variants/variant-4-cli";
import { Variant5Receipt } from "@/components/variants/variant-5-receipt";

export type VariantMeta = {
  id: string;
  title: string;
  summary: string;
  Component: ComponentType;
};

export const VARIANTS: Record<string, VariantMeta> = {
  "1": {
    id: "1",
    title: "Omni bar",
    summary: "Search-sized URL field. Pins to top when results arrive.",
    Component: Variant1OmniBar,
  },
  "2": {
    id: "2",
    title: "Split instrument",
    summary: "Command rail left, live globe canvas right. No page change.",
    Component: Variant2Split,
  },
  "3": {
    id: "3",
    title: "Globe canvas",
    summary: "Globe is the environment from second one. URL floats on top.",
    Component: Variant3GlobeCanvas,
  },
  "4": {
    id: "4",
    title: "CLI strip",
    summary: "probe <url> — log streams in, globe follows.",
    Component: Variant4Cli,
  },
  "5": {
    id: "5",
    title: "Receipt unfold",
    summary: "Narrow slot prints a strip, then expands to full results.",
    Component: Variant5Receipt,
  },
};

export const VARIANT_LIST = Object.values(VARIANTS);
