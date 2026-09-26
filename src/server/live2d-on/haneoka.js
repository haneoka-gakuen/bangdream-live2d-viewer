// Our Notes models served by the public haneoka.org catalog (backed by its R2
// release buckets): list from /api/v1/servers/{server}/live2d, descriptors from
// /runtime/{server}/live2d/{key}/model3.json. All FileReferences are rewritten
// to absolute haneoka URLs so the browser loads files directly (the endpoints
// are CORS-enabled); no per-file proxying is needed.
const DEFAULT_API_BASE = "https://haneoka.org";
const DEFAULT_LIVE2D_SERVER = "intl";
const CACHE_DURATION_MS = 60 * 1000;

const withoutTrailingSlash = (value) => String(value || "").replace(/\/+$/, "");

const HANEOKA_API_BASE = withoutTrailingSlash(process.env.HANEOKA_LIVE2D_API_BASE || DEFAULT_API_BASE);
const HANEOKA_LIVE2D_SERVER = process.env.HANEOKA_LIVE2D_SERVER || DEFAULT_LIVE2D_SERVER;

const HANEOKA_MODEL_ID_PATTERN = /^[0-9A-Za-z][0-9A-Za-z_-]*$/;

export const isHaneokaOnSourceEnabled = () => (process.env.LIVE2D_ON_SOURCE || "haneoka") !== "r2";

export const toHaneokaCharacterKey = (characterId) => String(characterId || "").replace(/-/g, "_");

export const isValidHaneokaModelId = (modelId) => HANEOKA_MODEL_ID_PATTERN.test(String(modelId || ""));

export const getHaneokaModelDirectoryUrl = (modelId) =>
  `${HANEOKA_API_BASE}/runtime/${HANEOKA_LIVE2D_SERVER}/live2d/${modelId}`;

const normalizePathSegments = (path = "") => {
  const stack = [];

  String(path)
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .split("/")
    .forEach((segment) => {
      if (!segment || segment === ".") return;
      if (segment === "..") {
        if (stack.length > 0) {
          stack.pop();
        }
        return;
      }
      stack.push(segment);
    });

  return stack.join("/");
};

const getBaseNameOf = (path = "") => normalizePathSegments(path).split("/").pop() || "";

// Absolute http(s)/data/blob refs pass through, site-absolute paths resolve
// against the API base origin, everything else against the model directory.
const resolveHaneokaFileUrl = (ref, modelDirectoryUrl) => {
  if (typeof ref !== "string" || !ref) return ref;
  if (/^(https?:|data:|blob:)/i.test(ref)) return ref;
  if (ref.startsWith("/")) return `${HANEOKA_API_BASE}${ref}`;
  return `${modelDirectoryUrl}/${normalizePathSegments(ref)}`;
};

let cachedIndex = null;

export async function getHaneokaLive2DIndex() {
  const now = Date.now();
  if (cachedIndex && now - cachedIndex.fetchedAt <= CACHE_DURATION_MS) {
    return cachedIndex;
  }

  const url = `${HANEOKA_API_BASE}/api/v1/servers/${HANEOKA_LIVE2D_SERVER}/live2d`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw Object.assign(new Error(`Haneoka live2d index unavailable (${response.status})`), {
      status: 502,
    });
  }

  const data = await response.json();
  cachedIndex = {
    data,
    modelEntries: Object.values(data || {}).filter(
      (entry) => entry && typeof entry.live2dKey === "string",
    ),
    fetchedAt: now,
  };
  return cachedIndex;
}

export function getHaneokaModelsForCharacter(index, characterId) {
  const characterKey = toHaneokaCharacterKey(characterId);

  return index.modelEntries
    .filter((entry) => entry.characterKey === characterKey)
    .sort((a, b) => a.live2dKey.localeCompare(b.live2dKey))
    .map((entry) => ({
      id: entry.live2dKey,
      label: entry.live2dKey,
      modelDirectory: `${HANEOKA_LIVE2D_SERVER}/live2d/${entry.live2dKey}`,
    }));
}

const toMotionGroupName = (motionFilePath = "") =>
  getBaseNameOf(motionFilePath).replace(/\.motion3\.json$/i, "").replace(/\.json$/i, "");

// One motion per group, keyed by the file basename — the same grouping the
// private-bucket flow produces, which the viewer's motion picker relies on.
const rewriteMotionGroups = (motions, modelDirectoryUrl) => {
  if (!motions || typeof motions !== "object") {
    return motions;
  }

  const groups = {};

  Object.values(motions).forEach((motionList) => {
    if (!Array.isArray(motionList)) return;

    motionList.forEach((motion) => {
      if (!motion || typeof motion !== "object") return;
      const rewrittenMotion = { ...motion };
      ["File", "file", "Sound", "sound"].forEach((key) => {
        if (typeof rewrittenMotion[key] === "string") {
          rewrittenMotion[key] = resolveHaneokaFileUrl(rewrittenMotion[key], modelDirectoryUrl);
        }
      });

      const groupName = toMotionGroupName(rewrittenMotion.File || rewrittenMotion.file || "");
      if (!groupName) return;
      groups[groupName] = [rewrittenMotion];
    });
  });

  return groups;
};

const normalizeHaneokaModelJson = (rawData, modelDirectoryUrl) => {
  const data = JSON.parse(JSON.stringify(rawData || {}));
  const references = data.FileReferences;

  if (!references || typeof references !== "object") {
    return data;
  }

  ["Moc", "Physics", "Pose", "DisplayInfo", "UserData"].forEach((key) => {
    if (typeof references[key] === "string") {
      references[key] = resolveHaneokaFileUrl(references[key], modelDirectoryUrl);
    }
  });

  if (Array.isArray(references.Textures)) {
    references.Textures = references.Textures.map((texture) =>
      resolveHaneokaFileUrl(texture, modelDirectoryUrl),
    );
  }

  if (Array.isArray(references.Expressions)) {
    references.Expressions = references.Expressions.map((expression) => {
      if (!expression || typeof expression !== "object" || typeof expression.File !== "string") {
        return expression;
      }
      return { ...expression, File: resolveHaneokaFileUrl(expression.File, modelDirectoryUrl) };
    });
  }

  references.Motions = rewriteMotionGroups(references.Motions, modelDirectoryUrl);
  data.url = `${modelDirectoryUrl}/`;
  return data;
};

const descriptorCache = new Map();

export async function getHaneokaOnModelDescriptor(modelId) {
  if (!isValidHaneokaModelId(modelId)) {
    throw Object.assign(new Error("Invalid Haneoka ON model id"), { status: 400 });
  }

  const cacheKey = String(modelId);
  const now = Date.now();
  const cached = descriptorCache.get(cacheKey);
  if (cached && now - cached.fetchedAt <= CACHE_DURATION_MS) {
    return cached;
  }

  const modelDirectoryUrl = getHaneokaModelDirectoryUrl(modelId);
  const response = await fetch(`${modelDirectoryUrl}/model3.json`, { cache: "no-store" });
  if (!response.ok) {
    throw Object.assign(new Error(`Haneoka model3.json unavailable (${response.status})`), {
      status: response.status === 404 ? 404 : 502,
    });
  }

  const rawData = await response.json();
  const nextCache = {
    modelId: cacheKey,
    modelDirectoryUrl,
    rawData,
    processedBuildData: normalizeHaneokaModelJson(rawData, modelDirectoryUrl),
    fetchedAt: now,
  };

  descriptorCache.set(cacheKey, nextCache);
  return nextCache;
}
