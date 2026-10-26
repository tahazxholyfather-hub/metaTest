import { describe, expect, it } from "vitest";
import { resolveSceneTrack, trackCatalog } from "../audio/music";

describe("optional music", () => {
  it("does not register a url for the tracks shipped with the game", () => {
    expect(resolveSceneTrack("home")).toBeNull();
    expect(resolveSceneTrack("game")).toBeNull();
  });

  it("does not register a url when the track file is absent", () => {
    const catalog = trackCatalog({});
    expect(resolveSceneTrack("home", catalog)).toBeNull();
    expect(resolveSceneTrack("game", catalog)).toBeNull();
  });

  it("uses only files that are present and does not add missing alternates", () => {
    const catalog = trackCatalog({
      "./tracks/home.mp3": "/assets/home.mp3",
      "./tracks/game.ogg": "/assets/game.ogg",
    });
    expect(resolveSceneTrack("home", catalog)).toBe("/assets/home.mp3");
    expect(resolveSceneTrack("game", catalog)).toBe("/assets/game.ogg");
    expect([...catalog.keys()].sort()).toEqual(["game.ogg", "home.mp3"]);
  });

  it("falls back to a bundled home track for the game scene", () => {
    const catalog = trackCatalog({ "./tracks/home.wav": "/assets/home.wav" });
    expect(resolveSceneTrack("game", catalog)).toBe("/assets/home.wav");
  });
});
