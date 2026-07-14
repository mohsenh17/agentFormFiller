import { tool } from "ai";
import { z } from "zod";
import { type Page } from "playwright";
import { generateText } from "ai";
import { model } from "./_internal/setup";

export function buildTools(page: Page) {
  return {

    // ── Navigation ────────────────────────────────────────────────────────────

    navigate: tool({
      description: "Navigate the browser to a URL and wait for the page to settle.",
      inputSchema: z.object({
        url: z.string(),
      }),
      execute: async ({ url }) => {
        await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
        return `Navigated to ${url}`;
      },
    }),

    // ── Page inspection ───────────────────────────────────────────────────────

    getPageSnapshot: tool({
      description:
        "Return a structured text snapshot of the current page state: " +
        "all visible inputs (with their IDs/names and current values), " +
        "buttons, select options, and whether accordion sections are expanded. " +
        "Always call this after navigating or after expanding a section.",
      inputSchema: z.object({}),
      execute: async () => {
        const snapshot = await page.evaluate(() => {
          const lines: string[] = [];
          lines.push(`TITLE: ${document.title}`);
          lines.push(`URL: ${location.href}`);

          // ── Accordion section buttons ──
          // The form uses <button type="button"> for collapsible sections.
          // We detect expansion by checking if the chevron has the "rotate-180" class
          // (the open section's chevron has it, closed sections don't).
          document.querySelectorAll<HTMLButtonElement>('button[type="button"]').forEach((btn) => {
            const label = btn.innerText.trim().replace(/\s+/g, " ");
            const chevron = btn.querySelector("svg:last-child");
            const isExpanded = chevron?.classList.contains("rotate-180") ?? false;
            lines.push(`SECTION_TOGGLE: "${label}" expanded=${isExpanded}`);
          });

          // ── All form inputs ──
          document
            .querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
              "input, select, textarea"
            )
            .forEach((el) => {
              // Find associated label
              const labelEl =
                (el as HTMLInputElement).labels?.[0] ??
                document.querySelector<HTMLLabelElement>(`label[for="${el.id}"]`);
              const label =
                labelEl?.innerText.trim() ||
                el.getAttribute("aria-label") ||
                (el as HTMLInputElement).placeholder ||
                el.name || el.id || "(unlabelled)";

              const type = el.tagName === "SELECT"
                ? "select"
                : (el as HTMLInputElement).type || "input";

              // Best selector: prefer #id, then [name=], then tag
              const selector = el.id
                ? `#${el.id}`
                : el.name
                ? `[name="${el.name}"]`
                : el.tagName.toLowerCase();

              // For selects, list the options
              let optionList = "";
              if (el.tagName === "SELECT") {
                const opts = Array.from((el as HTMLSelectElement).options)
                  .map((o) => `"${o.text}"(value="${o.value}")`)
                  .join(", ");
                optionList = ` OPTIONS=[${opts}]`;
              }

              lines.push(
                `INPUT label="${label}" type=${type} selector=${selector} ` +
                `currentValue="${el.value}"${optionList}`
              );
            });

          // ── Submit and action buttons ──
          document
            .querySelectorAll<HTMLButtonElement | HTMLInputElement>(
              'button[type="submit"], input[type="submit"]'
            )
            .forEach((el) => {
              const label =
                (el as HTMLButtonElement).innerText?.trim() ||
                (el as HTMLInputElement).value ||
                "Submit";
              lines.push(`SUBMIT_BUTTON: "${label}" selector=button[type="submit"]`);
            });

          return lines.join("\n");
        });

        return snapshot || "Page appears empty.";
      },
    }),

    // ── Fill a text/date/number input ─────────────────────────────────────────

    fill: tool({
      description:
        "Clear a text, date, or number input field and type a value. " +
        "Use the selector from getPageSnapshot (prefer #id selectors).",
      inputSchema: z.object({
        selector: z.string().describe("CSS selector, e.g. '#firstName' or '[name=\"dob\"]'"),
        value: z.string().describe("Value to enter. Dates must be YYYY-MM-DD."),
      }),
      execute: async ({ selector, value }) => {
        await page.waitForSelector(selector, { timeout: 10_000 });
        await page.fill(selector, value);
        // Read back the value to confirm
        const actual = await page.$eval(
          selector,
          (el) => (el as HTMLInputElement).value
        );
        return `Filled ${selector} → "${actual}"`;
      },
    }),

    // ── Select a dropdown option ──────────────────────────────────────────────

    selectOption: tool({
      description:
        "Choose an option in a <select> dropdown. " +
        "Pass either the option's value attribute or its visible label text. " +
        "Get the list of options from getPageSnapshot first.",
      inputSchema: z.object({
        selector: z.string().describe("CSS selector for the <select> element."),
        value: z.string().describe("Option value attribute or visible label to select."),
      }),
      execute: async ({ selector, value }) => {
        await page.waitForSelector(selector, { timeout: 10_000 });
        // Try by value first, fall back to label
        try {
          await page.selectOption(selector, { value });
        } catch {
          await page.selectOption(selector, { label: value });
        }
        const actual = await page.$eval(
          selector,
          (el) => (el as HTMLSelectElement).options[(el as HTMLSelectElement).selectedIndex]?.text
        );
        return `Selected "${actual}" in ${selector}`;
      },
    }),

    // ── Click any element ─────────────────────────────────────────────────────

    click: tool({
      description:
        "Click an element. For accordion section headers use Playwright's " +
        "text selector syntax: button:has-text(\"Medical Information\"). " +
        "For submit: button[type=\"submit\"].",
      inputSchema: z.object({
        selector: z.string(),
      }),
      execute: async ({ selector }) => {
        await page.waitForSelector(selector, { timeout: 10_000 });
        await page.click(selector);
        // Short pause for React to re-render after accordion toggle
        await page.waitForTimeout(400);
        return `Clicked "${selector}"`;
      },
    }),

    // ── Scroll ────────────────────────────────────────────────────────────────

    scroll: tool({
      description:
        "Scroll the page. Pass pixels to scroll by amount, or selector to " +
        "bring a specific element into view before interacting with it.",
      inputSchema: z.object({
        pixels: z.number().optional().describe("Pixels to scroll (positive = down). Default 400."),
        selector: z.string().optional().describe("Scroll this element into view instead."),
      }),
      execute: async ({ pixels = 400, selector }) => {
        if (selector) {
          await page.locator(selector).scrollIntoViewIfNeeded({ timeout: 10_000 });
          return `Scrolled "${selector}" into view`;
        }
        await page.evaluate((px) => window.scrollBy(0, px), pixels);
        return `Scrolled ${pixels}px`;
      },
    }),

    // ── Wait for element ──────────────────────────────────────────────────────

    waitForElement: tool({
      description: "Wait until a selector appears in the DOM. Use after clicking an accordion to wait for its fields to render.",
      inputSchema: z.object({
        selector: z.string(),
        timeout: z.number().optional().describe("Max ms. Default 8000."),
      }),
      execute: async ({ selector, timeout = 8_000 }) => {
        await page.waitForSelector(selector, { timeout });
        return `"${selector}" is now in the DOM`;
      },
    }),

    // ── Bonus #5: Screenshot + vision analysis ────────────────────────────────

    screenshotAndAnalyze: tool({
      description:
        "Capture the current browser viewport as an image and ask a vision model " +
        "a question about what is visible. Use after submitting to confirm success, " +
        "or when the text snapshot alone is ambiguous.",
      inputSchema: z.object({
        question: z.string().describe(
          "What to look for, e.g. \"Is there a success or confirmation message?\""
        ),
      }),
      execute: async ({ question }) => {
        const buffer = await page.screenshot({ type: "png", fullPage: false });
        const base64 = buffer.toString("base64");

        const response = await generateText({
          model,
          messages: [
            {
                role: "user",
                content: [
                {
                    type: "image",
                    image: `data:image/png;base64,${base64}`,
                },
                {
                    type: "text",
                    text: `You are analyzing a screenshot of a medical web form. ${question} Be concise and specific about what you see.`,
                },
                ],
            },
        ],
          maxOutputTokens: 300,
        });

        return response.text;
      },
    }),

    // ── Completion signal ─────────────────────────────────────────────────────

    done: tool({
        description:
            "Signal that the workflow is complete. Call with success=true if the form " +
            "was submitted and a confirmation was visible, or success=false with the " +
            "error reason if something went wrong.",
        inputSchema: z.object({
            success: z.boolean(),
            summary: z.string(),
        }),
        execute: async ({ success, summary }) => {
            return {
            success,
            summary,
            };
        },
    }),
  };
}