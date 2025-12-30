# Project-Specific Guidelines

This file contains important workflow and development guidelines for Claude Code when working in this repository.

## Development Server Management

**DO NOT run backend or frontend development servers automatically.**

- The user is responsible for starting and managing both `python run.py` (backend) and `npm run dev` (frontend)
- Do not execute these commands unless explicitly requested by the user
- You may check the status of running background processes if needed, but do not start new server instances

## Git Workflow and Code Review

**The user is the only one who commits to git.**

When working on a coding session with detailed step-by-step planning:

1. **Before implementing each step/task:**
   - Provide a brief explanation of what is about to be done
   - Explain the approach and any important decisions
   - Wait for user acknowledgment if needed

2. **After implementing each step/task:**
   - Each implemented step must be reviewed by the user before proceeding to the next
   - The user will commit the changes themselves
   - Do not create git commits unless explicitly requested
   - Do not run `git add`, `git commit`, or `git push` commands automatically

3. **Workflow pattern:**
   ```
   ’ Explain what Step 1 will do
   ’ Implement Step 1
   ’ User reviews and commits
   ’ Explain what Step 2 will do
   ’ Implement Step 2
   ’ User reviews and commits
   ’ ... and so on
   ```

This ensures the user has full control over the git history and can review each change before it's committed.
