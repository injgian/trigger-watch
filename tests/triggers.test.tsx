import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'trigger-watch',
  component: 'Pane',
  requestId: 'trigger-watch',
  surface: 'desktop',
  props: {
    title: 'Triggers',
    isFocused: false,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

test('a hook row names the event, its details and the settings hook it ran', async ($, on) => {
  on('classic.*', () => ({}))
  on('settings.read', (_, e) => ({
    value:
      e.source === 'project'
        ? { hooks: { Notification: [{ matcher: 'idle_prompt', hooks: [{ type: 'command', command: 'say done' }] }] } }
        : {},
  }))

  await $.classic.Notification({ notification_type: 'idle_prompt', message: 'Claude is waiting', title: 'Waiting' })

  const ui = await $.ui.mount(PANE)
  expect((await ui.find({ type: 'Text', text: /Notification/ }))?.text).toContain('idle_prompt')
  expect((await ui.find({ type: 'Text', text: /message:/ }))?.text).toContain('Claude is waiting')
  expect((await ui.find({ type: 'Text', text: /say done/ }))?.text).toContain('project [idle_prompt]')
  await ui.unmount()
})

test('a subagent row carries its id and the hook names where it fired', async ($, on) => {
  on('classic.*', () => ({}))
  on('settings.read', () => ({ value: {} }))

  await $.classic.SubagentStart({ agent_id: 'abcdef1234567', agent_type: 'Explore' })
  await $.classic.SubagentStop({
    agent_id: 'abcdef1234567',
    agent_type: 'Explore',
    stop_hook_active: false,
    agent_transcript_path: '/t.jsonl',
    last_assistant_message: 'Found 3 files',
  })

  const ui = await $.ui.mount(PANE)
  expect((await ui.find({ type: 'Text', text: /id: abcdef1234567/ }))).toBeDefined()
  expect((await ui.find({ type: 'Text', text: /result: Found 3 files/ }))).toBeDefined()
  expect((await ui.find({ type: 'Text', text: /@Explore#abcdef12/ }))).toBeDefined()
  await ui.unmount()
})
