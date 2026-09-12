# Superpowers Development Rules

<EXTREMELY-IMPORTANT>
If you think there is even a 1% chance a skill applies to what you are doing, you ABSOLUTELY MUST invoke and follow the skill.
IF A SKILL APPLIES TO YOUR TASK, YOU DO NOT HAVE A CHOICE. YOU MUST USE IT.
No AI slop, no dumb code, no placeholders, no skipped tests.
</EXTREMELY-IMPORTANT>

## Core Superpowers Workflow

1. **Systematic Debugging**:
   - Investigate the root cause first with concrete evidence.
   - Do not guess or apply random speculative edits.
   - Trace logs, test runs, and configuration directly.

2. **Test-Driven & Disciplined Implementation**:
   - Write or update tests to verify fixes.
   - Avoid creating simple MVP or half-baked code.
   - Adhere to YAGNI, DRY, and clean architecture.

3. **Verification Before Completion**:
   - Always run the build/lint/test commands to prove everything works before declaring completion.
   - Check device connection (`adb devices`), build logs, and runtime errors.
   - Ensure zero errors, warnings, or missing dependencies.

4. **Task & State Tracking**:
   - Maintain a clear task list for multi-step tasks.
   - Update status as each step is verified.
