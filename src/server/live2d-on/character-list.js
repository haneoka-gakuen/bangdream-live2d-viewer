import { onCharacters } from "@/src/server/catalog/on-characters";
import { getHaneokaLive2DIndex, isHaneokaOnSourceEnabled } from "./haneoka";
import { getOnLive2DInfoIndex } from "./model-index-cache";

const CACHE_DURATION = 60 * 1000;

let cachedList = null;

// characterKey ("001", "sub_mana") -> viewer id ("001", "sub-mana")
const toCharacterId = (characterKey) =>
  characterKey.startsWith("sub") ? characterKey.replace(/_/g, "-") : characterKey;

const pickHaneokaName = (characterName) => {
  if (!Array.isArray(characterName)) return null;
  const localized = characterName[3] || characterName[0];
  if (typeof localized !== "string" || !localized) return null;
  // Ave Mujica entries combine stage and real names ("Doloris / 三角初华").
  return localized.split(" / ").pop();
};

const compareCharacterIds = (a, b) =>
  Number(a.startsWith("sub")) - Number(b.startsWith("sub")) || a.localeCompare(b);

// haneoka catalog: keys and localized names come straight from the index.
async function discoverHaneokaCharacters() {
  const index = await getHaneokaLive2DIndex();
  const byKey = new Map();

  index.modelEntries.forEach((entry) => {
    if (!entry.characterKey || byKey.has(entry.characterKey)) return;
    byKey.set(entry.characterKey, { name: pickHaneokaName(entry.characterName), pathPrefixes: [] });
  });
  return byKey;
}

// private bucket: collapse the first directory segment ("001_adv" / "001_live"
// / "sub_mana") into a character key, keeping every raw prefix for matching.
function discoverR2Characters(modelDirectories) {
  const byKey = new Map();

  modelDirectories.forEach((modelDirectory) => {
    const firstSegment = String(modelDirectory).split("/")[0];
    if (!firstSegment) return;

    const characterKey = firstSegment.startsWith("sub") ? firstSegment : firstSegment.split("_")[0];
    if (!characterKey) return;

    const entry = byKey.get(characterKey) || { name: null, pathPrefixes: [] };
    if (!entry.pathPrefixes.includes(firstSegment)) {
      entry.pathPrefixes.push(firstSegment);
    }
    byKey.set(characterKey, entry);
  });
  return byKey;
}

// Characters present in the model source but missing from on-characters.js
// are merged in automatically (hand-written names and order win).
export async function getOnLive2DCharacters() {
  const now = Date.now();
  if (cachedList && now - cachedList.fetchedAt <= CACHE_DURATION) {
    return cachedList;
  }

  let discovered;
  if (isHaneokaOnSourceEnabled()) {
    discovered = await discoverHaneokaCharacters();
  } else {
    const info = await getOnLive2DInfoIndex();
    discovered = discoverR2Characters(info.modelDirectories);
  }

  const staticById = new Map(onCharacters.map((character) => [character.id, character]));
  const extras = [];

  discovered.forEach((info, characterKey) => {
    const id = toCharacterId(characterKey);
    if (staticById.has(id)) return;

    extras.push({
      id,
      name: info.name ? `${characterKey} ${info.name}` : characterKey,
      pathPrefixes: info.pathPrefixes.length > 0 ? info.pathPrefixes : [characterKey],
    });
  });

  const characters = [...onCharacters, ...extras].sort((a, b) => compareCharacterIds(a.id, b.id));
  cachedList = { characters, fetchedAt: now };
  return cachedList;
}
