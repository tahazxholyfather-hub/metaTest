#!/usr/bin/env python3
"""Generate replaceable placeholder artwork and audio for Gleam."""
from __future__ import annotations

import math
import os
import struct
import wave
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "public" / "assets"


def chunk(tag: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def write_png(path: Path, w: int, h: int, rgba: bytearray) -> None:
    raw = bytearray()
    stride = w * 4
    for y in range(h):
        raw.append(0)
        raw.extend(rgba[y * stride : (y + 1) * stride])
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)))
        f.write(chunk(b"IDAT", zlib.compress(bytes(raw), 9)))
        f.write(chunk(b"IEND", b""))


def lerp(a, b, t):
    return a + (b - a) * t


def mix(c1, c2, t):
    return tuple(int(lerp(a, b, t)) for a, b in zip(c1, c2))


def setp(buf, w, x, y, c):
    if 0 <= x < w and 0 <= y < (len(buf) // (w * 4)):
        i = (y * w + x) * 4
        buf[i : i + 4] = bytes([*c[:3], c[3] if len(c) > 3 else 255])


def disc(buf, w, cx, cy, r, col):
    r2 = r * r
    for y in range(int(cy - r), int(cy + r) + 1):
        for x in range(int(cx - r), int(cx + r) + 1):
            if (x - cx) ** 2 + (y - cy) ** 2 <= r2:
                setp(buf, w, x, y, col)


def ellipse(buf, w, cx, cy, rx, ry, col):
    for y in range(int(cy - ry), int(cy + ry) + 1):
        for x in range(int(cx - rx), int(cx + rx) + 1):
            if ((x - cx) / max(0.01, rx)) ** 2 + ((y - cy) / max(0.01, ry)) ** 2 <= 1:
                setp(buf, w, x, y, col)


def ball(buf, w, cx, cy, r):
    disc(buf, w, cx, cy, r, (245, 241, 234, 255))
    ellipse(buf, w, cx - r * 0.22, cy - r * 0.04, r * 0.09, r * 0.28, (14, 14, 16, 255))
    ellipse(buf, w, cx + r * 0.22, cy - r * 0.04, r * 0.09, r * 0.28, (14, 14, 16, 255))


def fill_grad(buf, w, h, top, bot, extra=None):
    for y in range(h):
        t = y / max(1, h - 1)
        c = mix(top, bot, t)
        for x in range(w):
            col = c
            if extra:
                col = extra(x, y, c)
            setp(buf, w, x, y, (*col, 255))


def hills(buf, w, h, color, baseline, amp, freq, phase=0):
    for x in range(w):
        y0 = int(baseline + math.sin(x / freq + phase) * amp)
        for y in range(y0, h):
            setp(buf, w, x, y, color)


def studio_logo():
    w, h = 1024, 1024
    buf = bytearray(w * h * 4)
    cx, cy, r = w // 2, h // 2, 210
    disc(buf, w, cx, cy, r + 18, (245, 241, 234, 255))
    disc(buf, w, cx, cy, r, (12, 11, 10, 255))
    disc(buf, w, cx, cy, 78, (245, 241, 234, 255))
    write_png(ROOT / "game" / "studio-logo-placeholder.png", w, h, buf)


def cover():
    w, h = 1600, 900
    buf = bytearray(w * h * 4)
    fill_grad(buf, w, h, (159, 214, 240), (215, 242, 200))
    hills(buf, w, h, (109, 191, 122, 255), h * 0.62, 28, 140, 0.2)
    hills(buf, w, h, (62, 140, 74, 255), h * 0.74, 18, 90, 1.1)
    ball(buf, w, w * 0.5, h * 0.48, 118)
    write_png(ROOT / "game" / "cover-placeholder.png", w, h, buf)


def season_cover(name, top, bot, mid, ground, ball_y=0.5):
    w, h = 1200, 800
    buf = bytearray(w * h * 4)
    fill_grad(buf, w, h, top, bot)
    hills(buf, w, h, (*mid, 255), h * 0.58, 36, 110)
    hills(buf, w, h, (*ground, 255), h * 0.72, 22, 70, 0.8)
    ball(buf, w, w * 0.5, h * ball_y, 90)
    write_png(ROOT / "seasons" / name, w, h, buf)


def bg(name, top, bot, mid):
    w, h = 1600, 720
    buf = bytearray(w * h * 4)
    fill_grad(buf, w, h, top, bot)
    hills(buf, w, h, (*mid, 255), h * 0.7, 40, 160)
    write_png(ROOT / "seasons" / name, w, h, buf)


def write_wav(path: Path, samples, sr=22050):
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        frames = b"".join(struct.pack("<h", max(-32767, min(32767, int(s * 32767)))) for s in samples)
        wf.writeframes(frames)


def env(t, a=0.01, d=0.08, s=0.6, r=0.12, dur=0.2):
    if t < a:
        return t / a
    if t < a + d:
        return lerp(1, s, (t - a) / d)
    if t < dur - r:
        return s
    if t >= dur:
        return 0
    return s * max(0, 1 - (t - (dur - r)) / r)


def tone(freq, dur, sr, kind="sine", vol=0.3):
    n = int(dur * sr)
    out = []
    for i in range(n):
        t = i / sr
        p = freq * t
        if kind == "square":
            v = 1 if (p % 1) < 0.5 else -1
        elif kind == "tri":
            v = 4 * abs((p % 1) - 0.5) - 1
        elif kind == "noise":
            v = ((i * 1103515245 + 12345) & 0x7FFF) / 0x7FFF * 2 - 1
        else:
            v = math.sin(2 * math.pi * p)
        out.append(v * vol * env(t, dur=dur, r=min(0.08, dur * 0.4)))
    return out


def blip(freq, dur=0.12, kind="tri", vol=0.32):
    return tone(freq, dur, 22050, kind, vol)


def save_sfx():
    sdir = ROOT / "audio" / "sfx"
    mapping = {
        "jump": blip(420, 0.11, "tri", 0.28),
        "bounce": blip(280, 0.1, "sine", 0.3) + blip(360, 0.08, "sine", 0.16),
        "land": blip(140, 0.09, "sine", 0.34) + tone(80, 0.06, 22050, "noise", 0.08),
        "collect": blip(880, 0.08) + blip(1174, 0.1),
        "collect-rare": blip(988, 0.08) + blip(1318, 0.12) + blip(1568, 0.12),
        "collect-secret": blip(784, 0.1) + blip(1046, 0.12) + blip(1318, 0.16, "sine", 0.22),
        "enemy-hit": blip(200, 0.08, "square", 0.18),
        "enemy-death": blip(160, 0.16, "square", 0.16) + tone(90, 0.1, 22050, "noise", 0.1),
        "damage": blip(90, 0.18, "square", 0.22),
        "ui-click": blip(640, 0.05, "tri", 0.2),
        "ui-hover": blip(520, 0.04, "sine", 0.12),
        "unlock": blip(392, 0.1) + blip(523, 0.12) + blip(659, 0.16),
        "complete": blip(392, 0.12) + blip(523, 0.12) + blip(659, 0.14) + blip(784, 0.2),
        "secret": blip(523, 0.1, "sine") + blip(784, 0.16, "sine") + blip(1046, 0.2, "sine", 0.18),
        "checkpoint": blip(660, 0.1) + blip(880, 0.12),
        "spring": blip(340, 0.08, "tri") + blip(510, 0.1, "tri", 0.2),
        "portal": blip(240, 0.16, "sine") + blip(180, 0.18, "sine", 0.16),
        "boss-hit": blip(80, 0.14, "square", 0.22),
        "boss-phase": blip(60, 0.28, "square", 0.2) + tone(40, 0.2, 22050, "noise", 0.12),
        "death": blip(70, 0.28, "square", 0.2) + tone(50, 0.2, 22050, "noise", 0.12),
        "whoosh": tone(180, 0.16, 22050, "noise", 0.1) + blip(220, 0.12, "sine", 0.12),
    }
    for name, samples in mapping.items():
        write_wav(sdir / f"{name}.wav", samples)


def melody(notes, sr=22050, bpm=96, kind="tri", vol=0.12):
    beat = 60 / bpm
    out = []
    for freq, beats in notes:
        dur = beats * beat
        if freq == 0:
            out.extend([0.0] * int(dur * sr))
        else:
            out.extend(tone(freq, dur, sr, kind, vol))
    return out


def loop_to(samples, seconds, sr=22050):
    need = int(seconds * sr)
    if not samples:
        return [0.0] * need
    out = []
    while len(out) < need:
        out.extend(samples)
    return out[:need]


def save_music():
    mdir = ROOT / "audio" / "music"
    C, D, E, F, G, A, B = 261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88
    tracks = {
        "menu": melody([(E, 1), (G, 1), (A, 2), (G, 1), (E, 1), (D, 2), (C, 2), (0, 1)], kind="sine", vol=0.1, bpm=72),
        "season-1": melody([(G, 1), (A, 1), (B, 1), (D * 2, 2), (B, 1), (A, 1), (G, 2)], kind="tri", vol=0.11, bpm=100),
        "season-2": melody([(E / 2, 1), (G / 2, 1), (B / 2, 1), (E, 1), (D, 1), (B / 2, 1), (A / 2, 2)], kind="square", vol=0.06, bpm=118),
        "season-3": melody([(A, 2), (E, 2), (F, 2), (C * 2, 2), (A, 2), (0, 1)], kind="sine", vol=0.09, bpm=84),
        "season-4": melody([(D, 1), (F, 1), (A, 1), (G, 2), (F, 1), (D, 2)], kind="tri", vol=0.1, bpm=92),
        "boss-1": melody([(G / 2, 0.5), (G / 2, 0.5), (A / 2, 1), (B / 2, 1), (D, 1)], kind="square", vol=0.07, bpm=132),
        "boss-2": melody([(E / 2, 0.5), (E / 2, 0.5), (G / 2, 1), (B / 2, 0.5), (D, 1)], kind="square", vol=0.07, bpm=140),
        "boss-3": melody([(A / 2, 1), (E, 1), (C * 2, 1), (B, 1), (A, 2)], kind="tri", vol=0.09, bpm=110),
        "boss-4": melody([(D / 2, 0.5), (F / 2, 0.5), (A / 2, 1), (D, 1), (C, 1), (A / 2, 1)], kind="square", vol=0.07, bpm=124),
    }
    for name, samples in tracks.items():
        write_wav(mdir / f"{name}.wav", loop_to(samples, 12))


def main():
    studio_logo()
    cover()
    season_cover("season-1-cover.png", (159, 214, 240), (215, 242, 200), (107, 191, 122), (62, 140, 74), 0.48)
    season_cover("season-2-cover.png", (43, 48, 56), (74, 69, 64), (109, 115, 124), (58, 63, 70), 0.5)
    season_cover("season-3-cover.png", (7, 6, 22), (27, 15, 58), (58, 42, 122), (21, 16, 44), 0.46)
    season_cover("season-4-cover.png", (26, 12, 20), (58, 21, 40), (138, 58, 90), (74, 32, 52), 0.5)
    bg("season-1/bg-far.png", (159, 214, 240), (215, 242, 200), (107, 191, 122))
    bg("season-2/bg-far.png", (43, 48, 56), (74, 69, 64), (109, 115, 124))
    bg("season-3/bg-far.png", (7, 6, 22), (27, 15, 58), (58, 42, 122))
    bg("season-4/bg-far.png", (26, 12, 20), (58, 21, 40), (138, 58, 90))
    save_sfx()
    save_music()
    print("assets written to", ROOT)


if __name__ == "__main__":
    main()
