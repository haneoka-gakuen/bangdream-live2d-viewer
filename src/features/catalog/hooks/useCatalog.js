"use client";

import useSWR from "swr";
import { getCharactersApiUrl } from "@/src/config/urls";
import { fetchJson } from "@/src/lib/fetchJson";
import { categories } from "@/src/server/catalog/categories";
import { characters } from "@/src/server/catalog/characters";

// The catalog starts from the hand-written lists (same first paint as
// before), then upgrades to the merged list from /api/characters which
// auto-appends characters discovered from the actual model indexes.
export function useCharacters() {
  const { data, error, isLoading } = useSWR(getCharactersApiUrl(), fetchJson, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
    fallbackData: { characters },
  });

  const mergedCharacters =
    Array.isArray(data?.characters) && data.characters.length > 0 ? data.characters : characters;

  return {
    characters: mergedCharacters,
    loading: isLoading && !data,
    error,
  };
}

export function useCategories() {
  return {
    categories,
    loading: false,
    error: null,
  };
}
