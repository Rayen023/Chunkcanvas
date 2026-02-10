export HF_HOME="/mnt/0a56cc8f-eb63-4f04-b727-0615646b8bdb/lerobot_cache/huggingface"
export VLLM_CACHE_ROOT="/mnt/0a56cc8f-eb63-4f04-b727-0615646b8bdb/vllm"
# export VLLM_SERVER_DEV_MODE=1
# export VLLM_LOGGING_LEVEL=DEBUG
#mlx-community/gpt-oss-20b-MXFP4-Q8 OOM

MODEL_PATH="${1:-Qwen/Qwen3-VL-8B-Instruct-FP8}"
# /mnt/0a56cc8f-eb63-4f04-b727-0615646b8bdb/vllm/Qwen3-0.6B-IQ4_XS.gguf
# "/mnt/0a56cc8f-eb63-4f04-b727-0615646b8bdb/vllm/Qwen3-0.6B-Q3_K_M.gguf"
# Qwen/Qwen3-VL-8B-Instruct-FP8
# jinaai/jina-embeddings-v3
source /home/recherche-a/OneDrive_recherche_a/Linux_onedrive/Projects_linux/chunkcanvas/backend/.venv/bin/activate

vllm serve $MODEL_PATH \
  --gpu-memory-utilization 0.85 \
  --enforce-eager \
  --port 8002 \
  --trust-remote-code \
  # --max-model-len 16000 \
  # --enable-auto-tool-choice \
  # --tool-call-parser openai \
  # --reasoning-parser=openai_gptoss
  # --enable-sleep-mode \ #  --tool-call-parser openai
# KeyError: 'invalid tool call parser: qwen (chose from { deepseek_v3,deepseek_v31,deepseek_v32,ernie45,functiongemma,gigachat3,glm45,glm47,granite,granite-20b-fc,hermes,hunyuan_a13b,internlm,jamba,kimi_k2,llama3_json,llama4_json,llama4_pythonic,longcat,minimax,minimax_m2,mistral,olmo3,openai,phi4_mini_json,pythonic,qwen3_coder,qwen3_xml,seed_oss,step3,step3p5,xlam })'


# /mnt/0a56cc8f-eb63-4f04-b727-0615646b8bdb/vllm/Qwen3-0.6B-IQ4_XS.gguf
# "/mnt/0a56cc8f-eb63-4f04-b727-0615646b8bdb/vllm/Qwen3-0.6B-Q3_K_M.gguf"
# Qwen/Qwen3-VL-8B-Instruct-FP8

  # --quantization mxfp4
#   --max-num-batched-tokens 512 \

# (APIServer pid=481999) INFO 02-08 01:45:33 [api_server.py:946] Starting vLLM API server 0 on http://0.0.0.0:8000
# (APIServer pid=481999) INFO 02-08 01:45:33 [launcher.py:38] Available routes are:
# (APIServer pid=481999) INFO 02-08 01:45:33 [launcher.py:46] Route: /openapi.json, Methods: GET, HEAD
# (APIServer pid=481999) INFO 02-08 01:45:33 [launcher.py:46] Route: /docs, Methods: GET, HEAD
# (APIServer pid=481999) INFO 02-08 01:45:33 [launcher.py:46] Route: /docs/oauth2-redirect, Methods: GET, HEAD
# (APIServer pid=481999) INFO 02-08 01:45:33 [launcher.py:46] Route: /redoc, Methods: GET, HEAD
# (APIServer pid=481999) INFO 02-08 01:45:33 [launcher.py:46] Route: /scale_elastic_ep, Methods: POST
# (APIServer pid=481999) INFO 02-08 01:45:33 [launcher.py:46] Route: /is_scaling_elastic_ep, Methods: POST
# (APIServer pid=481999) INFO 02-08 01:45:33 [launcher.py:46] Route: /tokenize, Methods: POST
# (APIServer pid=481999) INFO 02-08 01:45:33 [launcher.py:46] Route: /detokenize, Methods: POST
# (APIServer pid=481999) INFO 02-08 01:45:33 [launcher.py:46] Route: /inference/v1/generate, Methods: POST
# (APIServer pid=481999) INFO 02-08 01:45:33 [launcher.py:46] Route: /pause, Methods: POST
# (APIServer pid=481999) INFO 02-08 01:45:33 [launcher.py:46] Route: /resume, Methods: POST
# (APIServer pid=481999) INFO 02-08 01:45:33 [launcher.py:46] Route: /is_paused, Methods: GET
# (APIServer pid=481999) INFO 02-08 01:45:33 [launcher.py:46] Route: /metrics, Methods: GET
# (APIServer pid=481999) INFO 02-08 01:45:33 [launcher.py:46] Route: /health, Methods: GET
# (APIServer pid=481999) INFO 02-08 01:45:33 [launcher.py:46] Route: /v1/chat/completions, Methods: POST
# (APIServer pid=481999) INFO 02-08 01:45:33 [launcher.py:46] Route: /v1/chat/completions/render, Methods: POST
# (APIServer pid=481999) INFO 02-08 01:45:33 [launcher.py:46] Route: /v1/responses, Methods: POST
# (APIServer pid=481999) INFO 02-08 01:45:33 [launcher.py:46] Route: /v1/responses/{response_id}, Methods: GET
# (APIServer pid=481999) INFO 02-08 01:45:33 [launcher.py:46] Route: /v1/responses/{response_id}/cancel, Methods: POST
# (APIServer pid=481999) INFO 02-08 01:45:33 [launcher.py:46] Route: /v1/audio/transcriptions, Methods: POST
# (APIServer pid=481999) INFO 02-08 01:45:33 [launcher.py:46] Route: /v1/audio/translations, Methods: POST
# (APIServer pid=481999) INFO 02-08 01:45:33 [launcher.py:46] Route: /v1/completions, Methods: POST
# (APIServer pid=481999) INFO 02-08 01:45:33 [launcher.py:46] Route: /v1/completions/render, Methods: POST
# (APIServer pid=481999) INFO 02-08 01:45:33 [launcher.py:46] Route: /v1/messages, Methods: POST
# (APIServer pid=481999) INFO 02-08 01:45:33 [launcher.py:46] Route: /v1/models, Methods: GET
# (APIServer pid=481999) INFO 02-08 01:45:33 [launcher.py:46] Route: /load, Methods: GET
# (APIServer pid=481999) INFO 02-08 01:45:33 [launcher.py:46] Route: /version, Methods: GET
# (APIServer pid=481999) INFO 02-08 01:45:33 [launcher.py:46] Route: /ping, Methods: GET
# (APIServer pid=481999) INFO 02-08 01:45:33 [launcher.py:46] Route: /ping, Methods: POST
# (APIServer pid=481999) INFO 02-08 01:45:33 [launcher.py:46] Route: /invocations, Methods: POST
# (APIServer pid=481999) INFO 02-08 01:45:33 [launcher.py:46] Route: /classify, Methods: POST
# (APIServer pid=481999) INFO 02-08 01:45:33 [launcher.py:46] Route: /v1/embeddings, Methods: POST
# (APIServer pid=481999) INFO 02-08 01:45:33 [launcher.py:46] Route: /score, Methods: POST
# (APIServer pid=481999) INFO 02-08 01:45:33 [launcher.py:46] Route: /v1/score, Methods: POST
# (APIServer pid=481999) INFO 02-08 01:45:33 [launcher.py:46] Route: /rerank, Methods: POST   
# (APIServer pid=481999) INFO 02-08 01:45:33 [launcher.py:46] Route: /v1/rerank, Methods: POST
# (APIServer pid=481999) INFO 02-08 01:45:33 [launcher.py:46] Route: /v2/rerank, Methods: POST
# (APIServer pid=481999) INFO 02-08 01:45:33 [launcher.py:46] Route: /pooling, Methods: POST

  #   1 curl http://localhost:8000/v1/chat/completions \
  #   2   -H "Content-Type: application/json" \
  #   3   -d '{
  #   4     "model": "Qwen/Qwen3-VL-8B-Instruct-FP8",
  #   5     "messages": [
  #   6       {
  #   7         "role": "user",
  #   8         "content": [
  #   9           {
  #  10             "type": "text",
  #  11             "text": "What is in this image?"
  #  12           },
  #  13           {
  #  14             "type": "image_url",
  #  15             "image_url": {
  #  16               "url": "https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png"
  #  17             }
  #  18           }
  #  19         ]
  #  20       }
  #  21     ],
  #  22     "max_tokens": 300
  #  23   }'