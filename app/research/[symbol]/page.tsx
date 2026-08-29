import { ResearchView } from "@/components/views/research-view";

export default async function Page({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  return <ResearchView symbol={symbol.toUpperCase()} />;
}
