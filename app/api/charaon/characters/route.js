import { NextResponse } from "next/server";
import { getOnLive2DCharacters } from "@/src/server/live2d-on/character-list";

export async function GET() {
  try {
    const { characters, fetchedAt } = await getOnLive2DCharacters();

    return NextResponse.json(
      { characters },
      {
        headers: {
          "Cache-Control": "public, max-age=60, s-maxage=300",
          ETag: `"on-characters-${characters.length}-${fetchedAt}"`,
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch ON characters" },
      { status: error.status || 500 },
    );
  }
}
