Installation of this mega project.

First setup db if you are running through docker. create a new database folder and have researches.json file inside it.


Use profiles during development.
Do not use this in production. Just start all the services in production.



`docker compose --profile infra web up`
`docker compose --profile * up`


on mac use
`docker compsoe --profile infra up -d`
then
`docker compose --profile web up -d`


If you are debugging frontend with cursor, use chrome and keep running this MCP server.
`npx @agentdeskai/browser-tools-server`.


