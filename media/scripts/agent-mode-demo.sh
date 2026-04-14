#!/usr/bin/env bash
# =============================================================
# Agent Mode Demo — Copilot Cockpit Terminal Recording
# Simulates an Agent Mode session in VS Code / Copilot Chat
# =============================================================
# Usage: asciinema rec --command "./media/scripts/agent-mode-demo.sh" \
#        --cols 100 --rows 30 media/casts/agent-mode.cast

set -e

# Simulated typing effect
type_slow() {
    local text="$1"
    local delay="${2:-0.04}"
    for ((i = 0; i < ${#text}; i++)); do
        printf '%s' "${text:$i:1}"
        sleep "$delay"
    done
}

type_line() {
    type_slow "$1"
    echo
}

prompt() {
    printf '\033[1;32m❯\033[0m '
}

copilot_reply() {
    printf '\033[1;36m🤖 Copilot:\033[0m '
    type_line "$1" 0.02
}

section() {
    echo
    printf '\033[1;33m── %s ──\033[0m\n' "$1"
    echo
}

clear
echo
printf '\033[1;37m  ✈ COPILOT COCKPIT — Agent Mode Demo\033[0m\n'
printf '\033[0;90m  ─────────────────────────────────────\033[0m\n'
echo
sleep 1

# --- Step 1: Start Agent Mode ---
section "1. Starting Agent Mode"

prompt
type_line "# Open VS Code Copilot Chat, switch to Agent Mode"
sleep 0.5

prompt
type_line "# Type your task in natural language:"
sleep 0.3

printf '\033[1;35m@agent\033[0m '
type_line "Create a REST API endpoint for user registration with email validation, password hashing, and a PostgreSQL insert." 0.03
sleep 1

# --- Step 2: Agent Plans ---
section "2. Agent Creates a Plan"

copilot_reply "I'll create the registration endpoint. Here's my plan:"
sleep 0.5
echo
printf '\033[0;90m  1. Create src/routes/auth.ts with POST /register\033[0m\n'
sleep 0.2
printf '\033[0;90m  2. Add email validation with zod schema\033[0m\n'
sleep 0.2
printf '\033[0;90m  3. Hash password with bcrypt\033[0m\n'
sleep 0.2
printf '\033[0;90m  4. Insert user into PostgreSQL via Prisma\033[0m\n'
sleep 0.2
printf '\033[0;90m  5. Write unit tests in src/routes/auth.test.ts\033[0m\n'
sleep 1

# --- Step 3: Agent Edits Files ---
section "3. Agent Edits Multiple Files"

printf '\033[0;33m📝 Creating src/routes/auth.ts...\033[0m\n'
sleep 0.5
printf '\033[0;32m  + import { z } from "zod";\033[0m\n'
printf '\033[0;32m  + import bcrypt from "bcrypt";\033[0m\n'
printf '\033[0;32m  + import { prisma } from "../db";\033[0m\n'
sleep 0.3
printf '\033[0;32m  + \033[0m\n'
printf '\033[0;32m  + const registerSchema = z.object({\033[0m\n'
printf '\033[0;32m  +   email: z.string().email(),\033[0m\n'
printf '\033[0;32m  +   password: z.string().min(8),\033[0m\n'
printf '\033[0;32m  + });\033[0m\n'
sleep 0.8

printf '\033[0;33m📝 Updating src/app.ts...\033[0m\n'
sleep 0.3
printf '\033[0;32m  + import { authRouter } from "./routes/auth";\033[0m\n'
printf '\033[0;32m  + app.use("/api/auth", authRouter);\033[0m\n'
sleep 0.5

# --- Step 4: Agent Runs Terminal Commands ---
section "4. Agent Runs Terminal Commands"

printf '\033[0;90m$ npx prisma migrate dev --name add-users\033[0m\n'
sleep 0.5
printf '\033[0;32m✓ Migration applied: add-users\033[0m\n'
sleep 0.3

printf '\033[0;90m$ npm test -- --filter auth\033[0m\n'
sleep 0.8
printf '\033[0;32m ✓ POST /register — creates user with valid data (12ms)\033[0m\n'
printf '\033[0;32m ✓ POST /register — rejects duplicate email (8ms)\033[0m\n'
printf '\033[0;32m ✓ POST /register — rejects weak password (3ms)\033[0m\n'
printf '\033[0;32m\n Tests: 3 passed, 3 total\033[0m\n'
sleep 1

# --- Step 5: Summary ---
section "5. Done"

copilot_reply "Registration endpoint created with validation, hashing, and tests. 3 files modified, 3 tests passing."
echo
printf '\033[1;32m  ✈ Agent Mode — Task complete\033[0m\n'
echo
sleep 2
