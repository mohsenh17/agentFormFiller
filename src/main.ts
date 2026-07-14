/**
 *
 * Usage:
 *   npm run dev
 *   npm run dev -- --workflow healthcareFormBasic
 *   npm run dev -- --firstName Jane --lastName Smith
 *   npm run dev -- --headless false     ← show the browser window
 *
 * All --key value pairs that match a workflow variable are forwarded as overrides.
 */

import { runWorkflow } from "./agent";
import { workflows } from "./workflows";

export async function main() {
  // ── Parse CLI args ──────────────────────────────────────────────────────────
  const args = process.argv.slice(2);
  const parsed: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 2) {
    parsed[args[i].replace(/^--/, "")] = args[i + 1] ?? "true";
  }

  const workflowName = parsed.workflow ?? "healthcareForm";
  const headless = parsed.headless !== "false";
  delete parsed.workflow;
  delete parsed.headless;

  const workflow = workflows[workflowName];
  if (!workflow) {
    console.error(
      `Unknown workflow "${workflowName}". Available: ${Object.keys(workflows).join(", ")}`
    );
    process.exit(1);
  }

  // Merge default variables with CLI overrides (bonus #3 – dynamic variables)
  const variables: Record<string, string> = { ...workflow.defaultVariables, ...parsed };

  console.log(`\n Magical Agent — workflow: "${workflowName}"`);

  const result = await runWorkflow({
    instructions: workflow.instructions,
    variables,
    headless,
  });

  process.exit(result.success ? 0 : 1);
}