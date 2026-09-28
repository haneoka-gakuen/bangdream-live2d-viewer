"use client";

import { Button } from "@/components/ui/button";
import { saveAs } from "file-saver";
import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { buildOnModelZip } from "@/src/features/viewer/lib/onModelDownload";

export function OnModelDownloadButton({ modelId, disabled = false }) {
  const [isPackaging, setIsPackaging] = useState(false);
  const [progress, setProgress] = useState(null);

  const handleDownload = async () => {
    if (!modelId || isPackaging) return;

    setIsPackaging(true);
    setProgress(null);
    try {
      const { fileName, blob } = await buildOnModelZip(modelId, {
        onProgress: (value) => setProgress(value),
      });
      saveAs(blob, fileName);
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.error("Our Notes model download failed:", error);
        window.alert(error instanceof Error ? error.message : "下载失败，请稍后重试。");
      }
    } finally {
      setIsPackaging(false);
      setProgress(null);
    }
  };

  const progressLabel =
    progress && progress.total > 0 ? `${progress.completed}/${progress.total}` : "...";

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleDownload}
      disabled={disabled || !modelId || isPackaging}
      className="h-11 w-11 shrink-0 rounded-xl border-[#E5004F]/20 dark:border-[#ff76a7]/25 bg-white/85 dark:bg-[#2a1d35]/70 hover:bg-[#E5004F]/10 hover:border-[#E5004F]/50 hover:text-[#E5004F] transition-all disabled:opacity-50 px-1 py-1"
      title={modelId ? "下载当前模型 ZIP" : "请先选择一个在线模型"}
    >
      <span className="flex h-full w-full flex-col items-center justify-center leading-none">
        {isPackaging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        <span className="mt-1 text-[8px] font-semibold uppercase tracking-tight">
          {isPackaging ? progressLabel : "ZIP"}
        </span>
      </span>
    </Button>
  );
}
