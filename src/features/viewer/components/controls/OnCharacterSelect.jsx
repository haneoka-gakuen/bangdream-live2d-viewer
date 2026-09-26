"use client";

import { SelectItem } from "@/components/ui/select";
import { getOnCharactersApiUrl } from "@/src/config/urls";
import { fetchJson } from "@/src/lib/fetchJson";
import { onCharacters } from "@/src/server/catalog/on-characters";
import { Users } from "lucide-react";
import { memo, useMemo } from "react";
import useSWR from "swr";
import { SelectField, selectItemClass } from "./shared/SelectField";

const OnCharacterSelect = memo(function OnCharacterSelect({ onSelect, value, disabled }) {
  // Static list first, then upgrade to /api/charaon/characters which merges
  // characters discovered from the model source into the right position.
  const { data } = useSWR(getOnCharactersApiUrl(), fetchJson, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
    fallbackData: { characters: onCharacters },
  });

  const characterList = useMemo(
    () => (Array.isArray(data?.characters) && data.characters.length > 0 ? data.characters : onCharacters),
    [data?.characters],
  );

  return (
    <SelectField
      value={value}
      onValueChange={onSelect}
      disabled={disabled}
      icon={Users}
      placeholder="请选择 Our Notes 角色..."
    >
      {characterList.map((character) => (
        <SelectItem key={character.id} value={character.id} className={selectItemClass}>
          {character.name}
        </SelectItem>
      ))}
    </SelectField>
  );
});

export { OnCharacterSelect };
