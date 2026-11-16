# trigger-watch

A Claude Code mod that opens a **Triggers** pane beside the chat and lists, live and newest first, everything that fires while you work:

- **skill**: each skill invoked, by `/name` or by Claude
- **agent**: each subagent as it starts and finishes, by type
- **hook**: each hook event as it fires (`UserPromptSubmit`, `Stop`, `SubagentStart`, …)

Tool hook events (`PreToolUse`, `PostToolUse`, permission events) fire on every tool call, so they're hidden until you press **Show tool hook events**. **Clear** empties the list. Run `/triggers` to reopen the pane.

A hook row means the event fired and any hooks configured for it ran then; it does not name the script. For that, run `claude --debug`.

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
