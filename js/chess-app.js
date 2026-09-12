class ChessApp {
    constructor() {
        this.game = null;
        this.gameMode = null;
        this.difficulty = null;
        this.player1Name = 'Игрок 1';
        this.player2Name = 'Игрок 2';
        this.ai = null;
        this.aiColor = 'b';
        this.selectedSquare = null;
        this.moveHistory = [];
        this.themeManager = new ThemeManager();
        this.soundManager = new SoundManager();
        this.isAIThinking = false;

        this.initElements();
        this.attachEventListeners();
        this.loadPlayerName();
        this.loadTheme();
    }

    initElements() {
        this.mainMenu = document.getElementById('mainMenu');
        this.difficultyMenu = document.getElementById('difficultyMenu');
        this.gameScreen = document.getElementById('gameScreen');
        this.board = document.getElementById('board');
        this.playerNameInput = document.getElementById('playerName');
        this.whitePlayerEl = document.getElementById('whitePlayer');
        this.blackPlayerEl = document.getElementById('blackPlayer');
        this.statusEl = document.getElementById('status');
        this.moveHistoryEl = document.getElementById('moveHistory');
    }

    attachEventListeners() {
        document.getElementById('pvpBtn').addEventListener('click', () => this.startGame('pvp'));
        document.getElementById('pveBtn').addEventListener('click', () => this.showDifficultyMenu());
        
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.selectTheme(e.target.dataset.theme));
        });

        document.querySelectorAll('[data-difficulty]').forEach(btn => {
            btn.addEventListener('click', (e) => this.startGame('pve', e.target.dataset.difficulty));
        });
        document.getElementById('backBtn').addEventListener('click', () => this.showMainMenu());

        document.getElementById('undoBtn').addEventListener('click', () => this.undoMove());
        document.getElementById('resetBtn').addEventListener('click', () => this.resetGame());
        document.getElementById('menuBtn').addEventListener('click', () => this.backToMenu());
    }

    loadPlayerName() {
        const saved = localStorage.getItem('chess-player-name');
        if (saved) {
            this.playerNameInput.value = saved;
            this.player1Name = saved;
        }
    }

    loadTheme() {
        const saved = localStorage.getItem('chess-theme');
        if (saved) {
            this.themeManager.loadTheme(saved);
            document.querySelectorAll('.theme-btn').forEach(btn => {
                btn.classList.toggle('theme-btn-active', btn.dataset.theme === saved);
            });
        }
    }

    selectTheme(themeKey) {
        this.themeManager.loadTheme(themeKey);
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.classList.toggle('theme-btn-active', btn.dataset.theme === themeKey);
        });
        this.renderBoard();
    }

    showMainMenu() {
        this.mainMenu.classList.remove('hidden');
        this.difficultyMenu.classList.add('hidden');
        this.gameScreen.classList.add('hidden');
        this.resetGame();
    }

    showDifficultyMenu() {
        this.player1Name = this.playerNameInput.value || 'Игрок 1';
        localStorage.setItem('chess-player-name', this.player1Name);
        this.mainMenu.classList.add('hidden');
        this.difficultyMenu.classList.remove('hidden');
    }

    startGame(mode, difficulty = null) {
        this.gameMode = mode;
        this.difficulty = difficulty;
        this.player1Name = this.playerNameInput.value || 'Игрок 1';
        localStorage.setItem('chess-player-name', this.player1Name);

        if (mode === 'pvp') {
            this.player2Name = 'Игрок 2';
        } else if (mode === 'pve') {
            this.player2Name = `Компьютер (${difficulty === 'easy' ? 'Лёгкий' : difficulty === 'medium' ? 'Средний' : 'Тяжёлый'})`;
            this.ai = new ChessAI(difficulty);
        }

        this.game = new Chess();
        this.moveHistory = [];
        this.selectedSquare = null;

        this.mainMenu.classList.add('hidden');
        this.difficultyMenu.classList.add('hidden');
        this.gameScreen.classList.remove('hidden');

        this.updateUI();
        this.renderBoard();
    }

    resetGame() {
        if (this.game) {
            this.game = new Chess();
            this.moveHistory = [];
            this.selectedSquare = null;
            this.updateUI();
            this.renderBoard();
        }
    }

    backToMenu() {
        this.showMainMenu();
    }

    renderBoard() {
        const board = this.game.board();
        this.board.innerHTML = '';

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const square = document.createElement('div');
                const isWhiteSquare = (row + col) % 2 === 0;
                square.className = `chess-square ${isWhiteSquare ? 'white' : 'black'}`;
                square.dataset.row = row;
                square.dataset.col = col;
                square.dataset.square = String.fromCharCode(97 + col) + (8 - row);

                const piece = board[row][col];
                if (piece) {
                    const pieceEl = document.createElement('div');
                    pieceEl.className = 'chess-piece';
                    
                    const pieceSymbol = piece.color === 'w' ? piece.type.toUpperCase() : piece.type.toLowerCase();
                    pieceEl.textContent = this.themeManager.getPieceSymbol(pieceSymbol);
                    
                    square.appendChild(pieceEl);
                }

                square.addEventListener('click', () => this.handleSquareClick(square));
                square.addEventListener('touchstart', (e) => this.handleSquareTouchStart(e, square));
                square.addEventListener('touchend', (e) => this.handleSquareTouchEnd(e, square));

                this.board.appendChild(square);
            }
        }

        this.highlightLegalMoves();
        this.highlightCheck();
    }

    highlightLegalMoves() {
        const squares = document.querySelectorAll('.chess-square');
        squares.forEach(sq => sq.classList.remove('highlight', 'move-highlight'));

        if (this.selectedSquare) {
            const moves = this.game.moves({ square: this.selectedSquare, verbose: true });
            moves.forEach(move => {
                const targetSquare = Array.from(squares).find(sq => sq.dataset.square === move.to);
                if (targetSquare) {
                    targetSquare.classList.add('move-highlight');
                }
            });

            const selectedSq = Array.from(squares).find(sq => sq.dataset.square === this.selectedSquare);
            if (selectedSq) selectedSq.classList.add('highlight');
        }
    }

    highlightCheck() {
        if (this.game.isCheck()) {
            const board = this.game.board();
            const kingType = this.game.turn() === 'w' ? 'k' : 'k';
            const currentColor = this.game.turn();
            
            for (let row = 0; row < 8; row++) {
                for (let col = 0; col < 8; col++) {
                    const piece = board[row][col];
                    if (piece && piece.type === 'k' && piece.color === currentColor) {
                        const sq = String.fromCharCode(97 + col) + (8 - row);
                        const squareEl = Array.from(document.querySelectorAll('.chess-square')).find(s => s.dataset.square === sq);
                        if (squareEl) squareEl.classList.add('check');
                    }
                }
            }
        }
    }

    handleSquareClick(square) {
        if (this.isAIThinking) return;

        const squareNotation = square.dataset.square;
        const piece = this.game.get(squareNotation);

        if (this.selectedSquare) {
            const moves = this.game.moves({ square: this.selectedSquare, verbose: true });
            const targetMove = moves.find(m => m.to === squareNotation);

            if (targetMove) {
                this.makeMove(targetMove);
            } else if (piece && piece.color === this.game.turn()) {
                this.selectedSquare = squareNotation;
                this.renderBoard();
            } else {
                this.selectedSquare = null;
                this.renderBoard();
            }
        } else if (piece && piece.color === this.game.turn()) {
            this.selectedSquare = squareNotation;
            this.renderBoard();
        }
    }

    handleSquareTouchStart(e, square) {
        if (this.isAIThinking) return;

        const squareNotation = square.dataset.square;
        const piece = this.game.get(squareNotation);

        if (piece && piece.color === this.game.turn()) {
            this.selectedSquare = squareNotation;
            this.renderBoard();
            square.querySelector('.chess-piece')?.classList.add('hovering');
        }
    }

    handleSquareTouchEnd(e, square) {
        if (this.isAIThinking || !this.selectedSquare) return;

        const squareNotation = square.dataset.square;
        const moves = this.game.moves({ square: this.selectedSquare, verbose: true });
        const targetMove = moves.find(m => m.to === squareNotation);

        if (targetMove) {
            this.makeMove(targetMove);
        }

        this.selectedSquare = null;
        this.renderBoard();
    }

    makeMove(move) {
        this.game.move(move);
        this.soundManager.playMoveSound();
        this.moveHistory.push(move);
        this.selectedSquare = null;
        this.updateUI();
        this.renderBoard();

        if (this.gameMode === 'pve' && this.game.turn() === 'b' && !this.game.isGameOver()) {
            this.isAIThinking = true;
            this.statusEl.textContent = '🤖 Компьютер думает...';
            setTimeout(() => this.makeAIMove(), 500);
        }
    }

    makeAIMove() {
        if (!this.ai || this.game.isGameOver()) {
            this.isAIThinking = false;
            return;
        }

        const move = this.ai.getBestMove(this.game);
        if (move) {
            this.game.move(move);
            this.soundManager.playMoveSound();
            this.moveHistory.push(move);
        }

        this.isAIThinking = false;
        this.updateUI();
        this.renderBoard();
    }

    undoMove() {
        if (this.moveHistory.length === 0) return;

        if (this.gameMode === 'pve' && this.moveHistory.length > 1) {
            this.game.undo();
            this.moveHistory.pop();
            this.game.undo();
            this.moveHistory.pop();
        } else if (this.gameMode === 'pvp' && this.moveHistory.length > 0) {
            this.game.undo();
            this.moveHistory.pop();
        }

        this.selectedSquare = null;
        this.updateUI();
        this.renderBoard();
    }

    updateUI() {
        this.whitePlayerEl.textContent = this.player1Name;
        this.blackPlayerEl.textContent = this.player2Name;

        if (this.game.isCheckmate()) {
            const winner = this.game.turn() === 'w' ? this.player2Name : this.player1Name;
            this.statusEl.textContent = `♔ Мат! ${winner} выиграл!`;
            this.soundManager.playGameOverSound();
        } else if (this.game.isDraw()) {
            this.statusEl.textContent = '🤝 Ничья!';
        } else if (this.game.isCheck()) {
            const player = this.game.turn() === 'w' ? this.player1Name : this.player2Name;
            this.statusEl.textContent = `⚠️ Шах! Ход ${player}`;
            this.soundManager.playCheckSound();
        } else {
            const player = this.game.turn() === 'w' ? this.player1Name : this.player2Name;
            this.statusEl.textContent = `Ход ${player}`;
        }

        this.updateMoveHistory();
    }

    updateMoveHistory() {
        this.moveHistoryEl.innerHTML = '';
        let moveNum = 1;
        
        for (let i = 0; i < this.moveHistory.length; i += 2) {
            const moveText = document.createElement('div');
            moveText.style.fontWeight = 'bold';
            moveText.style.gridColumn = '1';
            moveText.textContent = moveNum + '.';
            this.moveHistoryEl.appendChild(moveText);

            const whiteBtn = document.createElement('button');
            whiteBtn.textContent = this.moveHistory[i].san || this.moveHistory[i];
            whiteBtn.style.gridColumn = '2';
            this.moveHistoryEl.appendChild(whiteBtn);

            if (i + 1 < this.moveHistory.length) {
                const blackBtn = document.createElement('button');
                blackBtn.textContent = this.moveHistory[i + 1].san || this.moveHistory[i + 1];
                blackBtn.style.gridColumn = '3';
                this.moveHistoryEl.appendChild(blackBtn);
            }

            moveNum++;
        }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.chessApp = new ChessApp();
});
