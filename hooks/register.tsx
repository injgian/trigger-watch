import { atom, read, update } from 'claude-code'
import type { Register, EngineInterface } from 'claude-code'

import type { Trigger, TriggerKind } from '../types'

const PANE = 'trigger-watch'
const TITLE = 'Triggers'
const triggers = atom({ plugin: 'trigger-watch', key: 'triggers' } as const, [], {
  shape: 'triggers-1',
})
const showToolHooks = atom({ plugin: 'trigger-watch', key: 'showToolHooks' } as const, false)

// Hook events that fire around every tool call; hidden unless toggled on.
const TOOL_EVENTS = ['PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'PostToolBatch', 'PermissionRequest']

function stamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

async function log($: EngineInterface, kind: TriggerKind, name: string, detail: string) {
  const item: Trigger = { at: stamp(), kind, name, detail }
  await update($, triggers, list => [...list, item].slice(-300))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'triggers', description: 'Open the pane listing skills, subagents and hook events as they fire' })
    void $.ui.open({ id: PANE, title: TITLE })
    return next(e)
  })

  on('command.run', { command: 'triggers' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })
    return { text: 'Triggers pane opened.' }
  })

  on('skill.prompt', async ($, e, next) => {
    await log($, 'skill', e.skill, 'invoked')
    return next(e)
  })

  on('classic.*', async ($, e, next) => {
    try {
      const r = e as Record<string, unknown>
      const event = typeof r.hook_event_name === 'string' ? r.hook_event_name : 'PreToolUse'
      if (event === 'SubagentStart') {
        await log($, 'agent', String(r.agent_type ?? '?'), 'started')
      } else if (event === 'SubagentStop') {
        await log($, 'agent', String(r.agent_type ?? '?'), 'finished')
      }
      const tool = typeof r.tool_name === 'string' ? r.tool_name : typeof r.tool === 'string' ? r.tool : ''
      const isToolEvent = TOOL_EVENTS.includes(event)
      if (!isToolEvent || (await read($, showToolHooks))) {
        await log($, 'hook', event, tool)
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
    const room = Math.max(1, (e.viewport?.rows ?? 30) - 5)
    const color = { skill: 'magenta', agent: 'cyan', hook: 'yellow' } as const

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" gap={1}>
          <Button key="tools" onPress={async () => { await update($, showToolHooks, v => !v) }}>
            {withTools ? 'Hide tool hook events' : 'Show tool hook events'}
          </Button>
          <Button key="clear" onPress={async () => { await update($, triggers, () => []) }}>Clear</Button>
        </Box>
        {list.length === 0 && <Text dimColor>Nothing has fired yet.</Text>}
        {list.slice(-room).reverse().map((t, i) => (
          <Text key={`${i}`}>
            <Text dimColor>{t.at} </Text>
            <Text color={color[t.kind]} bold>{t.kind.padEnd(5)} </Text>
            {t.name}
            {t.detail ? <Text dimColor> {t.detail}</Text> : ''}
          </Text>
        ))}
      </Box>
    )
  })
}
