/*
 * Компьютерный соперник.
 * Движок (js/engine.js) работает в Web Worker, созданном из исходника функции через Blob:
 * так интерфейс и 3D-анимации не подвисают, пока компьютер думает, и это работает даже при
 * открытии index.html напрямую (file://). Если Worker недоступен — считаем в основном потоке
 * с урезанным временем.
 */
class ChessAI {
    constructor() {
        this.worker = null;
        this.workerUrl = null;
        this.local = null;
        this.nextId = 1;
        this.pending = new Map();
        this.startWorker();
    }

    startWorker() {
        if (typeof Worker === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined') return;
        try {
            const src = ChessEngineModule.toString() +
                '\nvar engine = ChessEngineModule();' +
                '\nself.onmessage = function (e) {' +
                '\n  var d = e.data, res = null, error = null;' +
                '\n  try { res = engine.search(d.params); } catch (err) { error = String((err && err.message) || err); }' +
                '\n  self.postMessage({ id: d.id, res: res, error: error });' +
                '\n};';
            this.workerUrl = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
            this.worker = new Worker(this.workerUrl);
            this.worker.onmessage = (e) => this.onMessage(e.data);
            this.worker.onerror = (e) => {
                if (e && e.preventDefault) e.preventDefault();
                this.fallbackToLocal();
            };
        } catch (e) {
            this.worker = null;
        }
    }

    stopWorker() {
        if (this.worker) this.worker.terminate();
        this.worker = null;
        if (this.workerUrl) URL.revokeObjectURL(this.workerUrl);
        this.workerUrl = null;
    }

    // Worker не запустился (например, запрещён политикой браузера) — досчитываем в основном потоке
    fallbackToLocal() {
        this.stopWorker();
        const waiting = Array.from(this.pending.values());
        this.pending.clear();
        waiting.forEach((p) => this.runLocal(p.params, p.resolve, p.reject));
    }

    onMessage(data) {
        const p = this.pending.get(data.id);
        if (!p) return;
        this.pending.delete(data.id);
        if (data.error) p.reject(new Error(data.error));
        else p.resolve(data.res);
    }

    runLocal(params, resolve, reject) {
        // Даём браузеру дорисовать анимацию хода перед «тяжёлым» синхронным расчётом
        setTimeout(() => {
            try {
                if (!this.local) this.local = ChessEngineModule();
                const level = this.local.LEVELS[params.level] || this.local.LEVELS.medium;
                const timeMs = Math.min(level.timeMs, 1000);
                resolve(this.local.search(Object.assign({}, params, { timeMs })));
            } catch (e) {
                reject(e);
            }
        }, 60);
    }

    /**
     * Найти ход компьютера.
     * @param {{fen?: string, moves: string[], level: 'easy'|'medium'|'hard'}} params
     *        moves — история партии в формате UCI (e2e4, e7e8q) от начальной позиции fen.
     * @returns {Promise<{from: string, to: string, promotion?: string}|null>}
     */
    think(params) {
        return new Promise((resolve, reject) => {
            if (this.worker) {
                const id = this.nextId++;
                this.pending.set(id, { params, resolve, reject });
                this.worker.postMessage({ id, params });
            } else {
                this.runLocal(params, resolve, reject);
            }
        });
    }

    /** Прервать расчёт (новая партия, отмена хода, выход в меню). Незавершённые запросы вернут null. */
    cancel() {
        if (!this.pending.size) return;
        const waiting = Array.from(this.pending.values());
        this.pending.clear();
        this.stopWorker();
        this.startWorker();
        waiting.forEach((p) => p.resolve(null));
    }
}

window.ChessAI = ChessAI;
