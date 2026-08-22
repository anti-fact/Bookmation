export { LocalDataLayer, openBookmationDatabase } from "./indexeddb/local-data-layer"
export type {
  SaveBookmarkWithJobInput,
  SaveBookmarkWithJobResult,
  CreateCategoryInput,
  CreateTagInput,
  AssignTagEdgeInput,
  ListRecentBookmarksResult,
} from "./indexeddb/local-data-layer"

export type {
  PersistedActiveBookmarkRecord,
  PersistedLabelRecord,
  PersistedClassificationJobRecord,
  BookmarkCursor,
  UpdateTagResult,
  DeleteCategoryCascadeCommand,
  DeleteCategoryCascadeResult,
  CategoryEditDetail,
} from "./indexeddb/persisted-types"

export { openBookmationDatabase as openDatabase } from "./indexeddb/open-database"
export { STORES, DB_NAME, DB_VERSION } from "./indexeddb/stores"
