import { characters } from "./characters";

const UNCATEGORIZED_CATEGORY = "其他";
const UNCATALOGED_LABEL = "未收录角色";

// Characters discovered from model keys but missing from the hand-written
// catalog are appended as uncategorized entries so new models show up without
// waiting for a catalog update. Alias ids (e.g. bili server prefixes) already
// resolve to their base character, so they count as known too.
export function mergeGbpCharactersWithDiscovered(discoveredIds = []) {
  const knownIds = new Set();
  characters.forEach((character) => {
    knownIds.add(Number(character.id));
    (Array.isArray(character.alias) ? character.alias : [character.alias]).forEach((aliasId) => {
      const numericAliasId = Number(aliasId);
      if (Number.isFinite(numericAliasId)) {
        knownIds.add(numericAliasId);
      }
    });
  });

  const extras = Array.from(new Set(discoveredIds.map((id) => Number(id))))
    .filter((id) => Number.isFinite(id) && id > 0 && !knownIds.has(id))
    .sort((a, b) => a - b)
    .map((id) => ({
      id,
      name: `${String(id).padStart(3, "0")} ${UNCATALOGED_LABEL}`,
      category: [UNCATEGORIZED_CATEGORY],
    }));

  return extras.length > 0 ? [...characters, ...extras] : characters;
}
