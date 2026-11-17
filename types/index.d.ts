export type TriggerKind = 'skill' | 'agent' | 'hook'
export type Trigger = {
  at: string
  kind: TriggerKind
  name: string
  detail: string
  /** Where it fired: `main`, or the subagent's type and short id. */
  who?: string
  /** `key: value` lines describing the event (tool input, prompt, reason…). */
  extra?: string[]
  /** Settings hooks whose matcher matched this event, as `source: command`. */
  hooks?: string[]
}

declare module 'claude-code' {
  interface PluginState {
    'trigger-watch': {
      triggers: Shaped<Trigger[]>
      showToolHooks: boolean
      showDetails: boolean
    }
  }
}
