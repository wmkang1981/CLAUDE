# CLAUDE

## Plugin Marketplace

This repo doubles as a Claude Code plugin marketplace.

### Add this marketplace (on any machine)
```
/plugin marketplace add wmkang1981/CLAUDE
```

### Install a plugin from it
```
/plugin install hello-plugin@wmkang-marketplace
```

### Add a new plugin later
1. Create a folder under `plugins/<plugin-name>/` with its own `.claude-plugin/plugin.json` and skills/commands/agents/hooks.
2. Add an entry for it in `.claude-plugin/marketplace.json` (in the `plugins` array).
3. Commit and push.
4. Run `/plugin marketplace update` (or re-add) on any machine to pick up the change, then `/plugin install <name>@wmkang-marketplace`.
