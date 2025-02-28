Installation of this mega project.


Use profiles during development.
Do not use this in production. Just start all the services in production.

`docker compose --profile infra web up`
`docker compose --profile * up`


If you are debugging frontend with cursor, use chrome and keep running this MCP server.
`npx @agentdeskai/browser-tools-server`.