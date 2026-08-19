GameScene.prototype.pickArcadeVoice = function() {
    if (typeof window === 'undefined' || !window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices() || [];
    return voices.find((v) => /en-US|en_US/.test(v.lang) && /Google|Natural|Premium|Neural|Samantha|David/i.test(v.name))
        || voices.find((v) => /en-US|en_US/.test(v.lang))
        || voices.find((v) => /^en/i.test(v.lang))
        || null;
};

GameScene.prototype.speakCommentary = function(text) {
    if (!text || typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'en-US';
        u.rate = 0.88;
        u.pitch = 0.9;
        u.volume = 1;
        const pick = this.pickArcadeVoice();
        if (pick) u.voice = pick;
        window.speechSynthesis.speak(u);
    } catch (_) {}
};

GameScene.prototype.playWhistle = function(kind) {
    try {
        if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
        const ctx = this.audioCtx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        const now = ctx.currentTime;
        if (kind === 'go') {
            osc.frequency.setValueAtTime(1800, now);
            osc.frequency.exponentialRampToValueAtTime(700, now + 0.55);
            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.exponentialRampToValueAtTime(0.22, now + 0.04);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
            osc.start(now);
            osc.stop(now + 0.72);
        } else {
            osc.frequency.setValueAtTime(1400, now);
            osc.frequency.exponentialRampToValueAtTime(900, now + 0.18);
            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.exponentialRampToValueAtTime(0.16, now + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
            osc.start(now);
            osc.stop(now + 0.24);
        }
        osc.connect(gain);
        gain.connect(ctx.destination);
    } catch (_) {}
};

GameScene.prototype.playBeep = function(freq, type, duration, vol) {
    if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
    }
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
    gain.gain.setValueAtTime(vol, this.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start();
    osc.stop(this.audioCtx.currentTime + duration);
};
