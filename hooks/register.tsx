import { atom, read, update } from 'claude-code'
import type { Register, EngineInterface, SettingsSource } from 'claude-code'

import type { Trigger, TriggerKind } from '../types'

const PANE = 'trigger-watch'
const TITLE = 'Triggers'
const triggers = atom({ plugin: 'trigger-watch', key: 'triggers' } as const, [], {
  shape: 'triggers-1',
})
const showToolHooks = atom({ plugin: 'trigger-watch', key: 'showToolHooks' } as const, false)
const showDetails = atom({ plugin: 'trigger-watch', key: 'showDetails' } as const, true)

// Hook events that fire around every tool call; hidden unless toggled on.
const TOOL_EVENTS = ['PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'PostToolBatch', 'PermissionRequest']

// The field each event's settings-hook matcher is compared against.
const MATCH_FIELD: Record<string, string> = {
  PreToolUse: 'tool_name',
  PostToolUse: 'tool_name',
  PostToolUseFailure: 'tool_name',
  PermissionRequest: 'tool_name',
  PermissionDenied: 'tool_name',
  SessionStart: 'source',
  SessionEnd: 'reason',
  PreCompact: 'trigger',
  PostCompact: 'trigger',
  Setup: 'trigger',
  Notification: 'notification_type',
  SubagentStart: 'agent_type',
  SubagentStop: 'agent_type',
  ConfigChange: 'source',
  InstructionsLoaded: 'load_reason',
}

type Rec = Record<string, unknown>

function stamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/** One line, at most `n` characters. */
function clip(v: unknown, n = 120): string {
  const s = (typeof v === 'string' ? v : JSON.stringify(v) ?? '').replace(/\s+/g, ' ').trim()
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v !== '' ? v : undefined
}

function shortId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id
}

/** Where the event fired: the main thread or a subagent. */
function whoOf(r: Rec): string {
  const id = str(r.agent_id) ?? str(r.agentId)
  const type = str(r.agent_type)
  if (id) return `${type ?? 'agent'}#${shortId(id)}`
  return type ? `main (${type})` : 'main'
}

/** The most telling arguments of a tool call, as `key: value` lines. */
function toolInputLines(input: unknown): string[] {
  if (!input || typeof input !== 'object') return input === undefined ? [] : [`input: ${clip(input)}`]
  const o = input as Rec
  const keys = ['command', 'description', 'subagent_type', 'skill', 'file_path', 'path', 'pattern', 'url', 'query', 'prompt', 'args']
  const picked = keys.filter(k => o[k] !== undefined && o[k] !== '').map(k => `${k}: ${clip(o[k])}`)
  return picked.length > 0 ? picked : [`input: ${clip(o)}`]
}

/** The tool call's own arguments: `tool_input`, or the envelope minus its reserved fields (PreToolUse). */
function toolInput(r: Rec): unknown {
  if ('tool_input' in r) return r.tool_input
  const { tool: _t, tool_use_id: _u, agentId: _a, requestMeta: _m, hook_event_name: _h, ...rest } = r
  return rest
}

/** Detail lines for one settings-hook event. */
function describe(event: string, r: Rec): { detail: string; extra: string[] } {
  const extra: string[] = []
  const add = (k: string, v: unknown, n?: number) => {
    if (v !== undefined && v !== null && v !== '') extra.push(`${k}: ${clip(v, n)}`)
  }
  const tool = str(r.tool_name) ?? str(r.tool) ?? ''
  const mcp = r.mcp_server as Rec | undefined
  switch (event) {
    case 'PreToolUse':
    case 'PermissionRequest':
      extra.push(...toolInputLines(toolInput(r)))
      if (mcp) add('mcp server', `${mcp.name} (${mcp.source})`)
      return { detail: tool, extra }
    case 'PostToolUse':
      extra.push(...toolInputLines(r.tool_input))
      add('duration', typeof r.duration_ms === 'number' ? `${r.duration_ms} ms` : undefined)
      add('response', r.tool_response, 100)
      return { detail: tool, extra }
    case 'PostToolUseFailure':
      extra.push(...toolInputLines(r.tool_input))
      add('error', r.error)
      if (r.is_interrupt) add('interrupted', 'yes')
      return { detail: tool, extra }
    case 'PermissionDenied':
      extra.push(...toolInputLines(r.tool_input))
      add('reason', r.reason)
      return { detail: tool, extra }
    case 'PostToolBatch': {
      const calls = Array.isArray(r.tool_calls) ? (r.tool_calls as Rec[]) : []
      return { detail: `${calls.length} call${calls.length === 1 ? '' : 's'}`, extra: calls.map(c => `${c.tool_name}: ${clip(toolInputLines(c.tool_input)[0] ?? '', 100)}`) }
    }
    case 'UserPromptSubmit':
      add('prompt', r.prompt)
      if (r.source && r.source !== 'user') add('source', r.source)
      return { detail: '', extra }
    case 'UserPromptExpansion':
      add('args', r.command_args)
      add('from', r.command_source)
      return { detail: `/${r.command_name} (${r.expansion_type})`, extra }
    case 'Stop':
    case 'SubagentStop': {
      add('last message', r.last_assistant_message)
      if (r.stop_hook_active) add('stop hook active', 'yes (re-entered)')
      const bg = Array.isArray(r.background_tasks) ? r.background_tasks.length : 0
      if (bg > 0) add('background tasks', bg)
      if (event === 'SubagentStop') add('transcript', r.agent_transcript_path)
      return { detail: event === 'SubagentStop' ? `${r.agent_type} #${shortId(String(r.agent_id ?? ''))}` : '', extra }
    }
    case 'StopFailure':
      add('details', r.error_details)
      add('last message', r.last_assistant_message)
      return { detail: clip(r.error, 60), extra }
    case 'SubagentStart':
      return { detail: `${r.agent_type} #${shortId(String(r.agent_id ?? ''))}`, extra }
    case 'Notification':
      add('title', r.title)
      add('message', r.message)
      return { detail: String(r.notification_type ?? ''), extra }
    case 'SessionStart':
      add('model', r.model)
      add('permission mode', r.permission_mode)
      add('title', r.session_title)
      return { detail: String(r.source ?? ''), extra }
    case 'SessionEnd':
      return { detail: String(r.reason ?? ''), extra }
    case 'PreCompact':
      add('instructions', r.custom_instructions)
      return { detail: String(r.trigger ?? ''), extra }
    case 'PostCompact':
      add('summary', r.compact_summary)
      return { detail: String(r.trigger ?? ''), extra }
    case 'PreModelSwitch':
    case 'PostModelSwitch':
      return { detail: `${r.from_model} → ${r.to_model}`, extra }
    case 'Setup':
      return { detail: String(r.trigger ?? ''), extra }
    case 'InstructionsLoaded':
      add('file', r.file_path)
      add('triggered by', r.trigger_file_path)
      return { detail: `${r.memory_type} · ${r.load_reason}`, extra }
    case 'ConfigChange':
      add('file', r.file_path)
      return { detail: String(r.source ?? ''), extra }
    case 'CwdChanged':
      return { detail: `${r.old_cwd} → ${r.new_cwd}`, extra }
    case 'FileChanged':
      return { detail: `${r.event} ${r.file_path}`, extra }
    case 'DirectoryAdded':
      add('via', r.source)
      return { detail: String(r.directory ?? ''), extra }
    case 'WorktreeCreate':
      return { detail: String(r.name ?? ''), extra }
    case 'WorktreeRemove':
      return { detail: String(r.worktree_path ?? ''), extra }
    case 'TaskCreated':
    case 'TaskCompleted':
      add('description', r.task_description)
      add('teammate', r.teammate_name)
      return { detail: clip(r.task_subject, 60), extra }
    case 'TeammateIdle':
      return { detail: `${r.teammate_name} (${r.team_name})`, extra }
    case 'Elicitation':
      add('message', r.message)
      add('url', r.url)
      return { detail: String(r.mcp_server_name ?? ''), extra }
    case 'ElicitationResult':
      return { detail: `${r.mcp_server_name} ${r.action}`, extra }
    default:
      return { detail: tool, extra }
  }
}

// Settings hooks, read per source so a row can say where each came from.
// Cached briefly: tool events can fire many times a second.
const SOURCES: SettingsSource[] = ['user', 'project', 'local', 'flag', 'policy']
type HookGroup = { source: SettingsSource; matcher: string; hooks: Rec[] }
let hookCache: { at: number; byEvent: Record<string, HookGroup[]> } | undefined

async function configuredHooks($: EngineInterface): Promise<Record<string, HookGroup[]>> {
  if (hookCache && Date.now() - hookCache.at < 5000) return hookCache.byEvent
  const byEvent: Record<string, HookGroup[]> = {}
  for (const source of SOURCES) {
    let hooks: unknown
    try {
      hooks = await $.settings.read({ key: 'hooks', source })
    } catch {
      continue
    }
    if (!hooks || typeof hooks !== 'object') continue
    for (const [event, groups] of Object.entries(hooks as Rec)) {
      if (!Array.isArray(groups)) continue
      for (const g of groups as Rec[]) {
        const list = Array.isArray(g?.hooks) ? (g.hooks as Rec[]) : []
        ;(byEvent[event] ??= []).push({ source, matcher: typeof g?.matcher === 'string' ? g.matcher : '', hooks: list })
      }
    }
  }
  hookCache = { at: Date.now(), byEvent }
  return byEvent
}

function matcherHits(matcher: string, value: string | undefined): boolean {
  if (matcher === '' || matcher === '*') return true
  if (value === undefined) return false
  if (/^[\w|]+$/.test(matcher)) return matcher.split('|').includes(value)
  try {
    return new RegExp(`^(?:${matcher})$`).test(value)
  } catch {
    return false
  }
}

function hookLabel(h: Rec): string {
  const type = str(h.type) ?? 'command'
  const body = str(h.command) ?? str(h.url) ?? str(h.prompt) ?? str(h.server) ?? ''
  return type === 'command' ? clip(body, 90) : `${type}: ${clip(body, 80)}`
}

async function matchingHooks($: EngineInterface, event: string, r: Rec): Promise<string[]> {
  const groups = (await configuredHooks($))[event] ?? []
  const field = MATCH_FIELD[event]
  const value = field ? str(r[field]) ?? (field === 'tool_name' ? str(r.tool) : undefined) : undefined
  const out: string[] = []
  for (const g of groups) {
    if (field && !matcherHits(g.matcher, value)) continue
    const m = g.matcher && g.matcher !== '*' ? ` [${g.matcher}]` : ''
    for (const h of g.hooks) out.push(`${g.source}${m}: ${hookLabel(h)}`)
  }
  return out
}

async function log($: EngineInterface, kind: TriggerKind, name: string, detail: string, more: Partial<Trigger> = {}) {
  const item: Trigger = { at: stamp(), kind, name, detail, ...more }
  await update($, triggers, list => [...list, item].slice(-300))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    hookCache = undefined
    await $.command.register({ name: 'triggers', description: 'Open the pane listing skills, subagents and hook events as they fire' })
    void $.ui.open({ id: PANE, title: TITLE })
    return next(e)
  })

  on('command.run', { command: 'triggers' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })
    return { text: 'Triggers pane opened.' }
  })

  on('skill.prompt', async ($, e, next) => {
    try {
      const extra: string[] = [`source: ${e.source}${e.pluginName ? ` (${e.pluginName})` : ''}`]
      if (e.path) extra.push(`file: ${e.path}`)
      const desc = (e.frontmatter as Rec | undefined)?.description
      if (desc) extra.push(`about: ${clip(desc, 100)}`)
      await log($, 'skill', e.skill, 'invoked', { extra, who: whoOf(e as unknown as Rec) })
    } catch {
      // never let logging get in the way of the skill
    }
    return next(e)
  })

  on('classic.*', async ($, e, next) => {
    try {
      const r = e as Rec
      const event = typeof r.hook_event_name === 'string' ? r.hook_event_name : 'PreToolUse'
      const who = whoOf(r)
      if (event === 'SubagentStart' || event === 'SubagentStop') {
        const id = str(r.agent_id)
        const extra = id ? [`id: ${id}`] : []
        if (event === 'SubagentStop' && r.last_assistant_message) extra.push(`result: ${clip(r.last_assistant_message)}`)
        await log($, 'agent', String(r.agent_type ?? '?'), event === 'SubagentStart' ? 'started' : 'finished', { extra })
      }
      const isToolEvent = TOOL_EVENTS.includes(event)
      if (!isToolEvent || (await read($, showToolHooks))) {
        const { detail, extra } = describe(event, r)
        const hooks = await matchingHooks($, event, r)
        await log($, 'hook', event, detail, { who, extra, hooks })
      }
    } catch {
      // never let logging get in the way of the real hook
    }
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const list = await read($, triggers)
    const withTools = await read($, showToolHooks)
    const details = await read($, showDetails)
    const room = Math.max(1, (e.viewport?.rows ?? 30) - 5)
    const color = { skill: 'magenta', agent: 'cyan', hook: 'yellow' } as const

    // Newest first, as many whole entries as fit in the pane's rows.
    const shown: Trigger[] = []
    let used = 0
    for (const t of [...list].reverse()) {
      const lines = 1 + (details ? (t.extra?.length ?? 0) + (t.hooks?.length ?? 0) : 0)
      if (used + lines > room && shown.length > 0) break
      shown.push(t)
      used += lines
    }

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" gap={1}>
          <Button key="tools" onPress={async () => { await update($, showToolHooks, v => !v) }}>
            {withTools ? 'Hide tool hook events' : 'Show tool hook events'}
          </Button>
          <Button key="details" onPress={async () => { await update($, showDetails, v => !v) }}>
            {details ? 'Hide details' : 'Show details'}
          </Button>
          <Button key="clear" onPress={async () => { await update($, triggers, () => []) }}>Clear</Button>
        </Box>
        {list.length === 0 && <Text dimColor>Nothing has fired yet.</Text>}
        {shown.map((t, i) => (
          <Box key={`row-${i}`} flexDirection="column">
            <Text>
              <Text dimColor>{t.at} </Text>
              <Text color={color[t.kind]} bold>{t.kind.padEnd(5)} </Text>
              {t.name}
              {t.detail ? <Text dimColor> {t.detail}</Text> : ''}
              {t.who && t.who !== 'main' ? <Text color="cyan"> @{t.who}</Text> : ''}
            </Text>
            {details && (t.extra ?? []).map((x, j) => (
              <Text key={`x-${j}`} dimColor>{'         '}{x}</Text>
            ))}
            {details && (t.hooks ?? []).map((hook, j) => (
              <Text key={`h-${j}`} color="green">{'         ↳ '}{hook}</Text>
            ))}
          </Box>
        ))}
      </Box>
    )
  })
}
