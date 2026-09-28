import JSZip from "jszip";

// Client-side packaging for Our Notes (haneoka) Live2D models, mirroring what
// haneoka.org's own viewer does on download: fetch the descriptor, download
// every FileReferences entry, and build a portable ZIP whose model3.json uses
// archive-relative paths. The runtime endpoints are CORS-enabled, so the
// browser can pull everything straight from haneoka with no server pipeline.
const FETCH_CONCURRENCY = 4;

const toDescriptorUrl = (modelId) => `/api/charaon/${encodeURIComponent(modelId)}/buildData.asset`;

const joinUrl = (base, ref) => {
  if (/^(https?:|data:|blob:)/i.test(ref)) return ref;
  const trimmedBase = String(base || "").replace(/\/+$/, "");
  return `${trimmedBase}/${String(ref).replace(/^\/+/, "")}`;
};

const toArchivePath = (fetchUrl, baseUrl) => {
  try {
    const refUrl = new URL(fetchUrl);
    const basePath = new URL(baseUrl).pathname;
    const refPath = decodeURIComponent(refUrl.pathname);
    if (refPath.startsWith(basePath)) {
      return refPath.slice(basePath.length).replace(/^\/+/, "");
    }
    return refPath.split("/").pop() || refPath;
  } catch {
    return String(fetchUrl).split("/").pop() || "resource";
  }
};

const collectReferences = (descriptor) => {
  const refs = new Set();
  const add = (value) => {
    if (typeof value === "string" && value) refs.add(value);
  };

  const walkMotionGroups = (motions) => {
    if (!motions || typeof motions !== "object") return;
    Object.values(motions).forEach((group) => {
      const list = Array.isArray(group) ? group : group?.Motion ?? group?.motion;
      if (!Array.isArray(list)) return;
      list.forEach((motion) => {
        if (!motion || typeof motion !== "object") return;
        add(motion.File || motion.file);
        add(motion.Sound || motion.sound);
      });
    });
  };

  const references = descriptor?.FileReferences;
  if (references && typeof references === "object") {
    ["Moc", "Physics", "Pose", "UserData", "DisplayInfo"].forEach((key) => add(references[key]));
    (Array.isArray(references.Textures) ? references.Textures : []).forEach(add);
    (Array.isArray(references.Expressions) ? references.Expressions : []).forEach(
      (expression) => expression && add(expression.File || expression.file),
    );
    walkMotionGroups(references.Motions);
    walkMotionGroups(references.MotionSync);
  }

  return [...refs];
};

const rewriteDescriptorPaths = (descriptor, resolveArchivePath) => {
  const clone = JSON.parse(JSON.stringify(descriptor));
  const rewrite = (value, depth = 0) => {
    if (depth > 8 || value == null || typeof value !== "object") {
      return typeof value === "string" ? resolveArchivePath(value) : value;
    }
    if (Array.isArray(value)) return value.map((item) => rewrite(item, depth + 1));
    const result = {};
    for (const [key, item] of Object.entries(value)) {
      if (key === "url") continue;
      result[key] = rewrite(item, depth + 1);
    }
    return result;
  };
  return rewrite(clone);
};

export async function buildOnModelZip(modelId, { signal, onProgress } = {}) {
  if (!modelId) throw new Error("请先选择一个在线模型");

  const descriptorResponse = await fetch(toDescriptorUrl(modelId), { signal });
  if (!descriptorResponse.ok) {
    throw new Error(`模型描述获取失败 (${descriptorResponse.status})`);
  }
  const descriptor = await descriptorResponse.json();

  const baseUrl =
    typeof descriptor?.url === "string" && descriptor.url
      ? descriptor.url
      : `/api/charaon/${encodeURIComponent(modelId)}/`;

  const refs = collectReferences(descriptor);
  onProgress?.({ stage: "resources", completed: 0, total: refs.length });

  const resources = new Map(
    refs.map((ref) => [ref, { fetchUrl: joinUrl(baseUrl, ref), bytes: null }]),
  );
  const queue = [...resources.values()];
  let completed = 0;

  const worker = async () => {
    for (;;) {
      const item = queue.shift();
      if (!item) return;
      const response = await fetch(item.fetchUrl, { signal });
      if (!response.ok) {
        throw new Error(`资源下载失败 (${response.status}): ${item.fetchUrl}`);
      }
      item.bytes = new Uint8Array(await response.arrayBuffer());
      completed += 1;
      onProgress?.({ stage: "resources", completed, total: refs.length });
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(FETCH_CONCURRENCY, queue.length || 1) }, () => worker()),
  );

  const resolveArchivePath = (value) => {
    if (typeof value !== "string" || !value) return value;
    if (/^(data:|blob:)/i.test(value)) return value;
    if (resources.has(value)) return toArchivePath(joinUrl(baseUrl, value), baseUrl);
    if (/^https?:/i.test(value)) return toArchivePath(value, baseUrl);
    return value;
  };

  const zip = new JSZip();
  const descriptorFileName = descriptor?.FileReferences
    ? `${modelId}.model3.json`
    : `${modelId}.model.json`;

  zip.file(
    descriptorFileName,
    JSON.stringify(rewriteDescriptorPaths(descriptor, resolveArchivePath), null, 2),
  );

  resources.forEach((entry) => {
    zip.file(toArchivePath(entry.fetchUrl, baseUrl), entry.bytes);
  });

  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
    mimeType: "application/zip",
  });

  return { fileName: `${modelId}.zip`, blob };
}
