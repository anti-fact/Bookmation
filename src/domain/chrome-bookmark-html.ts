/** Chrome ブックマークマネージャー export（NETSCAPE Bookmark 形式）の解析。 */

export type ParsedChromeBookmarkEntry = Readonly<{
  entryId: string
  url: string
  title: string
  /** 直上 Folder の表示名。ルート直下は null。 */
  sourceFolderName: string | null
}>

function flattenDlChildren(dl: Element): Element[] {
  const result: Element[] = []
  for (const child of dl.children) {
    if (child.tagName === "P") {
      for (const grandchild of child.children) {
        result.push(grandchild)
      }
    } else {
      result.push(child)
    }
  }
  return result
}

function parseBookmarkDl(
  dl: Element,
  currentFolder: string | null,
  entries: ParsedChromeBookmarkEntry[],
  nextEntryIndex: { value: number },
): void {
  const children = flattenDlChildren(dl)
  for (let index = 0; index < children.length; index += 1) {
    const node = children[index]
    if (node.tagName === "DT") {
      const heading = node.querySelector("h3")
      const anchor = node.querySelector("a[href]")
      if (heading) {
        const folderName = heading.textContent?.trim() ?? ""
        const nestedInNode = [...node.children].find((child) => child.tagName === "DL")
        const nestedSibling =
          children[index + 1]?.tagName === "DL" ? children[index + 1] : null
        const nested = nestedInNode ?? nestedSibling
        if (nested && folderName.length > 0) {
          parseBookmarkDl(nested, folderName, entries, nextEntryIndex)
          if (nestedSibling) index += 1
        }
        continue
      }
      if (anchor) {
        const href = anchor.getAttribute("href")?.trim()
        if (!href) continue
        entries.push({
          entryId: `entry-${nextEntryIndex.value}`,
          url: href,
          title: anchor.textContent?.trim() ?? "",
          sourceFolderName: currentFolder,
        })
        nextEntryIndex.value += 1
      }
      continue
    }
    if (node.tagName === "DL") {
      parseBookmarkDl(node, currentFolder, entries, nextEntryIndex)
    }
  }
}

/**
 * NETSCAPE Bookmark HTML を解析し、各 URL の直上 Folder 名を付与する。
 * DOMParser が使える環境（ブラウザ / jsdom）専用。
 */
export function parseNetscapeBookmarkHtml(html: string): ParsedChromeBookmarkEntry[] {
  const parser = new DOMParser()
  const document = parser.parseFromString(html, "text/html")
  const rootDl = document.querySelector("dl")
  if (!rootDl) return []

  const entries: ParsedChromeBookmarkEntry[] = []
  parseBookmarkDl(rootDl, null, entries, { value: 0 })
  return entries
}
