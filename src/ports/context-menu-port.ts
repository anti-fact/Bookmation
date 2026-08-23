export interface ContextMenuPort {
  reconcile(enabled: boolean): Promise<void>
}
