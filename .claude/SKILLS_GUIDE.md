# Claude Code Skills Guide

This document explains the custom skills available in this project.

## Available Skills

### `/status` - Project Status Analyzer

**Purpose**: Analyzes all markdown documentation files (.claude/*.md, ROADMAP.md) to identify TODO tasks, features, and implementation progress, then validates them against the actual codebase state.

**Usage**:
```bash
# In Claude Code, simply run:
/status

# Or if using the CLI:
claude /status
```

**What it does**:
1. Scans all markdown files for:
   - Checkbox items `[ ]` (incomplete) and `[x]` (complete)
   - TODO items and feature lists
   - Implementation phases and steps

2. Categorizes tasks by status:
   - ✅ COMPLETED
   - 🔄 IN PROGRESS
   - ⏸️ BLOCKED
   - ❌ NOT STARTED

3. Validates against codebase:
   - Checks if "completed" items are actually implemented
   - Verifies file paths mentioned in docs exist
   - Identifies discrepancies between docs and reality

4. Provides actionable report:
   - Overall completion percentage
   - Current phase and focus area
   - Top priority next steps
   - Blockers and issues
   - Recommendations

**Example Output**:
```
# Project Status Report

## Summary
- Overall Progress: 35%
- Current Phase: Phase 1.2 - Backend API Implementation
- Files Analyzed: 3 markdown files, 47 tasks found

## Phase 1: Core Content & Features (40% complete)
✅ Completed (12): Database setup, models, migrations
🔄 In Progress (8): Authentication system partially implemented
❌ Not Started (27): API CRUD operations, frontend auth UI

## Validation Issues
⚠️ authentication-system.md shows JWT as "configured" but Flask-JWT-Extended not in requirements.txt
⚠️ phase1-core-features.md marks migration as complete but 'flask db upgrade' not run

## Next Steps (Priority Order)
1. Run database migration: `cd backend && flask db upgrade`
2. Install Flask-JWT-Extended: `pip install Flask-JWT-Extended==4.6.0`
3. Replace hardcoded API data with database queries in backend/app/routes.py

## Recommendations
- Update documentation dates (last modified 3 days ago)
- Consider creating Phase 2 plan before finishing Phase 1
```

## Creating Your Own Skills

Skills are executable scripts (bash, python, node, etc.) that Claude Code can run. They should output a prompt that instructs Claude on what to do.

**Structure**:
```bash
#!/usr/bin/env bash

cat << 'PROMPT'
[Instructions for Claude Code to execute]
PROMPT
```

**Location**: `.claude/skills/[skill-name]`

**Naming**:
- Use lowercase, no extensions
- Make file executable: `chmod +x .claude/skills/skill-name`

**Best Practices**:
- Be specific in your instructions
- Ask Claude to validate/verify claims
- Request structured output formats
- Include examples in the prompt when helpful

## More Skill Ideas

- `/review` - Code review for recent changes
- `/test-coverage` - Analyze test coverage gaps
- `/security` - Security audit checklist
- `/deps` - Dependency update checker
- `/deploy-check` - Pre-deployment validation
