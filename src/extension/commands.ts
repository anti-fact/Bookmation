export const EXTENSION_COMMANDS = {
  SAVE_CURRENT_PAGE: "save-current-page",
  OPEN_BOOKMATION_HOME: "open-bookmation-home"
} as const

export type ExtensionCommand =
  (typeof EXTENSION_COMMANDS)[keyof typeof EXTENSION_COMMANDS]

export const EXTENSION_COMMAND_ALLOWLIST: readonly ExtensionCommand[] = [
  EXTENSION_COMMANDS.SAVE_CURRENT_PAGE,
  EXTENSION_COMMANDS.OPEN_BOOKMATION_HOME
]

export function isExtensionCommand(value: string): value is ExtensionCommand {
  return (EXTENSION_COMMAND_ALLOWLIST as readonly string[]).includes(value)
}
