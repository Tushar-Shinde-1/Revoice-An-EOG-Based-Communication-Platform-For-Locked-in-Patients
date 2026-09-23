import React, { useState, useEffect, useRef } from 'react';
import { Trophy, RotateCcw, ArrowLeft } from 'lucide-react';
import confetti from 'canvas-confetti';
import { speechService } from '../services/speechService';

interface GamesSectionProps {
  focusedIndex: number;
  triggerSelect: boolean;
  onSelectHandled: () => void;
  activeItemCount: (count: number) => void;
  lastGesture: string | null;
}

export const GamesSection: React.FC<GamesSectionProps> = ({
  focusedIndex,
  triggerSelect,
  onSelectHandled,
  activeItemCount,
  lastGesture
}) => {
  const [activeGame, setActiveGame] = useState<'menu' | 'pong' | 'memory' | 'runner'>('menu');

  // Inform parent of menu item count if in game picker menu
  useEffect(() => {
    if (activeGame === 'menu') {
      activeItemCount(3); // 3 games
    }
  }, [activeGame, activeItemCount]);

  // Handle menu selection
  useEffect(() => {
    if (!triggerSelect) return;

    if (activeGame === 'menu') {
      if (focusedIndex === 0) {
        setActiveGame('pong');
        speechService.speak('Starting Eye Pong.');
      } else if (focusedIndex === 1) {
        setActiveGame('memory');
        speechService.speak('Starting Card Memory Match.');
      } else if (focusedIndex === 2) {
        setActiveGame('runner');
        speechService.speak('Starting Lane Runner.');
      }
    }

    onSelectHandled();
  }, [triggerSelect, activeGame, focusedIndex]);

  return (
    <div className="w-full flex flex-col h-full gap-4">
      {/* Header / Game Switcher */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-3">
          {activeGame !== 'menu' && (
            <button
              onClick={() => setActiveGame('menu')}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 flex items-center gap-1.5 text-sm font-semibold border border-slate-700 transition-all cursor-pointer"
            >
              <ArrowLeft size={16} /> Exit Game
            </button>
          )}
          <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
            <Trophy className="text-amber-400" size={24} />
            {activeGame === 'menu' && 'Cognitive & Eye-Movement Games'}
            {activeGame === 'pong' && 'Eye-Gaze Pong Challenge'}
            {activeGame === 'memory' && 'Card Memory Match'}
            {activeGame === 'runner' && 'Reflex Lane Pilot'}
          </h2>
        </div>

        <div className="text-xs text-slate-400 bg-white/5 px-3 py-1 rounded-full border border-white/10">
          Controlled by Eye Saccades (Left / Right) & Blinks
        </div>
      </div>

      {/* Game Menu Selection */}
      {activeGame === 'menu' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 items-center">
          {/* Pong Game Card */}
          <div
            onClick={() => setActiveGame('pong')}
            className={`
              p-6 rounded-2xl bg-slate-900/80 border-2 flex flex-col items-center text-center cursor-pointer transition-all duration-300
              ${focusedIndex === 0 ? 'eye-focus-active !border-cyan-300' : 'border-slate-700/60 hover:border-slate-500'}
            `}
          >
            <div className="w-24 h-24 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center text-5xl mb-4">
              🏓
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Eye Pong</h3>
            <p className="text-sm text-slate-400 mb-4">
              Move your paddle left and right with eye gaze to bounce the ball. Test your ocular reflexes!
            </p>
            <span className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-semibold">
              Look Left / Right to Move Paddle
            </span>
          </div>

          {/* Memory Match Card */}
          <div
            onClick={() => setActiveGame('memory')}
            className={`
              p-6 rounded-2xl bg-slate-900/80 border-2 flex flex-col items-center text-center cursor-pointer transition-all duration-300
              ${focusedIndex === 1 ? 'eye-focus-active !border-cyan-300' : 'border-slate-700/60 hover:border-slate-500'}
            `}
          >
            <div className="w-24 h-24 rounded-2xl bg-purple-500/20 text-purple-400 border border-purple-500/40 flex items-center justify-center text-5xl mb-4">
              🃏
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Memory Match</h3>
            <p className="text-sm text-slate-400 mb-4">
              Navigate across hidden cards with Left / Right gaze and Triple-Blink to flip and match pairs!
            </p>
            <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-semibold">
              Left / Right + Triple Blink
            </span>
          </div>

          {/* Lane Runner Card */}
          <div
            onClick={() => setActiveGame('runner')}
            className={`
              p-6 rounded-2xl bg-slate-900/80 border-2 flex flex-col items-center text-center cursor-pointer transition-all duration-300
              ${focusedIndex === 2 ? 'eye-focus-active !border-cyan-300' : 'border-slate-700/60 hover:border-slate-500'}
            `}
          >
            <div className="w-24 h-24 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center text-5xl mb-4">
              🚀
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Lane Pilot</h3>
            <p className="text-sm text-slate-400 mb-4">
              Pilot your spaceship across 3 lanes using Left and Right eye movements. Catch stars and dodge obstacles!
            </p>
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold">
              Fast Reflex Gazing
            </span>
          </div>
        </div>
      )}

      {/* GAME 1: EYE PONG */}
      {activeGame === 'pong' && (
        <EyePongGame lastGesture={lastGesture} />
      )}

      {/* GAME 2: CARD MEMORY */}
      {activeGame === 'memory' && (
        <CardMemoryGame
          focusedIndex={focusedIndex}
          triggerSelect={triggerSelect}
          onSelectHandled={onSelectHandled}
          activeItemCount={activeItemCount}
        />
      )}

      {/* GAME 3: LANE RUNNER */}
      {activeGame === 'runner' && (
        <LaneRunnerGame lastGesture={lastGesture} />
      )}
    </div>
  );
};

// ========================================================
// SUB-GAME 1: EYE PONG (Canvas-based Reflex Pong)
// ========================================================
const EyePongGame: React.FC<{ lastGesture: string | null }> = ({ lastGesture }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(0);
  const [gameOver, setGameOver] = useState<boolean>(false);

  // Game state refs
  const stateRef = useRef({
    paddleX: 250,
    paddleWidth: 100,
    ballX: 300,
    ballY: 150,
    ballSpeedX: 3.5,
    ballSpeedY: -3.5,
    score: 0,
    isPlaying: true
  });

  // Respond to eye movements
  useEffect(() => {
    if (!lastGesture) return;
    const s = stateRef.current;
    if (lastGesture === 'LOOK_LEFT') {
      s.paddleX = Math.max(10, s.paddleX - 45);
      speechService.playTone(350, 0.04);
    } else if (lastGesture === 'LOOK_RIGHT') {
      s.paddleX = Math.min(600 - s.paddleWidth - 10, s.paddleX + 45);
      speechService.playTone(450, 0.04);
    }
  }, [lastGesture]);

  const restart = () => {
    stateRef.current = {
      paddleX: 250,
      paddleWidth: 100,
      ballX: 300,
      ballY: 150,
      ballSpeedX: (Math.random() > 0.5 ? 1 : -1) * 3.5,
      ballSpeedY: -3.5,
      score: 0,
      isPlaying: true
    };
    setScore(0);
    setGameOver(false);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const loop = () => {
      const s = stateRef.current;

      if (s.isPlaying) {
        // Move ball
        s.ballX += s.ballSpeedX;
        s.ballY += s.ballSpeedY;

        // Bounce walls
        if (s.ballX - 10 <= 0 || s.ballX + 10 >= 600) {
          s.ballSpeedX = -s.ballSpeedX;
          speechService.playTone(280, 0.03);
        }
        if (s.ballY - 10 <= 0) {
          s.ballSpeedY = -s.ballSpeedY;
          speechService.playTone(320, 0.03);
        }

        // Paddle collision
        const paddleY = 360;
        if (
          s.ballY + 10 >= paddleY &&
          s.ballY - 10 <= paddleY + 14 &&
          s.ballX >= s.paddleX &&
          s.ballX <= s.paddleX + s.paddleWidth
        ) {
          s.ballSpeedY = -Math.abs(s.ballSpeedY) * 1.04;
          s.ballSpeedX *= 1.02;
          s.score += 1;
          setScore(s.score);
          speechService.playTone(600, 0.06);

          if (s.score % 5 === 0) {
            confetti({ particleCount: 30, spread: 60, origin: { y: 0.7 } });
          }
        }

        // Missed paddle
        if (s.ballY > 400) {
          s.isPlaying = false;
          setGameOver(true);
          speechService.playTone(180, 0.25, 'sawtooth');
          setHighScore(prev => Math.max(prev, s.score));
        }
      }

      // Draw
      ctx.fillStyle = '#0b0f19';
      ctx.fillRect(0, 0, 600, 400);

      // Draw dashed center line
      ctx.strokeStyle = '#1e293b';
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(0, 200);
      ctx.lineTo(600, 200);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw Paddle
      ctx.fillStyle = '#06b6d4';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.roundRect(s.paddleX, 360, s.paddleWidth, 14, 7);
      ctx.fill();

      // Draw Ball
      ctx.fillStyle = '#10b981';
      ctx.shadowColor = '#10b981';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(s.ballX, s.ballY, 10, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-3">
      <div className="flex items-center justify-between w-full max-w-[600px] px-2 text-slate-300 font-mono font-bold">
        <span className="text-cyan-400 text-lg">Score: {score}</span>
        <span className="text-amber-400 text-lg">Best: {highScore}</span>
      </div>

      <div className="relative rounded-2xl overflow-hidden border-2 border-slate-700 shadow-2xl">
        <canvas ref={canvasRef} width={600} height={400} className="w-full max-w-[600px] h-auto block bg-slate-950" />

        {gameOver && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
            <h3 className="text-3xl font-black text-rose-400">Game Over!</h3>
            <p className="text-slate-300 font-mono">Final Score: {score}</p>
            <button
              onClick={restart}
              className="px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold flex items-center gap-2 cursor-pointer shadow-lg"
            >
              <RotateCcw size={18} /> Play Again
            </button>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400">
        👀 Look Left / Right to move your paddle.
      </p>
    </div>
  );
};

// ========================================================
// SUB-GAME 2: CARD MEMORY MATCH
// ========================================================
interface CardItem {
  id: number;
  symbol: string;
  matched: boolean;
}

const SYMBOLS = ['🌟', '🍎', '💎', '🔔'];

const CardMemoryGame: React.FC<{
  focusedIndex: number;
  triggerSelect: boolean;
  onSelectHandled: () => void;
  activeItemCount: (count: number) => void;
}> = ({ focusedIndex, triggerSelect, onSelectHandled, activeItemCount }) => {
  const [cards, setCards] = useState<CardItem[]>([]);
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [matchesCount, setMatchesCount] = useState<number>(0);

  const initCards = () => {
    const deck = [...SYMBOLS, ...SYMBOLS]
      .sort(() => Math.random() - 0.5)
      .map((sym, idx) => ({ id: idx, symbol: sym, matched: false }));
    setCards(deck);
    setFlippedIndices([]);
    setMatchesCount(0);
  };

  useEffect(() => {
    initCards();
  }, []);

  useEffect(() => {
    activeItemCount(8); // 8 cards
  }, [activeItemCount]);

  // Handle Triple-Blink Flip
  useEffect(() => {
    if (!triggerSelect) return;

    handleCardFlip(focusedIndex);
    onSelectHandled();
  }, [triggerSelect, focusedIndex]);

  const handleCardFlip = (index: number) => {
    if (cards[index]?.matched) return;
    if (flippedIndices.includes(index)) return;
    if (flippedIndices.length >= 2) return;

    speechService.playSelectionTone();
    const nextFlipped = [...flippedIndices, index];
    setFlippedIndices(nextFlipped);

    if (nextFlipped.length === 2) {
      const [first, second] = nextFlipped;
      if (cards[first].symbol === cards[second].symbol) {
        // Matched!
        setTimeout(() => {
          setCards(prev => prev.map((c, i) => i === first || i === second ? { ...c, matched: true } : c));
          setFlippedIndices([]);
          setMatchesCount(m => {
            const newM = m + 1;
            if (newM === 4) {
              confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
              speechService.speak('Congratulations! You matched all pairs!');
            } else {
              speechService.speak('Match found!');
            }
            return newM;
          });
        }, 600);
      } else {
        // Not a match -> flip back
        setTimeout(() => {
          setFlippedIndices([]);
          speechService.playTone(220, 0.15, 'sawtooth');
        }, 1000);
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-4">
      <div className="flex items-center justify-between w-full max-w-[600px] text-slate-300 font-bold">
        <span className="text-purple-400">Pairs Found: {matchesCount} / 4</span>
        <button
          onClick={initCards}
          className="px-3 py-1 rounded-lg bg-slate-800 text-xs text-slate-300 hover:bg-slate-700 flex items-center gap-1 cursor-pointer"
        >
          <RotateCcw size={14} /> Reset
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4 w-full max-w-[600px]">
        {cards.map((card, idx) => {
          const isFlipped = flippedIndices.includes(idx) || card.matched;
          const isFocused = focusedIndex === idx;

          return (
            <div
              key={card.id}
              onClick={() => handleCardFlip(idx)}
              className={`
                aspect-square rounded-2xl flex items-center justify-center text-4xl select-none cursor-pointer
                transition-all duration-300 border-2
                ${isFocused ? 'eye-focus-active !border-cyan-300' : 'border-slate-700/60'}
                ${card.matched ? 'bg-emerald-950/40 border-emerald-500/50' : isFlipped ? 'bg-purple-900/60' : 'bg-slate-900/80 hover:bg-slate-800'}
              `}
            >
              {isFlipped ? card.symbol : '❓'}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-slate-400">
        👀 Look Left / Right to traverse cards • Triple-Blink to flip.
      </p>
    </div>
  );
};

// ========================================================
// SUB-GAME 3: LANE RUNNER (3-Lane Reflex Pilot)
// ========================================================
const LaneRunnerGame: React.FC<{ lastGesture: string | null }> = ({ lastGesture }) => {
  const [lane, setLane] = useState<number>(1); // 0 = Left, 1 = Center, 2 = Right
  const [score, setScore] = useState<number>(0);
  const [stars, setStars] = useState<{ id: number; lane: number; y: number }[]>([]);

  useEffect(() => {
    if (!lastGesture) return;
    if (lastGesture === 'LOOK_LEFT') {
      setLane(prev => Math.max(0, prev - 1));
      speechService.playTone(400, 0.04);
    } else if (lastGesture === 'LOOK_RIGHT') {
      setLane(prev => Math.min(2, prev + 1));
      speechService.playTone(500, 0.04);
    }
  }, [lastGesture]);

  useEffect(() => {
    let nextId = 0;
    const interval = setInterval(() => {
      setStars(prev => [
        ...prev.map(s => ({ ...s, y: s.y + 12 })),
        ...(Math.random() > 0.4 ? [{ id: nextId++, lane: Math.floor(Math.random() * 3), y: 0 }] : [])
      ]);
    }, 120);

    return () => clearInterval(interval);
  }, []);

  // Check collision with stars
  useEffect(() => {
    setStars(prev => {
      const remaining: typeof prev = [];
      prev.forEach(star => {
        if (star.y >= 260 && star.y <= 310 && star.lane === lane) {
          // Collected!
          setScore(s => s + 10);
          speechService.playTone(650, 0.05);
        } else if (star.y < 340) {
          remaining.push(star);
        }
      });
      return remaining;
    });
  }, [stars, lane]);

  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-3">
      <div className="flex items-center justify-between w-full max-w-[500px] text-emerald-400 font-mono font-bold text-lg">
        <span>Score: {score}</span>
        <span className="text-xs text-slate-400 font-sans">Look Left/Right to change lane</span>
      </div>

      <div className="relative w-full max-w-[500px] h-[340px] rounded-2xl bg-slate-950 border-2 border-slate-700 overflow-hidden flex">
        {/* 3 Lanes */}
        {[0, 1, 2].map(l => (
          <div key={l} className="flex-1 border-r border-slate-800/80 last:border-r-0 relative">
            {stars.filter(s => s.lane === l).map(s => (
              <div
                key={s.id}
                className="absolute text-2xl animate-spin transition-transform"
                style={{ top: `${s.y}px`, left: '38%' }}
              >
                ⭐
              </div>
            ))}

            {lane === l && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-4xl filter drop-shadow-[0_0_12px_#06b6d4]">
                🚀
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
