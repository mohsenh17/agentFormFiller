export interface Workflow {
  defaultVariables: Record<string, string>;
  instructions: string;
}

export const workflows: Record<string, Workflow> = {
  /**
   * Full form — all three sections.
   */
  healthcareForm: {
    defaultVariables: {
      firstName: "John",
      lastName: "Doe",
      dateOfBirth: "1990-01-01",
      medicalId: "9092301202",
    },
    instructions: `
Complete the healthcare intake form at https://magical-medical-form.netlify.app/

## Section 1 — Personal Information (already expanded on page load)
The fields have these exact IDs — fill them directly:
  - #firstName       → {{firstName}}
  - #lastName        → {{lastName}}
  - #dateOfBirth     → {{dateOfBirth}}  (input type="date", use YYYY-MM-DD format)
  - #medicalId       → {{medicalId}}

## Section 2 — Medical Information (collapsed by default)
Click the accordion button whose visible text contains "Medical Information" to expand it.
Use the selector: button:has-text("Medical Information")
After expanding, call getPageSnapshot to discover the newly revealed fields, then fill them all.
For any dropdown, pick the first non-empty/non-placeholder option.
For any text field with no specified value, enter a reasonable placeholder.

## Section 3 — Emergency Contact (collapsed by default)
Click the accordion button whose visible text contains "Emergency Contact" to expand it.
Use the selector: button:has-text("Emergency Contact")
After expanding, call getPageSnapshot again to discover the fields, then fill them all.

## Submission
Click the submit button: button[type="submit"]
After clicking, call screenshotAndAnalyze with question "Is there a success or confirmation message visible on the page?"
Call done(success=true) if confirmed, or done(success=false, summary=<error>) otherwise.
    `.trim(),
  },

  /**
   * Minimal — only the four required fields from the brief.
   */
  healthcareFormBasic: {
    defaultVariables: {
      firstName: "John",
      lastName: "Doe",
      dateOfBirth: "1990-01-01",
      medicalId: "91927885",
    },
    instructions: `
Complete the healthcare intake form at https://magical-medical-form.netlify.app/

Section 1 is already expanded. Fill these fields directly by ID:
  - #firstName   → {{firstName}}
  - #lastName    → {{lastName}}
  - #dateOfBirth → {{dateOfBirth}}
  - #medicalId   → {{medicalId}}

Then click button[type="submit"].
Call screenshotAndAnalyze to confirm a success message, then call done().
    `.trim(),
  },
};