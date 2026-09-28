"use client";

import { getHaneokaLive2DUrl } from "@/src/config/urls";

const HANEOKA_SERVERS = [
  { key: "jp", label: "JP" },
  { key: "intl", label: "INTL" },
];

export function OpenInHaneokaButtons({ modelId, disabled = false, missingHint = "请先选择一个在线模型" }) {
  const open = (server) => {
    const url = getHaneokaLive2DUrl(server, modelId);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      {HANEOKA_SERVERS.map(({ key, label }) => {
        const enabled = !disabled && Boolean(modelId);
        return (
          <button
            key={key}
            type="button"
            onClick={() => open(key)}
            disabled={!enabled}
            className={`transition-all duration-300 transform active:scale-95 inline-flex items-center gap-1 ${enabled ? "text-gray-300 dark:text-gray-600 hover:text-[#E5004F]" : "text-gray-200 dark:text-gray-700"} ${enabled ? "" : "opacity-50 cursor-not-allowed"}`}
            title={enabled ? `在 haneoka (${label}) 中打开` : missingHint}
          >
            <img src="/haneoka.svg" alt="" className="w-3.5 h-3.5" />
            <span className="text-[10px] font-semibold uppercase">{label}</span>
          </button>
        );
      })}
    </>
  );
}
