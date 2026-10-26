import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HELP, HELP_SERVICES, isHelpService } from "@/shared/config/help";
import { HelpServiceView } from "@/views/help-service/ui/HelpServiceView";

export const dynamicParams = false;

export function generateStaticParams() {
  return HELP_SERVICES.map((service) => ({ service }));
}

export async function generateMetadata({
  params,
}: PageProps<"/help/[service]">): Promise<Metadata> {
  const { service } = await params;
  if (!isHelpService(service)) return {};
  return {
    title: `${HELP[service].label} 도움말 · vis-a-lot`,
    description: HELP[service].summary,
  };
}

export default async function HelpServicePage({
  params,
}: PageProps<"/help/[service]">) {
  const { service } = await params;
  if (!isHelpService(service)) notFound();
  return <HelpServiceView service={service} />;
}
