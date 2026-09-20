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

## Project Files (work-in-progress source code)

Each project lives in its own folder under `projects/<project-name>/`. This repo is the
single source of truth shared between PC A and PC B.

### One-time setup on a new PC
```powershell
git clone https://github.com/wmkang1981/CLAUDE.git C:\Users\<user>\ClaudeSync
```
Then, inside a Claude Code session on that PC, register the marketplace once:
```
/plugin marketplace add wmkang1981/CLAUDE
```

### Daily workflow
Run these from a regular PowerShell terminal (not inside Claude) — this is a manual
step by design, not an automatic hook.

**Starting work on a project** (pulls the latest files, creates the project folder if new):
```powershell
C:\Users\<user>\ClaudeSync\scripts\claude-sync.ps1 start -Project <name>
```
It prints the local path — point Claude Code's working directory at that folder and start working.
If you added/changed a plugin recently, also run `/plugin marketplace update` once inside the session.

**Ending a session** (commits and pushes whatever changed back to GitHub):
```powershell
C:\Users\<user>\ClaudeSync\scripts\claude-sync.ps1 end -Project <name>
```
Run it without `-Project` to commit/push everything in the repo (e.g. after editing a plugin).

**List existing projects:**
```powershell
C:\Users\<user>\ClaudeSync\scripts\claude-sync.ps1 list
```
