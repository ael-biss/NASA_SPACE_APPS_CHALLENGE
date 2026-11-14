# ==============================================================================
# Space Mission Design Game — Project Makefile
# Runs all Node/Vite commands inside the shared Docker (node:24-alpine) container
# ==============================================================================

DC := docker compose
IMAGE_NAME := space-mission-game
PROD_PORT := 8080

# Helper: run command in running 'game' container, or spin up a one-off container
define exec_game
	@if [ -n "$$($(DC) ps -q game)" ]; then \
		$(DC) exec -T game $(1); \
	else \
		$(DC) run --rm game npm install --silent && $(DC) run --rm game $(1); \
	fi
endef

.DEFAULT_GOAL := help

.PHONY: help up dev down restart logs ps shell install add test test-spacecraft check build preview prod-build prod-up clean

help: ## Show available make targets
	@echo "Space Mission Design Game — Commands:"
	@echo ""
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

up: ## Start Vite dev server in background (http://localhost:5173)
	$(DC) up -d

dev: ## Start Vite dev server in foreground with live logs
	$(DC) up

down: ## Stop and remove Docker Compose containers
	$(DC) down

restart: ## Restart Docker Compose services
	$(DC) restart

logs: ## Follow container logs
	$(DC) logs -f

ps: ## Show running container status
	$(DC) ps

shell: ## Open an interactive shell inside the game container
	$(DC) exec game sh

install: ## Install npm dependencies inside Docker
	$(call exec_game,npm install)

add: ## Install a new npm package (usage: make add PKG=<package>)
ifndef PKG
	$(error Usage: make add PKG=<package-name>)
endif
	$(call exec_game,npm install $(PKG))

test: ## Run all *.test.js unit tests across src/
	$(call exec_game,sh -c 'find src -name "*.test.js" -exec node --test {} +')

test-spacecraft: ## Run Spacecraft Design module unit tests
	$(call exec_game,node --test src/modules/spacecraft-design/__tests__/spacecraft.test.js)

check: ## Syntax-check all JavaScript files under src/
	$(call exec_game,sh -c 'find src -name "*.js" -exec node --check {} + && echo "All JS files syntax-valid"')

build: ## Build production Vite bundle into dist/
	$(call exec_game,npm run build)

preview: ## Preview production build locally on port 4173
	$(DC) run --rm -p 4173:4173 game npm run preview -- --host 0.0.0.0

prod-build: ## Build production Nginx Docker image from Dockerfile
	docker build -t $(IMAGE_NAME) .

prod-up: prod-build ## Run production Nginx container on http://localhost:$(PROD_PORT)
	docker run --rm -p $(PROD_PORT):80 $(IMAGE_NAME)

clean: ## Remove dist/ production build artifacts
	rm -rf dist
