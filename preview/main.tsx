import * as React from "react"
import { createRoot } from "react-dom/client"

import "~/style.css"

import { AppShellFixture } from "./AppShellFixture"
import { ComponentSheet } from "./ComponentSheet"
import { PopupFixture } from "./PopupFixture"

const rootElement = document.getElementById("root")

if (!rootElement) {
  throw new Error("Web preview root element was not found")
}

const previewView = new URLSearchParams(window.location.search).get("view")

if (previewView === "app-shell" && !window.location.hash) {
  window.history.replaceState(null, "", "?view=app-shell#/home")
}

document.title =
  previewView === "app-shell"
    ? "Bookmation UI-02 App Shell preview"
    : previewView === "popup"
      ? "Bookmation UI-03 Popup preview"
      : "Bookmation UI component sheet"

createRoot(rootElement).render(
  <React.StrictMode>
    {previewView === "app-shell" ? (
      <AppShellFixture />
    ) : previewView === "popup" ? (
      <PopupFixture />
    ) : (
      <ComponentSheet />
    )}
  </React.StrictMode>
)
