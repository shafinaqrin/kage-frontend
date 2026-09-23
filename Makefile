-include ../.env
-include .env
DOCKER_CONTEXT ?= default
DOCKER_ENV := DOCKER_BUILDKIT=0 COMPOSE_DOCKER_CLI_BUILD=0

COMPOSE = docker compose -f docker-compose.yml
NETWORK ?= $(or $(KAGE_DOCKER_NETWORK),kage-network)
FRONTEND_PORT ?= 5173

.PHONY: network build up down logs health shell

network:
	@DOCKER_CONTEXT=$(DOCKER_CONTEXT) docker network inspect $(NETWORK) >/dev/null 2>&1 || DOCKER_CONTEXT=$(DOCKER_CONTEXT) docker network create $(NETWORK)

build:
	$(COMPOSE) build

up: network
	DOCKER_CONTEXT=$(DOCKER_CONTEXT) $(DOCKER_ENV) $(COMPOSE) up -d --build

down:
	DOCKER_CONTEXT=$(DOCKER_CONTEXT) $(COMPOSE) down

logs:
	DOCKER_CONTEXT=$(DOCKER_CONTEXT) $(COMPOSE) logs -f --tail=100

health:
	DOCKER_CONTEXT=$(DOCKER_CONTEXT) $(COMPOSE) ps
	@docker compose exec frontend wget -q --spider http://127.0.0.1:5173/ && echo "frontend -> healthy"

shell:
	$(COMPOSE) exec frontend sh
