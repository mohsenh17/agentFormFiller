/**
 
 * ── Endpoints ──────────────────────────────────────────────────────────────
 *
 *  GET  /health
 *  GET  /workflows                              list workflows + default vars
 *
 *  POST /run
 *       { workflow?, variables?, headless? }
 *       → { success, summary, steps, durationMs }
 *
 *  GET  /runs                                   last 50 results
 *
 *  POST /schedule/enable
 *       { workflow?, variables? }               start cron (every 5 min)
 *  POST /schedule/disable                       stop cron
 *  GET  /schedule/status
 *
 * ── Example curl ───────────────────────────────────────────────────────────
 *
 *  curl -s -X POST http://localhost:3000/run \
 *    -H "Content-Type: application/json" \
 *    -d '{"workflow":"healthcareForm","variables":{"firstName":"Jane","lastName":"Smith"}}'
 *
 *  curl -s -X POST http://localhost:3000/schedule/enable \
 *    -H "Content-Type: application/json" \
 *    -d '{"workflow":"healthcareForm"}'
 */

import "dotenv-defaults/config";
import express, { Request, Response } from "express";
import * as cron from "node-cron";
import { runWorkflow, WorkflowResult } from "./agent";
import { workflows } from "./workflows";

const app = express();
app.use(express.json());

const PORT = process.env.PORT ?? 3000;
const serverStart = Date.now();

// ── Run history ─────────────────────────────────────────────────────────────

interface RunRecord {
  workflowName: string;
  variables: Record<string, string>;
  result: WorkflowResult;
  timestamp: string;
  source: "api" | "cron";
}

const runHistory: RunRecord[] = [];
const MAX_HISTORY = 50;

function recordRun(
  workflowName: string,
  variables: Record<string, string>,
  result: WorkflowResult,
  source: "api" | "cron" = "api"
) {
  runHistory.unshift({ workflowName, variables, result, timestamp: new Date().toISOString(), source });
  if (runHistory.length > MAX_HISTORY) runHistory.pop();
}

// ── Scheduler state ──────────────────────────────────────────────────────────

let scheduledJob: cron.ScheduledTask | null = null;
let scheduledConfig: { workflowName: string; variables: Record<string, string>,  } | null = null;


// ── Routes ───────────────────────────────────────────────────────────────────

app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    uptimeSeconds: Math.floor((Date.now() - serverStart) / 1000),
    schedulerEnabled: !!scheduledJob,
    recentRuns: runHistory.length,
  });
});

app.get("/workflows", (_req: Request, res: Response) => {
  const list = Object.entries(workflows).map(([name, wf]) => ({
    name,
    defaultVariables: wf.defaultVariables,
    instructionPreview: wf.instructions.substring(0, 120) + "...",
  }));
  res.json(list);
});

app.post("/run", async (req: Request, res: Response) => {
  const workflowName: string = req.body.workflow ?? "healthcareForm";
  const workflow = workflows[workflowName];

  if (!workflow) {
    res.status(400).json({
      error: `Unknown workflow "${workflowName}". Available: ${Object.keys(workflows).join(", ")}`,
    });
    return;
  }

  const variables: Record<string, string> = {
    ...workflow.defaultVariables,
    ...(req.body.variables ?? {}),
  };
  const headless: boolean = req.body.headless ?? true;

  console.log(`\n [API] POST /run  workflow=${workflowName}`, variables);

  try {
    const result = await runWorkflow({ instructions: workflow.instructions, variables, headless });
    recordRun(workflowName, variables, result, "api");
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

app.get("/runs", (_req: Request, res: Response) => {
  res.json(runHistory);
});

// ── Scheduler ────────────────────────────────────────────────────────────────

app.post("/schedule/enable", (req: Request, res: Response) => {
  if (scheduledJob) scheduledJob.stop();

  const workflowName: string = req.body.workflow ?? "healthcareForm";
  const workflow = workflows[workflowName];
  if (!workflow) {
    res.status(400).json({ error: `Unknown workflow "${workflowName}"` });
    return;
  }

  const variables: Record<string, string> = {
    ...workflow.defaultVariables,
    ...(req.body.variables ?? {}),
  };

  scheduledConfig = { workflowName, variables };

  // Every 5 minutes
  scheduledJob = cron.schedule("*/5 * * * *", async () => {
    console.log(`\n [Cron] Firing: ${workflowName}`);
    try {
      const result = await runWorkflow({ instructions: workflow.instructions, variables, headless: true });
      recordRun(workflowName, variables, result, "cron");
    } catch (err) {
      console.error("[Cron] Run failed:", err);
    }
  });

  console.log(`\n Scheduler enabled — "${workflowName}" every 5 minutes`);
  res.json({ enabled: true, workflowName, variables, message: "Runs every 5 minutes." });
});

app.post("/schedule/disable", (_req: Request, res: Response) => {
  scheduledJob?.stop();
  scheduledJob = null;
  scheduledConfig = null;
  console.log("\n Scheduler disabled");
  res.json({ enabled: false, message: "Scheduler stopped." });
});

app.get("/schedule/status", (_req: Request, res: Response) => {
  res.json({
    enabled: !!scheduledJob,
    config: scheduledConfig,
    message: scheduledJob ? "Active — every 5 minutes." : "Not running.",
  });
});

// ── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🌐 Magical Agent API — http://localhost:${PORT}`);
  console.log("   GET  /health");
  console.log("   GET  /workflows");
  console.log("   POST /run              { workflow?, variables?, headless? }");
  console.log("   GET  /runs");
  console.log("   POST /schedule/enable  { workflow?, variables? }");
  console.log("   POST /schedule/disable");
  console.log("   GET  /schedule/status\n");
});