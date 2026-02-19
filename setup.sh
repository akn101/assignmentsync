#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   AssignmentSync - One-Click Setup                         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    echo -e "${YELLOW}Please install Node.js from https://nodejs.org/${NC}"
    exit 1
fi

NODE_VERSION=$(node -v)
echo -e "${GREEN}✅ Node.js ${NODE_VERSION} found${NC}"
echo ""

# Install dependencies
echo -e "${BLUE}📦 Installing dependencies...${NC}"
if npm install --quiet; then
    echo -e "${GREEN}✅ Dependencies installed${NC}"
else
    echo -e "${RED}❌ Failed to install dependencies${NC}"
    exit 1
fi
echo ""

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo -e "${BLUE}🔧 Creating .env file...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✅ .env file created${NC}"
    echo -e "${YELLOW}   Note: Tokens will be filled in automatically${NC}"
    echo ""
fi

# Token extraction
echo -e "${BLUE}🔐 Token Extraction${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "This will launch Microsoft Edge to extract authentication tokens."
echo -e "Follow these steps:"
echo -e "  1. Edge will open and navigate to Teams Assignments"
echo -e "  2. Sign in if prompted"
echo -e "  3. Click on Assignments to trigger the token capture"
echo -e "  4. Wait for 'Tokens saved' message in the terminal"
echo -e "  5. Close the browser window"
echo ""
echo -e "${YELLOW}Press Enter to continue, or Ctrl+C to skip...${NC}"
read -r

node simple-edge-extractor.mjs
TOKEN_STATUS=$?

if [ $TOKEN_STATUS -eq 0 ]; then
    echo -e "${GREEN}✅ Tokens extracted successfully${NC}"
else
    echo -e "${RED}⚠️  Token extraction failed or was skipped${NC}"
    echo -e "${YELLOW}You can run 'npm run extract-tokens' later when ready${NC}"
    exit 1
fi
echo ""

# Validate setup
echo -e "${BLUE}🔍 Validating setup...${NC}"

if [ ! -f .env ]; then
    echo -e "${RED}❌ .env file not found${NC}"
    exit 1
fi

# Check for tokens in .env
if grep -q "^AUI_TOKEN=" .env && grep -q "^AUI_SESSION_ID=" .env; then
    AUI_TOKEN=$(grep "^AUI_TOKEN=" .env | cut -d'=' -f2)
    if [ -z "$AUI_TOKEN" ]; then
        echo -e "${RED}❌ Tokens are empty in .env${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Tokens found in .env${NC}"
else
    echo -e "${RED}❌ Token keys not found in .env${NC}"
    exit 1
fi
echo ""

# Success!
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Setup Complete! ✅                                       ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "You can now run:"
echo -e "  ${BLUE}npm run sync${NC}           - Sync all assignments"
echo -e "  ${BLUE}npm run sync:full${NC}      - Full sync (no incremental)"
echo -e "  ${BLUE}npm run sync:incremental${NC} - Incremental sync"
echo ""
echo -e "For more options, see:"
echo -e "  ${BLUE}node sync-assignments.mjs --help${NC}"
echo ""

# Ask if they want to run sync now
echo -e "${YELLOW}Would you like to run a sync now? (y/n)${NC}"
read -r RESPONSE

if [[ "$RESPONSE" =~ ^[Yy]$ ]]; then
    echo ""
    npm run sync
else
    echo -e "${BLUE}Setup complete! Run ${YELLOW}npm run sync${BLUE} when ready.${NC}"
fi
