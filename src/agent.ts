import { generateText, stepCountIs } from "ai";
import { model } from "./_internal/setup";
import { createSession } from "./session";
import { buildTools } from "./tools";

const SYSTEM_PROMPT = `
You are a precise web form automation agent. You fill out web forms by calling browser tools.

## Strict rules
1. Call navigate() first to load the target URL.
2. Call getPageSnapshot() after navigation — and after every accordion expand — to see current field IDs.
3. Fill inputs using the exact selector from the snapshot (prefer #id).
4. For collapsed sections: click the section toggle button using button:has-text("Section Name"),
   then call getPageSnapshot() again to discover the newly rendered fields before filling them.
5. Never guess a selector. If unsure, call getPageSnapshot() first.
6. For <select> dropdowns use selectOption(), never fill().
7. After submitting, call screenshotAndAnalyze() to confirm the success message.
8. Call done() as the very last action with success=true/false and a summary.

## Form-specific knowledge
- URL: https://magical-medical-form.netlify.app/
- Section 1 (Personal Information) is already expanded on load. Field IDs: #firstName, #lastName, #dateOfBirth, #medicalId
- Section 2 (Medical Information) and Section 3 (Emergency Contact) are collapsed. Toggle with: button:has-text("Medical Information") and button:has-text("Emergency Contact")
- Submit button selector: button[type="submit"]
`.trim();

export interface WorkflowResult {
  success: boolean;
  summary: string;
  steps: number;
  durationMs: number;
}

export interface RunOptions {
  instructions: string;
  variables?: Record<string, string>;
  headless?: boolean;
  onStep?: (info: { stepCount: number }) => void;
}

export async function runWorkflow({
  instructions,
  variables = {},
  headless = true,
  onStep,
}: RunOptions): Promise<WorkflowResult> {
  const startTime = Date.now();

  // Substitute {{variable}} placeholders
  let prompt = instructions;
  for (const [key, value] of Object.entries(variables)) {
    prompt = prompt.replaceAll(`{{${key}}}`, value);
  }

  console.log("\n Starting workflow...");
  console.log("Resolved prompt:\n", prompt);

  const page = await createSession("about:blank");
  const tools = buildTools(page);

  let finalResult = { success: false, summary: "Workflow did not call done()." };
  let stepCount = 0;

  try {
    await generateText({
      model,
      system: SYSTEM_PROMPT,
      prompt,
      tools,
      stopWhen: stepCountIs(40),
      onStepFinish: (step) => {
        stepCount++;

        for (const call of step.toolCalls ?? []) {
          console.log(`\n [Step ${stepCount}] ${call.toolName}`);
          const args = call.input as Record<string, unknown>;
          if (Object.keys(args).length) {
            // Don't print full base64 screenshots
            const printable = Object.fromEntries(
              Object.entries(args).map(([k, v]) =>
                typeof v === "string" && v.length > 200 ? [k, v.substring(0, 80) + "…"] : [k, v]
              )
            );
            console.log("   Args:", JSON.stringify(printable, null, 2).replace(/\n/g, "\n   "));
          }

          if (call.toolName === "done") {
            finalResult = {
              success: (args as { success: boolean }).success,
              summary: (args as { summary: string }).summary,
            };
          }
        }

        for (const res of step.toolResults ?? []) {
          const preview = String(res.output).substring(0, 300);
          console.log(`   ↳ ${preview}`);
        }

        onStep?.({ stepCount });
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    finalResult = { success: false, summary: `Agent error: ${message}` };
    console.error("Agent error:", err);
  } finally {
    await page.context().browser()?.close();
  }

  const durationMs = Date.now() - startTime;

  console.log("\n─────────────────────────────────────────");
  console.log(finalResult.success ? "Workflow succeeded" : "Workflow failed");
  console.log("summary:", finalResult.summary);
  console.log(`  ${(durationMs / 1000).toFixed(1)}s | ${stepCount} steps`);
  console.log("─────────────────────────────────────────\n");

  return { ...finalResult, steps: stepCount, durationMs };
}