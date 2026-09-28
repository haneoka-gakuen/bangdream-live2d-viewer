"use client";

import { OnCharacterSelect, OnModelSelect, OpenInHaneokaButtons } from "@/src/features/viewer/components/controls";

export function RemoteOnModelSection({
  activeModel,
  isBatching,
  isReloading,
  handleOnCharacterSelect,
  handleOnModelSelect,
  handleModelReload,
}) {
  return (
    <>
      <div className="control-group">
        <label className="text-xs font-bold text-gray-400 uppercase mb-1.5 block px-1">角色</label>
        <OnCharacterSelect
          onSelect={handleOnCharacterSelect}
          value={activeModel.characterId}
          disabled={isBatching}
        />
      </div>

      <div className="control-group">
        <div className="flex items-center justify-between gap-2 flex-wrap px-1 mb-1.5">
          <label className="text-xs font-bold text-gray-400 uppercase">模型</label>
          <div className="flex items-center gap-2 flex-wrap">
            <OpenInHaneokaButtons
              modelId={activeModel.modelId}
              disabled={isBatching}
              missingHint="请先选择一个在线模型"
            />
          </div>
        </div>
        <OnModelSelect
          characterId={activeModel.characterId}
          onSelect={handleOnModelSelect}
          value={activeModel.modelId}
          onReload={handleModelReload}
          disabled={isBatching}
          isReloading={isReloading}
        />
      </div>
    </>
  );
}
