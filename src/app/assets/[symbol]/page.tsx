import { AssetDetailClient } from "./AssetDetailClient";

export default async function AssetPage(
  props: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await props.params;
  return <AssetDetailClient symbol={symbol} />;
}

