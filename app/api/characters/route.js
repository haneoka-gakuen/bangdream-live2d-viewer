import { NextResponse } from "next/server";
import { collectAvailableCharacterIds } from "@/src/features/viewer/lib/characterAvailability";
import { filterOutGeneralLive2DModelKeys } from "@/src/features/viewer/lib/live2dRemoteUtils";
import { mergeGbpCharactersWithDiscovered } from "@/src/server/catalog/character-merge";
import { getModelIndex } from "@/src/server/live2d/model-index-cache";
import { getSpineModelIndex } from "@/src/server/spine/model-index-cache";
import { extractSpineModelIds } from "@/src/server/spine/remote";

export async function GET() {
  const discovered = new Set();
  const sources = [
    async () => Object.keys((await getModelIndex(false)).data || {}),
    async () => Object.keys((await getModelIndex(true)).data || {}),
    async () => extractSpineModelIds((await getSpineModelIndex()).data || {}),
  ];

  await Promise.all(
    sources.map(async (loadKeys) => {
      try {
        collectAvailableCharacterIds(filterOutGeneralLive2DModelKeys(await loadKeys())).forEach((id) => {
          discovered.add(id);
        });
      } catch {
        // A missing branch (e.g. no modified index in the bucket) just
        // contributes nothing; the catalog still merges the other sources.
      }
    }),
  );

  const characters = mergeGbpCharactersWithDiscovered(Array.from(discovered));

  return NextResponse.json(
    { characters, discoveredCharacterIds: Array.from(discovered).sort((a, b) => a - b) },
    {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=300",
        ETag: `"characters-${characters.length}-${discovered.size}"`,
      },
    },
  );
}
