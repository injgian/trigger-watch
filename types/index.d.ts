export type TriggerKind = 'skill' | 'agent' | 'hook'
export type Trigger = { at: string; kind: TriggerKind; name: string; detail: string }

declare module 'claude-code' {
  interface PluginState {
    'trigger-watch': {
      triggers: Shaped<Trigger[]>
      showToolHooks: boolean
    }
  }
}
