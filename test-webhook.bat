@echo off
chcp 65001 >nul
echo ============================================
echo   FlowForge Webhook Test
echo ============================================
echo.

set WEBHOOK_URL=https://zapier.egor-dev.ru/api/webhooks/19bab847-9354-41f0-a22e-fa3de7619a74

echo Sending test webhook to: %WEBHOOK_URL%
echo.

curl -s -X POST "%WEBHOOK_URL%" ^
  -H "Content-Type: application/json" ^
  -d "{\"event\":\"order_created\",\"name\":\"Egor\",\"message\":\"New order #123 - Test from bat file\",\"amount\":1500,\"currency\":\"RUB\"}"

echo.
echo.
echo ============================================
echo   Done! Check:
echo   1. Telegram - message from FlowForge bot
echo   2. Email - egor3951@gmail.com
echo   3. Dashboard - https://zapier.egor-dev.ru
echo ============================================
echo.
pause
