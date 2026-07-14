# Magical Agent

AI-powered web form automation using **Playwright** + **Vercel AI SDK** (Gemini).


## Running

### CLI (npm run dev)

```bash
# Run the full healthcare form (all 3 sections)
npm run dev

# Override patient name (Bonus #3 – dynamic variables)
npm run dev -- --firstName Jane --lastName Smith

# Minimal form only
npm run dev -- --workflow healthcareFormBasic

# Show the browser window while running
npm run dev -- --headless false
```

### API server (Bonus #2 + #3 + #4)

```bash
npm run server
```

**Run a workflow via HTTP (Bonus #2 + #3):**
```bash
curl -X POST http://localhost:3000/run \
  -H "Content-Type: application/json" \
  -d '{"workflow":"healthcareForm","variables":{"firstName":"Jane","lastName":"Smith"}}'
```

**Enable 5-minute cron (Bonus #4):**
```bash
curl -X POST http://localhost:3000/schedule/enable \
  -H "Content-Type: application/json" \
  -d '{"workflow":"healthcareForm"}'

curl http://localhost:3000/schedule/status
curl -X POST http://localhost:3000/schedule/disable
```

**View run history:**
```bash
curl http://localhost:3000/runs
```

---

## Bonus features implemented

| # | Feature | Where |
|---|---------|-------|
| 1 | Sections 2 & 3 (dropdowns, scroll, expand) |
| 2 | Run via API call | `server.ts` → `POST /run` |
| 3 | Dynamic variables (`{{firstName}}` etc.) | 
| 4 | 5-minute cron schedule | `server.ts` → `POST /schedule/enable` |
| 5 | **Visual self-correction** — screenshot + vision analysis |

### Bonus #5 – Visual self-correction

The `screenshotAndAnalyze` tool captures the viewport as a PNG and sends it to Gemini Vision with a question. The agent uses this to:
- Confirm a success message is visible after submission

The agent's system prompt instructs it to call this tool after clicking Submit.

---

## How the agentic loop works

```
User prompt + workflow instructions
        ↓
  generateText (maxSteps: 40)
        ↓
  Model picks a tool → tool executes → result fed back
        ↓
  Repeat until model calls done()
        ↓
  Return { success, summary, steps, durationMs }
```

Tools available to the model:
- `navigate` — go to a URL
- `getPageSnapshot` — DOM → text summary of inputs/buttons/selects
- `fill` — type into an input
- `selectOption` — pick from a `<select>`
- `click` — click any element
- `scroll` — scroll page or element into view
- `expandSection` — open collapsed accordion/details
- `waitForElement` — wait for DOM changes
- `screenshotAndAnalyze` — vision-based page analysis
- `done` — signal completion to the loop