import * as React from "react"

import { createChromePopupPort } from "~adapters/chrome-popup-port"
import { PopupApp } from "~ui/features/popup/PopupApp"

import "./style.css"

const popupPort = createChromePopupPort({
  commands: chrome.commands,
  runtime: chrome.runtime,
  tabs: chrome.tabs
})

function IndexPopup() {
  return <PopupApp port={popupPort} />
}

export default IndexPopup
