import * as React from "react"

import { createChromePopupPort } from "~adapters/chrome-popup-port"
import { PopupApp } from "~ui/features/popup/PopupApp"

import "./style.css"
import "./popup.css"

const popupPort = createChromePopupPort({
  commands: chrome.commands,
  runtime: chrome.runtime,
  storage: chrome.storage,
  tabs: chrome.tabs,
  windows: chrome.windows,
})

function IndexPopup() {
  return <PopupApp port={popupPort} />
}

export default IndexPopup
