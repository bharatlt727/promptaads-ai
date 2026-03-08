# Contributing to PromptAds AI

Thank you for your interest in contributing! This guide will help you get started.

## Development Setup

1. **Clone the repo:**

   ```bash
   git clone https://github.com/abhishekayu/promptads-ai.git
   cd promptads-ai
   ```

2. **Run setup script:**

   ```bash
   ./scripts/setup.sh
   ```

3. **Start services:**
   ```bash
   docker compose up
   ```

## Project Structure

- `backend/` — FastAPI server (Python 3.11)
- `frontend/` — Next.js 15 dashboard (TypeScript)
- `sdk/js/` — JavaScript / TypeScript SDK
- `sdk/python/` — Python SDK
- `examples/` — Example integrations
- `docs/` — Architecture & guides

## Code Style

### Backend (Python)

- Formatter: `ruff format`
- Linter: `ruff check`
- Type checker: `mypy`

### Frontend (TypeScript)

- Linter: `eslint`
- Type checker: `tsc --noEmit`

## Pull Request Process

1. Fork the repo and create a feature branch
2. Write tests for new functionality
3. Ensure all tests pass: `pytest` (backend) / `npm test` (frontend)
4. Update documentation if needed
5. Submit a PR with a clear description

## Reporting Issues

Use GitHub Issues for bug reports and feature requests.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
