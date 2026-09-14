#!/usr/bin/env python3
"""Generate replaceable placeholder artwork and audio for Luma."""
from __future__ import annotations

import math
import struct
import wave
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "public" / "assets"


def write_png(path: Path, width: int, height: int, rgba: bytes) -> None:
    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    raw = b""
    stride = width * 4
    for y in range(height):
        raw += b"\x00" + rgba[y * stride : (y + 1) * stride]
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(png)


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def mix(c0: tuple[int, int, int], c1: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    t = max(0.0, min(1.0, t))
    return (
        int(lerp(c0[0], c1[0], t)),
        int(lerp(c0[1], c1[1], t)),
        int(lerp(c0[2], c1[2], t)),
    )


def noise(x: float, y: float) -> float:
    n = math.sin(x * 12.9898 + y * 78.233) * 43758.5453
    return n - math.floor(n)


def fbm(x: float, y: float) -> float:
    v = 0.0
    a = 0.5
    f = 1.0
    for _ in range(5):
        v += a * noise(x * f, y * f)
        a *= 0.5
        f *= 2.03
    return v


def draw_cover(
    width: int,
    height: int,
    top: tuple[int, int, int],
    bot: tuple[int, int, int],
    accent: tuple[int, int, int],
    motif: str,
) -> bytes:
    out = bytearray(width * height * 4)
    cx, cy = width * 0.5, height * 0.46
    for y in range(height):
        gy = y / max(1, height - 1)
        for x in range(width):
            gx = x / max(1, width - 1)
            n = fbm(gx * 4.2, gy * 4.2)
            col = mix(top, bot, gy * 0.85 + n * 0.15)
            # vignette
            dx = (gx - 0.5) * 1.6
            dy = (gy - 0.5) * 1.4
            vig = max(0.0, 1.0 - math.sqrt(dx * dx + dy * dy))
            col = mix((8, 9, 12), col, 0.35 + 0.65 * vig)

            if motif == "forest":
                sway = math.sin(gx * 18 + n * 4) * 0.02
                tree = 1.0 if gy > 0.62 + math.sin(gx * 40) * 0.03 + sway and abs((gx * 11) % 1 - 0.5) < 0.08 + (1 - gy) * 0.04 else 0.0
                canopy = 1.0 if ((gx - 0.5) ** 2) * 1.4 + ((gy - 0.42) ** 2) < 0.09 + n * 0.02 else 0.0
                if canopy:
                    col = mix(col, accent, 0.45)
                if tree:
                    col = mix(col, (28, 58, 40), 0.7)
            elif motif == "factory":
                beam = 1.0 if abs(gx - 0.5) < 0.012 and gy < 0.7 else 0.0
                gear = math.hypot(gx - 0.72, gy - 0.58)
                if 0.08 < gear < 0.16 and int((math.atan2(gy - 0.58, gx - 0.72) + 3.14) * 6) % 2:
                    col = mix(col, accent, 0.7)
                if gy > 0.78:
                    col = mix(col, (40, 36, 34), 0.8)
                if beam:
                    col = mix(col, (255, 196, 90), 0.55)
            elif motif == "space":
                if n > 0.82:
                    col = mix(col, (230, 240, 255), 0.9)
                ring = abs(math.hypot(gx - 0.5, gy - 0.48) - 0.18)
                if ring < 0.012:
                    col = mix(col, accent, 0.8)
                planet = math.hypot(gx - 0.5, gy - 0.48)
                if planet < 0.11:
                    col = mix(accent, (20, 24, 48), planet / 0.11)
            else:  # bio
                cell = math.hypot(gx - 0.5, gy - 0.46)
                if cell < 0.22:
                    col = mix(col, accent, 0.5 * (1 - cell / 0.22))
                if 0.18 < cell < 0.22:
                    col = mix(col, (255, 180, 200), 0.7)
                if n > 0.78 and gy > 0.3:
                    col = mix(col, (120, 255, 210), 0.35)

            # character disc
            d = math.hypot(x - cx, y - cy) / min(width, height)
            if d < 0.13:
                col = mix((245, 241, 234), (255, 255, 252), 0.3)
                # eyes
                ey = (y - cy) / min(width, height)
                ex = (x - cx) / min(width, height)
                for side in (-1, 1):
                    if abs(ex - side * 0.04) < 0.012 and abs(ey + 0.01) < 0.028:
                        col = (14, 14, 16)

            i = (y * width + x) * 4
            out[i : i + 4] = bytes((*col, 255))
    return bytes(out)


def draw_logo(width: int, height: int) -> bytes:
    out = bytearray(width * height * 4)
    cx, cy = width / 2, height / 2
    for y in range(height):
        for x in range(width):
            dx = (x - cx) / width
            dy = (y - cy) / height
            d = math.hypot(dx * 1.1, dy)
            col = (7, 8, 12)
            if d < 0.28:
                col = (245, 241, 234)
                ex = dx
                ey = dy + 0.01
                for side in (-0.07, 0.07):
                    if abs(ex - side) < 0.022 and abs(ey) < 0.055:
                        col = (14, 14, 16)
            elif d < 0.32:
                t = (0.32 - d) / 0.04
                col = mix((7, 8, 12), (245, 241, 234), t * 0.35)
            i = (y * width + x) * 4
            out[i : i + 4] = bytes((*col, 255))
    return bytes(out)


def draw_bg(width: int, height: int, top: tuple[int, int, int], bot: tuple[int, int, int], motif: str) -> bytes:
    out = bytearray(width * height * 4)
    for y in range(height):
        gy = y / max(1, height - 1)
        for x in range(width):
            gx = x / max(1, width - 1)
            n = fbm(gx * 3.0 + 2, gy * 3.0)
            col = mix(top, bot, gy)
            col = mix(col, accent_of(motif), n * 0.12)
            if motif == "space" and n > 0.84:
                col = (240, 245, 255)
            i = (y * width + x) * 4
            out[i : i + 4] = bytes((*col, 255))
    return bytes(out)


def accent_of(motif: str) -> tuple[int, int, int]:
    return {
        "forest": (90, 180, 120),
        "factory": (220, 140, 70),
        "space": (90, 150, 255),
        "bio": (255, 90, 140),
    }[motif]


def write_wav(path: Path, samples: list[float], rate: int = 22050) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        frames = b"".join(struct.pack("<h", max(-32767, min(32767, int(s * 32767)))) for s in samples)
        w.writeframes(frames)


def env(i: int, n: int, attack: float, release: float) -> float:
    a = int(n * attack)
    r = int(n * release)
    if i < a:
        return i / max(1, a)
    if i > n - r:
        return max(0.0, (n - i) / max(1, r))
    return 1.0


def tone(freq: float, seconds: float, rate: int = 22050, vol: float = 0.3, kind: str = "sine") -> list[float]:
    n = int(seconds * rate)
    out = []
    for i in range(n):
        t = i / rate
        phase = 2 * math.pi * freq * t
        if kind == "sine":
            s = math.sin(phase)
        elif kind == "tri":
            s = 2 * abs(2 * ((t * freq) % 1) - 1) - 1
        elif kind == "square":
            s = 1.0 if math.sin(phase) > 0 else -1.0
        else:
            s = math.sin(phase) + 0.3 * math.sin(phase * 2)
        out.append(s * vol * env(i, n, 0.02, 0.25))
    return out


def noise_burst(seconds: float, rate: int = 22050, vol: float = 0.2) -> list[float]:
    n = int(seconds * rate)
    seed = 12345
    out = []
    for i in range(n):
        seed = (1103515245 * seed + 12345) & 0x7FFFFFFF
        s = (seed / 0x7FFFFFFF) * 2 - 1
        out.append(s * vol * env(i, n, 0.001, 0.5))
    return out


def mix_samples(*tracks: list[float]) -> list[float]:
    n = max(len(t) for t in tracks)
    out = [0.0] * n
    for t in tracks:
        for i, s in enumerate(t):
            out[i] += s
    peak = max(1e-6, max(abs(s) for s in out))
    if peak > 0.95:
        out = [s * 0.95 / peak for s in out]
    return out


def loop_pad(chords: list[list[float]], seconds: float, rate: int = 22050) -> list[float]:
    n = int(seconds * rate)
    out = [0.0] * n
    step = n // max(1, len(chords))
    for ci, chord in enumerate(chords):
        for i in range(n):
            # slow crossfade between chords
            local = (i / step) - ci
            w = max(0.0, 1.0 - abs(local))
            if w <= 0:
                continue
            t = i / rate
            s = 0.0
            for f in chord:
                s += math.sin(2 * math.pi * f * t) * 0.18
                s += math.sin(2 * math.pi * f * 2 * t) * 0.04
            out[i] += s * w * env(i, n, 0.08, 0.08)
    peak = max(1e-6, max(abs(s) for s in out))
    return [s * 0.55 / peak for s in out]


def main() -> None:
    covers = {
        "game/cover-placeholder.png": ((18, 48, 42), (8, 12, 16), (120, 200, 140), "forest"),
        "seasons/season-1-cover.png": ((26, 80, 58), (12, 28, 24), (140, 220, 160), "forest"),
        "seasons/season-2-cover.png": ((40, 32, 28), (12, 12, 14), (230, 150, 70), "factory"),
        "seasons/season-3-cover.png": ((10, 16, 42), (6, 8, 16), (110, 170, 255), "space"),
        "seasons/season-4-cover.png": ((40, 10, 24), (12, 6, 14), (255, 90, 140), "bio"),
    }
    for rel, (top, bot, acc, motif) in covers.items():
        write_png(ASSETS / rel, 1280, 720, draw_cover(1280, 720, top, bot, acc, motif))

    write_png(ASSETS / "game/studio-logo-placeholder.png", 1024, 1024, draw_logo(1024, 1024))

    bgs = {
        "season-1/world-bg.png": ((90, 170, 190), (30, 70, 50), "forest"),
        "season-2/world-bg.png": ((40, 42, 48), (18, 16, 16), "factory"),
        "season-3/world-bg.png": ((8, 12, 32), (4, 6, 16), "space"),
        "season-4/world-bg.png": ((50, 16, 32), (16, 8, 16), "bio"),
    }
    for rel, (top, bot, motif) in bgs.items():
        write_png(ASSETS / rel, 1600, 900, draw_bg(1600, 900, top, bot, motif))

    # tiny 1x1 so UI keys always resolve
    write_png(ASSETS / "ui/white.png", 8, 8, bytes([255, 255, 255, 255] * 64))

    sfx = {
        "jump": tone(520, 0.12, vol=0.28, kind="sine") ,
        "bounce": mix_samples(tone(240, 0.16, vol=0.22, kind="tri"), tone(480, 0.12, vol=0.12)),
        "land": mix_samples(noise_burst(0.08, vol=0.12), tone(140, 0.1, vol=0.18, kind="tri")),
        "collect": mix_samples(tone(880, 0.12, vol=0.2), tone(1320, 0.16, vol=0.12)),
        "collect-rare": mix_samples(tone(660, 0.18, vol=0.2), tone(990, 0.22, vol=0.14), tone(1320, 0.26, vol=0.1)),
        "secret": mix_samples(tone(523, 0.2, vol=0.16), tone(659, 0.24, vol=0.14), tone(784, 0.3, vol=0.12)),
        "hit": mix_samples(noise_burst(0.12, vol=0.2), tone(90, 0.16, vol=0.25, kind="tri")),
        "damage": mix_samples(tone(180, 0.2, vol=0.22, kind="square"), noise_burst(0.14, vol=0.1)),
        "death": mix_samples(tone(90, 0.4, vol=0.22, kind="tri"), tone(70, 0.5, vol=0.12)),
        "enemy-hit": mix_samples(tone(320, 0.08, vol=0.18), noise_burst(0.08, vol=0.1)),
        "enemy-death": mix_samples(tone(200, 0.2, vol=0.16, kind="tri"), tone(140, 0.24, vol=0.12)),
        "ui-click": tone(740, 0.05, vol=0.18),
        "ui-hover": tone(520, 0.04, vol=0.08),
        "unlock": mix_samples(tone(392, 0.18, vol=0.16), tone(523, 0.22, vol=0.14), tone(784, 0.28, vol=0.12)),
        "level-complete": mix_samples(tone(523, 0.22, vol=0.16), tone(659, 0.28, vol=0.14), tone(784, 0.36, vol=0.12)),
        "spring": mix_samples(tone(300, 0.08, vol=0.16), tone(700, 0.14, vol=0.14)),
        "portal": mix_samples(tone(240, 0.2, vol=0.12, kind="sine"), tone(480, 0.22, vol=0.08)),
        "laser": tone(1400, 0.08, vol=0.08, kind="square"),
        "boss-hit": mix_samples(noise_burst(0.16, vol=0.22), tone(80, 0.2, vol=0.25, kind="tri")),
        "boss-phase": mix_samples(tone(110, 0.4, vol=0.2), tone(165, 0.45, vol=0.12)),
        "checkpoint": mix_samples(tone(640, 0.1, vol=0.14), tone(960, 0.14, vol=0.1)),
    }
    # jump needs a snappier envelope — already short
    for name, samples in sfx.items():
        write_wav(ASSETS / "audio" / "sfx" / f"{name}.wav", samples)

    music = {
        "menu": loop_pad([[220, 277, 330], [196, 247, 294], [174, 220, 261], [196, 247, 330]], 10.0),
        "season-1": loop_pad([[196, 247, 294], [220, 261, 330], [174, 220, 261], [246, 311, 370]], 12.0),
        "season-2": loop_pad([[110, 146, 164], [98, 130, 155], [123, 146, 185], [110, 138, 164]], 12.0),
        "season-3": loop_pad([[174, 220, 261], [196, 247, 311], [164, 220, 329], [146, 196, 277]], 14.0),
        "season-4": loop_pad([[130, 164, 196], [146, 174, 220], [123, 164, 185], [110, 146, 174]], 12.0),
        "boss": loop_pad([[98, 123, 146], [92, 116, 138], [110, 138, 164], [82, 110, 146]], 10.0),
    }
    for name, samples in music.items():
        write_wav(ASSETS / "audio" / "music" / f"{name}.wav", samples)

    print("assets written under", ASSETS)


if __name__ == "__main__":
    main()
