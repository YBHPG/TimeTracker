#!/bin/bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "=== Запуск TimeTracker локально ==="

# Проверка и создание .venv если нужно
if [ ! -d ".venv" ]; then
    echo "Создание виртуального окружения Python..."
    python3 -m venv .venv
    ./.venv/bin/pip install -r backend/requirements.txt
fi

# Проверка сборки фронтенда
if [ ! -d "frontend/dist" ]; then
    echo "Сборка фронтенда..."
    npm --prefix frontend install
    npm --prefix frontend run build
fi

echo ""
echo "🚀 Сервер запущен!"
echo "👉 Веб-интерфейс: http://localhost:8000"
echo "👉 Swagger API:    http://localhost:8000/docs"
echo ""
echo "Для остановки нажмите Ctrl+C"
echo ""

./.venv/bin/uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload
