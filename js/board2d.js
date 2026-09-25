/*
 * Запасная плоская доска — на случай, если браузер не поддерживает WebGL.
 * Тот же интерфейс, что у CM.Board3D, фигуры — символы Unicode, ходы — кликами.
 */
(function () {
    'use strict';
    const GLYPHS = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
    const FILES = 'abcdefgh';

    class Board2D {
        constructor(container, handlers) {
            this.container = container;
            this.handlers = handlers;
            this.orientation = 'w';
            this.board = null;
            this.hl = { selected: null, targets: [], last: null, check: null };
            this.interactive = true;
            this.el = document.createElement('div');
            this.el.className = 'board2d';
            container.appendChild(this.el);
            this.el.addEventListener('pointerdown', (e) => {
                if (!this.interactive) return;
                const sq = this.squareAt(e);
                this.downSq = sq;
                this.handlers.down(sq);
            });
            this.el.addEventListener('pointerup', (e) => {
                if (!this.interactive) return;
                this.handlers.up(this.squareAt(e), this.downSq);
            });
        }

        squareAt(e) {
            const t = e.target.closest('[data-sq]');
            return t ? t.dataset.sq : null;
        }

        render() {
            if (!this.board) return;
            const frag = document.createDocumentFragment();
            const targets = new Map((this.hl.targets || []).map((t) => [t.sq, t.capture]));
            for (let i = 0; i < 8; i++) {
                for (let j = 0; j < 8; j++) {
                    const r = this.orientation === 'w' ? i : 7 - i;
                    const f = this.orientation === 'w' ? j : 7 - j;
                    const sq = FILES[f] + (8 - r);
                    const cell = document.createElement('div');
                    cell.dataset.sq = sq;
                    cell.className = 'sq ' + ((r + f) % 2 ? 'd' : 'l');
                    if (this.hl.last && (sq === this.hl.last.from || sq === this.hl.last.to)) cell.classList.add('last');
                    if (sq === this.hl.selected) cell.classList.add('sel');
                    if (sq === this.hl.check) cell.classList.add('check');
                    if (targets.has(sq)) cell.classList.add(targets.get(sq) ? 'capture' : 'target');
                    const p = this.board[r][f];
                    if (p) {
                        const s = document.createElement('span');
                        s.className = 'pc ' + p.color;
                        s.textContent = GLYPHS[p.type];
                        cell.appendChild(s);
                    }
                    if (i === 7) { const c = document.createElement('span'); c.className = 'coord f'; c.textContent = FILES[f]; cell.appendChild(c); }
                    if (j === 0) { const c = document.createElement('span'); c.className = 'coord r'; c.textContent = 8 - r; cell.appendChild(c); }
                    frag.appendChild(cell);
                }
            }
            this.el.replaceChildren(frag);
        }

        setTheme() { this.render(); }
        setOrientation(color) { this.orientation = color; this.render(); return Promise.resolve(); }
        setPreset() { return Promise.resolve(); }
        setPosition(board) { this.board = board; this.render(); }
        get isFlat() { return true; }
        applyMove(move, o = {}) {
            if (o.board) this.setPosition(o.board);
            if (o.onStart) o.onStart();
            if (move.captured && o.onImpact) o.onImpact();
            return Promise.resolve();
        }
        setOptions() {}
        setHighlights(h) { Object.assign(this.hl, h); this.render(); }
        showCheck(sq) { this.hl.check = sq; this.render(); }
        showMate() { return Promise.resolve(); }
        setInteractive(v) { this.interactive = v; }
        requestRender() {}
        resize() {}
        returnPiece() { return Promise.resolve(); }
    }

    window.Board2D = Board2D;
})();
