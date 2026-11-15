# ==============================================================================
# Space Mission Design Game — Project Makefile
# Runs all Node/Vite commands inside the shared Docker (node:24-alpine) container
# ==============================================================================

DC := docker compose
IMAGE_NAME := space-mission-game
PROD_PORT := 8080
VITE_PID_FILE := .vite.pid
VITE_LOG_FILE := .vite.log

# Helper: run command in Docker if accessible, otherwise run directly with local Node/npm
define exec_game
	@if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then \
		if [ -n "$$($(DC) ps -q game 2>/dev/null)" ]; then \
			$(DC) exec -T game $(1); \
		else \
			$(DC) run --rm game npm install --silent && $(DC) run --rm game $(1); \
		fi; \
	else \
		$(1); \
	fi
endef

.DEFAULT_GOAL := help

.PHONY: help up dev down restart logs ps shell install add test test-spacecraft check build preview prod-build prod-up clean open

DEV_URL := http://localhost:5173

help: ## Show available make targets
	@echo "Space Mission Design Game — Commands:"
	@echo ""
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

up: ## Start Vite dev server (Docker if available, else local Node) and open the website
	@url=""; \
	mode="url"; \
	if [ -f "$(VITE_PID_FILE)" ] && kill -0 "$$(cat "$(VITE_PID_FILE)")" 2>/dev/null && [ -f "$(VITE_LOG_FILE)" ]; then \
		url=$$(sed -n 's/\x1b\[[0-9;]*m//g; s/.*\(http:\/\/localhost:[0-9]*\).*/\1/p' "$(VITE_LOG_FILE)" | head -n 1); \
	fi; \
	if [ -n "$$url" ] && curl -sf --noproxy localhost,127.0.0.1 "$$url" >/dev/null 2>&1; then \
		echo "Dev server already running at $$url"; \
	elif curl -sf --noproxy localhost,127.0.0.1 "$(DEV_URL)" >/dev/null 2>&1; then \
		url="$(DEV_URL)"; \
		echo "Dev server already running at $$url"; \
	elif command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then \
		$(DC) up -d; \
		url="$(DEV_URL)"; \
	else \
		echo "Docker unavailable; starting local Vite dev server..."; \
		[ -d node_modules ] || npm install --silent; \
		rm -f "$(VITE_LOG_FILE)"; \
		nohup ./node_modules/.bin/vite --host 0.0.0.0 > "$(VITE_LOG_FILE)" 2>&1 </dev/null & echo $$! > "$(VITE_PID_FILE)"; \
		mode="local"; \
	fi; \
	echo "Waiting for dev server to be ready..."; \
	i=0; \
	while true; do \
		if [ "$$mode" = "local" ]; then \
			if [ -f "$(VITE_PID_FILE)" ] && ! kill -0 "$$(cat "$(VITE_PID_FILE)")" 2>/dev/null; then \
				echo "Local Vite server exited unexpectedly. Check $(VITE_LOG_FILE):"; \
				cat "$(VITE_LOG_FILE)" 2>/dev/null || true; \
				rm -f "$(VITE_PID_FILE)"; \
				exit 1; \
			fi; \
			if [ -f "$(VITE_LOG_FILE)" ]; then \
				url=$$(sed -n 's/\x1b\[[0-9;]*m//g; s/.*\(http:\/\/localhost:[0-9]*\).*/\1/p' "$(VITE_LOG_FILE)" | head -n 1); \
			fi; \
		fi; \
		if [ -n "$$url" ] && curl -sf --noproxy localhost,127.0.0.1 "$$url" >/dev/null 2>&1; then \
			break; \
		fi; \
		i=$$((i + 1)); \
		if [ "$$i" -ge 60 ]; then \
			echo "Timed out waiting for dev server. Check $(VITE_LOG_FILE) or 'make logs'."; \
			exit 1; \
		fi; \
		sleep 1; \
	done; \
	$(MAKE) open DEV_URL="$$url"

open: ## Open $(DEV_URL) in the default browser
	@if command -v xdg-open >/dev/null 2>&1; then \
		nohup xdg-open "$(DEV_URL)" >/dev/null 2>&1 & \
	elif command -v open >/dev/null 2>&1; then \
		open "$(DEV_URL)"; \
	elif command -v wslview >/dev/null 2>&1; then \
		wslview "$(DEV_URL)"; \
	else \
		echo "Open $(DEV_URL) in your browser."; \
	fi
	@echo "App ready at $(DEV_URL)"

dev: ## Start Vite dev server in foreground with live logs
	@if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then \
		$(DC) up; \
	else \
		[ -d node_modules ] || npm install --silent; \
		./node_modules/.bin/vite --host 0.0.0.0; \
	fi

down: ## Stop dev server (Docker Compose or local Vite)
	@if [ -f "$(VITE_PID_FILE)" ]; then \
		kill "$$(cat $(VITE_PID_FILE))" 2>/dev/null || true; \
		rm -f "$(VITE_PID_FILE)"; \
		echo "Stopped local Vite server."; \
	fi
	@if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then \
		$(DC) down; \
	fi

restart: ## Restart Docker Compose services
	$(DC) restart

logs: ## Follow server logs (Docker Compose or local Vite)
	@if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then \
		$(DC) logs -f; \
	elif [ -f "$(VITE_LOG_FILE)" ]; then \
		tail -n 100 -f "$(VITE_LOG_FILE)"; \
	else \
		echo "No running Docker session or $(VITE_LOG_FILE) found."; \
	fi

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
