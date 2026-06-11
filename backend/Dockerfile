FROM python:3.11-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# 先装依赖
COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir --default-timeout=120 -U pip \
    && pip install --no-cache-dir --default-timeout=120 -r /tmp/requirements.txt

# 拷贝后端代码
COPY app /app/app

EXPOSE 8080
CMD ["uvicorn", "app.main:app", "--host","0.0.0.0","--port","8000","--proxy-headers"]