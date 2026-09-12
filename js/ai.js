class ChessAI {
    constructor(difficulty = 'medium') {
        this.difficulty = difficulty;
        this.maxDepth = {
            'easy': 1,
            'medium': 3,
            'hard': 5
        }[difficulty] || 3;

        this.pieceValues = {
            'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9, 'k': 0,
            'P': 1, 'N': 3, 'B': 3, 'R': 5, 'Q': 9, 'K': 0
        };

        this.positionBonus = {
            'P': [0,0,0,0,0,0,0,0, 5,10,10,-20,-20,10,10,5, 5,-5,-10,0,0,-10,-5,5, 0,0,0,20,20,0,0,0, 5,5,10,25,25,10,5,5, 10,10,20,30,30,20,10,10, 50,50,50,50,50,50,50,50, 0,0,0,0,0,0,0,0],
            'N': [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
            'B': [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10, -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
            'R': [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
            'Q': [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
            'K': [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10, 20,30,10,0,0,10,30,20, 20,30,30,0,0,30,30,20]
        };
    }

    getBestMove(game) {
        const moves = game.moves({ verbose: true });
        if (moves.length === 0) return null;

        let bestMove = moves[0];
        let bestScore = -Infinity;

        for (const move of moves) {
            game.move(move);
            const score = -this.minimax(game, this.maxDepth - 1, -Infinity, Infinity, false);
            game.undo();

            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }

        return bestMove;
    }

    minimax(game, depth, alpha, beta, isMaximizing) {
        if (depth === 0) {
            return this.evaluatePosition(game);
        }

        const moves = game.moves({ verbose: true });

        if (game.isCheckmate()) {
            return isMaximizing ? -100000 : 100000;
        }

        if (game.isDraw() || moves.length === 0) {
            return 0;
        }

        if (isMaximizing) {
            let maxEval = -Infinity;
            for (const move of moves) {
                game.move(move);
                const eval_ = this.minimax(game, depth - 1, alpha, beta, false);
                game.undo();
                maxEval = Math.max(maxEval, eval_);
                alpha = Math.max(alpha, eval_);
                if (beta <= alpha) break;
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (const move of moves) {
                game.move(move);
                const eval_ = this.minimax(game, depth - 1, alpha, beta, true);
                game.undo();
                minEval = Math.min(minEval, eval_);
                beta = Math.min(beta, eval_);
                if (beta <= alpha) break;
            }
            return minEval;
        }
    }

    evaluatePosition(game) {
        let score = 0;
        const board = game.board();

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = board[row][col];
                if (piece) {
                    const index = row * 8 + col;
                    const baseValue = this.pieceValues[piece.type];
                    const posBonus = this.positionBonus[piece.type]?.[index] || 0;
                    const value = baseValue + posBonus * 0.1;

                    if (piece.color === 'w') {
                        score += value;
                    } else {
                        score -= value;
                    }
                }
            }
        }

        if (game.isCheck()) {
            score += game.turn() === 'w' ? -5 : 5;
        }

        return score;
    }
}
