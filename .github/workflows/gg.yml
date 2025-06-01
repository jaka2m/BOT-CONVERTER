name: Deploy VPN CF

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      deployments: write

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm install

      - name: Setup Wrangler secrets and deploy worker
        env:
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
          API_KEY: ${{ secrets.API_KEY }}
          API_EMAIL: ${{ secrets.API_EMAIL }}
          ACCOUNT_ID: ${{ secrets.ACCOUNT_ID }}
          ZONE_ID: ${{ secrets.ZONE_ID }}
          WORKER_NAME: v2ray-config-bot
        run: |
          set -e

          SECRETS_API="https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/scripts/$WORKER_NAME/secrets"
          HEADERS=(-H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json")

          replace_secret() {
            NAME=$1
            VALUE=$2
            echo "Replacing secret: $NAME"

            # Cek apakah sudah ada
            EXISTS=$(curl -s -X GET "$SECRETS_API" "${HEADERS[@]}" | jq -r '.result[]?.name' | grep "^$NAME$" || true)
            if [ "$EXISTS" = "$NAME" ]; then
              echo "Deleting existing secret $NAME..."
              curl -s -X DELETE "$SECRETS_API/$NAME" "${HEADERS[@]}" > /dev/null
            fi

            echo "$VALUE" | npx wrangler secret put "$NAME" --name "$WORKER_NAME"
          }

          replace_secret TELEGRAM_BOT_TOKEN "$TELEGRAM_BOT_TOKEN"
          replace_secret API_KEY "$API_KEY"
          replace_secret API_EMAIL "$API_EMAIL"
          replace_secret ACCOUNT_ID "$ACCOUNT_ID"
          replace_secret ZONE_ID "$ZONE_ID"

          echo "Deploying worker..."
          npx wrangler deploy --name "$WORKER_NAME"
