import { notFound } from "next/navigation";
import { VARIANTS } from "@/components/variants/registry";
import "@/app/variants.css";

type Props = {
  params: Promise<{ id: string }>;
};

export function generateStaticParams() {
  return Object.keys(VARIANTS).map((id) => ({ id }));
}

export default async function VariantPage({ params }: Props) {
  const { id } = await params;
  const variant = VARIANTS[id];

  if (!variant) {
    notFound();
  }

  const Component = variant.Component;
  return <Component />;
}
