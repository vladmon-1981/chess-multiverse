const THEMES = {
    classic: {
        name: 'Классические шахматы',
        pieces: {
            'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
            'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
        },
        sounds: {
            move: 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA==',
            capture: 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA=='
        }
    },
    animal: {
        name: 'Animal Hospital',
        pieces: {
            'K': '🦁', 'Q': '🦅', 'R': '🐘', 'B': '🦒', 'N': '🐴', 'P': '🐭',
            'k': '🐅', 'q': '🦉', 'r': '🦏', 'b': '🐋', 'n': '🦒', 'p': '🐿'
        },
        sounds: {
            move: 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA==',
            capture: 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA=='
        }
    },
    cars: {
        name: 'Тачки',
        pieces: {
            'K': '🏎️', 'Q': '🏁', 'R': '🚛', 'B': '🚓', 'N': '🏎️', 'P': '🚗',
            'k': '🏎️', 'q': '🏁', 'r': '🚛', 'b': '🚔', 'n': '🏎️', 'p': '🚙'
        },
        sounds: {
            move: 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA==',
            capture: 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA=='
        }
    }
};

class ThemeManager {
    constructor() {
        this.currentTheme = 'classic';
        this.loadTheme('classic');
    }

    loadTheme(themeKey) {
        this.currentTheme = themeKey;
        const theme = THEMES[themeKey];
        localStorage.setItem('chess-theme', themeKey);
        return theme;
    }

    getTheme() {
        return THEMES[this.currentTheme];
    }

    getPieceSymbol(piece) {
        return this.getTheme().pieces[piece] || piece;
    }

    playSound(type) {
        if (!window.audioContext) {
            window.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        this.generateBeep(type === 'capture' ? 800 : 400, type === 'capture' ? 0.1 : 0.05);
    }

    generateBeep(frequency, duration) {
        try {
            const ctx = window.audioContext;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.frequency.value = frequency;
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + duration);
        } catch (e) {
            console.log('Звук не поддерживается');
        }
    }
}
