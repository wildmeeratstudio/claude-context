# npm install
# test
# npm run test
# deploy
npm run build:next
PROJECT_PATH=$(pwd)
pm2 start "npx next start -p 1311" --name CLAUDE_CONTEXT_CORE --cwd $PROJECT_PATH