import { applyTranslations } from "./apply"
import { getLocale, onLocaleChange, resolveLocale, setLocale } from "./locale"
import type { Locale } from "./types"

/** 语言展示名（autonym），不随界面语言翻译。 */
const LOCALE_LABELS: Record<Locale, string> = {
  zh: "中文",
  en: "English",
}

export interface MountLanguageToggleOptions {
  /** 挂载点；默认创建并插入 document.body */
  mount?: HTMLElement | null
  /** 追加到切换器的 class（如 portal / sandcastle / example 布局） */
  className?: string
  /** 形态：split 为 中文 | EN 双按钮（默认），dropdown 为显示当前语言的下拉选择 */
  variant?: "split" | "dropdown"
  /** locale 变更后的额外回调（例如重渲 gallery） */
  onChange?: (locale: Locale) => void
  /** 是否在 setLocale 后自动 applyTranslations(document) */
  applyDocument?: boolean
}

function syncToggleState(root: HTMLElement, locale: Locale) {
  root.querySelectorAll<HTMLButtonElement>("[data-locale]").forEach((button) => {
    const isActive = button.dataset.locale === locale
    button.setAttribute("aria-pressed", String(isActive))
    button.classList.toggle("is-active", isActive)
  })
}

/**
 * 挂载语言切换器：split 形态是 中文 | EN 双按钮，dropdown 形态是当前语言下拉。
 * Mount the language switcher: "split" renders the 中文 | EN button pair, "dropdown" a dropdown showing the current language.
 */
export function mountLanguageToggle(
  options: MountLanguageToggleOptions = {}
): HTMLElement {
  resolveLocale()

  const {
    mount = null,
    className = "",
    variant = "split",
    onChange,
    applyDocument = true,
  } = options

  const root = document.createElement("div")
  root.className = [
    "lang-toggle",
    variant === "dropdown" && "lang-toggle--dropdown",
    className,
  ]
    .filter(Boolean)
    .join(" ")
  root.setAttribute("role", "group")
  root.setAttribute("aria-label", "Language")

  let sync: (locale: Locale) => void

  const applyLocale = (locale: Locale) => {
    setLocale(locale)
    if (applyDocument) applyTranslations(document)
    sync(locale)
    onChange?.(locale)
  }

  if (variant === "dropdown") {
    root.innerHTML = `
      <button type="button" class="lang-select__trigger" aria-haspopup="true" aria-expanded="false">
        <span class="lang-select__label"></span>
        <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true" focusable="false"><path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <div class="lang-select__menu" hidden>
        <button type="button" class="lang-select__option" data-locale="zh">中文</button>
        <button type="button" class="lang-select__option" data-locale="en">English</button>
      </div>
    `

    const trigger = root.querySelector<HTMLButtonElement>(".lang-select__trigger")
    const menu = root.querySelector<HTMLElement>(".lang-select__menu")

    const setOpen = (open: boolean) => {
      root.classList.toggle("is-open", open)
      if (menu) menu.hidden = !open
      trigger?.setAttribute("aria-expanded", String(open))
    }

    trigger?.addEventListener("click", () => {
      setOpen(menu?.hidden ?? false)
    })

    root.querySelectorAll<HTMLButtonElement>("[data-locale]").forEach((button) => {
      button.addEventListener("click", () => {
        const next = button.dataset.locale
        if (next === "zh" || next === "en") {
          applyLocale(next)
        }
        setOpen(false)
      })
    })

    // 点击组件外部时收起菜单；组件与页面同生命周期，无需注销。
    document.addEventListener("pointerdown", (event) => {
      if (event.target instanceof Node && !root.contains(event.target)) {
        setOpen(false)
      }
    })
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && menu && !menu.hidden) {
        setOpen(false)
        trigger?.focus()
      }
    })

    sync = (locale) => {
      const label = root.querySelector<HTMLElement>(".lang-select__label")
      if (label) label.textContent = LOCALE_LABELS[locale]
      root.querySelectorAll<HTMLButtonElement>("[data-locale]").forEach((button) => {
        button.classList.toggle("is-active", button.dataset.locale === locale)
      })
    }
  } else {
    root.innerHTML = `
      <button type="button" class="lang-toggle__button" data-locale="zh" aria-pressed="false">中文</button>
      <button type="button" class="lang-toggle__button" data-locale="en" aria-pressed="false">EN</button>
    `

    root.querySelectorAll<HTMLButtonElement>("[data-locale]").forEach((button) => {
      button.addEventListener("click", () => {
        const next = button.dataset.locale
        if (next === "zh" || next === "en") {
          applyLocale(next)
        }
      })
    })

    sync = (locale) => syncToggleState(root, locale)
  }

  sync(getLocale())

  if (mount) {
    mount.append(root)
  } else if (!root.isConnected) {
    document.body.append(root)
  }

  onLocaleChange((locale) => {
    sync(locale)
  })

  return root
}
