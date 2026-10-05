-include ../.env
-include .env
DOCKER_CONTEXT ?= default
DOCKER_ENV := DOCKER_BUILDKIT=0 COMPOSE_DOCKER_CLI_BUILD=0

COMPOSE = docker compose -f docker-compose.yml
NETWORK ?= $(or $(KAGE_DOCKER_NETWORK),kage-network)
FRONTEND_PORT ?= 5173

.PHONY: help network build up down restart logs health shell

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-14s %s\n", $$1, $$2}'

network: ## Create the shared Docker network if missing
	@DOCKER_CONTEXT=$(DOCKER_CONTEXT) docker network inspect $(NETWORK) >/dev/null 2>&1 || DOCKER_CONTEXT=$(DOCKER_CONTEXT) docker network create $(NETWORK)

build: ## Build the frontend image
	$(COMPOSE) build

# Scope teardown to this service: all three packages share compose project `kage`,
# so a bare `compose down` would also stop the backend and the sidecar.
up: network ## Rebuild and start the frontend container
	-@DOCKER_CONTEXT=$(DOCKER_CONTEXT) $(COMPOSE) rm -s -f frontend
	DOCKER_CONTEXT=$(DOCKER_CONTEXT) $(DOCKER_ENV) $(COMPOSE) up -d --build

down: ## Stop the frontend container
	DOCKER_CONTEXT=$(DOCKER_CONTEXT) $(COMPOSE) rm -s -f frontend

restart: down up ## Restart the frontend container

logs: ## Follow frontend logs
	DOCKER_CONTEXT=$(DOCKER_CONTEXT) $(COMPOSE) logs -f --tail=100

health: ## Show frontend container health
	DOCKER_CONTEXT=$(DOCKER_CONTEXT) $(COMPOSE) ps
	@$(COMPOSE) exec frontend wget -q --spider http://127.0.0.1:5173/ && echo "frontend -> healthy"

shell: ## Open a shell in the frontend container
	$(COMPOSE) exec frontend sh
