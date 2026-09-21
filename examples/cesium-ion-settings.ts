import { applyTranslations } from "./i18n/apply"
import { onLocaleChange } from "./i18n/locale"

/**
 * Sandcastle 与独立示例共用的 Cesium Ion token（localStorage）。
 * 不读 `VITE_CESIUM_ION_TOKEN`。
 *
 * Shared Cesium Ion token for Sandcastle and standalone examples.
 * Does not read `VITE_CESIUM_ION_TOKEN`.
 */

export const CESIUM_ION_TOKEN_STORAGE_KEY = "tellux:cesium-ion-token"

export function getCesiumIonToken(): string {
  try {
    return globalThis.localStorage?.getItem(CESIUM_ION_TOKEN_STORAGE_KEY)?.trim() ?? ""
  } catch {
    return ""
  }
}

export function setCesiumIonToken(token: string): void {
  const value = token.trim()
  try {
    if (!value) {
      globalThis.localStorage?.removeItem(CESIUM_ION_TOKEN_STORAGE_KEY)
      return
    }
    globalThis.localStorage?.setItem(CESIUM_ION_TOKEN_STORAGE_KEY, value)
  } catch {
    // 隐私模式等写失败时保持静默；调用方仍按空 token 处理。
  }
}

export interface MountExampleSettingsOptions {
  mount: HTMLElement
  /** 没有 token 时直接打开面板。默认 true。 */
  autoOpenIfMissing?: boolean
}

export interface ExampleSettingsHandle {
  open: () => void
  close: () => void
}

const GEAR_SVG = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
  <path fill="currentColor" d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.03 7.03 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 13.9 2h-3.8a.5.5 0 0 0-.5.42l-.36 2.54c-.59.24-1.13.55-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.8 8.48a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.92 14.16a.5.5 0 0 0-.12.64l1.92 3.32c.13.22.4.31.6.22l2.39-.96c.5.39 1.04.7 1.63.94l.36 2.54c.05.24.26.42.5.42h3.8c.24 0 .45-.18.5-.42l.36-2.54c.59-.24 1.13-.55 1.63-.94l2.39.96c.22.09.47 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z"/>
</svg>`

export function mountExampleSettings(
  options: MountExampleSettingsOptions
): ExampleSettingsHandle {
  const autoOpenIfMissing = options.autoOpenIfMissing ?? true
  const root = document.createElement("div")
  root.className = "example-settings"

  root.innerHTML = `
    <button
      type="button"
      class="example-settings__toggle"
      data-i18n-attr="aria-label:settings.gear.aria,title:settings.gear.aria"
      aria-label="设置"
      title="设置"
      aria-expanded="false"
      aria-haspopup="dialog"
    >${GEAR_SVG}</button>
    <div class="example-settings__panel" role="dialog" aria-modal="false" hidden>
      <h2 data-i18n="settings.panel.title">设置</h2>
      <p class="example-settings__help" data-i18n-html="settings.panel.ionHelp"></p>
      <label class="example-settings__field">
        <span data-i18n="settings.panel.ionLabel">Cesium Ion token</span>
        <input
          class="example-settings__input"
          type="password"
          autocomplete="off"
          spellcheck="false"
          data-i18n-attr="placeholder:settings.panel.ionPlaceholder"
        />
      </label>
      <div class="example-settings__actions">
        <button type="button" class="example-settings__save" data-i18n="settings.panel.save">保存并刷新</button>
        <button type="button" class="example-settings__clear" data-i18n="settings.panel.clear">清除</button>
      </div>
    </div>
  `

  options.mount.append(root)
  applyTranslations(root)
  onLocaleChange(() => applyTranslations(root))

  const toggle = root.querySelector(".example-settings__toggle")
  const panel = root.querySelector(".example-settings__panel")
  const input = root.querySelector(".example-settings__input")
  const saveButton = root.querySelector(".example-settings__save")
  const clearButton = root.querySelector(".example-settings__clear")

  if (
    !(toggle instanceof HTMLButtonElement) ||
    !(panel instanceof HTMLElement) ||
    !(input instanceof HTMLInputElement) ||
    !(saveButton instanceof HTMLButtonElement) ||
    !(clearButton instanceof HTMLButtonElement)
  ) {
    throw new Error("Example settings UI failed to mount.")
  }

  const syncInput = () => {
    input.value = getCesiumIonToken()
  }

  const open = () => {
    panel.hidden = false
    toggle.setAttribute("aria-expanded", "true")
    root.classList.add("is-open")
    syncInput()
    window.requestAnimationFrame(() => input.focus())
  }

  const close = () => {
    panel.hidden = true
    toggle.setAttribute("aria-expanded", "false")
    root.classList.remove("is-open")
  }

  toggle.addEventListener("click", (event) => {
    event.stopPropagation()
    if (panel.hidden) open()
    else close()
  })

  saveButton.addEventListener("click", () => {
    setCesiumIonToken(input.value)
    window.location.reload()
  })

  clearButton.addEventListener("click", () => {
    setCesiumIonToken("")
    window.location.reload()
  })

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault()
      setCesiumIonToken(input.value)
      window.location.reload()
    }
  })

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) {
      close()
    }
  })

  document.addEventListener("pointerdown", (event) => {
    if (panel.hidden) return
    if (event.target instanceof Node && root.contains(event.target)) return
    close()
  })

  syncInput()
  if (autoOpenIfMissing && !getCesiumIonToken()) {
    open()
  }

  return { open, close }
}
