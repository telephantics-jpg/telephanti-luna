FROM python:3.12-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt requirements-lipsync.txt ./
RUN pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir -r requirements-lipsync.txt

COPY server.py telephanti_url.py make_icons.py ./
COPY firmament ./firmament
COPY luna_lipsync ./luna_lipsync
COPY scripts/setup_lipsync.py ./scripts/
RUN mkdir -p data static/lipsync_cache models/lipsync \
    && python scripts/setup_lipsync.py || echo "Wav2Lip setup skipped (optional)"

COPY static ./static
COPY quantum_samples ./quantum_samples
COPY data/luna_quantum_lines.json ./data/

RUN mkdir -p static/avatars static/icons data \
    && python make_icons.py \
    && test -f static/avatars/brunette.glb || curl -fsSL \
      -o static/avatars/brunette.glb \
      https://raw.githubusercontent.com/met4citizen/TalkingHead/main/avatars/brunette.glb

ENV LUNA_CLOUD=1
ENV LUNA_HOST=0.0.0.0
ENV LUNA_PUBLIC_URL=https://telephanti.com
ENV LUNA_PREWARM=0
ENV LUNA_LLM_BACKEND=grok

EXPOSE 10000

CMD ["python", "server.py"]