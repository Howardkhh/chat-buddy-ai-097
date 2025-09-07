## Higgs Audio – Hackathon Starter (Pre-Assigned VM)

Welcome! Your team has been assigned a GPU VM and a private SSH key. This repository helps you connect, generate audio with Boson AI's Higgs Audio, and (optionally) run a tiny API server.

— Keep your private key secret. Never commit it to GitHub.

### What You Received
- A private SSH key file, e.g., `teamXX_id_ed25519`
- Connection details: username, host (IP), SSH port
- This repository link

### 1) Connect to Your VM
Add your key to the SSH agent and connect:

```bash
eval "$(ssh-agent -s)"
ssh-add /path/to/teamXX_id_ed25519
ssh -p <PORT> root@<HOST>
```

Sanity check the GPU:

```bash
nvidia-smi
```

### 2) Activate the Ready-Made Environment
A Python venv and repos are already prepared on your VM.

```bash
source /workspace/.venv/bin/activate
```

If anything looks missing, you can re-run installs:

```bash
pip install -U pip wheel setuptools
pip install -r /workspace/higgs-audio-hackathon-starter/requirements.txt
pip install -r /workspace/higgs-audio/requirements.txt
pip install -e /workspace/higgs-audio
```

### 3) Quick Generate Example
```bash
cd /workspace/higgs-audio
source /workspace/.venv/bin/activate
python examples/generation.py \
  --transcript "Hello from our team VM!" \
  --temperature 0.35 \
  --out_path generation.wav
```

### 4) (Optional) Run the Simple API Server
Start a small FastAPI server that wraps the example script:

```bash
cd /workspace/higgs-audio-hackathon-starter
source /workspace/.venv/bin/activate
export HIGGS_AUDIO_REPO=/workspace/higgs-audio
uvicorn server:app --host 0.0.0.0 --port 8000
```

Health check:

```bash
curl http://localhost:8000/health
```

Call the API (base64 → wav):

```bash
curl -s -X POST "http://localhost:8000/generate" \
  -H "Content-Type: application/json" \
  -d '{"transcript":"Hello from the API!","temperature":0.35,"return_audio":"base64"}' \
  | jq -r '.audio_base64' | base64 --decode > generation.wav
```

Or request a downloadable URL:

```bash
curl -s -X POST "http://localhost:8000/generate" \
  -H "Content-Type: application/json" \
  -d '{"transcript":"Hello!","temperature":0.35,"return_audio":"url"}'
```

### 5) Client Script (Optional)
From the VM:

```bash
source /workspace/.venv/bin/activate
python /workspace/higgs-audio-hackathon-starter/client/client_generate.py \ 
  --host http://localhost:8000 \
  --text "Hello from the client!" \
  --temperature 0.3 \
  --mode url \
  --out client.wav
```

### 6) LLM API Server

The model deployed is Qwen3 - 32B you can communicate with it with the following api, there are two machines:

# Machine 1
```
curl -s -H "Content-Type: application/json"  -d '{
             "model": "qwen3-30b-a3b-thinking-fp8",
             "messages": [{"role":"user","content":"Solve 24*37 step by step"}],
             "max_tokens": 256
           }' http://20.66.111.167:31022/v1/chat/completions | jq
```
# Machine 2
```
curl -s -H "Content-Type: application/json"  -d '{
             "model": "qwen3-30b-a3b-thinking-fp8",
             "messages": [{"role":"user","content":"Solve 24*37 step by step"}],
             "max_tokens": 256
           }' http://174.78.228.101:40514/v1/chat/completions | jq

```
### 7) Private Higgs Audio Understanding model 
We have our own model deployed you can reach it via

- See: [Higgs Audio understanding endpoint](higgs-audio-understanding.md)



### FAQ and Quickstart
- Quickstart: `docs/QUICKSTART.md`
- Common issues: `docs/FAQ.md`

Good luck & have fun! 🎉


