#!/usr/bin/env python3
"""Derive a tangent-space normal map from a tileable albedo (Sobel on blurred luminance, wrap-around).
Usage: python3 tools/normalmap.py SRC.png DST.webp [--strength 2.0] [--blur 1.2] [--size 512] [--quality 80]
Only needs numpy + Pillow. Blur is a periodic gaussian via FFT, so seams stay seamless."""
import argparse
import numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument("src"); ap.add_argument("dst")
ap.add_argument("--strength", type=float, default=2.0)
ap.add_argument("--blur", type=float, default=1.2)
ap.add_argument("--size", type=int, default=512)
ap.add_argument("--quality", type=int, default=80)
a = ap.parse_args()

im = Image.open(a.src).convert("RGB").resize((a.size, a.size), Image.LANCZOS)
rgb = np.asarray(im).astype(np.float32) / 255
lum = rgb @ np.array([0.299, 0.587, 0.114], np.float32)
lum = (lum - lum.mean()) / (lum.std() + 1e-5)           # normalise contrast so strength is comparable across materials
n = a.size
fx = np.fft.fftfreq(n)[None, :]; fy = np.fft.fftfreq(n)[:, None]
g = np.exp(-2 * (np.pi ** 2) * (a.blur ** 2) * (fx ** 2 + fy ** 2))
h = np.real(np.fft.ifft2(np.fft.fft2(lum) * g))
r = lambda dy, dx: np.roll(np.roll(h, dy, 0), dx, 1)
dx = (r(-1, -1) + 2 * r(0, -1) + r(1, -1)) - (r(-1, 1) + 2 * r(0, 1) + r(1, 1))
dy = (r(-1, -1) + 2 * r(-1, 0) + r(-1, 1)) - (r(1, -1) + 2 * r(1, 0) + r(1, 1))
nx, ny = dx * a.strength * 0.25, -dy * a.strength * 0.25   # image y runs down; +v up in GL
nz = np.ones_like(nx)
l = np.sqrt(nx * nx + ny * ny + nz * nz)
out = np.stack([nx / l, ny / l, nz / l], -1) * 0.5 + 0.5
Image.fromarray((out * 255).clip(0, 255).astype(np.uint8)).save(a.dst, "WEBP", quality=a.quality, method=6)
print("normal", a.dst)
