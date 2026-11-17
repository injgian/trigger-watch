# trigger-watch

A Claude Code mod that opens a **Triggers** pane beside the chat and lists, live and newest first, everything that fires while you work:

- **skill**: each skill invoked, by `/name` or by Claude
- **agent**: each subagent as it starts and finishes, by type
- **hook**: each hook event as it fires (`UserPromptSubmit`, `Stop`, `SubagentStart`, …)

Tool hook events (`PreToolUse`, `PostToolUse`, permission events) fire on every tool call, so they're hidden until you press **Show tool hook events**. **Clear** empties the list. Run `/triggers` to reopen the pane.

Each row shows details under it (**Hide details** folds them):

- where it fired: `@Explore#1a2b3c4d` when inside a subagent
- what it was about: the tool and its key arguments (command, file path, pattern…), the prompt, the stop's last message, the notification, the compaction trigger, and so on
- for agents, the full agent id and, when it finishes, the start of its result
- for skills, its source, plugin and file
- in green (`↳`), each settings hook whose matcher matched the event, with the settings file it came from (`user`, `project`, `local`, `flag`, `policy`) and its command

Hooks that plugins register are not listed in green; run `claude --debug` to see those.

## Install

At the prompt of a terminal session:

```
/plugin install trigger-watch --marketplace injgian/trigger-watch
```

From a shell:

```bash
claude plugin install trigger-watch --marketplace injgian/trigger-watch
```

In the desktop app: click + next to the prompt box, then Plugins, Add marketplace with `injgian/trigger-watch`, then Add plugin.

## License

MIT
