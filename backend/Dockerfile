# python:3.12-slim -- Python 3.14 may lack prebuilt wheels for some deps
# (asyncpg, Pillow, etc.) at time of writing, so 3.12 is used for compatibility.
FROM python:3.12-slim

WORKDIR /app

# System dependencies needed to build wheels for asyncpg/Pillow if no
# prebuilt wheel is available for the target platform.
RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
