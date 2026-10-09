// Lip-sync simples a partir do microfone: volume (abertura) + timbre (qual vogal).
// Heuristica de proposito: reconhecimento de fala completo seria lento demais ao vivo.

export class LipSync {
  constructor() {
    this.ctx = null;
    this.stream = null;
    this.analyser = null;
    this.time = null;
    this.freq = null;
    this.active = false;

    this.rms = 0;
    this.open = 0; // 0..1 suavizado
    this.centroid = 1200; // Hz suavizado
    this.viseme = 0;
    this._holdUntil = 0;
    this._clock = 0;
    this._simNext = 0;
    this._simViseme = 0;
  }

  async listDevices() {
    const devs = await navigator.mediaDevices.enumerateDevices();
    return devs.filter((d) => d.kind === 'audioinput');
  }

  async start(deviceId) {
    this.stop();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    this.stream = stream;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    const src = this.ctx.createMediaStreamSource(stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.3;
    src.connect(this.analyser); // nao liga na saida: evita microfonia
    this.time = new Float32Array(this.analyser.fftSize);
    this.freq = new Uint8Array(this.analyser.frequencyBinCount);
    this.active = true;
  }

  stop() {
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    if (this.ctx) this.ctx.close();
    this.stream = null;
    this.ctx = null;
    this.analyser = null;
    this.active = false;
    this.rms = 0;
  }

  // sens: sensibilidade (0.3..3). forced: viseme forcado por tecla (ou -1). simulate: fala falsa.
  update(dt, sens, simulate, forced) {
    this._clock += dt;
    let targetOpen = 0;
    let targetCentroid = this.centroid;

    if (forced >= 0) {
      this.viseme = forced;
      this.open = forced === 0 ? 0 : 0.7;
      return this.viseme;
    }

    if (simulate) {
      if (this._clock >= this._simNext) {
        const seq = [2, 3, 4, 1, 2, 0, 3, 2, 4, 1];
        this._simViseme = seq[Math.floor(Math.random() * seq.length)];
        this._simNext = this._clock + 0.09 + Math.random() * 0.1;
      }
      this.viseme = this._simViseme;
      this.open = this.viseme === 0 ? 0 : 0.6;
      return this.viseme;
    }

    if (this.active && this.analyser) {
      this.analyser.getFloatTimeDomainData(this.time);
      let sum = 0;
      for (let i = 0; i < this.time.length; i++) sum += this.time[i] * this.time[i];
      this.rms = Math.sqrt(sum / this.time.length);

      const gate = 0.012;
      targetOpen = Math.min(1, Math.max(0, this.rms - gate) * 9 * sens);

      this.analyser.getByteFrequencyData(this.freq);
      const binHz = this.ctx.sampleRate / this.analyser.fftSize;
      let num = 0;
      let den = 0;
      const lo = Math.floor(150 / binHz);
      const hi = Math.min(this.freq.length - 1, Math.floor(4500 / binHz));
      for (let i = lo; i <= hi; i++) {
        const m = this.freq[i] / 255;
        num += m * i * binHz;
        den += m;
      }
      if (den > 0.5) targetCentroid = num / den;
    }

    const aUp = 1 - Math.exp(-dt / 0.025);
    const aDown = 1 - Math.exp(-dt / 0.09);
    this.open += (targetOpen - this.open) * (targetOpen > this.open ? aUp : aDown);
    this.centroid += (targetCentroid - this.centroid) * (1 - Math.exp(-dt / 0.06));

    let v;
    const o = this.open;
    if (o < 0.12) v = 0;
    else if (o < 0.3) v = 1;
    else if (this.centroid > 2000) v = 4;
    else if (this.centroid < 1000) v = 3;
    else v = 2;

    // evita tremida: segura a forma por um instante antes de trocar
    if (v !== this.viseme) {
      if (v === 0 || this._clock >= this._holdUntil) {
        this.viseme = v;
        this._holdUntil = this._clock + 0.07;
      }
    }
    return this.viseme;
  }
}
