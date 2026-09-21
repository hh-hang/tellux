import { afterEach, describe, expect, it } from "vitest"
import {
  CESIUM_ION_TOKEN_STORAGE_KEY,
  getCesiumIonToken,
  setCesiumIonToken,
} from "./cesium-ion-settings"

const memory = new Map<string, string>()

afterEach(() => {
  memory.clear()
})

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem(key: string) {
      return memory.get(key) ?? null
    },
    setItem(key: string, value: string) {
      memory.set(key, value)
    },
    removeItem(key: string) {
      memory.delete(key)
    },
  },
})

describe("cesium ion token storage", () => {
  it("returns empty when nothing is stored", () => {
    expect(getCesiumIonToken()).toBe("")
  })

  it("trims and persists a token", () => {
    setCesiumIonToken("  abc.def  ")
    expect(getCesiumIonToken()).toBe("abc.def")
    expect(memory.get(CESIUM_ION_TOKEN_STORAGE_KEY)).toBe("abc.def")
  })

  it("clears storage for an empty value", () => {
    setCesiumIonToken("keep")
    setCesiumIonToken("   ")
    expect(getCesiumIonToken()).toBe("")
    expect(memory.has(CESIUM_ION_TOKEN_STORAGE_KEY)).toBe(false)
  })
})
