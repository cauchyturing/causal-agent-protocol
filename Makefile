.PHONY: install build dev check check-all test test-unit test-integration test-conformance lint format typecheck structural clean

# ── Setup ──────────────────────────────────────────────
install:
	npm install

# ── Build ──────────────────────────────────────────────
build:
	npm run build

dev:
	npm run dev

dev-stdio:
	npm run start:stdio

# ── Quality Gates ──────────────────────────────────────
check: lint format-check test-unit typecheck  ## Quick gate: lint + format + unit tests + types
	@echo "✓ check passed"

check-all: lint format-check test typecheck structural  ## Full gate: everything
	@echo "✓ check-all passed"

# ── Tests ──────────────────────────────────────────────
test:
	npm run test

test-unit:
	npm run test:unit

test-integration:
	npm run test:integration

test-conformance:
	npm run test:conformance

test-coverage:
	npm run test:coverage

structural:  ## Architectural boundary tests
	npm run structural

# ── Lint & Format ──────────────────────────────────────
lint:
	npm run lint

lint-fix:
	npm run lint:fix

format:
	npm run format

format-check:
	npm run format:check

typecheck:
	npm run typecheck

# ── Clean ──────────────────────────────────────────────
clean:
	rm -rf dist node_modules coverage .vitest
