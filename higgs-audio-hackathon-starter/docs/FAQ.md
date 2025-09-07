## FAQ – Common Issues

- **SSH permission denied (publickey)**: Add the private key and try again.
  ```bash
  eval "$(ssh-agent -s)"
  ssh-add /path/to/teamXX_id_ed25519
  ssh -p <PORT> root@<HOST>
  ```

- **No GPU in nvidia-smi**: Ping an organizer; the VM may need to be replaced.

- **Port 8000 already in use**: Start uvicorn on another port (e.g., 8010).
  ```bash
  uvicorn server:app --host 0.0.0.0 --port 8010
  ```

- **Out of disk space**: Delete large WAVs or caches.
  ```bash
  rm -f ~/*.wav ~/higgs-audio/*.wav /tmp/higgs_audio_out/*.wav
  sudo apt-get clean
  ```

- **pip install errors**: Upgrade pip first and retry.
  ```bash
  pip install -U pip wheel setuptools
  ```

- **Where are repos located?**
  - Starter repo: `~/higgs-audio-hackathon-starter`
  - Model repo: `~/higgs-audio`


