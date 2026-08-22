import * as React from "react"
import { createRoot } from "react-dom/client"

import "~/style.css"

import { ComponentSheet } from "./ComponentSheet"

const rootElement = document.getElementById("root")

if (!rootElement) {
  throw new Error("Web preview root element was not found")
}

createRoot(rootElement).render(
  <React.StrictMode>
    <ComponentSheet />
  </React.StrictMode>
)
