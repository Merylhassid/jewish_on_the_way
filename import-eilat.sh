#!/bin/bash

# Eilat Synagogues Import Script
# This script logs in, gets a JWT token, and imports 37 Eilat synagogues

set -e

BACKEND_URL="http://localhost:3001"
EMAIL="daniyehudai@gmail.com"
PASSWORD="daniel2109"
IMPORT_FILE="backend/import-eilat-synagogues.json"

echo "🔐 Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$BACKEND_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\", \"password\": \"$PASSWORD\"}")

echo "Response: $LOGIN_RESPONSE"

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Login failed. Could not extract token."
  echo "Full response: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Login successful!"
echo "🎫 Token: ${TOKEN:0:50}..."

echo ""
echo "📤 Importing 37 Eilat synagogues..."
IMPORT_RESPONSE=$(curl -s -X POST "$BACKEND_URL/admin/synagogues/bulk" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @"$IMPORT_FILE")

echo ""
echo "📊 Import Result:"
echo "$IMPORT_RESPONSE" | jq '.' 2>/dev/null || echo "$IMPORT_RESPONSE"

# Extract summary
CREATED=$(echo "$IMPORT_RESPONSE" | grep -o '"created":[0-9]*' | cut -d':' -f2)
UPDATED=$(echo "$IMPORT_RESPONSE" | grep -o '"updated":[0-9]*' | cut -d':' -f2)
SKIPPED=$(echo "$IMPORT_RESPONSE" | grep -o '"skipped":[0-9]*' | cut -d':' -f2)
ERRORS=$(echo "$IMPORT_RESPONSE" | grep -o '"errors":[0-9]*' | cut -d':' -f2)

echo ""
echo "════════════════════════════════════════════════════════"
echo "📋 Summary:"
echo "  ✅ Created:  $CREATED"
echo "  🔄 Updated:  $UPDATED"
echo "  ⏭️  Skipped:  $SKIPPED"
echo "  ❌ Errors:   $ERRORS"
echo "════════════════════════════════════════════════════════"
