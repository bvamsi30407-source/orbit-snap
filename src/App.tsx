import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  Trophy,
  Info,
  Zap,
  Award,
  Pause,
  Disc,
  Activity,
  ChevronRight,
  ShieldCheck,
  Star,
  Target
} from "lucide-react";

// Types and Interfaces
interface Segment {
  start: number; // in radians [0, 2PI]
  end: number;   // in radians [0, 2PI]
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  decay: number;
  shape: "circle" | "square" | "spark";
}

interface Ring {
  radius: number;
  angle: number;
  speed: number;
  segments: Segment[];
  spikes: { localAngle: number }[];
  collectibles: { localAngle: number }[];
}

// Retro Arcade Audio Synth Engine using Web Audio API
class AudioSynth {
  ctx: AudioContext | null = null;
  muted: boolean = false;
  private musicInterval: any = null;
  private currentStep = 0;

  constructor() {
    // Lazy loaded initialization on user click to comply with autoplay policy
  }

  init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      this.ctx = new AudioContextClass();
    }
  }

  playSnap() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === "suspended") this.ctx.resume();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    const now = this.ctx.currentTime;
    osc.type = "sine";
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.12);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.12);

    osc.start(now);
    osc.stop(now + 0.12);
  }

  playCollect() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === "suspended") this.ctx.resume();

    const now = this.ctx.currentTime;

    const playTone = (freq: number, delay: number, dur: number) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + delay);

      gain.gain.setValueAtTime(0.06, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + dur);

      osc.start(now + delay);
      osc.stop(now + delay + dur);
    };

    // Uplifting Perfect 5th to Major 7th arpeggio
    playTone(523.25, 0, 0.12); // C5
    playTone(659.25, 0.04, 0.12); // E5
    playTone(783.99, 0.08, 0.18); // G5
    playTone(987.77, 0.12, 0.25); // B5
  }

  playFailed() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === "suspended") this.ctx.resume();

    const now = this.ctx.currentTime;

    // Pitch sweep fall down
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.linearRampToValueAtTime(40, now + 0.5);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.5);

    osc.start(now);
    osc.stop(now + 0.5);

    // Crackle noise crash
    try {
      const bufferSize = this.ctx.sampleRate * 0.45;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = "lowpass";
      noiseFilter.frequency.setValueAtTime(600, now);
      noiseFilter.frequency.exponentialRampToValueAtTime(40, now + 0.45);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.15, now);
      noiseGain.gain.linearRampToValueAtTime(0.001, now + 0.45);

      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);

      noise.start(now);
      noise.stop(now + 0.45);
    } catch (e) {
      // Ignored if noise buffer unsupported
    }
  }

  startAmbientMusic() {
    if (this.muted) return;
    this.init();
    if (this.musicInterval) return;

    // Pentatonic scale notes to design pleasant backbeats
    const scale = [110.0, 130.81, 146.83, 164.81, 196.0, 220.0, 261.63, 293.66];
    
    this.musicInterval = setInterval(() => {
      if (this.muted || !this.ctx) return;
      if (this.ctx.state === "suspended") return;

      const now = this.ctx.currentTime;
      const freq = scale[this.currentStep % scale.length];
      
      // Pluck a low ambient bass node syncopated periodically
      if (this.currentStep % 4 === 0 || this.currentStep % 6 === 3) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq / 2, now); // Octave below for bass response
        
        gain.gain.setValueAtTime(0.035, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

        osc.start(now);
        osc.stop(now + 0.6);
      }
      
      this.currentStep = (this.currentStep + 1) % 16;
    }, 320);
  }

  stopAmbientMusic() {
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
  }
}

// Automated Segment Generator with angle limits
function createRingSegments(ringIndex: number, difficultyBonus: number): Segment[] {
  // Level counts: Innermost ring has 2, Outer ranges scale 2-3
  const count = ringIndex === 0 ? 2 : ringIndex === 2 ? 3 : 2;
  
  // Gap width increases slightly as difficulty / scoring scales up
  const baseGap = 0.4 + (difficultyBonus * 0.05); // in radians
  const maxGap = 0.85;
  const gapAngle = Math.min(maxGap, baseGap);
  
  const sectorRad = (2 * Math.PI) / count;
  const segments: Segment[] = [];

  for (let i = 0; i < count; i++) {
    const center = i * sectorRad + sectorRad / 2;
    // Solid width is spacing sector minus randomized gap range
    const randMultiplier = 0.85 + Math.random() * 0.3;
    const solidWidth = sectorRad - (gapAngle * randMultiplier);
    
    const start = center - solidWidth / 2;
    const end = center + solidWidth / 2;

    segments.push({
      start: (start + 4 * Math.PI) % (2 * Math.PI),
      end: (end + 4 * Math.PI) % (2 * Math.PI),
    });
  }

  // Sort segments clockwise to ensure linear logic
  segments.sort((a, b) => a.start - b.start);

  // If Ring 0 (Innermost Starting Hub): Force safe coverage at Spawn Angle (0 radians) with a 90-degree safe zone
  if (ringIndex === 0) {
    // Shift ALL segments so that the first segment (which is solid) is centered exactly at 0.0 range.
    // This guarantees that the entire 90-degree arc (-PI/4 to +PI/4, i.e., -0.785 to +0.785 radians)
    // is fully covered with a solid ring and has zero gaps.
    const currentMid = (segments[0].start + (segments[0].end > segments[0].start ? segments[0].end : segments[0].end + 2 * Math.PI)) / 2;
    const shiftVal = -currentMid;
    for (const seg of segments) {
      seg.start = (seg.start + shiftVal + 8 * Math.PI) % (2 * Math.PI);
      seg.end = (seg.end + shiftVal + 8 * Math.PI) % (2 * Math.PI);
    }
  }

  return segments;
}

export default function App() {
  const [gameState, setGameState] = useState<"MENU" | "PLAYING" | "GAMEOVER" | "PAUSED">("MENU");
  const [difficulty, setDifficulty] = useState<"CASUAL" | "HARDCORE">("CASUAL");
  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(0);
  const [personalBestBeaten, setPersonalBestBeaten] = useState<boolean>(false);
  const [activeLevel, setActiveLevel] = useState<number>(1);
  const [muted, setMuted] = useState<boolean>(false);
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const [defeatReason, setDefeatReason] = useState<string>("");

  // References and Game Mechanics Core variables
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<AudioSynth | null>(null);
  const scoreRef = useRef<number>(0);
  const levelRef = useRef<number>(1);
  const lastTimeRef = useRef<number>(0);
  const animationFrameId = useRef<number | null>(null);
  
  // Custom screen shake and rotating animation tickers
  const screenShakeAmount = useRef<number>(0);
  const cubeRot = useRef<number>(0);
  const playTimeRef = useRef<number>(0);
  const initialSpikesSpawnedRef = useRef<boolean>(false);

  // Player properties
  const playerRef = useRef({
    angle: 0.0, // starts facing horizontal right (0 radians)
    ringIndex: 0, // starts on innermost circular ring
    trail: [] as { x: number; y: number; alpha: number }[],
    isFading: false,
    fadeScale: 1.0,
  });

  // Concentric Rings Configuration Ref
  const ringsRef = useRef<Ring[]>([]);
  // Particle pools
  const particlesRef = useRef<Particle[]>([]);

  // Load High Score on mount
  useEffect(() => {
    const saved = localStorage.getItem("orbit_snap_high_score");
    if (saved) {
      setHighScore(parseInt(saved, 10));
    }
    
    audioRef.current = new AudioSynth();
    return () => {
      audioRef.current?.stopAmbientMusic();
    };
  }, []);

  // Sync mute state with synth
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = muted;
      if (muted) {
        audioRef.current.stopAmbientMusic();
      } else if (gameState === "PLAYING") {
        audioRef.current.startAmbientMusic();
      }
    }
  }, [muted, gameState]);

  // Utility to trigger brief glowing center notifications
  const triggerNotification = (text: string) => {
    setAnnouncement(text);
    setTimeout(() => {
      setAnnouncement((prev) => (prev === text ? null : prev));
    }, 1800);
  };

  // Safe Spawning of yellow glowing gold cubes on any solid ring section
  const spawnCollectible = (targetRings: Ring[], preferIndex?: number) => {
    const targetRingIdx = preferIndex !== undefined ? preferIndex : Math.floor(Math.random() * 4);
    const ring = targetRings[targetRingIdx];
    
    if (ring.segments.length === 0) return;
    const seg = ring.segments[Math.floor(Math.random() * ring.segments.length)];
    
    let localAngle = 0;
    if (seg.start < seg.end) {
      // Standard segment interval
      localAngle = seg.start + 0.15 + Math.random() * (seg.end - seg.start - 0.3);
    } else {
      // Wrapped boundary interval
      const totalLen = (seg.end + 2 * Math.PI) - seg.start;
      const offset = 0.15 + Math.random() * (totalLen - 0.3);
      localAngle = (seg.start + offset) % (2 * Math.PI);
    }

    ring.collectibles = [{ localAngle }];
  };

  // Safe Spawning of red hazard spikes
  const spawnSpike = (targetRings: Ring[], forRingIndex: number) => {
    // Safety Rule: Do not spawn any hazards on any ring for the first 2 seconds of a new game
    if (playTimeRef.current < 2.0) return;

    const ring = targetRings[forRingIndex];
    if (ring.segments.length === 0) return;
    
    // Choose segment
    const seg = ring.segments[Math.floor(Math.random() * ring.segments.length)];
    
    // Pick angular position on the segment
    let localAngle = 0;
    if (seg.start < seg.end) {
      localAngle = seg.start + 0.1 + Math.random() * (seg.end - seg.start - 0.2);
    } else {
      const totalLen = (seg.end + 2 * Math.PI) - seg.start;
      const offset = 0.1 + Math.random() * (totalLen - 0.2);
      localAngle = (seg.start + offset) % (2 * Math.PI);
    }

    // Ensure it's not starting right under player if checking spawning constraints
    ring.spikes.push({ localAngle });
  };

  // Initialize Game Logic Models
  const initiateGame = (diffMode: "CASUAL" | "HARDCORE") => {
    const isHard = diffMode === "HARDCORE";
    const speedCoefficient = isHard ? 0.72 : 0.44;
    
    const initialRings: Ring[] = [
      {
        radius: 0, // determined reactively on screen size resizing
        angle: 0,
        speed: speedCoefficient * 0.9, // Clockwise fast Inner
        segments: createRingSegments(0, 1),
        spikes: [], // Spawning area remains safe
        collectibles: [],
      },
      {
        radius: 0,
        angle: Math.PI / 4,
        speed: -speedCoefficient * 1.1, // Counter-clockwise
        segments: createRingSegments(1, 1),
        spikes: [], // Safety rule: No starter spikes until 2.0 seconds have passed
        collectibles: [],
      },
      {
        radius: 0,
        angle: Math.PI / 2,
        speed: speedCoefficient * 1.3, // Clockwise
        segments: createRingSegments(2, 1),
        spikes: [], // Safety rule: No starter spikes until 2.0 seconds have passed
        collectibles: [],
      },
      {
        radius: 0,
        angle: Math.PI,
        speed: -speedCoefficient * 1.5, // Counter-clockwise outer
        segments: createRingSegments(3, 1),
        spikes: [], // Safety rule: No starter spikes until 2.0 seconds have passed
        collectibles: [],
      },
    ];

    // Distribute collectibles across Rings 1 and 3 to start
    spawnCollectible(initialRings, 1);
    spawnCollectible(initialRings, 3);

    ringsRef.current = initialRings;
    particlesRef.current = [];
    
    playerRef.current = {
      angle: 0.0,
      ringIndex: 0, // innermost
      trail: [],
      isFading: false,
      fadeScale: 1.0,
    };
    
    scoreRef.current = 0;
    levelRef.current = 1;
    playTimeRef.current = 0.0;
    initialSpikesSpawnedRef.current = false;

    setScore(0);
    setActiveLevel(1);
    setPersonalBestBeaten(false);

    if (audioRef.current && !muted) {
      audioRef.current.init();
      audioRef.current.startAmbientMusic();
    }
  };

  // Action: Jump to adjacent outer ring
  const snapPlayer = () => {
    if (gameState !== "PLAYING" || playerRef.current.isFading) return;

    const prevIndex = playerRef.current.ringIndex;
    const nextIndex = (prevIndex + 1) % 4;
    playerRef.current.ringIndex = nextIndex;

    // Trigger visual shake and sound
    screenShakeAmount.current = 6;
    audioRef.current?.playSnap();

    // Spawn a radiant glowing line array of vertical snap dust
    const pxAngle = playerRef.current.angle;
    const fromRadius = ringsRef.current[prevIndex].radius;
    const toRadius = ringsRef.current[nextIndex].radius;
    
    const canvas = canvasRef.current;
    if (canvas) {
      const w = canvas.width / window.devicePixelRatio;
      const h = canvas.height / window.devicePixelRatio;
      const cx = w / 2;
      const cy = h / 2;
      
      const x1 = cx + fromRadius * Math.cos(pxAngle);
      const y1 = cy + fromRadius * Math.sin(pxAngle);
      const x2 = cx + toRadius * Math.cos(pxAngle);
      const y2 = cy + toRadius * Math.sin(pxAngle);

      // Generate spark path
      const sparkSteps = 8;
      for (let i = 0; i < sparkSteps; i++) {
        const ratio = i / (sparkSteps - 1);
        const sx = x1 + (x2 - x1) * ratio;
        const sy = y1 + (y2 - y1) * ratio;
        
        particlesRef.current.push({
          x: sx,
          y: sy,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
          color: "#00ffcc", // green glowing energy trail
          size: 2 + Math.random() * 3,
          alpha: 1.0,
          decay: 0.04 + Math.random() * 0.04,
          shape: "spark",
        });
      }
    }
  };

  // Screen Keypress binding
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault(); // prevent default browser space scrolling
        if (gameState === "PLAYING") {
          snapPlayer();
        } else if (gameState === "MENU") {
          startGame();
        } else if (gameState === "GAMEOVER") {
          restartGame();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gameState, difficulty, muted]);

  // Main game state launchers
  const startGame = () => {
    initiateGame(difficulty);
    setGameState("PLAYING");
    lastTimeRef.current = 0;
  };

  const restartGame = () => {
    initiateGame(difficulty);
    setGameState("PLAYING");
    lastTimeRef.current = 0;
  };

  const pauseGame = () => {
    setGameState("PAUSED");
    audioRef.current?.stopAmbientMusic();
  };

  const resumeGame = () => {
    setGameState("PLAYING");
    lastTimeRef.current = 0;
    if (!muted) {
      audioRef.current?.startAmbientMusic();
    }
  };

  // Triggers visual explosion on game over / failures
  const triggerGameOver = (type: "fell" | "spike", px: number, py: number) => {
    playerRef.current.isFading = true;

    // Choose a random cyberpunk failure description
    const DEFEAT_PHRASES = [
      "Connection lost. Synaptic link severed by orbital debris.",
      "Signal dropped. Core integrity compromised by ring variance.",
      "Datalink breached. Re-route failed due to orbital gap."
    ];
    const randomIndex = Math.floor(Math.random() * DEFEAT_PHRASES.length);
    setDefeatReason(DEFEAT_PHRASES[randomIndex]);
    audioRef.current?.playFailed();
    audioRef.current?.stopAmbientMusic();

    // Shake screen violently
    screenShakeAmount.current = 18;

    // Spawn massive vibrant custom cyber particles
    const explodeColor = type === "spike" ? "#ff3366" : "#00ffcc";
    for (let i = 0; i < 35; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 6;
      particlesRef.current.push({
        x: px,
        y: py,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: explodeColor,
        size: 3 + Math.random() * 5,
        alpha: 1.0,
        decay: 0.015 + Math.random() * 0.02,
        shape: Math.random() > 0.4 ? "circle" : "square",
      });
    }

    // Display death overlay sequence with a slight frame buffer
    setTimeout(() => {
      setGameState("GAMEOVER");
      // Persist High Scores safely inside standard Client LocalStorage database
      const finalScore = scoreRef.current;
      const savedHigh = localStorage.getItem("orbit_snap_high_score");
      const currentHigh = savedHigh ? parseInt(savedHigh, 10) : 0;
      
      if (finalScore > currentHigh) {
        localStorage.setItem("orbit_snap_high_score", finalScore.toString());
        setHighScore(finalScore);
        setPersonalBestBeaten(true);
      } else {
        setPersonalBestBeaten(false);
      }
    }, 450);
  };

  // Helper angular function to check if local angle lies inside any safe solid segment (allowing wraps)
  const isAngleOnSolidSegment = (localA: number, segments: Segment[]): boolean => {
    for (const seg of segments) {
      if (seg.start < seg.end) {
        if (localA >= seg.start && localA <= seg.end) return true;
      } else {
        // wrapped segments
        if (localA >= seg.start || localA <= seg.end) return true;
      }
    }
    return false;
  };

  // Main Loop logic (Runs only while active states)
  useEffect(() => {
    if (gameState !== "PLAYING") {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handles Retina/Sharp screen resizing natively inside logic
    const handleResize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.imageSmoothingEnabled = true;
    };
    handleResize();

    const loop = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      let dt = (timestamp - lastTimeRef.current) / 1000;
      if (dt > 0.1) dt = 0.1; // clamp to prevent clipping bugs on focus losts
      lastTimeRef.current = timestamp;

      // 1. UPDATE LOOP
      // Increment play time elapsed in active round
      playTimeRef.current += dt;

      // Spawn default initial spikes after 2.0 seconds have passed to allow clean reactions
      if (!initialSpikesSpawnedRef.current && playTimeRef.current >= 2.0) {
        initialSpikesSpawnedRef.current = true;
        if (ringsRef.current[1]) {
          ringsRef.current[1].spikes = [{ localAngle: 1.8 }];
        }
        if (ringsRef.current[2]) {
          ringsRef.current[2].spikes = [{ localAngle: 3.2 }];
        }
        if (ringsRef.current[3]) {
          ringsRef.current[3].spikes = [{ localAngle: 0.8 }, { localAngle: 4.2 }];
        }
      }

      // Update data rotating animations
      cubeRot.current = (cubeRot.current + 3.8 * dt) % (2 * Math.PI);

      const w = canvas.width / window.devicePixelRatio;
      const h = canvas.height / window.devicePixelRatio;
      const cx = w / 2;
      const cy = h / 2;

      // Circular Ring Radius distribution proportional to canvas space
      const maxRadius = Math.min(w, h) * 0.43;
      const spacingUnit = maxRadius / 4.2;
      ringsRef.current.forEach((ring, idx) => {
        ring.radius = spacingUnit * (1.2 + idx * 1.0);
      });

      // Update ring rotational shifts
      ringsRef.current.forEach((ring) => {
        ring.angle = (ring.angle + ring.speed * dt) % (2 * Math.PI);
      });

      // Update player angles
      if (!playerRef.current.isFading) {
        // Base Speed scales as player scores higher
        const isHard = difficulty === "HARDCORE";
        const scaleFactor = isHard ? 2.1 : 1.6;
        const orbitalSpeed = scaleFactor + (scoreRef.current * 0.04);
        
        playerRef.current.angle = (playerRef.current.angle + orbitalSpeed * dt) % (2 * Math.PI);

        // Fetch physical player coordinate
        const currentRing = ringsRef.current[playerRef.current.ringIndex];
        const pRadius = currentRing.radius;
        const px = cx + pRadius * Math.cos(playerRef.current.angle);
        const py = cy + pRadius * Math.sin(playerRef.current.angle);

        // Track trails for glow depth
        playerRef.current.trail.push({ x: px, y: py, alpha: 1.0 });
        if (playerRef.current.trail.length > 14) {
          playerRef.current.trail.shift();
        }
        playerRef.current.trail.forEach((trailDot) => {
          trailDot.alpha -= 0.06;
        });

        // Wait exactly 0.5 seconds after a "Reboot" before enabling the defeat collision code, ensuring a clean start
        if (playTimeRef.current >= 0.5) {
          // Fail Condition 1: Check if player falls off the ring's gaps
          const relativeLocalAngle = (playerRef.current.angle - currentRing.angle) % (2 * Math.PI);
          const alignedAngle = relativeLocalAngle < 0 ? relativeLocalAngle + 2 * Math.PI : relativeLocalAngle;
          
          const safeOnSolid = isAngleOnSolidSegment(alignedAngle, currentRing.segments);
          if (!safeOnSolid) {
            triggerGameOver("fell", px, py);
          }

          // Fail Condition 2: Check for collisions with revolving Hazard Spikes on same orbit ring
          currentRing.spikes.forEach((spike) => {
            const spikeWorldAngle = spike.localAngle + currentRing.angle;
            const sx = cx + pRadius * Math.cos(spikeWorldAngle);
            const sy = cy + pRadius * Math.sin(spikeWorldAngle);

            // Standard linear distance threshold collision check
            const deltaX = px - sx;
            const deltaY = py - sy;
            const linearDist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            
            if (linearDist < 12) {
              triggerGameOver("spike", px, py);
            }
          });
        }

        // Collectible retrieval routine matching matching radius rings index
        currentRing.collectibles.forEach((collectible, cIdx) => {
          const collWorldAngle = collectible.localAngle + currentRing.angle;
          const cxCube = cx + pRadius * Math.cos(collWorldAngle);
          const cyCube = cy + pRadius * Math.sin(collWorldAngle);

          const deltaX = px - cxCube;
          const deltaY = py - cyCube;
          const distToCube = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

          // Collided: Trigger points and sparkle particle splatters
          if (distToCube < 16) {
            currentRing.collectibles.splice(cIdx, 1);
            scoreRef.current += 1;
            setScore(scoreRef.current);

            // Play futuristic chime
            audioRef.current?.playCollect();

            // Flash neon flare sparkles
            for (let i = 0; i < 14; i++) {
              const a = Math.random() * Math.PI * 2;
              const sp = 1.5 + Math.random() * 3.5;
              particlesRef.current.push({
                x: cxCube,
                y: cyCube,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp,
                color: "#ffff00", // yellow cube particles
                size: 2 + Math.random() * 4,
                alpha: 1.0,
                decay: 0.03 + Math.random() * 0.03,
                shape: "circle",
              });
            }

            // Recycle collectible spawn to a newly random ring
            spawnCollectible(ringsRef.current);

            // Dynamic progression escalation systems
            const currentPoints = scoreRef.current;
            if (currentPoints % 5 === 0) {
              const prevLvl = levelRef.current;
              levelRef.current += 1;
              setActiveLevel(levelRef.current);
              triggerNotification(`LEVEL ${levelRef.current}: ROTATIONS ACCELERATED!`);
              
              // Increment additional hazard spikes randomly as level counts ascend
              const ringToStitch = Math.floor(Math.random() * 3) + 1; // Rings 1 to 3
              if (ringsRef.current[ringToStitch].spikes.length < 3) {
                spawnSpike(ringsRef.current, ringToStitch);
              }
            } else if (currentPoints % 3 === 0) {
              triggerNotification("HAZARD SYSTEM CHARGED!");
              // Spawn temporary floating spikes
              const spikeRing = Math.floor(Math.random() * 3) + 1;
              if (ringsRef.current[spikeRing].spikes.length < 3) {
                spawnSpike(ringsRef.current, spikeRing);
              }
            }
          }
        });
      }

      // Update particle decay and vectors
      particlesRef.current.forEach((p, pIdx) => {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;
        if (p.alpha <= 0.01) {
          particlesRef.current.splice(pIdx, 1);
        }
      });

      // 2. RENDERING CANVAS LAYER
      ctx.save();
      
      // Clear with pitch black frame
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Support sharp DPI translations
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

      // Implement Screen Shake translations
      if (screenShakeAmount.current > 0.1) {
        const dx = (Math.random() - 0.5) * screenShakeAmount.current;
        const dy = (Math.random() - 0.5) * screenShakeAmount.current;
        ctx.translate(dx, dy);
        screenShakeAmount.current *= 0.88; // decay
      }

      // Background decorative gridlines
      ctx.strokeStyle = "rgba(26, 43, 60, 0.22)";
      ctx.lineWidth = 1;
      const cyberGridSz = 45;
      for (let gridX = 0; gridX < w; gridX += cyberGridSz) {
        ctx.beginPath();
        ctx.moveTo(gridX, 0);
        ctx.lineTo(gridX, h);
        ctx.stroke();
      }
      for (let gridY = 0; gridY < h; gridY += cyberGridSz) {
        ctx.beginPath();
        ctx.moveTo(0, gridY);
        ctx.lineTo(w, gridY);
        ctx.stroke();
      }

      // Display circular peripheral alignment rings
      ctx.strokeStyle = "rgba(0, 255, 204, 0.05)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, maxRadius * 1.14, 0, 2 * Math.PI);
      ctx.stroke();

      // Render concentric orbits
      ringsRef.current.forEach((ring, idx) => {
        const isPlayerCurrentIdx = playerRef.current.ringIndex === idx;

        // Custom cyber color pairings
        ctx.strokeStyle = isPlayerCurrentIdx ? "rgba(0, 255, 204, 0.95)" : "rgba(26, 43, 60, 0.65)";
        ctx.lineWidth = isPlayerCurrentIdx ? 4.5 : 2.5;
        
        // Add exquisite shadows for beautiful retro glow
        ctx.shadowColor = isPlayerCurrentIdx ? "#00ffcc" : "#1a2b3c";
        ctx.shadowBlur = isPlayerCurrentIdx ? 14 : 3;

        // Draw solid circular components omitting space gaps
        ring.segments.forEach((seg) => {
          const rotationAngleStart = seg.start + ring.angle;
          const rotationAngleEnd = seg.end + ring.angle;

          // Wrapped Canvas Arc drawing utility 
          if (rotationAngleStart < rotationAngleEnd) {
            ctx.beginPath();
            ctx.arc(cx, cy, ring.radius, rotationAngleStart, rotationAngleEnd);
            ctx.stroke();
          } else {
            ctx.beginPath();
            ctx.arc(cx, cy, ring.radius, rotationAngleStart, 2 * Math.PI);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(cx, cy, ring.radius, 0, rotationAngleEnd);
            ctx.stroke();
          }
        });

        // Kill active path shadow blur for secondary vectors (reduces webgpu lag)
        ctx.shadowBlur = 0;

        // Draw dangerous red spikes rotating inside orbits
        ring.spikes.forEach((spike) => {
          const absoluteAngle = spike.localAngle + ring.angle;
          const sx = cx + ring.radius * Math.cos(absoluteAngle);
          const sy = cy + ring.radius * Math.sin(absoluteAngle);

          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(absoluteAngle);

          ctx.fillStyle = "#ff3366"; // Neon crimson red
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.2;
          ctx.shadowColor = "#ff3366";
          ctx.shadowBlur = 10;

          ctx.beginPath();
          ctx.moveTo(-5, -4);
          ctx.lineTo(13, 0); // Tip pointing wedge outwards along orbit perimeter
          ctx.lineTo(-5, 4);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          ctx.restore();
        });

        // Draw yellow cubes collectibles
        ring.collectibles.forEach((coll) => {
          const absoluteAngle = coll.localAngle + ring.angle;
          const rx = cx + ring.radius * Math.cos(absoluteAngle);
          const ry = cy + ring.radius * Math.sin(absoluteAngle);

          ctx.save();
          ctx.translate(rx, ry);
          ctx.rotate(cubeRot.current);

          ctx.fillStyle = "#ffff00"; // yellow fluorescent
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.5;
          ctx.shadowColor = "#ffff00";
          ctx.shadowBlur = 12;

          ctx.fillRect(-6, -6, 12, 12);
          ctx.strokeRect(-6, -6, 12, 12);

          ctx.restore();
        });
      });

      // Reset standard shadows for particles and trail drawing
      ctx.shadowBlur = 0;

      // Draw faint neon trails
      playerRef.current.trail.forEach((tDot) => {
        ctx.beginPath();
        ctx.fillStyle = `rgba(0, 255, 204, ${tDot.alpha * 0.55})`;
        ctx.arc(tDot.x, tDot.y, 3.8, 0, 2 * Math.PI);
        ctx.fill();
      });

      // Draw active Player bright neon dot
      if (!playerRef.current.isFading) {
        const currentRing = ringsRef.current[playerRef.current.ringIndex];
        const px = cx + currentRing.radius * Math.cos(playerRef.current.angle);
        const py = cy + currentRing.radius * Math.sin(playerRef.current.angle);

        ctx.save();
        ctx.translate(px, py);
        
        ctx.fillStyle = "#00ffcc"; // Neon turquoise green
        ctx.shadowColor = "#00ffcc";
        ctx.shadowBlur = 16;

        ctx.beginPath();
        ctx.arc(0, 0, 6.5, 0, 2 * Math.PI);
        ctx.fill();

        // White core node
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(0, 0, 3.0, 0, 2 * Math.PI);
        ctx.fill();

        ctx.restore();
      }

      // Draw particles array
      particlesRef.current.forEach((p) => {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;

        if (p.shape === "square") {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        } else if (p.shape === "spark") {
          ctx.beginPath();
          ctx.moveTo(-p.size, 0);
          ctx.lineTo(0, -p.size / 2);
          ctx.lineTo(p.size, 0);
          ctx.lineTo(0, p.size / 2);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, 2 * Math.PI);
          ctx.fill();
        }
        ctx.restore();
      });
      ctx.globalAlpha = 1.0;

      ctx.restore();

      animationFrameId.current = requestAnimationFrame(loop);
    };

    animationFrameId.current = requestAnimationFrame(loop);

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [gameState, difficulty]);

  return (
    <div className="relative min-h-screen w-full bg-[#000000] text-gray-100 flex flex-col md:flex-row font-sans overflow-hidden selection:bg-[#00ffcc] selection:text-black">
      {/* Absolute CRT Scanline Overlay Effect */}
      <div className="pointer-events-none absolute inset-0 z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[size:100%_4px] opacity-[0.07]" />

      {/* LEFT SIDEBAR: Cyberpunk Branding and Stats */}
      <div className="w-full md:w-80 p-6 md:p-8 flex flex-col justify-between border-b md:border-b-0 md:border-r border-[#1a2b3c] bg-black z-10">
        <div>
          {/* Neon Logo */}
          <div className="flex items-center gap-3 mb-6">
            <span className="p-2.5 rounded-xl bg-gradient-to-br from-[#1a2b3c] to-black border border-[#00ffcc] text-[#00ffcc] shadow-[0_0_15px_rgba(0,255,204,0.15)] animate-pulse">
              <Disc className="w-6 h-6 animate-spin text-[#00ffcc]" style={{ animationDuration: "3s" }} />
            </span>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-widest text-[#00ffcc] [text-shadow:_0_0_10px_rgba(0,255,204,0.3)]">
                ORBIT SNAP
              </h1>
              <p className="text-xs text-[#1a2b3c] tracking-widest font-mono">
                SECURE_LINK.v2.8
              </p>
            </div>
          </div>

          <p className="text-sm text-gray-400 mb-8 font-mono leading-relaxed">
            Overpass nested circular security grids by snapping outwards. Maximize cubes retrieved before gap-slip or core hazard collapse.
          </p>

          {/* Active stats panel */}
          <div className="space-y-4 font-mono">
            <div className="p-4 rounded-xl bg-zinc-950/80 border border-[#1a2b3c]/80 space-y-2">
              <div className="text-xs text-[#1a2b3c] flex items-center gap-1.5 uppercase font-bold tracking-wider">
                <Target className="w-3.5 h-3.5 text-[#00ffcc]" /> NODE RETRIEVED
              </div>
              <div className="text-2xl font-semibold text-yellow-300 tracking-tight flex items-baseline gap-1">
                {score} <span className="text-xs text-[#1a2b3c]">CUBES</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-zinc-950/80 border border-[#1a2b3c]/80 space-y-2">
              <div className="text-xs text-[#1a2b3c] flex items-center gap-1.5 uppercase font-bold tracking-wider">
                <Trophy className="w-3.5 h-3.5 text-yellow-500" /> SYSTEM HIGH RECORD
              </div>
              <div className="text-2xl font-semibold text-white tracking-tight flex items-baseline gap-1">
                {highScore} <span className="text-xs text-[#1a2b3c]">PTS</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-zinc-950/80 border border-[#1a2b3c]/80 space-y-2">
              <div className="text-xs text-[#1a2b3c] flex items-center gap-1.5 uppercase font-bold tracking-wider">
                <Activity className="w-3.5 h-3.5 text-[#ff3366]" /> THREAT RADAR
              </div>
              <div className="text-sm font-semibold flex items-center justify-between text-gray-300">
                <span>SECURITY LEVEL:</span>
                <span className="text-[#ff3366] font-bold">{activeLevel}</span>
              </div>
              <div className="text-xs text-gray-500">
                Rings rotates faster as levels mount up.
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM PANEL: Audio Control Toggles and Manual */}
        <div className="mt-8 space-y-4 font-mono">
          <div className="flex gap-2">
            <button
              onClick={() => setMuted(!muted)}
              className={`flex-1 flex items-center justify-center gap-2 p-2.5 rounded-lg border transition-all text-sm font-semibold ${
                muted
                  ? "border-zinc-800 text-gray-500 bg-zinc-950/40"
                  : "border-[#00ffcc]/30 text-[#00ffcc] bg-[#00ffcc]/5 hover:bg-[#00ffcc]/15 shadow-[0_0_10px_rgba(0,255,204,0.05)]"
              }`}
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              {muted ? "MUTED" : "SOUND ON"}
            </button>
          </div>

          <div className="text-[11px] text-[#1a2b3c] leading-tight flex items-center gap-2 border-t border-[#1a2b3c]/30 pt-4">
            <Info className="w-4 h-4 text-[#00ffcc] shrink-0" />
            <span>PLAY WITH SPACEBAR OR CLICKING SCREEN CONTAINER</span>
          </div>
        </div>
      </div>

      {/* RIGHT CONTAINER: Interactive Arcade Stage */}
      <div className="flex-1 relative flex flex-col items-center justify-center bg-[#010101] min-h-[450px] md:min-h-screen">
        
        {/* Core Canvas stage container */}
        <div
          onClick={gameState === "PLAYING" ? snapPlayer : undefined}
          className={`relative w-full h-full max-w-2xl max-h-[640px] aspect-square mx-auto flex items-center justify-center ${
            gameState === "PLAYING" ? "cursor-pointer" : ""
          }`}
        >
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full bg-black block select-none"
            style={{ touchAction: "none" }}
          />

          {/* Floating announcements HUD overlay */}
          <AnimatePresence>
            {announcement && (
              <motion.div
                initial={{ opacity: 0, scale: 0.85, y: 15 }}
                animate={{ opacity: 1, scale: 1.0, y: 0 }}
                exit={{ opacity: 0, scale: 1.1, y: -20 }}
                transition={{ type: "spring", stiffness: 180, damping: 15 }}
                className="absolute top-1/4 pointer-events-none z-30 px-6 py-2 rounded-full border border-[#00ffcc] bg-black/95 text-[#00ffcc] text-xs font-mono font-bold tracking-widest uppercase shadow-[0_0_20px_rgba(0,255,204,0.35)]"
              >
                {announcement}
              </motion.div>
            )}
          </AnimatePresence>

          {/* OVERLAY 1: INTRO / MENU */}
          <AnimatePresence>
            {gameState === "MENU" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/85 z-40 flex flex-col items-center justify-center p-6 text-center"
              >
                <motion.div
                  initial={{ y: 25, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.08, type: "spring" }}
                  className="max-w-md w-full space-y-6"
                >
                  <div className="inline-block px-3 py-1 rounded-full border border-[#00ffcc]/30 bg-[#00ffcc]/5 text-xs text-[#00ffcc] font-mono tracking-widest mb-2 uppercase animate-pulse">
                    ARCH-GRID SIMULATION
                  </div>
                  
                  <h2 className="text-4xl md:text-5xl font-black tracking-widest text-[#00ffcc] [text-shadow:_0_0_20px_rgba(0,255,204,0.5)]">
                    ORBIT SNAP
                  </h2>
                  <p className="text-sm text-gray-400 font-mono leading-relaxed">
                    Cycle outward through revolving light rings. Gather nodes to charge system power while steering clear of gaps and neon core spikes.
                  </p>

                  {/* Settings Toggle Option */}
                  <div className="p-4 rounded-xl border border-[#1a2b3c] bg-zinc-950/75 space-y-3">
                    <div className="text-xs text-[#1a2b3c] tracking-widest font-mono font-bold uppercase flex items-center justify-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-[#ffff00]" /> CHOOSE DIFFICULTY FREQ
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setDifficulty("CASUAL")}
                        className={`flex-1 p-2 rounded-lg text-xs font-mono font-bold transition-all ${
                          difficulty === "CASUAL"
                            ? "bg-[#00ffcc] text-black border border-[#00ffcc]"
                            : "bg-zinc-900 border border-zinc-800 text-gray-400 hover:text-white"
                        }`}
                      >
                        CASUAL FLOW
                      </button>
                      <button
                        onClick={() => setDifficulty("HARDCORE")}
                        className={`flex-1 p-2 rounded-lg text-xs font-mono font-bold transition-all ${
                          difficulty === "HARDCORE"
                            ? "bg-[#ff3366] text-white border border-[#ff3366] shadow-[0_0_15px_rgba(255,51,102,0.3)] animate-pulse"
                            : "bg-zinc-900 border border-zinc-800 text-gray-400 hover:text-white"
                        }`}
                      >
                        HARDCORE JUMP
                      </button>
                    </div>
                    <div className="text-[10px] text-gray-500 font-mono leading-tight">
                      {difficulty === "CASUAL" 
                        ? "Steady progression, safe speed ramps, standard-size gaps." 
                        : "High initial velocities, wide circular ring gap offsets, maximum spike frequency."}
                    </div>
                  </div>

                  {/* Manual visual hints */}
                  <div className="grid grid-cols-2 gap-3 text-left font-mono text-[11px] text-gray-400">
                    <div className="p-2.5 rounded-lg bg-zinc-950/40 border border-[#1a2b3c]/40 flex items-start gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#00ffcc] mt-1 shrink-0" />
                      <span>TAP / CLICK anywhere to snap outwards.</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-zinc-950/40 border border-[#1a2b3c]/40 flex items-start gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#ff3366] mt-1 shrink-0" />
                      <span>AVOID spike wedges and ring gaps.</span>
                    </div>
                  </div>

                  {/* Fire Game Engine Button */}
                  <button
                    onClick={startGame}
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-gradient-to-r from-[#00ffcc] to-[#00b386] text-black font-extrabold text-sm md:text-base tracking-widest transition-all hover:scale-[1.02] shadow-[0_0_25px_rgba(0,255,204,0.45)] cursor-pointer uppercase"
                  >
                    <Play className="w-5 h-5 fill-current" />
                    BOOT ENGINE [SPACE]
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* OVERLAY 2: GAME OVER / CRITICAL FAILURE */}
          <AnimatePresence>
            {gameState === "GAMEOVER" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/90 z-40 flex flex-col items-center justify-center p-6 text-center"
              >
                <motion.div
                  initial={{ y: -30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 150 }}
                  className="max-w-md w-full space-y-6"
                >
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-red-500/30 bg-red-500/10 text-xs text-[#ff3366] font-mono tracking-widest font-bold uppercase">
                    <Activity className="w-3.5 h-3.5 animate-pulse" /> NETWORK COLLAPSE
                  </div>

                  <h2 className="text-4xl md:text-5xl font-black tracking-widest text-[#ff3366] [text-shadow:_0_0_20px_rgba(255,51,102,0.4)] uppercase">
                    DEFEATED
                  </h2>

                  <p id="defeat-cause-text" className="text-xs text-gray-400 font-mono italic max-w-sm mx-auto leading-relaxed mt-2">
                    {defeatReason}
                  </p>

                  {/* Score breakdown metrics card */}
                  <div className="p-5 rounded-2xl border border-[#1a2b3c] bg-zinc-950/90 font-mono space-y-4">
                    {personalBestBeaten && (
                      <div className="flex items-center justify-center gap-2 text-yellow-300 bg-yellow-500/10 border border-yellow-500/20 py-1.5 rounded-lg text-xs font-bold animate-bounce">
                        <Award className="w-4 h-4 text-yellow-400" /> NEW SYST_RECORD AUTHORIZED!
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-4 divide-x divide-[#1a2b3c]">
                      <div>
                        <div className="text-[10px] text-gray-500 uppercase tracking-widest">RETRIEVED CUBES</div>
                        <div className="text-3xl font-extrabold text-[#00ffcc] mt-1">{score}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-500 uppercase tracking-widest">RANK SECURED</div>
                        <div className="text-[13px] font-bold text-gray-200 mt-2">
                          {score < 5 ? "ORBIT INTRO" : score < 15 ? "GRID RUNNER" : score < 30 ? "NEON MASTER" : "DEEP SHIELD HACKER"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Play Again Reboot Controller */}
                  <button
                    onClick={restartGame}
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-gradient-to-r from-[#ff3366] to-[#cc0044] text-white font-extrabold text-sm md:text-base tracking-widest transition-all hover:scale-[1.02] shadow-[0_0_25px_rgba(255,51,102,0.4)] cursor-pointer uppercase"
                  >
                    <RotateCcw className="w-5 h-5" />
                    REBOOT LINK [SPACE]
                  </button>

                  <button
                    onClick={() => setGameState("MENU")}
                    className="text-xs font-mono text-gray-500 hover:text-gray-300 tracking-wider hover:underline"
                  >
                    BACK TO SECTOR INSTRUCTIONS
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* OVERLAY 3: SYSTEM PAUSED */}
          <AnimatePresence>
            {gameState === "PAUSED" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/85 z-40 flex flex-col items-center justify-center p-6 text-center"
              >
                <div className="space-y-6">
                  <h3 className="text-3xl font-black tracking-widest text-white">SYSTEM_PAUSED</h3>
                  <p className="text-sm font-mono text-gray-400">
                    Orbit rotations stabilized. Connection waiting to resume safely.
                  </p>
                  <button
                    onClick={resumeGame}
                    className="px-6 py-3 rounded-xl bg-[#00ffcc] text-black font-extrabold tracking-widest hover:scale-105 transition-all shadow-[0_0_20px_rgba(0,255,204,0.3)] uppercase cursor-pointer"
                  >
                    RESUME CONSTRUCT
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Dynamic Corner Widgets (Pause & High Score Flags) */}
          {gameState === "PLAYING" && (
            <div className="absolute top-4 right-4 z-30 flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  pauseGame();
                }}
                className="p-2.5 rounded-lg border border-[#1a2b3c] bg-black/80 hover:bg-zinc-900 text-gray-400 hover:text-[#00ffcc] transition-all cursor-pointer"
              >
                <Pause className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
