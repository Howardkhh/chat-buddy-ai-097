# 5-Minute Quickstart

1) Add key + connect

```bash
eval "$(ssh-agent -s)"
ssh-add ./teamXX_id_ed25519
ssh -p <PORT> root@<HOST>
```

2) GPU checkß

```bash
nvidia-smi
```

3) Generate sample

```bash
cd ~/higgs-audio
source ~/.venv/bin/activate
python examples/generation.py --transcript "Hello!" --out_path out.wav
```

