# Magical Agent

AI-powered web form automation using **Playwright** + **Vercel AI SDK** (Gemini).

The project provides:

- A CLI interface for running workflows
- A REST API for triggering workflows
- A web dashboard for submitting and monitoring runs
- Dynamic scheduling with configurable intervals
- Visual self-correction using Gemini Vision

---

## Running

### CLI

Run the agent directly from the command line.

#### Full healthcare form (all sections)

```bash
npm run dev
```

#### Override variables

Dynamic variables can be passed to workflows:

```bash
npm run dev -- --firstName Jane --lastName Smith
```

#### Run minimal form

```bash
npm run dev -- --workflow healthcareFormBasic
```

#### Show browser window

By default Playwright runs headless. To see the browser:

```bash
npm run dev -- --headless false
```

---

## Web Dashboard

The project includes a browser-based dashboard for submitting workflows and monitoring executions.

Start the API server:

```bash
npm run server
```

Open:

```
http://localhost:3000
```

The dashboard allows you to:

- Select a workflow
- Provide dynamic variables
- Execute workflows
- Monitor execution history
- View success/failure status
- Enable/disable scheduled runs
- Configure scheduler intervals

**Example dashboard flow:**

```
Dashboard
    |
    ↓
POST /run
    |
    ↓
Agentic workflow execution
    |
    ↓
Run history update
    |
    ↓
Dashboard refresh
```

---

## API Server

Start:

```bash
npm run server
```

### Available endpoints

| Method | Endpoint           | Description           |
|--------|--------------------|-----------------------|
| GET    | `/health`          | Server status         |
| GET    | `/workflows`       | Available workflows   |
| POST   | `/run`             | Execute workflow      |
| GET    | `/runs`            | View run history      |
| POST   | `/schedule/enable` | Enable scheduler      |
| POST   | `/schedule/disable`| Disable scheduler     |
| GET    | `/schedule/status` | Scheduler status      |

### Running a Workflow Through API

```bash
curl -X POST http://localhost:3000/run \
  -H "Content-Type: application/json" \
  -d '{
    "workflow": "healthcareForm",
    "variables": {
      "firstName": "Jane",
      "lastName": "Smith",
      "dateOfBirth": "1990-01-01",
      "medicalId": "91927885"
    }
  }'
```

**Response:**

```json
{
  "success": true,
  "summary": "Healthcare form completed successfully",
  "steps": 14,
  "durationMs": 45231
}
```

---

## Scheduler

The dashboard supports configurable scheduling.

### Enable scheduler

```bash
curl -X POST http://localhost:3000/schedule/enable \
  -H "Content-Type: application/json" \
  -d '{
    "workflow": "healthcareForm",
    "intervalMinutes": 10
  }'
```

**Examples:**

Run every minute:

```json
{ "intervalMinutes": 1 }
```

Run every 30 minutes:

```json
{ "intervalMinutes": 30 }
```

### Check scheduler status

```bash
curl http://localhost:3000/schedule/status
```

### Disable scheduler

```bash
curl -X POST http://localhost:3000/schedule/disable
```

---

## Run History

All executions are stored in memory.

### View history

```bash
curl http://localhost:3000/runs
```

Each record contains:

```json
{
  "workflowName": "healthcareForm",
  "variables": {
    "firstName": "Jane"
  },
  "result": {
    "success": true,
    "steps": 14,
    "durationMs": 45231
  },
  "timestamp": "2026-07-15T12:00:00Z",
  "source": "api"
}
```

The dashboard automatically refreshes and displays these results.

---

## Implemented Features

| # | Feature | Location |
|---|---------|----------|
| 1 | Complete healthcare form automation | `workflows.ts` |
| 2 | Section expansion, scrolling, dropdown handling | `tools.ts` |
| 3 | Dynamic workflow variables (`{{firstName}}`, etc.) | `agent.ts` |
| 4 | REST API execution | `server.ts` → `POST /run` |
| 5 | Browser dashboard submission UI | `public/dashboard.html` |
| 6 | Run history monitoring | `server.ts` → `/runs` |
| 7 | Configurable cron scheduler | `server.ts` → `/schedule/enable` |
| 8 | Visual self-correction with Gemini Vision | `screenshotAndAnalyze` |

---

## Bonus #5 – Visual Self-Correction

The agent includes a visual verification tool: **`screenshotAndAnalyze`**

The tool:

1. Captures the current browser viewport
2. Sends the screenshot to Gemini Vision
3. Asks the model to analyze the page state
4. Returns visual feedback to the agent

The agent uses this to verify:

- Buttons are visible
- Sections expanded correctly
- Form state matches expectations
- Submission succeeded

**Example flow:**

```
Click Submit
      ↓
Take screenshot
      ↓
Gemini Vision analysis
      ↓
Success message detected
      ↓
done()
```

---

## Agentic Loop

The automation is implemented as a tool-calling agent loop.

```
Workflow instructions
        |
        ↓
generateText()
        |
        ↓
LLM selects next tool
        |
        ↓
Tool execution through Playwright
        |
        ↓
Tool result returned to model
        |
        ↓
Repeat until done()
        |
        ↓
WorkflowResult returned
```

**The final response:**

```json
{
  "success": true,
  "summary": "...",
  "steps": 14,
  "durationMs": 45231
}
```

---

## Available Agent Tools

| Tool | Description |
|------|-------------|
| `navigate` | Open webpage |
| `getPageSnapshot` | Extract DOM information |
| `fill` | Fill text fields |
| `selectOption` | Select dropdown values |
| `click` | Click buttons/elements |
| `scroll` | Scroll page or elements |
| `expandSection` | Open collapsed sections |
| `waitForElement` | Wait for page changes |
| `screenshotAndAnalyze` | Gemini Vision page analysis |
| `done` | Finish workflow execution |

---

## Architecture

```
             Dashboard
                 |
                 |
          Express Server
                 |
    +------------+-------------+
    |                          |
Workflow API              Scheduler
    |                          |
    ↓                          ↓
  Agent                  node-cron
    |
    ↓
Vercel AI SDK (Gemini)
    |
    ↓
 Playwright Browser
    |
    ↓
  Web Application
```

---

## Technologies

- TypeScript
- Node.js
- Express
- Playwright
- Vercel AI SDK
- Google Gemini
- node-cron
- HTML/CSS dashboard