class SoundManager {
    constructor() {
        this.audioContext = null;
        this.enabled = true;
    }

    playMoveSound() {
        if (!this.enabled) return;
        this.playNote(400, 0.05);
    }

    playCaptureSound() {
        if (!this.enabled) return;
        this.playNote(800, 0.08);
        setTimeout(() => this.playNote(600, 0.08), 50);
    }

    playCheckSound() {
        if (!this.enabled) return;
        this.playNote(1000, 0.1);
    }

    playGameOverSound() {
        if (!this.enabled) return;
        this.playNote(800, 0.1);
        setTimeout(() => this.playNote(1000, 0.1), 100);
        setTimeout(() => this.playNote(1200, 0.2), 200);
    }

    playNote(frequency, duration) {
        try {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }

            const ctx = this.audioContext;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.type = 'sine';
            osc.frequency.value = frequency;

            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + duration);
        } catch (e) {
            console.log('Звук недоступен:', e.message);
        }
    }

    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }
}
