import { isDomainError } from "~/domain"
import { isContextMenuLinkId, isContextMenuPageId, isOwnedContextMenuId } from "~/domain/context-menu"
import { isAllowedUrl } from "~/domain/value-objects/url"
import { LocalDataLayer } from "~/adapters/indexeddb/local-data-layer"
import { safeLogError, safeLogWarning } from "~/adapters/security/log-redaction"
import { SaveBookmarkUseCase } from "~/application/save-bookmark"
import type { LocalSettingsStore } from "~/ports/local-settings-store-port"
import { openExtensionPopup, type ExtensionPopupAction } from "~/extension/open-extension-popup"
import { recordPopupSaveFeedback, type PopupSaveFeedbackStorage } from "~/extension/popup-save-feedback"
import { scheduleBookmarkMetadataFetch } from "~/extension/save-side-effects"

export type SaveContextMenuBookmarkDeps = Readonly<{
  settingsStore: LocalSettingsStore
  sessionStorage: PopupSaveFeedbackStorage
  action: ExtensionPopupAction
}>

let dataLayerPromise: Promise<LocalDataLayer> | null = null

export async function resetSaveContextMenuDataLayerCache(): Promise<void> {
  if (dataLayerPromise) {
    const layer = await dataLayerPromise
    await layer.close()
  }
  dataLayerPromise = null
}

async function getDataLayer(): Promise<LocalDataLayer> {
  if (!dataLayerPromise) {
    dataLayerPromise = LocalDataLayer.open()
  }
  return dataLayerPromise
}

function pickRawUrl(info: chrome.contextMenus.OnClickData): string | null {
  if (isContextMenuPageId(info.menuItemId)) {
    return typeof info.pageUrl === "string" ? info.pageUrl : null
  }
  if (isContextMenuLinkId(info.menuItemId)) {
    return typeof info.linkUrl === "string" ? info.linkUrl : null
  }
  return null
}

export async function saveFromContextMenuClick(
  info: chrome.contextMenus.OnClickData,
  deps: SaveContextMenuBookmarkDeps,
): Promise<void> {
  if (!isOwnedContextMenuId(info.menuItemId)) {
    safeLogWarning("Context menu click", `ignored unknown menu id: ${String(info.menuItemId)}`)
    return
  }

  const settings = await deps.settingsStore.get()
  if (!settings.contextMenuBookmarkEnabled) {
    return
  }

  const rawUrl = pickRawUrl(info)
  if (!rawUrl || !isAllowedUrl(rawUrl)) {
    safeLogWarning("Context menu click", "rejected unsafe or missing URL")
    return
  }

  const creationRequestId = isContextMenuPageId(info.menuItemId)
    ? `context-page:${crypto.randomUUID()}`
    : `context-link:${crypto.randomUUID()}`

  try {
    const data = await getDataLayer()
    const useCase = new SaveBookmarkUseCase(data)
    const result = isContextMenuPageId(info.menuItemId)
      ? await useCase.saveFromContextPage({ rawUrl, creationRequestId })
      : await useCase.saveFromContextLink({
          rawUrl,
          title: typeof info.selectionText === "string" ? info.selectionText : "",
          creationRequestId,
        })

    if (result.duplicate) {
      await recordPopupSaveFeedback(deps.sessionStorage, "duplicate")
      await openExtensionPopup(deps.action)
      return
    }

    await recordPopupSaveFeedback(deps.sessionStorage, "saved")
    await openExtensionPopup(deps.action)
    scheduleBookmarkMetadataFetch(data, result, {
      rawUrl,
      source: isContextMenuPageId(info.menuItemId) ? "CONTEXT_PAGE" : "CONTEXT_LINK",
    })
  } catch (error: unknown) {
    if (isDomainError(error)) {
      safeLogWarning("Context menu save", error.code)
      return
    }
    safeLogError("Context menu save", error)
  }
}
