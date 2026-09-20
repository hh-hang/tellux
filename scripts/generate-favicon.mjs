/**
 * 把 examples/public/favicon.svg 同款几何 T 栅格化成
 * favicon.ico（32 PNG-in-ICO）和 apple-touch-icon.png（180）。
 * 改字形时先改 SVG，再跑 `node scripts/generate-favicon.mjs`。
 */
import { deflateSync } from "node:zlib"
import { writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const outDir = resolve(dirname(fileURLToPath(import.meta.url)), "../examples/public")

const BG = [20, 27, 34]
const FG = [229, 236, 239]
const BORDER = [198, 210, 219]
const BORDER_A = 0.26

function crc32(bytes) {
  let crc = 0xffffffff
  for (const b of bytes) {
    crc ^= b
    for (let i = 0; i < 8; i++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type)
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])))
  return Buffer.concat([len, typeBytes, data, crcBuf])
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    const row = y * (width * 4 + 1)
    raw[row] = 0
    rgba.copy(raw, row + 1, y * width * 4, (y + 1) * width * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ])
}

function encodeIco(png, size) {
  const header = Buffer.alloc(22)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(1, 4)
  header[6] = size
  header[7] = size
  header.writeUInt16LE(1, 10)
  header.writeUInt16LE(32, 12)
  header.writeUInt32LE(png.length, 14)
  header.writeUInt32LE(22, 18)
  return Buffer.concat([header, png])
}

function sdRoundBox(px, py, cx, cy, hx, hy, r) {
  const dx = Math.abs(px - cx) - (hx - r)
  const dy = Math.abs(py - cy) - (hy - r)
  const ox = Math.max(dx, 0)
  const oy = Math.max(dy, 0)
  return Math.hypot(ox, oy) + Math.min(Math.max(dx, dy), 0) - r
}

function cover(distSvg, pixelsPerUnit) {
  return Math.min(1, Math.max(0, 0.5 - distSvg * pixelsPerUnit))
}

function rasterize(size, { roundPlate, insetBorder }) {
  const rgba = Buffer.alloc(size * size * 4)
  const scale = 32 / size
  const pixelsPerUnit = size / 32
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = (x + 0.5) * scale
      const py = (y + 0.5) * scale
      const plate = roundPlate
        ? sdRoundBox(px, py, 16, 16, 16, 16, 6.4)
        : -1
      const letter = Math.min(
        sdRoundBox(px, py, 16, 9.6, 8, 1.6, 0),
        sdRoundBox(px, py, 16, 17.4, 1.6, 6.2, 0)
      )
      const border = insetBorder
        ? Math.abs(sdRoundBox(px, py, 16, 16, 15.5, 15.5, 5.9)) - 0.5
        : 1

      let r = 0
      let g = 0
      let b = 0
      let a = 0
      const plateCover = cover(plate, pixelsPerUnit)
      if (plateCover > 0) {
        r = BG[0]
        g = BG[1]
        b = BG[2]
        a = plateCover
        const borderMix = cover(border, pixelsPerUnit) * BORDER_A
        r = r * (1 - borderMix) + BORDER[0] * borderMix
        g = g * (1 - borderMix) + BORDER[1] * borderMix
        b = b * (1 - borderMix) + BORDER[2] * borderMix
        const letterCover = cover(letter, pixelsPerUnit)
        r = r * (1 - letterCover) + FG[0] * letterCover
        g = g * (1 - letterCover) + FG[1] * letterCover
        b = b * (1 - letterCover) + FG[2] * letterCover
      }

      const i = (y * size + x) * 4
      rgba[i] = Math.round(r)
      rgba[i + 1] = Math.round(g)
      rgba[i + 2] = Math.round(b)
      rgba[i + 3] = Math.round(a * 255)
    }
  }
  return rgba
}

const icoPng = encodePng(32, 32, rasterize(32, { roundPlate: true, insetBorder: true }))
writeFileSync(resolve(outDir, "favicon.ico"), encodeIco(icoPng, 32))

const touch = rasterize(180, { roundPlate: false, insetBorder: false })
writeFileSync(resolve(outDir, "apple-touch-icon.png"), encodePng(180, 180, touch))

console.log("wrote examples/public/favicon.ico and apple-touch-icon.png")
