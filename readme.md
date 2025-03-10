Installation of this mega project.

First setup db if you are running through docker. create a new database folder and have researches.json file inside it.
- Make sure that on .env.prod for frontend the NEXT_PUBLIC_API_BASE_URL is http://localhost:3001


`docker compose --profile infra web up`
`docker compose --profile * up`


on mac use
`docker compsoe --profile infra up -d`
then
`docker compose --profile web up -d`


If you are debugging frontend with cursor, use chrome and keep running this MCP server.
`npx @agentdeskai/browser-tools-server`.


