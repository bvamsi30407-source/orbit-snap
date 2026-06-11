import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  Trophy,
  Zap,
  CornerDownRight,
  ShieldAlert,
  Sparkles,
  Download,
  Flame,
  Gauge,
  HelpCircle
} from "lucide-react";

// Canvas Resolution Bounds
const V_W = 600;
const V_H = 800;

interface Skin {
  id: string;
  name: string;
  cost: number;
  helmet: string;
  vest: string;
  pants: string;
  stripe: string;
  description: string;
}

const SKINS: Skin[] = [
  {
    id: "default",
    name: "Classic Crew",
    cost: 0,
    helmet: "#ffd500",
    vest: "#ff5500",
    pants: "#1b2d42",
    stripe: "#39ff14",
    description: "Standard orange high-vis airport worker apparel."
  },
  {
    id: "neon",
    name: "Neon Hazard",
    cost: 250,
    helmet: "#39ff14",
    vest: "#bc13fe",
    pants: "#14151b",
    stripe: "#00ffff",
    description: "Toxic waste glow theme. High visibility, extreme attitude."
  },
  {
    id: "pink",
    name: "Pink Panic",
    cost: 600,
    helmet: "#ff007f",
    vest: "#ffb6c1",
    pants: "#ffffff",
    stripe: "#ff00ff",
    description: "Vaporwave panic. Look fab while getting near-misses."
  },
  {
    id: "cyber",
    name: "Cyber Runner",
    cost: 1200,
    helmet: "#00ffff",
    vest: "#1c1e24",
    pants: "#39ff14",
    stripe: "#00ffff",
    description: "Fitted with cybernetic light pipelines and dark carbon plates."
  },
  {
    id: "gold",
    name: "Golden Boss",
    cost: 2500,
    helmet: "#ffd700",
    vest: "#7f1d1d",
    pants: "#b45309",
    stripe: "#ffd700",
    description: "Exclusive luxury silk velvet & 24K pure gold crown shell."
  }
];

interface FloatingText {
  text: string;
  x: number;
  y: number;
  color: string;
  alpha: number;
  scale: number;
  speedY: number;
}

// Game Entities Types
interface Obstacle {
  id: number;
  lane: number;
  x: number;
  y: number;
  type: "suitcase" | "box" | "scanner" | "sign" | "cart" | "dog";
  speed: number; // movement speed on conveyor (- means moving forward, + means rolling backward)
  width: number;
  height: number;
  animTimer: number;
  dogDir?: number;
  nearMissScored?: boolean;
}

interface Collectible {
  id: number;
  lane: number;
  x: number;
  y: number;
  type: "sticker" | "drink" | "boots";
  width: number;
  height: number;
  pulseTimer: number;
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
  type: "shred" | "speed" | "star" | "sparkle";
}

// Retro Web Audio SFX Engine
class SoundEngine {
  ctx: AudioContext | null = null;
  muted: boolean = false;
  private bgmInterval: any = null;
  private stepCount = 0;
  private shredderGain: GainNode | null = null;
  private shredderOsc: OscillatorNode | null = null;

  constructor() {}

  init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      try {
        this.ctx = new AudioContextClass();
        // Warm up shredder low-frequency rumble
        this.shredderOsc = this.ctx.createOscillator();
        this.shredderGain = this.ctx.createGain();
        this.shredderOsc.type = "sawtooth";
        this.shredderOsc.frequency.setValueAtTime(55, this.ctx.currentTime);
        this.shredderGain.gain.setValueAtTime(0.0, this.ctx.currentTime); // start silent
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(120, this.ctx.currentTime);

        this.shredderOsc.connect(filter);
        filter.connect(this.shredderGain);
        this.shredderGain.connect(this.ctx.destination);
        this.shredderOsc.start();
      } catch (e) {
        console.warn("Audio Context init blocked or failed.", e);
      }
    }
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (m) {
      if (this.shredderGain && this.ctx) {
        this.shredderGain.gain.setValueAtTime(0, this.ctx.currentTime);
      }
      this.stopBGM();
    } else {
      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume();
      }
    }
  }

  updateShredderRumble(dangerLevel: number) {
    if (this.muted || !this.ctx || !this.shredderGain) return;
    // dangerLevel ranges from 0 (far) to 1 (falling in!)
    const targetGain = dangerLevel * 0.18;
    this.shredderGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.1);
    if (this.shredderOsc) {
      const targetFreq = 45 + dangerLevel * 50;
      this.shredderOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.1);
    }
  }

  playShift() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.type = "triangle";
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(650, now + 0.08);
    
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.08);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  playDash() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.type = "sine";
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(780, now + 0.16);
    
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.16);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  playSlide() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(350, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.22);
    
    gain.gain.setValueAtTime(0.07, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.22);
    osc.start(now);
    osc.stop(now + 0.22);
  }

  playCollect() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.setValueAtTime(880, now + 0.06); // A5
    osc.frequency.setValueAtTime(1174.66, now + 0.12); // D6
    
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.24);
    osc.start(now);
    osc.stop(now + 0.24);
  }

  playPowerup() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880, 1109.73];
    notes.forEach((freq, i) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + i * 0.05);
      gain.gain.setValueAtTime(0.06, now + i * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.2);
      osc.start(now + i * 0.05);
      osc.stop(now + i * 0.05 + 0.2);
    });
  }

  playHit() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.linearRampToValueAtTime(30, now + 0.4);
    
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.4);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  playShredded() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    // Buzzing final death grind
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.type = "square";
    osc.frequency.setValueAtTime(65, now);
    osc.frequency.linearRampToValueAtTime(30, now + 0.8);
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.8);
    osc.start(now);
    osc.stop(now + 0.8);

    // Crackle noise burst
    try {
      const bufferSize = this.ctx.sampleRate * 0.6;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(300, now);
      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.3, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      
      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);
      noise.start(now);
      noise.stop(now + 0.6);
    } catch(e) {}
  }

  startBGM() {
    if (this.muted) return;
    this.init();
    if (this.bgmInterval) return;

    this.stepCount = 0;
    const chordSeq = [
      [110, 165], // A2, E3
      [110, 165],
      [130.81, 196], // C3, G3
      [146.83, 220], // D3, A3
    ];

    this.bgmInterval = setInterval(() => {
      if (this.muted || !this.ctx) return;
      if (this.ctx.state === "suspended") return;
      
      const now = this.ctx.currentTime;
      const beat = this.stepCount % 8;
      const chordIdx = Math.floor(this.stepCount / 8) % chordSeq.length;
      const pair = chordSeq[chordIdx];

      // Bass Pluck on major beats
      if (beat === 0 || beat === 3 || beat === 6) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.type = "triangle";
        osc.frequency.setValueAtTime(pair[0], now);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.start(now);
        osc.stop(now + 0.45);
      }

      // Snare-like noise burst on offbeats (2, 6)
      if (beat === 2 || beat === 6) {
        try {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.type = "sine";
          osc.frequency.setValueAtTime(800, now);
          osc.frequency.exponentialRampToValueAtTime(100, now + 0.06);
          gain.gain.setValueAtTime(0.015, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.06);
          osc.start(now);
          osc.stop(now + 0.06);
        } catch(e) {}
      }

      // Tech synth lead chime on tick 5
      if (beat === 5) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(pair[1] * 1.5, now);
        gain.gain.setValueAtTime(0.02, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.23);
      }

      this.stepCount = (this.stepCount + 1) % 32;
    }, 180); // Fast high action tempo
  }

  stopBGM() {
    if (this.bgmInterval) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
  }

  playNearMiss() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(1400, now + 0.12);
    
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.25);
    osc.start(now);
    osc.stop(now + 0.25);
  }
}

export default function App() {
  const [gameState, setGameState] = useState<"MENU" | "PLAYING" | "GAMEOVER" | "PAUSED">("MENU");
  const [muted, setMuted] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(0);
  const [distance, setDistance] = useState<number>(0);
  const [maxDistance, setMaxDistance] = useState<number>(0);
  const [beltSpeedKph, setBeltSpeedKph] = useState<number>(15);
  const [showTutorial, setShowTutorial] = useState<boolean>(true);

  // Uniform Shop and Outfit States
  const [totalPoints, setTotalPoints] = useState<number>(0);
  const [unlockedSkins, setUnlockedSkins] = useState<string[]>(["default"]);
  const [selectedSkin, setSelectedSkin] = useState<string>("default");
  const [menuTab, setMenuTab] = useState<"PLAY" | "SHOP">("PLAY");
  
  // Power-up indicators for HUD
  const [energyDrinkTime, setEnergyDrinkTime] = useState<number>(0);
  const [magneticTime, setMagneticTime] = useState<number>(0);

  // References
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const soundRef = useRef<SoundEngine | null>(null);
  
  // Active state tracks
  const statsRef = useRef({
    score: 0,
    distance: 0,
    multiplier: 1,
    consecutiveStickers: 0,
    difficultyMultiplier: 1.0,
  });

  const playerRef = useRef({
    lane: 1,       // 0: Left, 1: Center, 2: Right
    targetX: 300,  // pixel screen horizontal center
    x: 300,        // animated smoothly
    y: 450,        // 200 (safety front) to 670 (shredder limit)
    width: 44,
    height: 55,
    isSliding: false,
    slideTimeLeft: 0,
    isLeaping: false,
    leapTimeLeft: 0,
    stunTimeLeft: 0,
    invincibleTimeLeft: 0,
    magnetTimeLeft: 0,
    animFrame: 0,
    driftTimer: 0,
  });

  const beltRef = useRef({
    speed: 210,         // starting pixels/sec speed
    maxSpeed: 480,
    lengthScrolled: 0,
    levelTimer: 0,
  });

  const obstaclesRef = useRef<Obstacle[]>([]);
  const collectiblesRef = useRef<Collectible[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const nearMissFlashActiveRef = useRef<number>(0);
  
  const totalPointsRef = useRef<number>(0);
  const selectedSkinRef = useRef<string>("default");

  const lastTimeRef = useRef<number>(0);
  const uniqueIdSeq = useRef<number>(1);
  const animationFrameId = useRef<number | null>(null);

  // Sync refs to state changes
  useEffect(() => {
    totalPointsRef.current = totalPoints;
  }, [totalPoints]);

  useEffect(() => {
    selectedSkinRef.current = selectedSkin;
  }, [selectedSkin]);

  // Load high score persistent state on mount
  useEffect(() => {
    const savedScore = localStorage.getItem("overbooked_hs");
    const savedDist = localStorage.getItem("overbooked_hd");
    if (savedScore) setHighScore(parseInt(savedScore, 10));
    if (savedDist) setMaxDistance(parseInt(savedDist, 10));

    const savedTotalPointsStr = localStorage.getItem("overbooked_total_points");
    if (savedTotalPointsStr) {
      const pts = parseInt(savedTotalPointsStr, 10);
      setTotalPoints(pts);
      totalPointsRef.current = pts;
    }

    const savedUnlocked = localStorage.getItem("overbooked_unlocked_skins");
    if (savedUnlocked) {
      try {
        setUnlockedSkins(JSON.parse(savedUnlocked));
      } catch (e) {
        setUnlockedSkins(["default"]);
      }
    }

    const savedCurrentSkin = localStorage.getItem("overbooked_current_skin");
    if (savedCurrentSkin) setSelectedSkin(savedCurrentSkin);

    soundRef.current = new SoundEngine();
    return () => {
      soundRef.current?.stopBGM();
    };
  }, []);

  const buyOrSelectSkin = (skin: Skin) => {
    if (unlockedSkins.includes(skin.id)) {
      setSelectedSkin(skin.id);
      localStorage.setItem("overbooked_current_skin", skin.id);
      soundRef.current?.playShift();
    } else {
      if (totalPoints >= skin.cost) {
        const nextPts = totalPoints - skin.cost;
        setTotalPoints(nextPts);
        const nextUnlocked = [...unlockedSkins, skin.id];
        setUnlockedSkins(nextUnlocked);
        setSelectedSkin(skin.id);

        localStorage.setItem("overbooked_total_points", nextPts.toString());
        localStorage.setItem("overbooked_unlocked_skins", JSON.stringify(nextUnlocked));
        localStorage.setItem("overbooked_current_skin", skin.id);

        soundRef.current?.playPowerup();
      } else {
        // Play action hit buzzer indicating insufficient points
        soundRef.current?.playHit();
      }
    }
  };

  // Control Audio
  useEffect(() => {
    soundRef.current?.setMuted(muted);
  }, [muted]);

  const initGame = () => {
    statsRef.current = {
      score: 0,
      distance: 0,
      multiplier: 1,
      consecutiveStickers: 0,
      difficultyMultiplier: 1.0,
    };

    playerRef.current = {
      lane: 1,
      targetX: 300,
      x: 300,
      y: 350, // Safe starting center-front position
      width: 44,
      height: 55,
      isSliding: false,
      slideTimeLeft: 0,
      isLeaping: false,
      leapTimeLeft: 0,
      stunTimeLeft: 0,
      invincibleTimeLeft: 1.5, // blink invulnerable at start
      animFrame: 0,
      driftTimer: 0,
      magnetTimeLeft: 0,
    };

    beltRef.current = {
      speed: 210,
      maxSpeed: 520,
      lengthScrolled: 0,
      levelTimer: 0,
    };

    obstaclesRef.current = [];
    collectiblesRef.current = [];
    particlesRef.current = [];
    uniqueIdSeq.current = 1;
    lastTimeRef.current = 0;

    setScore(0);
    setDistance(0);
    setBeltSpeedKph(15);
    setEnergyDrinkTime(0);
    setMagneticTime(0);

    if (soundRef.current) {
      soundRef.current.init();
      soundRef.current.setMuted(muted);
      soundRef.current.startBGM();
    }
  };

  const triggerNearMiss = () => {
    soundRef.current?.playNearMiss();
    
    // Explode glittering metallic gold star particles
    for (let i = 0; i < 12; i++) {
      particlesRef.current.push({
        x: playerRef.current.x,
        y: playerRef.current.y - 15,
        vx: (Math.random() - 0.5) * 8,
        vy: -3 - Math.random() * 7,
        color: "#ffd700", // Gold
        size: 4 + Math.random() * 4,
        alpha: 1.0,
        decay: 0.035,
        type: "star",
      });
    }

    // Add +50 points score bonus
    statsRef.current.score += 50;
    setScore(statsRef.current.score);

    // Create a gorgeous floating text popup on canvas
    floatingTextsRef.current.push({
      text: "+50 NEAR MISS!",
      x: playerRef.current.x,
      y: playerRef.current.y - 40,
      color: "#ffd700",
      alpha: 1.0,
      scale: 1.4,
      speedY: -85,
    });

    // Trigger brief gold screen flash overlay
    nearMissFlashActiveRef.current = 0.16;
  };

  const handleLaneShift = (dir: "L" | "R") => {
    if (gameState !== "PLAYING") return;
    if (playerRef.current.stunTimeLeft > 0) return; // cannot move while stunned
    
    let nextLane = playerRef.current.lane;
    if (dir === "L" && nextLane > 0) nextLane -= 1;
    if (dir === "R" && nextLane < 2) nextLane += 1;

    if (nextLane !== playerRef.current.lane) {
      const oldLane = playerRef.current.lane;
      
      // Check if player shifts lane at the absolute last microsecond before hitting a suitcase or hazard
      const dangerousObs = obstaclesRef.current.find(obs => {
        return obs.lane === oldLane &&
               !obs.nearMissScored &&
               obs.y > playerRef.current.y - 85 &&
               obs.y < playerRef.current.y + 20;
      });

      if (dangerousObs) {
        dangerousObs.nearMissScored = true;
        triggerNearMiss();
      }

      playerRef.current.lane = nextLane;
      playerRef.current.targetX = getLaneCenterX(nextLane);
      soundRef.current?.playShift();
    }
  };

  const handleUpDash = () => {
    if (gameState !== "PLAYING") return;
    if (playerRef.current.stunTimeLeft > 0) return;
    if (playerRef.current.isLeaping || playerRef.current.isSliding) return;

    // Trigger leap speed dash forward
    playerRef.current.isLeaping = true;
    playerRef.current.leapTimeLeft = 0.45; // seconds
    soundRef.current?.playDash();

    // Push player physical position up screen
    playerRef.current.y = Math.max(160, playerRef.current.y - 120);

    // Spawn leaping dust particles
    for (let i = 0; i < 8; i++) {
      particlesRef.current.push({
        x: playerRef.current.x,
        y: playerRef.current.y + 20,
        vx: (Math.random() - 0.5) * 5,
        vy: 2 + Math.random() * 3,
        color: "rgba(255, 255, 255, 0.7)",
        size: 3 + Math.random() * 4,
        alpha: 1.0,
        decay: 0.05,
        type: "speed",
      });
    }
  };

  const handleDownSlide = () => {
    if (gameState !== "PLAYING") return;
    if (playerRef.current.stunTimeLeft > 0) return;
    if (playerRef.current.isLeaping || playerRef.current.isSliding) return;

    // Slide crouching states
    playerRef.current.isSliding = true;
    playerRef.current.slideTimeLeft = 0.6; // seconds
    soundRef.current?.playSlide();

    // Spawn sleek speed slides on belt
    for (let i = 0; i < 6; i++) {
      particlesRef.current.push({
        x: playerRef.current.x + (Math.random() - 0.5) * 20,
        y: playerRef.current.y + 25,
        vx: (Math.random() - 0.5) * 2,
        vy: -3 - Math.random() * 2,
        color: "rgba(242, 169, 0, 0.6)", // yellow warning color spark
        size: 2 + Math.random() * 3,
        alpha: 0.9,
        decay: 0.06,
        type: "speed",
      });
    }
  };

  const triggerGameOver = () => {
    setGameState("GAMEOVER");
    soundRef.current?.playShredded();
    soundRef.current?.stopBGM();
    soundRef.current?.updateShredderRumble(0);

    // Check high score thresholds and update local storage database
    const finalScore = statsRef.current.score;
    const finalDist = Math.floor(statsRef.current.distance);

    const savedHS = localStorage.getItem("overbooked_hs");
    const savedHD = localStorage.getItem("overbooked_hd");

    const curHS = savedHS ? parseInt(savedHS, 10) : 0;
    const curHD = savedHD ? parseInt(savedHD, 10) : 0;

    if (finalScore > curHS) {
      localStorage.setItem("overbooked_hs", finalScore.toString());
      setHighScore(finalScore);
    }
    if (finalDist > curHD) {
      localStorage.setItem("overbooked_hd", finalDist.toString());
      setMaxDistance(finalDist);
    }

    // Accumulate total points across all runs for the skin shop
    const currentTotalPoints = totalPointsRef.current;
    const nextTotalPoints = currentTotalPoints + finalScore;
    setTotalPoints(nextTotalPoints);
    localStorage.setItem("overbooked_total_points", nextTotalPoints.toString());
  };

  // Maps physical column center coordinate
  const getLaneCenterX = (laneIdx: number) => {
    if (laneIdx === 0) return 180; // Left lane
    if (laneIdx === 1) return 300; // Center lane
    return 420;                    // Right lane
  };

  // Keyboard and Global Triggers Binding
  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (gameState === "PLAYING") {
        if (k === "arrowleft" || k === "a") handleLaneShift("L");
        if (k === "arrowright" || k === "d") handleLaneShift("R");
        if (k === "arrowup" || k === "w") handleLaneShift("L"); // Note: Support Up as dash too
        if (e.key === "ArrowUp" || k === "w") { e.preventDefault(); handleUpDash(); }
        if (e.key === "ArrowDown" || k === "s") { e.preventDefault(); handleDownSlide(); }
        if (e.key === "Escape") { e.preventDefault(); setGameState("PAUSED"); soundRef.current?.stopBGM(); }
      } else if (gameState === "MENU") {
        if (e.key === " " || e.key === "Enter") { e.preventDefault(); startGameBtn(); }
      } else if (gameState === "GAMEOVER") {
        if (e.key === " " || e.key === "Enter") { e.preventDefault(); retryGameBtn(); }
      } else if (gameState === "PAUSED") {
        if (e.key === "Escape" || e.key === " ") { e.preventDefault(); resumeGame(); }
      }
    };

    window.addEventListener("keydown", handleKeys);
    return () => window.removeEventListener("keydown", handleKeys);
  }, [gameState, muted]);

  const startGameBtn = () => {
    initGame();
    setGameState("PLAYING");
  };

  const retryGameBtn = () => {
    initGame();
    setGameState("PLAYING");
  };

  const resumeGame = () => {
    setGameState("PLAYING");
    lastTimeRef.current = 0; // reset delta anchor
    soundRef.current?.startBGM();
  };

  // Physics Update & Canvas Render loop
  useEffect(() => {
    if (gameState !== "PLAYING") return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const scaleAdjust = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
    };
    scaleAdjust();
    window.addEventListener("resize", scaleAdjust);

    let spawnTimer = 0;
    let collectibleTimer = 0;

    const updateRenderLoop = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      let dt = (timestamp - lastTimeRef.current) / 1000;
      if (dt > 0.1) dt = 0.1; // lock to avoid clipping/skipping
      lastTimeRef.current = timestamp;

      // 1. TIMERS AND ACCELERATION
      beltRef.current.levelTimer += dt;
      // Conveyor speed ramps up every 15 seconds
      const speedStep = Math.floor(beltRef.current.levelTimer / 15);
      const newSpeed = Math.min(beltRef.current.maxSpeed, 210 + speedStep * 30);
      beltRef.current.speed = newSpeed;
      setBeltSpeedKph(Math.round(newSpeed / 14)); // convert arbitrary pixels/sec to airport-sim kph

      // Update HUD Powerups countdown timer states
      if (playerRef.current.invincibleTimeLeft > 0) {
        playerRef.current.invincibleTimeLeft = Math.max(0, playerRef.current.invincibleTimeLeft - dt);
        setEnergyDrinkTime(parseFloat(playerRef.current.invincibleTimeLeft.toFixed(1)));
      } else {
        setEnergyDrinkTime(0);
      }

      if (playerRef.current.magnetTimeLeft > 0) {
        playerRef.current.magnetTimeLeft = Math.max(0, playerRef.current.magnetTimeLeft - dt);
        setMagneticTime(parseFloat(playerRef.current.magnetTimeLeft.toFixed(1)));
      } else {
        setMagneticTime(0);
      }

      // Track distance survived
      statsRef.current.distance += (beltRef.current.speed * dt) * 0.05;
      setDistance(Math.floor(statsRef.current.distance));

      // Player physical positions LERPs for instant but smooth transitions
      playerRef.current.x += (playerRef.current.targetX - playerRef.current.x) * 18 * dt;

      // Natural backward drag on the belt if of not invuln boosted
      const dangerDistFromTop = playerRef.current.y;
      // Danger scale closer to shredder (shredder starts at y=660, critical zone at y=580)
      const dangerRatio = Math.max(0, Math.min(1.0, (dangerDistFromTop - 250) / 410));
      soundRef.current?.updateShredderRumble(dangerRatio);

      // Player general animation loop and sliding counters
      playerRef.current.animFrame = (playerRef.current.animFrame + 12 * dt) % 4;

      if (playerRef.current.isSliding) {
        playerRef.current.slideTimeLeft -= dt;
        if (playerRef.current.slideTimeLeft <= 0) {
          playerRef.current.isSliding = false;
        }
      }

      if (playerRef.current.isLeaping) {
        playerRef.current.leapTimeLeft -= dt;
        if (playerRef.current.leapTimeLeft <= 0) {
          playerRef.current.isLeaping = false;
        }
      }

      if (playerRef.current.stunTimeLeft > 0) {
        playerRef.current.stunTimeLeft -= dt;
        // Pushes player back by full conveyor displacement
        playerRef.current.y += beltRef.current.speed * dt;
        
        // Spawn spin star particles around their head
        if (Math.random() < 0.35) {
          particlesRef.current.push({
            x: playerRef.current.x + (Math.random() - 0.5) * 15,
            y: playerRef.current.y - 45,
            vx: (Math.random() - 0.5) * 4,
            vy: -2 + Math.random() * -1,
            color: "#ffdd00",
            size: 3 + Math.random() * 2,
            alpha: 1.0,
            decay: 0.04,
            type: "star",
          });
        }
      } else {
        // Slowly push player slightly backward to keep tension, unless they speed boost
        playerRef.current.driftTimer += dt;
        // Gravity style conveyor pull: drifts back very slowly
        playerRef.current.y = Math.min(680, playerRef.current.y + (beltRef.current.speed * 0.14) * dt);
      }

      // Hit shredder (Game Over condition)
      if (playerRef.current.y >= 665) {
        // Trigger massive shredder explosion sparks
        for (let s = 0; s < 40; s++) {
          particlesRef.current.push({
            x: playerRef.current.x + (Math.random() - 0.5) * 40,
            y: 720,
            vx: (Math.random() - 0.5) * 12,
            vy: -8 - Math.random() * 10,
            color: Math.random() > 0.4 ? "#ff3300" : "#ffcc00",
            size: 4 + Math.random() * 8,
            alpha: 1.0,
            decay: 0.02,
            type: "shred",
          });
        }
        triggerGameOver();
        return;
      }

      // 2. SPAWNING ENGINE (Obstacles & Collectibles)
      spawnTimer += dt;
      const obstacleSpawnInterval = Math.max(0.65, 1.85 - speedStep * 0.15);
      if (spawnTimer >= obstacleSpawnInterval) {
        spawnTimer = 0;
        const randLane = Math.floor(Math.random() * 3);
        const randType = Math.random();
        
        let newObs: Obstacle;
        if (randType < 0.35) {
          // Suitcase
          newObs = {
            id: uniqueIdSeq.current++,
            lane: randLane,
            x: getLaneCenterX(randLane),
            y: -80,
            type: "suitcase",
            speed: 0,
            width: 48,
            height: 38,
            animTimer: 0,
          };
        } else if (randType < 0.60) {
          // Box
          newObs = {
            id: uniqueIdSeq.current++,
            lane: randLane,
            x: getLaneCenterX(randLane),
            y: -80,
            type: "box",
            speed: 0,
            width: 44,
            height: 44,
            animTimer: 0,
          };
        } else if (randType < 0.80) {
          // Tall Signs or Scanners
          const isScanner = Math.random() > 0.5;
          newObs = {
            id: uniqueIdSeq.current++,
            lane: randLane,
            x: getLaneCenterX(randLane),
            y: -90,
            type: isScanner ? "scanner" : "sign",
            speed: 0,
            width: 60,
            height: 52,
            animTimer: 0,
          };
        } else if (randType < 0.90) {
          // Fast rolling service food cart
          newObs = {
            id: uniqueIdSeq.current++,
            lane: randLane,
            x: getLaneCenterX(randLane),
            y: -120,
            type: "cart",
            speed: 160, // rolls down extra fast toward player!
            width: 50,
            height: 65,
            animTimer: 0,
          };
        } else {
          // Runaway Golden Retriever crossing lanes!
          newObs = {
            id: uniqueIdSeq.current++,
            lane: randLane,
            x: getLaneCenterX(randLane),
            y: -80,
            type: "dog",
            speed: 80, // runs down on its own
            width: 48,
            height: 34,
            animTimer: 0,
            dogDir: Math.random() > 0.5 ? 1 : -1,
          };
        }
        
        // Prevent stacking duplicate types on same exact coordinate
        const duplicateOnPath = obstaclesRef.current.some(o => o.lane === randLane && o.y < 80);
        if (!duplicateOnPath) {
          obstaclesRef.current.push(newObs);
        }
      }

      collectibleTimer += dt;
      if (collectibleTimer >= 1.45) {
        collectibleTimer = 0;
        const collLane = Math.floor(Math.random() * 3);
        const randType = Math.random();
        
        let cType: "sticker" | "drink" | "boots" = "sticker";
        if (randType > 0.90) {
          cType = "boots";
        } else if (randType > 0.78) {
          cType = "drink";
        }

        collectiblesRef.current.push({
          id: uniqueIdSeq.current++,
          lane: collLane,
          x: getLaneCenterX(collLane),
          y: -50,
          type: cType,
          width: 25,
          height: 25,
          pulseTimer: 0,
        });
      }

      // 3. UPDATING ENTITIES & COLLISIONS
      // Update Obstacles relative to belt speed
      obstaclesRef.current.forEach((obs, idx) => {
        const speedFactor = beltRef.current.speed + obs.speed;
        obs.y += speedFactor * dt;
        obs.animTimer += dt;

        // Custom dog lateral patrol logic
        if (obs.type === "dog" && obs.dogDir) {
          obs.x += obs.dogDir * 40 * dt;
          if (obs.x < 150) { obs.x = 150; obs.dogDir = 1; }
          if (obs.x > 450) { obs.x = 450; obs.dogDir = -1; }
        }

        // Drop out-of-screen obstacles
        if (obs.y > V_H + 80) {
          obstaclesRef.current.splice(idx, 1);
          return;
        }

        // Collision Check (Stun if player hit)
        if (
          playerRef.current.stunTimeLeft <= 0 &&
          playerRef.current.invincibleTimeLeft <= 0 &&
          obs.lane === playerRef.current.lane &&
          Math.abs(obs.y - playerRef.current.y) < 32
        ) {
          // If low obstacle (suitcase/box) and player is jumping/leaping, skip collision
          if ((obs.type === "suitcase" || obs.type === "box") && playerRef.current.isLeaping) {
            return;
          }
          // If high obstacle (sign/scanner) and player is sliding, skip collision
          if ((obs.type === "sign" || obs.type === "scanner") && playerRef.current.isSliding) {
            return;
          }

          // Hit obstacle!
          playerRef.current.stunTimeLeft = 0.75; // Stun duration
          playerRef.current.invincibleTimeLeft = 1.6; // temporary safety buffer
          statsRef.current.consecutiveStickers = 0; // reset rating multiplier
          statsRef.current.multiplier = 1;

          soundRef.current?.playHit();
          screenShake(10);

          // Explode impact particles
          for (let p = 0; p < 12; p++) {
            particlesRef.current.push({
              x: playerRef.current.x,
              y: playerRef.current.y - 10,
              vx: (Math.random() - 0.5) * 8,
              vy: (Math.random() - 0.5) * 8,
              color: "#ff3333",
              size: 3 + Math.random() * 4,
              alpha: 1.0,
              decay: 0.05,
              type: "shred",
            });
          }
        }
      });

      // Update Collectibles
      collectiblesRef.current.forEach((coll, idx) => {
        coll.y += beltRef.current.speed * dt;
        coll.pulseTimer += dt;

        // Magnetized draw towards player
        if (playerRef.current.magnetTimeLeft > 0) {
          const dx = playerRef.current.x - coll.x;
          const dy = playerRef.current.y - coll.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 185) {
            coll.x += (dx / dist) * 240 * dt;
            coll.y += (dy / dist) * 240 * dt;
            
            // adapt local lane index corresponding to x
            if (coll.x < 240) coll.lane = 0;
            else if (coll.x < 360) coll.lane = 1;
            else coll.lane = 2;
          }
        }

        if (coll.y > V_H + 50) {
          collectiblesRef.current.splice(idx, 1);
          return;
        }

        // Collision Check
        const distToPlayerX = Math.abs(coll.x - playerRef.current.x);
        const distToPlayerY = Math.abs(coll.y - playerRef.current.y);
        
        if (distToPlayerX < 32 && distToPlayerY < 32) {
          collectiblesRef.current.splice(idx, 1);
          
          if (coll.type === "sticker") {
            // Fragile sticker collection
            statsRef.current.consecutiveStickers += 1;
            const prevMult = statsRef.current.multiplier;
            if (statsRef.current.consecutiveStickers % 4 === 0) {
              statsRef.current.multiplier += 1;
            }
            const ptsGained = 10 * statsRef.current.multiplier;
            statsRef.current.score += ptsGained;
            setScore(statsRef.current.score);
            soundRef.current?.playCollect();

            // Spawn floating text popups
            floatingTextsRef.current.push({
              text: `+${ptsGained}`,
              x: coll.x,
              y: coll.y - 15,
              color: statsRef.current.multiplier > 1 ? "#ffd700" : "#ff0099",
              alpha: 1.0,
              scale: 1.0,
              speedY: -65,
            });

            if (statsRef.current.multiplier > prevMult) {
              floatingTextsRef.current.push({
                text: `MULTIPLIER x${statsRef.current.multiplier}!`,
                x: playerRef.current.x,
                y: playerRef.current.y - 65,
                color: "#ffd700",
                alpha: 1.0,
                scale: 1.25,
                speedY: -75,
              });
            }

            // Spawn lovely sparkling explosion particles
            for (let i = 0; i < 14; i++) {
              particlesRef.current.push({
                x: coll.x,
                y: coll.y,
                vx: (Math.random() - 0.5) * 6,
                vy: (Math.random() - 0.5) * 6,
                color: Math.random() > 0.5 ? "#ff0099" : "#00ffff",
                size: 3 + Math.random() * 3,
                alpha: 1.0,
                decay: 0.035,
                type: "sparkle",
              });
            }
          } else if (coll.type === "drink") {
            // Energy Drink Speed Boost & Invuln
            playerRef.current.invincibleTimeLeft = 4.2; // 4 seconds invulnerability
            // Boost player position up screen instantly
            playerRef.current.y = Math.max(180, playerRef.current.y - 150);
            soundRef.current?.playPowerup();

            floatingTextsRef.current.push({
              text: "SPEED BOOST!",
              x: playerRef.current.x,
              y: playerRef.current.y - 45,
              color: "#00ccff",
              alpha: 1.0,
              scale: 1.3,
              speedY: -70,
            });

            // Blue velocity lines
            for (let i = 0; i < 20; i++) {
              particlesRef.current.push({
                x: playerRef.current.x + (Math.random() - 0.5) * 30,
                y: playerRef.current.y + 40,
                vx: 0,
                vy: 5 + Math.random() * 4,
                color: "#00ccff",
                size: 2 + Math.random() * 3,
                alpha: 1.0,
                decay: 0.03,
                type: "speed",
              });
            }
          } else if (coll.type === "boots") {
            // Sticky boots magnetism
            playerRef.current.magnetTimeLeft = 6.0; // 6 seconds magnet
            soundRef.current?.playPowerup();

            floatingTextsRef.current.push({
              text: "🧲 MAGNET ACTIVE!",
              x: playerRef.current.x,
              y: playerRef.current.y - 45,
              color: "#ffd700",
              alpha: 1.0,
              scale: 1.3,
              speedY: -70,
            });

            // Golden sparks
            for (let i = 0; i < 15; i++) {
              particlesRef.current.push({
                x: playerRef.current.x + (Math.random() - 0.5) * 20,
                y: playerRef.current.y + 20,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                color: "#ffd700",
                size: 2 + Math.random() * 2,
                alpha: 1.0,
                decay: 0.04,
                type: "star",
              });
            }
          }
        }
      });

      // Update Floating Texts
      floatingTextsRef.current.forEach((ft, idx) => {
        ft.y += ft.speedY * dt;
        ft.alpha -= 1.3 * dt;
        if (ft.alpha <= 0.01) {
          floatingTextsRef.current.splice(idx, 1);
        }
      });

      // Update Particles
      particlesRef.current.forEach((p, idx) => {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;
        if (p.alpha <= 0.02) {
          particlesRef.current.splice(idx, 1);
        }
      });

      // 4. RENDERING CANVAS SCENE
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Retina/sharp scaling factor
      const rRatio = canvas.width / V_W;
      ctx.scale(rRatio, rRatio);

      // Render airport terminal passenger background parallax margins
      ctx.fillStyle = "#121319";
      ctx.fillRect(0, 0, V_W, V_H);

      // Parallax ceiling pillars & moving airport elements
      ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
      ctx.lineWidth = 1;
      for (let gridX = 0; gridX < V_W; gridX += 50) {
        ctx.beginPath();
        ctx.moveTo(gridX, 0);
        ctx.lineTo(gridX, V_H);
        ctx.stroke();
      }

      // Draw Parallax windows on terminal sides
      ctx.fillStyle = "#1e222b";
      ctx.fillRect(0, 0, 95, V_H); // left terminal lobby
      ctx.fillRect(505, 0, 95, V_H); // right terminal lobby

      // Window panes & silhouetted objects
      ctx.strokeStyle = "#272c38";
      ctx.strokeRect(10, 80, 75, 120);
      ctx.strokeRect(515, 80, 75, 120);
      
      // Little silhouetted airplane taxiing in windows
      const airplaneX = (timestamp * 0.02) % 300 - 150;
      ctx.fillStyle = "#0c0d11";
      ctx.beginPath();
      ctx.arc(45 + airplaneX, 130, 8, 0, Math.PI * 2);
      ctx.fill();

      // terminal flooring hazard lines flanking belt
      ctx.fillStyle = "#222530";
      ctx.fillRect(95, 0, 5, V_H);
      ctx.fillRect(500, 0, 5, V_H);

      // CONVEYOR BELT BED
      ctx.fillStyle = "#1b1d24";
      ctx.fillRect(100, 0, 400, V_H);

      // Drawing lanes separators / yellow warning chevron lines
      const laneLineOffset = (timestamp * 0.28) % 40;
      ctx.strokeStyle = "#323745";
      ctx.lineWidth = 3;
      ctx.setLineDash([15, 15]);
      
      // Draw Lane 0-1 partition
      ctx.beginPath();
      ctx.moveTo(240, -40 + laneLineOffset);
      ctx.lineTo(240, V_H + 40);
      ctx.stroke();

      // Draw Lane 1-2 partition
      ctx.beginPath();
      ctx.moveTo(360, -40 + laneLineOffset);
      ctx.lineTo(360, V_H + 40);
      ctx.stroke();

      ctx.setLineDash([]); // Reset line dash

      // Scrolling hazard chevrons inside conveyor sides
      ctx.fillStyle = "#2c2e36";
      for (let cy = -40 + (timestamp * 0.3) % 40; cy < V_H; cy += 40) {
        ctx.fillRect(105, cy, 10, 10);
        ctx.fillRect(485, cy, 10, 10);
      }

      // Render Collectibles
      collectiblesRef.current.forEach((coll) => {
        ctx.save();
        ctx.translate(coll.x, coll.y);
        const floatAnim = Math.sin(coll.pulseTimer * 8) * 4;

        if (coll.type === "sticker") {
          // Glossy Hexagonal "FRAGILE" sticker
          ctx.rotate(coll.pulseTimer * 2.5);
          ctx.fillStyle = "#ff0077";
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2;
          ctx.shadowColor = "#ff0077";
          ctx.shadowBlur = 12;

          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            const px = Math.cos(angle) * 12;
            const py = Math.sin(angle) * 12;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Text label
          ctx.rotate(-coll.pulseTimer * 2.5);
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 7px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("FRAG", 0, 0);
        } else if (coll.type === "drink") {
          // Kinetic Energy Drink Blue Can
          ctx.translate(0, floatAnim);
          ctx.fillStyle = "#00bbff";
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.5;
          ctx.shadowColor = "#00d8ff";
          ctx.shadowBlur = 10;
          ctx.fillRect(-8, -12, 16, 24);
          ctx.strokeRect(-8, -12, 16, 24);
          
          // Silver tab top
          ctx.fillStyle = "#cccccc";
          ctx.fillRect(-6, -14, 12, 2);

          // Orange lightning tag
          ctx.fillStyle = "#ffaa00";
          ctx.beginPath();
          ctx.moveTo(-1, -6);
          ctx.lineTo(3, -1);
          ctx.lineTo(0, 0);
          ctx.lineTo(2, 6);
          ctx.lineTo(-3, 1);
          ctx.lineTo(-1, 0);
          ctx.closePath();
          ctx.fill();
        } else if (coll.type === "boots") {
          // Yellow electromagnetic sticky boots
          ctx.translate(0, floatAnim);
          ctx.fillStyle = "#f2a900";
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.5;
          ctx.shadowColor = "#f2a900";
          ctx.shadowBlur = 10;
          
          // Draw Left and Right boot
          ctx.fillRect(-10, -5, 8, 12);
          ctx.fillRect(-10, 3, 12, 4);

          ctx.fillRect(2, -5, 8, 12);
          ctx.fillRect(2, 3, 12, 4);
        }
        ctx.restore();
      });

      // Render Obstacles
      obstaclesRef.current.forEach((obs) => {
        ctx.save();
        ctx.translate(obs.x, obs.y);

        if (obs.type === "suitcase") {
          // Suitcase carrying tags
          ctx.fillStyle = "#9c3a3c";
          ctx.strokeStyle = "#1e222b";
          ctx.lineWidth = 2.5;
          ctx.fillRect(-obs.width/2, -obs.height/2, obs.width, obs.height);
          ctx.strokeRect(-obs.width/2, -obs.height/2, obs.width, obs.height);

          // Leather corners
          ctx.fillStyle = "#2d1617";
          ctx.fillRect(-obs.width/2, -obs.height/2, 10, 10);
          ctx.fillRect(obs.width/2 - 10, -obs.height/2, 10, 10);
          
          // Plastic Handle
          ctx.strokeStyle = "#2c2e36";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(-12, -obs.height/2);
          ctx.lineTo(-12, -obs.height/2 - 6);
          ctx.lineTo(12, -obs.height/2 - 6);
          ctx.lineTo(12, -obs.height/2);
          ctx.stroke();

          // White dangling floppy shipping barcode tag
          ctx.fillStyle = "#ffffff";
          ctx.rotate(Math.sin(obs.animTimer * 5) * 0.2);
          ctx.fillRect(8, obs.height/2 - 2, 8, 14);
          ctx.fillStyle = "#000000";
          ctx.fillRect(10, obs.height/2 + 2, 4, 1);
          ctx.fillRect(10, obs.height/2 + 5, 4, 1);

        } else if (obs.type === "box") {
          // Shipping Box Cardboard
          ctx.fillStyle = "#c2915c";
          ctx.strokeStyle = "#2d1607";
          ctx.lineWidth = 2;
          ctx.fillRect(-obs.width/2, -obs.height/2, obs.width, obs.height);
          ctx.strokeRect(-obs.width/2, -obs.height/2, obs.width, obs.height);

          // Wrapping dark packing tape
          ctx.fillStyle = "#8a5824";
          ctx.fillRect(-obs.width/2, -5, obs.width, 10);
          ctx.fillRect(-5, -obs.height/2, 10, obs.height);

          // Barcode labels
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(-12, -15, 10, 6);
          ctx.fillStyle = "#000000";
          ctx.fillRect(-10, -13, 2, 2);
          ctx.fillRect(-6, -13, 2, 2);

        } else if (obs.type === "scanner") {
          // Airport Scanner Arch Hazard with scanning laser beam
          ctx.fillStyle = "#3e424c";
          ctx.strokeStyle = "#1b1d24";
          ctx.lineWidth = 3;
          // Left pillar
          ctx.fillRect(-obs.width/2, -obs.height/2, 8, obs.height);
          // Right pillar
          ctx.fillRect(obs.width/2 - 8, -obs.height/2, 8, obs.height);
          // Top lintel
          ctx.fillRect(-obs.width/2, -obs.height/2, obs.width, 10);

          // Warning blinking stroboscope on top
          const flashOn = Math.floor(timestamp / 120) % 2 === 0;
          ctx.fillStyle = flashOn ? "#ff3300" : "#a30000";
          ctx.fillRect(-6, -obs.height/2 - 6, 12, 6);

          // Animated purple scanning laser line slicing up & down
          const beamY = Math.sin(obs.animTimer * 10) * (obs.height * 0.4) + 5;
          ctx.strokeStyle = "rgba(186, 0, 255, 0.85)";
          ctx.lineWidth = 2.5;
          ctx.shadowColor = "#ba00ff";
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.moveTo(-obs.width/2 + 8, beamY);
          ctx.lineTo(obs.width/2 - 8, beamY);
          ctx.stroke();
          ctx.shadowBlur = 0;

        } else if (obs.type === "sign") {
          // Overhead Chains signs "DELAYED / LUGGAGE JAM"
          ctx.strokeStyle = "#727885";
          ctx.lineWidth = 1.5;
          // Supporting steel chains
          ctx.beginPath();
          ctx.moveTo(-15, -45); ctx.lineTo(-15, -obs.height/2);
          ctx.moveTo(15, -45); ctx.lineTo(15, -obs.height/2);
          ctx.stroke();

          // Sign plaque
          ctx.fillStyle = "#ffcc00"; // high caution yellow
          ctx.strokeStyle = "#000000";
          ctx.lineWidth = 2;
          ctx.fillRect(-obs.width/2 + 4, -obs.height/2, obs.width - 8, obs.height - 20);
          ctx.strokeRect(-obs.width/2 + 4, -obs.height/2, obs.width - 8, obs.height - 20);

          ctx.fillStyle = "#000000";
          ctx.font = "900 8px monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("LOW ENDS", 0, -18);
          ctx.font = "bold 6px monospace";
          ctx.fillText("KEEP CROUCH", 0, -11);

        } else if (obs.type === "cart") {
          // Speedy Runway Beverage Trolley
          ctx.fillStyle = "#a8adb5";
          ctx.strokeStyle = "#2a2b30";
          ctx.lineWidth = 2.5;
          ctx.fillRect(-obs.width/2, -obs.height/2, obs.width, obs.height);
          ctx.strokeRect(-obs.width/2, -obs.height/2, obs.width, obs.height);
          
          // Front glass window
          ctx.fillStyle = "#1e222b";
          ctx.fillRect(-obs.width/2 + 6, -obs.height/2 + 6, obs.width - 12, 16);
          
          // Coca cans inside window
          ctx.fillStyle = "#ff3333";
          ctx.fillRect(-10, -obs.height/2 + 10, 4, 8);
          ctx.fillStyle = "#33cc33";
          ctx.fillRect(6, -obs.height/2 + 10, 4, 8);

          // Rolling cart wheels
          ctx.fillStyle = "#333";
          ctx.beginPath();
          ctx.arc(-obs.width/2 + 6, obs.height/2, 6, 0, Math.PI*2);
          ctx.arc(obs.width/2 - 6, obs.height/2, 6, 0, Math.PI*2);
          ctx.fill();

          // Flashing orange beacon strobe
          const cartBlink = Math.floor(timestamp / 90) % 2 === 0;
          ctx.fillStyle = cartBlink ? "#ffaa00" : "#7f5500";
          ctx.fillRect(-8, -obs.height/2 - 5, 16, 5);

        } else if (obs.type === "dog") {
          // Galloping Golden Retriever
          ctx.save();
          const gallopCycle = Math.sin(obs.animTimer * 12);
          // tilt dog slightly while galloping
          ctx.rotate(gallopCycle * 0.1);
          
          ctx.fillStyle = "#e0aa43"; // beautiful golden retriever coat
          ctx.strokeStyle = "#4d2c00";
          ctx.lineWidth = 1;

          // Torso
          ctx.fillRect(-18, -10, 32, 18);
          
          // Legs running (projections)
          ctx.fillStyle = "#cc9631";
          ctx.fillRect(-14, 8, 4, 6 + gallopCycle * 3);
          ctx.fillRect(-4, 8, 4, 6 - gallopCycle * 3);
          ctx.fillRect(8, 8, 4, 4 + gallopCycle * 3);

          // Head with muzzle & floppy ears
          ctx.fillStyle = "#e0aa43";
          ctx.fillRect(10, -18, 12, 12);
          ctx.fillStyle = "#a1721f"; // ears
          ctx.fillRect(8, -16, 4, 10);
          ctx.fillStyle = "#2c1e05"; // wet nose
          ctx.fillRect(20, -14, 3, 3);

          // Wagging tail
          ctx.fillStyle = "#e0aa43";
          ctx.save();
          ctx.translate(-18, -4);
          ctx.rotate(Math.sin(obs.animTimer * 20) * 0.4);
          ctx.fillRect(-10, -2, 10, 4);
          ctx.restore();

          // occasional "WOOF!" callout label
          if (Math.floor(timestamp / 700) % 3 === 0) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(12, -35, 30, 11);
            ctx.strokeStyle = "#000000";
            ctx.strokeRect(12, -35, 30, 11);
            // bubble tag pointer
            ctx.beginPath();
            ctx.moveTo(14, -24); ctx.lineTo(10, -21); ctx.lineTo(18, -24);
            ctx.fill();

            ctx.fillStyle = "#ff0055";
            ctx.font = "900 6.5px monospace";
            ctx.textAlign = "center";
            ctx.fillText("WOOF!!", 27, -27);
          }
          ctx.restore();
        }
        ctx.restore();
      });

      // Render Particles
      particlesRef.current.forEach((p) => {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        
        if (p.type === "shred") {
          // Sharp firey shred particles
          ctx.beginPath();
          ctx.moveTo(p.x - p.size, p.y);
          ctx.lineTo(p.x, p.y - p.size * 1.5);
          ctx.lineTo(p.x + p.size, p.y);
          ctx.lineTo(p.x, p.y + p.size * 0.7);
          ctx.closePath();
          ctx.fill();
        } else if (p.type === "star") {
          // Swirling yellow stars
          ctx.translate(p.x, p.y);
          ctx.rotate(timestamp * 0.01);
          ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
        } else {
          // Speed / Sparkle dots
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });
      ctx.globalAlpha = 1.0; // Reset alpha

      // Render Floating Texts Popups
      floatingTextsRef.current.forEach((ft) => {
        ctx.save();
        ctx.globalAlpha = ft.alpha;
        ctx.fillStyle = ft.color;
        ctx.shadowColor = "#000000";
        ctx.shadowBlur = 4;
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 3.5;
        ctx.font = "900 13px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.strokeText(ft.text, ft.x, ft.y);
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
      });

      // Near-Miss Golden Screen Flash Decay Overlay
      if (nearMissFlashActiveRef.current > 0) {
        nearMissFlashActiveRef.current = Math.max(0, nearMissFlashActiveRef.current - dt);
        ctx.save();
        ctx.fillStyle = `rgba(255, 215, 0, ${0.28 * (nearMissFlashActiveRef.current / 0.16)})`;
        ctx.fillRect(0, 0, V_W, V_H);
        ctx.restore();
      }

      // Render Player Baggage Handler
      ctx.save();
      
      const playerJumpOffset = playerRef.current.isLeaping 
        ? Math.sin((playerRef.current.leapTimeLeft / 0.45) * Math.PI) * 55 
        : 0;

      ctx.translate(playerRef.current.x, playerRef.current.y - playerJumpOffset);

      // Invulnerable flickering rate
      const showPlayer = playerRef.current.invincibleTimeLeft > 0 
        ? Math.floor(timestamp / 70) % 2 === 0 
        : true;

      // Draw shiny circular shield when invulnerable
      if (playerRef.current.invincibleTimeLeft > 0) {
        ctx.strokeStyle = "rgba(0, 216, 255, 0.45)";
        ctx.lineWidth = 3;
        ctx.shadowColor = "#00d8ff";
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, -15, 33, 0, Math.PI*2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      if (showPlayer) {
        const currentSkinId = selectedSkinRef.current || "default";
        const currentSkinDef = SKINS.find(s => s.id === currentSkinId) || SKINS[0];

        const helmetColor = currentSkinDef.helmet;
        const vestColor = currentSkinDef.vest;
        const pantsColor = currentSkinDef.pants;
        const stripeColor = currentSkinDef.stripe;

        // Handle physical profile slide states
        if (playerRef.current.isSliding) {
          // Slide pose (crouched left/right horizontal sliding)
          ctx.rotate(0.2);
          ctx.fillStyle = pantsColor; // Outfit pants color
          ctx.fillRect(-15, -12, 34, 14);

          // High visibility vest
          ctx.fillStyle = vestColor;
          ctx.fillRect(-10, -22, 22, 12);
          // Reflective warning stripes
          ctx.fillStyle = stripeColor;
          ctx.fillRect(-10, -18, 22, 3);

          // Peach head angled
          ctx.fillStyle = "#ffd5b4";
          ctx.beginPath();
          ctx.arc(15, -18, 7, 0, Math.PI*2);
          ctx.fill();

          // Security hard hat helmet
          ctx.fillStyle = helmetColor;
          ctx.fillRect(8, -26, 15, 6);
          ctx.fillRect(5, -21, 19, 2);

        } else if (playerRef.current.stunTimeLeft > 0) {
          // Dizzy flopped pose
          ctx.fillStyle = "#ff3333"; // flashing red warning tint
          ctx.rotate(Math.sin(timestamp * 0.08) * 0.35);

          // Legs vertical
          ctx.fillStyle = pantsColor;
          ctx.fillRect(-12, -2, 6, 12);
          ctx.fillRect(6, -2, 6, 12);

          // Outfit Vest
          ctx.fillStyle = vestColor;
          ctx.fillRect(-12, -32, 24, 30);

          // Peach face looking distressed
          ctx.fillStyle = "#ffd5b4";
          ctx.beginPath();
          ctx.arc(0, -42, 8, 0, Math.PI*2);
          ctx.fill();
          // dizzy X eyes mark
          ctx.strokeStyle = "#000";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(-4, -44); ctx.lineTo(-1, -41);
          ctx.moveTo(-1, -44); ctx.lineTo(-4, -41);
          ctx.moveTo(1, -44); ctx.lineTo(4, -41);
          ctx.moveTo(4, -44); ctx.lineTo(1, -41);
          ctx.stroke();

          // Flopped Helmet
          ctx.fillStyle = helmetColor;
          ctx.fillRect(-10, -52, 20, 6);

        } else {
          // Running Animated Pose
          const runCycle = Math.sin(playerRef.current.animFrame);
          
          // Legs cycling back and forth
          ctx.fillStyle = pantsColor; // Selected Pants color
          // leg 1
          ctx.fillRect(-11, -2, 7, 18 + runCycle * 6);
          // leg 2
          ctx.fillRect(4, -2, 7, 18 - runCycle * 6);

          // Main Torso with reflective tape details
          ctx.fillStyle = "#1e222b";
          ctx.fillRect(-13, -35, 26, 33);
          
          // Outfit vest
          ctx.fillStyle = vestColor;
          ctx.fillRect(-13, -35, 26, 21);
          
          // Glowing hazard stripes
          ctx.fillStyle = stripeColor;
          ctx.fillRect(-13, -28, 26, 3);
          ctx.fillRect(-13, -20, 26, 3);
          ctx.fillRect(-8, -35, 3, 21);
          ctx.fillRect(5, -35, 3, 21);

          // Left/Right swinging arms
          ctx.fillStyle = "#ffd5b4";
          ctx.fillRect(-17, -29, 4, 16 - runCycle * 6);
          ctx.fillRect(13, -29, 4, 16 + runCycle * 6);

          // Head face looking backwards (facing up screen)
          ctx.fillStyle = "#ffd5b4";
          ctx.beginPath();
          ctx.arc(0, -45, 9, 0, Math.PI*2);
          ctx.fill();

          // Cute tiny safety sunglasses and headset
          ctx.fillStyle = "#111";
          ctx.fillRect(-6, -49, 12, 4);

          // Safety Helmet with visor
          ctx.fillStyle = helmetColor;
          ctx.beginPath();
          ctx.arc(0, -51, 9, Math.PI, 2*Math.PI);
          ctx.fill();
          ctx.fillRect(-11, -52, 22, 2); // brim

          // Sticky boots glow trail under feet
          if (playerRef.current.magnetTimeLeft > 0) {
            ctx.fillStyle = "rgba(242, 169, 0, 0.4)";
            ctx.fillRect(-12, 15, 24, 4);
          }
        }
      }
      ctx.restore();

      // THE GIANT SHREDDER MANGLE-O-MATIC INTERFACE
      // Render scary shredder body at absolute bottom (y = 680 to 800)
      ctx.save();
      ctx.translate(0, 680);

      // Warning hazard casing plate
      ctx.fillStyle = "#17181c";
      ctx.fillRect(80, 0, 440, 120);

      // Hazard Black yellow slanted stripes board
      ctx.lineWidth = 14;
      ctx.strokeStyle = "#f3b300";
      for (let sx = 90; sx < 510; sx += 32) {
        ctx.beginPath();
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx + 15, 120);
        ctx.stroke();
      }

      // Darkness inside the grinding throat mouth in the center
      ctx.fillStyle = "#090a0c";
      ctx.fillRect(110, 10, 380, 95);

      // Steel grinding gears / rotary teeth drawn inside the throat cavity
      const teethSpin = timestamp * 0.055;
      ctx.strokeStyle = "#3e424e";
      ctx.lineWidth = 3.5;
      
      // Left and Right gear rollers
      for (let gx = 130; gx < 470; gx += 46) {
        ctx.save();
        ctx.translate(gx, 55);
        ctx.rotate(teethSpin);
        // Draw steel circular core gears
        ctx.fillStyle = "#272a33";
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI*2);
        ctx.fill();
        ctx.stroke();
        
        ctx.fillStyle = "#c1272d";
        // gear teeth pegs
        for (let t = 0; t < 6; t++) {
          ctx.rotate(Math.PI / 3);
          ctx.fillRect(10, -4, 12, 8);
        }
        ctx.restore();
      }

      // Blinking warning panel overlays
      const alarmFlash = Math.floor(timestamp / 300) % 2 === 0;
      ctx.fillStyle = alarmFlash ? "rgba(255, 33, 0, 0.18)" : "rgba(255, 33, 0, 0.03)";
      ctx.fillRect(110, 10, 380, 95);

      ctx.fillStyle = alarmFlash ? "#ff2a00" : "#a30000";
      ctx.font = "900 12.5px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText("CRITICAL // EMERGENCY SHREDDER ACTIVE", 300, 58);

      // Metallic front enclosure frame
      ctx.fillStyle = "#23252d";
      ctx.fillRect(80, 0, 30, 120);
      ctx.fillRect(490, 0, 30, 120);

      // Warning alert beacons on left/right pillars
      const lightOn = Math.floor(timestamp / 150) % 2 === 0;
      ctx.fillStyle = lightOn ? "#ff3300" : "#550000";
      ctx.beginPath();
      ctx.arc(95, 30, 8, 0, Math.PI*2);
      ctx.arc(505, 30, 8, 0, Math.PI*2);
      ctx.fill();
      if (lightOn) {
        ctx.shadowColor = "#ff3300";
        ctx.shadowBlur = 10;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(95, 30, 8, 0, Math.PI*2);
        ctx.arc(505, 30, 8, 0, Math.PI*2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      ctx.restore();

      // Ambient tiny sparks flying out from shredder mouth constant spray
      if (Math.random() < 0.45) {
        particlesRef.current.push({
          x: 130 + Math.random() * 340,
          y: 690,
          vx: (Math.random() - 0.5) * 6,
          vy: -3 - Math.random() * 5,
          color: Math.random() > 0.45 ? "#ffaa00" : "#ff3300",
          size: 2 + Math.random() * 3,
          alpha: 1.0,
          decay: 0.035,
          type: "sparkle",
        });
      }

      ctx.restore(); // final global state

      // Recursive loop ticket trigger
      animationFrameId.current = requestAnimationFrame(updateRenderLoop);
    };

    animationFrameId.current = requestAnimationFrame(updateRenderLoop);

    return () => {
      window.removeEventListener("resize", scaleAdjust);
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [gameState, muted]);

  // Screen layout shaking trigger
  const screenShake = (amount: number) => {
    // Canvas ref container shake handled in inline inline css
    const wrapper = document.getElementById("canvas-wrap");
    if (wrapper) {
      wrapper.style.transform = `translate(${(Math.random() - 0.5) * amount}px, ${(Math.random() - 0.5) * amount}px)`;
      setTimeout(() => {
        wrapper.style.transform = "";
      }, 150);
    }
  };

  const toggleSound = () => {
    setMuted(!muted);
  };

  // Standalone Single-file deployment exporter helper
  const handleExportGame = () => {
    // Beautiful complete HTML code embedding styles and modular systems
    const htmlCode = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Overbooked: Baggage Claim // Standing Runner for CrazyGames</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;700;900&family=JetBrains+Mono:wght@400;700&display=swap');
    
    * { box-sizing: border-box; margin:0; padding:0; user-select:none; }
    body {
      background-color: #0b0c10;
      color: #fafbfc;
      font-family: 'Space Grotesk', sans-serif;
      overflow: hidden;
      width: 100vw;
      height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    
    .screen-container {
      position: relative;
      width: 100%;
      height: 100%;
      max-width: 600px;
      max-height: 800px;
      aspect-ratio: 3 / 4;
      box-shadow: 0 0 45px rgba(0,0,0,0.85);
      border: 3px solid #f2a900;
      overflow: hidden;
      background-color: #121319;
    }

    canvas {
      display: block;
      width: 100%;
      height: 100%;
      background-color: #121319;
    }

    /* Absolute Alert HUD panels */
    .hud-layer {
      position: absolute;
      top: 15px;
      left: 15px;
      right: 15px;
      display: flex;
      justify-content: space-between;
      pointer-events: none;
      font-family: 'JetBrains Mono', monospace;
      z-index: 20;
    }

    .hud-widget {
      background-color: rgba(18, 19, 25, 0.88);
      border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 11px;
      text-transform: uppercase;
      line-height: 1.4;
    }

    .shredder-meter-bar {
      position: absolute;
      left: 15px;
      bottom: 135px;
      width: 12px;
      height: 220px;
      background-color: rgba(0,0,0,0.6);
      border: 1px solid #333;
      border-radius: 6px;
      overflow: hidden;
      display: flex;
      flex-direction: column-reverse;
    }

    .shredder-meter-fill {
      width: 100%;
      background: linear-gradient(0deg, #ff0033, #ffaa00, #39ff14);
      transition: height 0.1s;
    }

    /* Screen UI overlays mapping */
    .overpanel {
      position: absolute;
      inset:0;
      background-color: rgba(9, 10, 15, 0.96);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 30px;
      text-align: center;
      z-index: 30;
      transition: opacity 0.25s ease-in-out;
    }

    .overpanel.hidden { display: none !important; }

    .logo-badge {
      display: inline-block;
      padding: 5px 12px;
      border-radius: 30px;
      font-size: 11px;
      font-weight: bold;
      letter-spacing: 2.5px;
      background-color: rgba(242, 169, 0, 0.12);
      border: 1px solid #f2a900;
      color: #f2a900;
      text-transform: uppercase;
      margin-bottom: 20px;
    }

    .logo-heading {
      font-size: 38px;
      font-weight: 950;
      letter-spacing: 1.5px;
      color: #f2a900;
      text-transform: uppercase;
      line-height: 1;
      margin-bottom: 5px;
      text-shadow: 0 0 15px rgba(242,169,0,0.35);
    }

    .logo-sub {
      font-size: 12px;
      letter-spacing: 4px;
      text-transform: uppercase;
      color: #fafbfc;
      margin-bottom: 25px;
    }

    .logo-description {
      font-size: 13px;
      color: #8f929d;
      line-height: 1.55;
      margin-bottom: 30px;
      max-width: 380px;
    }

    .stat-metric-card {
      background-color: #1a1b24;
      border: 1px solid #2d2f3b;
      border-radius: 12px;
      padding: 15px;
      width: 100%;
      max-width: 340px;
      margin-bottom: 25px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }

    .sec-metric {
      border-right: 1px solid #2d2f3b;
    }
    .sec-metric:last-child { border-right: none; }

    .stat-label {
      font-size: 10px;
      color: #6a6e7c;
      text-transform: uppercase;
      font-family: 'JetBrains Mono', monospace;
    }

    .stat-value {
      font-size: 25px;
      font-weight: bold;
      color: #f2a900;
    }

    .launch-btn {
      background: linear-gradient(135deg, #f2a900, #b27c00);
      color: #0b0c10;
      border: none;
      padding: 15px 35px;
      border-radius: 12px;
      font-weight: 900;
      font-size: 15px;
      letter-spacing: 2px;
      text-transform: uppercase;
      cursor: pointer;
      box-shadow: 0 0 20px rgba(242,169,0,0.35);
      transition: transform 0.15s, box-shadow 0.15s;
    }

    .launch-btn:hover {
      transform: scale(1.04);
      box-shadow: 0 0 25px rgba(242,169,0,0.55);
    }

    .launch-btn.red {
      background: linear-gradient(135deg, #ff0033, #c10022);
      color: #fff;
      box-shadow: 0 0 20px rgba(255,0,51,0.35);
    }
    .launch-btn.red:hover {
      box-shadow: 0 0 25px rgba(255,0,51,0.55);
    }

    .mobile-controls-stage {
      position: absolute;
      bottom: 20px;
      left: 15px;
      right: 15px;
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 12px;
      z-index: 20;
    }

    .m-bt {
      background-color: rgba(18,19,25,0.85);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 10px;
      padding: 14px;
      color: #fff;
      font-weight: bold;
      text-transform: uppercase;
      font-family: inherit;
      cursor: pointer;
      font-size: 11px;
    }

    .m-bt:active {
      background-color: #f2a900;
      color: #0a0b0e;
    }

    /* Sound mute handle corner */
    .s-toggle-crn {
      position: absolute;
      top: 15px;
      right: 15px;
      background-color: rgba(18,19,25,0.85);
      border:1px solid #333;
      color:#fafbfc;
      padding: 8px;
      border-radius: 5px;
      cursor: pointer;
      z-index: 25;
    }

    .instructions-tips {
      margin-top: 15px;
      font-size: 11px;
      color: #8f929d;
      font-family: 'JetBrains Mono', monospace;
      line-height: 1.5;
    }
  </style>
</head>
<body>

  <div class="screen-container" id="game-frame">

    <div class="hud-layer">
      <div class="hud-widget">
        <div>Stickers Gained</div>
        <div id="hud-stickers" style="font-size:15px; font-weight:bold; color:#ffdd00">0</div>
      </div>
      <div class="hud-widget" style="text-align:right">
        <div>Distance Survived</div>
        <div id="hud-dist" style="font-size:15px; font-weight:bold; color:#39ff14">0m</div>
      </div>
    </div>

    <!-- Alarm Shredder proximity meter -->
    <div class="shredder-meter-bar">
      <div class="shredder-meter-fill" id="meter-fill" style="height: 0%"></div>
    </div>

    <!-- Mobile Screen buttons layout -->
    <div class="mobile-controls-stage">
      <button class="m-bt" id="m-left">Left</button>
      <div style="display:flex; flex-direction:column; gap:8px">
        <button class="m-bt" id="m-dash">Dash [W]</button>
        <button class="m-bt" id="m-slide">Slide [S]</button>
      </div>
      <button class="m-bt" id="m-right">Right</button>
    </div>

    <button class="s-toggle-crn" id="s-crn-btn">🔈 Mute</button>

    <!-- MENU START OVERLAY -->
    <div class="overpanel" id="menu-overlay">
      <span class="logo-badge">Airport Ops Simulation</span>
      <h1 class="logo-heading">OVERBOOKED</h1>
      <div class="logo-sub">Baggage Claim</div>
      <p class="logo-description">
        You are a frantic airport baggage handler running backward on a chaotic conveyor belt. Run forward and dodge rogue suitcases, cargo scanners, and loose golden retrievers to avoid the giant shredder below!
      </p>

      <button class="launch-btn" id="start-bt">Start Duty [SPACE]</button>
      
      <div class="instructions-tips">
        Controls: Left/Right Arrow or A/D to shift lanes.<br>
        Up Arrow or W to Speed Boost (Dash over luggage).<br>
        Down Arrow or S to slide under scanners and signs.
      </div>
    </div>

    <!-- GAME OVER OVERLAY -->
    <div class="overpanel hidden" id="gameover-overlay">
      <span class="logo-badge" style="border-color:#ff0033; color:#ff0033; background-color:rgba(255,0,51,0.08)">Duty Terminated</span>
      <h1 class="logo-heading" style="color: #ff0033; text-shadow:0 0 15px rgba(255,0,51,0.3)">SHREDDED!</h1>
      <div class="logo-sub">Mangle-O-Matic Claim</div>
      <p class="logo-description">
        Your safety vest drifted too close. Critical impact registered with baggage shredding teeth.
      </p>

      <div class="stat-metric-card">
        <div class="sec-metric">
          <div class="stat-label">Stickers Gained</div>
          <div class="stat-value" id="go-stickers">0</div>
        </div>
        <div class="sec-metric">
          <div class="stat-label">Distance Run</div>
          <div class="stat-value" id="go-dist" style="color:#39ff14">0m</div>
        </div>
      </div>

      <button class="launch-btn red" id="retry-bt">Clock In [SPACE]</button>
    </div>

    <canvas id="gameCanvas"></canvas>

  </div>

  <script>
    // Stands standalone self-contained Vanilla JS/Canvas game loop mirror
    const canvas = document.getElementById("gameCanvas");
    const ctx = canvas.getContext("2d");

    const V_W = 600;
    const V_H = 800;

    let gameState = "MENU"; // PLAYING, GAMEOVER
    let score = 0;
    let distance = 0;
    let beltSpeed = 210;
    let levelTimer = 0;
    let scrollOffset = 0;
    let muted = false;

    // Player handler variables
    const player = {
      lane: 1,
      targetX: 300,
      x: 300,
      y: 350,
      width: 44,
      height: 55,
      isSliding: false,
      slideTime: 0,
      isLeaping: false,
      leapTime: 0,
      stunTime: 0,
      invulTime: 0,
      magnetTime: 0,
      animFrame: 0
    };

    let obstacles = [];
    let collectibles = [];
    let particles = [];
    let lastTime = 0;
    let spawnTimer = 0;
    let collTimer = 0;

    // Mini synthesizer sound
    const audio = {
      ctx: null,
      beep(f, d, t="sine") {
        if (muted) return;
        if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (this.ctx.state === "suspended") this.ctx.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = t;
        osc.frequency.setValueAtTime(f, this.ctx.currentTime);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + d);
        osc.start();
        osc.stop(this.ctx.currentTime + d);
      }
    };

    function getLaneCenterX(lane) {
      if (lane === 0) return 180;
      if (lane === 1) return 300;
      return 420;
    }

    function initGame() {
      score = 0;
      distance = 0;
      beltSpeed = 210;
      levelTimer = 0;
      obstacles = [];
      collectibles = [];
      particles = [];
      
      player.lane = 1;
      player.targetX = 300;
      player.x = 300;
      player.y = 350;
      player.isSliding = false;
      player.isLeaping = false;
      player.stunTime = 0;
      player.invulTime = 1.0;
      player.magnetTime = 0;

      updateHUDElements();
    }

    function updateHUDElements() {
      document.getElementById("hud-stickers").textContent = score;
      document.getElementById("hud-dist").textContent = Math.floor(distance) + "m";
      
      const dangerCoeff = Math.max(0, Math.min(100, (player.y - 250) / 4.1));
      document.getElementById("meter-fill").style.height = dangerCoeff + "%";
    }

    function moveLeft() {
      if (player.stunTime > 0) return;
      if (player.lane > 0) { player.lane--; player.targetX = getLaneCenterX(player.lane); audio.beep(300, 0.08); }
    }
    function moveRight() {
      if (player.stunTime > 0) return;
      if (player.lane < 2) { player.lane++; player.targetX = getLaneCenterX(player.lane); audio.beep(300, 0.08); }
    }
    function dash() {
      if (player.isLeaping || player.isSliding || player.stunTime > 0) return;
      player.isLeaping = true;
      player.leapTime = 0.45;
      player.y = Math.max(160, player.y - 120);
      audio.beep(440, 0.15, "triangle");
    }
    function slide() {
      if (player.isLeaping || player.isSliding || player.stunTime > 0) return;
      player.isSliding = true;
      player.slideTime = 0.6;
      audio.beep(150, 0.2, "sawtooth");
    }

    // Input handlers
    window.addEventListener("keydown", (e) => {
      const k = e.key.toLowerCase();
      if (gameState === "PLAYING") {
        if (k === "arrowleft" || k === "a") moveLeft();
        if (k === "arrowright" || k === "d") moveRight();
        if (e.key === "ArrowUp" || k === "w") { e.preventDefault(); dash(); }
        if (e.key === "ArrowDown" || k === "s") { e.preventDefault(); slide(); }
      } else {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          if (gameState === "MENU") startGame();
          if (gameState === "GAMEOVER") startGame();
        }
      }
    });

    document.getElementById("m-left").addEventListener("click", moveLeft);
    document.getElementById("m-right").addEventListener("click", moveRight);
    document.getElementById("m-dash").addEventListener("click", dash);
    document.getElementById("m-slide").addEventListener("click", slide);

    document.getElementById("s-crn-btn").addEventListener("click", () => {
      muted = !muted;
      document.getElementById("s-crn-btn").textContent = muted ? "🔇 Muted" : "🔈 Mute";
    });

    function startGame() {
      initGame();
      gameState = "PLAYING";
      document.getElementById("menu-overlay").classList.add("hidden");
      document.getElementById("gameover-overlay").classList.add("hidden");
      lastTime = 0;
      requestAnimationFrame(mainLoop);
    }

    function triggerGameOver() {
      gameState = "GAMEOVER";
      document.getElementById("go-stickers").textContent = score;
      document.getElementById("go-dist").textContent = Math.floor(distance) + "m";
      document.getElementById("gameover-overlay").classList.remove("hidden");
      audio.beep(60, 0.5, "sawtooth");
    }

    function mainLoop(timestamp) {
      if (gameState !== "PLAYING") return;
      if (!lastTime) lastTime = timestamp;
      let dt = (timestamp - lastTime) / 1000;
      if (dt > 0.1) dt = 0.1;
      lastTime = timestamp;

      // 1. TIMERS & SYSTEMS
      levelTimer += dt;
      beltSpeed = Math.min(520, 210 + Math.floor(levelTimer/15) * 30);
      distance += (beltSpeed * dt) * 0.05;

      player.x += (player.targetX - player.x) * 18 * dt;
      player.animFrame = (player.animFrame + 12 * dt) % 4;

      if (player.invulTime > 0) player.invulTime -= dt;
      if (player.magnetTime > 0) player.magnetTime -= dt;

      if (player.isSliding) {
        player.slideTime -= dt;
        if (player.slideTime <= 0) player.isSliding = false;
      }
      if (player.isLeaping) {
        player.leapTime -= dt;
        if (player.leapTime <= 0) player.isLeaping = false;
      }

      if (player.stunTime > 0) {
        player.stunTime -= dt;
        player.y += beltSpeed * dt;
      } else {
        player.y = Math.min(680, player.y + (beltSpeed * 0.14) * dt);
      }

      if (player.y >= 665) {
        triggerGameOver();
        return;
      }

      updateHUDElements();

      // 2. SPAWN OBS & COLLS
      spawnTimer += dt;
      if (spawnTimer >= Math.max(0.7, 1.8 - Math.floor(levelTimer/15)*0.15)) {
        spawnTimer = 0;
        const oLane = Math.floor(Math.random()*3);
        const randType = Math.random();
        let type = "suitcase";
        if (randType > 0.82) type = "cart";
        else if (randType > 0.65) type = "scanner";
        else if (randType > 0.40) type = "box";

        obstacles.push({
          lane: oLane,
          x: getLaneCenterX(oLane),
          y: -80,
          type: type,
          speed: type === "cart" ? 150 : 0,
          animTimer: 0
        });
      }

      collTimer += dt;
      if (collTimer >= 1.35) {
        collTimer = 0;
        const cLane = Math.floor(Math.random()*3);
        const randT = Math.random();
        let type = "sticker";
        if (randT > 0.85) type = "drink";
        else if (randT > 0.72) type = "boots";

        collectibles.push({
          lane: cLane,
          x: getLaneCenterX(cLane),
          y: -50,
          type: type,
          pulseTimer: 0
        });
      }

      // 3. UPDATE & COLLISION LOOP
      obstacles.forEach((obs, idx) => {
        obs.y += (beltSpeed + obs.speed) * dt;
        obs.animTimer += dt;

        if (obs.y > V_H + 90) {
          obstacles.splice(idx,1);
          return;
        }

        // Hit Detection
        if (
          player.stunTime <= 0 &&
          player.invulTime <= 0 &&
          obs.lane === player.lane &&
          Math.abs(obs.y - player.y) < 30
        ) {
          if ((obs.type === "suitcase" || obs.type === "box") && player.isLeaping) return;
          if ((obs.type === "scanner") && player.isSliding) return;

          player.stunTime = 0.75;
          player.invulTime = 1.5;
          player.y += 20;
          audio.beep(120, 0.4, "sawtooth");
        }
      });

      collectibles.forEach((coll, idx) => {
        coll.y += beltSpeed * dt;
        coll.pulseTimer += dt;

        // Magnet attraction
        if (player.magnetTime > 0) {
          const dx = player.x - coll.x;
          const dy = player.y - coll.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist < 180) {
            coll.x += (dx/dist) * 230 * dt;
            coll.y += (dy/dist) * 230 * dt;
          }
        }

        if (coll.y > V_H + 50) {
          collectibles.splice(idx,1);
          return;
        }

        if (Math.abs(coll.x - player.x) < 32 && Math.abs(coll.y - player.y) < 32) {
          collectibles.splice(idx,1);
          if (coll.type === "sticker") {
            score += 10;
            audio.beep(600, 0.15);
          } else if (coll.type === "drink") {
            player.invulTime = 4.0;
            player.y = Math.max(180, player.y - 150);
            audio.beep(800, 0.25, "triangle");
          } else if (coll.type === "boots") {
            player.magnetTime = 6.0;
            audio.beep(850, 0.2, "triangle");
          }
        }
      });

      // 4. RENDERING SCREEN
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      const ratio = canvas.width / V_W;
      ctx.scale(ratio, ratio);

      // Slate flooring
      ctx.fillStyle = "#121319";
      ctx.fillRect(0,0,V_W,V_H);

      // Lanes base conveyer
      ctx.fillStyle = "#1b1d24";
      ctx.fillRect(100,0,400,V_H);

      // Dashed lane marks scrolling
      ctx.strokeStyle = "#323745";
      ctx.lineWidth = 3;
      ctx.setLineDash([15,15]);
      ctx.beginPath();
      ctx.moveTo(240, (timestamp*0.2)%30); ctx.lineTo(240, V_H);
      ctx.moveTo(360, (timestamp*0.2)%30); ctx.lineTo(360, V_H);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw Collectibles
      collectibles.forEach((coll) => {
        ctx.fillStyle = coll.type === "sticker" ? "#ff0077" : coll.type === "drink" ? "#00bbff" : "#f2a900";
        ctx.fillRect(coll.x - 10, coll.y - 10, 20, 20);
      });

      // Draw Obstacles
      obstacles.forEach((obs) => {
        ctx.fillStyle = obs.type === "suitcase" ? "#9c3a3c" : obs.type === "box" ? "#c2915c" : obs.type === "scanner" ? "#3e424c" : "#ff3333";
        ctx.fillRect(obs.x - 20, obs.y - 20, 40, 40);
        if (obs.type === "scanner") {
          ctx.strokeStyle = "#ba00ff";
          ctx.lineWidth = 3;
          ctx.strokeRect(obs.x - 20, obs.y - 10, 40, 4);
        }
      });

      // Draw Player animated
      ctx.save();
      const jumpAmt = player.isLeaping ? Math.sin((player.leapTime/0.45)*Math.PI)*45 : 0;
      ctx.translate(player.x, player.y - jumpAmt);
      
      const blinkShow = player.invulTime > 0 ? Math.floor(timestamp/60)%2===0 : true;
      if (blinkShow) {
        ctx.fillStyle = player.stunTime > 0 ? "#ff2a00" : "#ffaa00";
        // body box
        ctx.fillRect(-15, -30, 30, 35);
        ctx.fillStyle = "#ffd5b4";
        // face
        ctx.fillRect(-8, -45, 16, 16);
        ctx.fillStyle = "#ffd500";
        // cap helmet
        ctx.fillRect(-10, -50, 20, 6);
      }
      ctx.restore();

      // Grinding shredder mouth at bottom
      ctx.fillStyle = "#17181c";
      ctx.fillRect(100, 680, 400, 120);
      ctx.fillStyle = "#ff1a00";
      ctx.fillRect(110, 690, 380, 45);
      
      ctx.fillStyle = "#000";
      ctx.font = "bold 9px monospace";
      ctx.fillText("CAUTION - SHREDDER ACTIVE", 140, 715);

      requestAnimationFrame(mainLoop);
    }

    document.getElementById("start-bt").addEventListener("click", startGame);
    document.getElementById("retry-bt").addEventListener("click", startGame);

  </script>
</body>
</html>`;

    const blob = new Blob([htmlCode], { type: "text/html" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "baggage-claim-standalone.html";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="relative w-screen h-screen bg-[#07080b] text-gray-100 flex items-center justify-center font-sans overflow-hidden selection:bg-[#f2a900] selection:text-[#07080b]">
      {/* Visual Ambient Scanlines */}
      <div className="pointer-events-none absolute inset-0 z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.2)_50%)] bg-[size:100%_4px] opacity-[0.05]" />

      {/* MAIN VIEWPORT: Hectic Conveyor runner Canvas */}
      <div className="w-full h-full flex items-center justify-center bg-[#07080a] p-0 md:p-3 select-none overflow-hidden">
        
        {/* Responsive Canvas Frame wrapper */}
        <div
          id="canvas-wrap"
          className="relative rounded-none md:rounded-2xl border-0 md:border-4 border-[#222530] bg-[#121319] overflow-hidden shadow-2xl transition-all"
          style={{
            width: "min(100vw, 100vh * 0.75)",
            height: "min(100vh, 100vw * 1.3333)",
          }}
        >
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full block"
            style={{ touchAction: "none" }}
          />

          {/* FLOATING HUD OVERLAY DURING PLAY */}
          {gameState === "PLAYING" && (
            <div className="absolute top-3 inset-x-3 flex flex-col gap-2 pointer-events-none z-30 font-mono text-[10px]">
              {/* Core metrics row */}
              <div className="flex justify-between items-center bg-black/75 border border-zinc-800/40 backdrop-blur-md px-3 py-2 rounded-xl">
                <div className="flex items-center gap-1">
                  <Gauge className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-gray-400">DIST:</span>
                  <span className="font-extrabold text-emerald-400">{distance}m</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-[#f2a900] animate-pulse" />
                  <span className="text-gray-400">SPEED:</span>
                  <span className="font-extrabold text-[#f2a900]">{beltSpeedKph} KPH</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-pink-500" />
                  <span className="text-gray-400">PTS:</span>
                  <span className="font-extrabold text-pink-500">{score}</span>
                </div>
              </div>

              {/* Active powerups drawer inside HUD */}
              {(energyDrinkTime > 0 || magneticTime > 0) && (
                <div className="flex flex-wrap gap-1.5 justify-center bg-cyan-950/60 border border-cyan-800/40 backdrop-blur-md p-1.5 rounded-lg pointer-events-none">
                  {energyDrinkTime > 0 && (
                    <span className="px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[8px] font-bold flex items-center gap-1">
                      ⚡ ENERGY: {energyDrinkTime}s
                    </span>
                  )}
                  {magneticTime > 0 && (
                    <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[8px] font-bold flex items-center gap-1">
                      🧲 MAGNET: {magneticTime}s
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* OVERLAY: START MENU */}
          <AnimatePresence>
            {gameState === "MENU" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/95 z-40 flex flex-col items-center justify-center p-6 text-center"
              >
                <div className="max-w-sm space-y-5">
                  <div className="inline-block px-3 py-1 rounded-full border border-[#f2a900]/30 bg-[#f2a900]/5 text-xs text-[#f2a900] tracking-widest font-mono uppercase animate-pulse">
                    COGNITIVE TERMINAL HAZARD
                  </div>
                  
                  <div>
                    <h2 className="text-4xl font-extrabold text-[#f2a900] tracking-wider uppercase [text-shadow:_0_0_15px_rgba(242,169,0,0.3)]">
                      OVERBOOKED
                    </h2>
                    <p className="text-xs uppercase tracking-widest text-[#fafbfc] font-mono mt-1">
                      Baggage Claim Edition
                    </p>
                  </div>

                  {/* TAB SWITCHER */}
                  <div className="flex bg-[#121319] p-1.5 rounded-xl border border-[#222530] font-mono text-[11px] gap-1.5">
                    <button
                      onClick={() => setMenuTab("PLAY")}
                      className={`flex-1 py-2 rounded-lg font-bold tracking-wider transition-all ${
                        menuTab === "PLAY"
                          ? "bg-[#f2a900] text-black shadow-md font-bold"
                          : "text-gray-400 hover:text-white bg-zinc-950/20"
                      }`}
                    >
                      🎮 SHIFT ROLE
                    </button>
                    <button
                      onClick={() => setMenuTab("SHOP")}
                      className={`flex-1 py-1 px-2 rounded-lg font-bold tracking-wider transition-all flex items-center justify-center gap-1 ${
                        menuTab === "SHOP"
                          ? "bg-[#f2a900] text-black shadow-md font-bold"
                          : "text-gray-400 hover:text-white bg-zinc-950/20"
                      }`}
                    >
                      👕 COSTUME SHOP 
                      <span className="bg-pink-600 text-[9px] px-1.5 py-0.5 rounded-full text-white animate-bounce">
                        NEW
                      </span>
                    </button>
                  </div>

                  {menuTab === "SHOP" ? (
                    <div className="space-y-3 text-left">
                      <div className="flex justify-between items-center bg-[#07080b]/90 p-2.5 rounded-xl border border-[#222530] font-mono">
                        <span className="text-[9px] text-gray-400 font-bold uppercase transition-all">FRAGILE REWARDS BALANCE:</span>
                        <span className="text-xs font-black text-pink-500 flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5" />
                          {totalPoints} PTS
                        </span>
                      </div>

                      <div className="max-h-[200px] overflow-y-auto pr-1 space-y-1.5 custom-scrollbar">
                        {SKINS.map(skin => {
                          const isUnlocked = unlockedSkins.includes(skin.id);
                          const isSelected = selectedSkin === skin.id;
                          const canBuy = totalPoints >= skin.cost;

                          return (
                            <div
                              key={skin.id}
                              className={`p-2.5 rounded-xl border transition-all flex justify-between items-center gap-2 ${
                                isSelected
                                  ? "border-[#f2a900] bg-[#f2a900]/10 shadow-[0_0_8px_rgba(242,169,0,0.15)]"
                                  : "border-[#222530] bg-[#121319] hover:border-zinc-700"
                              }`}
                            >
                              <div className="space-y-0.5 max-w-[170px]">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {/* Multi-colored circles */}
                                  <div className="flex gap-0.5">
                                    <span className="w-2.5 h-2.5 rounded-full border border-black/30 block" style={{ backgroundColor: skin.helmet }} title="Helmet" />
                                    <span className="w-2.5 h-2.5 rounded-full border border-black/30 block" style={{ backgroundColor: skin.vest }} title="Vest" />
                                    <span className="w-2.5 h-2.5 rounded-full border border-black/30 block" style={{ backgroundColor: skin.pants }} title="Pants" />
                                  </div>
                                  <span className="text-xs font-bold text-white transition-all font-mono">{skin.name}</span>
                                </div>
                                <p className="text-[9px] text-gray-400 leading-normal font-mono">{skin.description}</p>
                              </div>

                              <div>
                                {isSelected ? (
                                  <span className="px-2 py-0.5 rounded bg-[#f2a900] text-black font-mono font-bold text-[9px] uppercase">
                                    ON SHIFT
                                  </span>
                                ) : isUnlocked ? (
                                  <button
                                    onClick={() => buyOrSelectSkin(skin)}
                                    className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-white font-mono font-bold text-[9px] uppercase transition-all"
                                  >
                                    EQUIP
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => buyOrSelectSkin(skin)}
                                    disabled={!canBuy}
                                    className={`px-2 py-0.5 rounded font-mono font-bold text-[9px] uppercase transition-all flex items-center gap-1 ${
                                      canBuy
                                        ? "bg-pink-600 hover:bg-pink-500 text-white"
                                        : "bg-zinc-900 border border-zinc-800 text-zinc-600 cursor-not-allowed"
                                    }`}
                                  >
                                    🛒 {skin.cost}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <p className="text-[9px] font-mono text-center text-gray-500">
                        Earn Fragile Reward Points during shifts to buy custom high-vis vests and helmets!
                      </p>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-gray-400 leading-relaxed font-mono">
                        Shift lanes to collect FRAGILE Stickers and evade the airport conveyor roller obstacles. Run forward using boost so you don't drift down into the buzz-saw shredder teeth!
                      </p>

                      <div className="p-3 rounded-lg border border-[#222530] bg-[#0c0d12]/90 space-y-2.5 font-mono text-left">
                        <div className="text-[9px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1.5 justify-center border-b border-[#222530] pb-2">
                          <CornerDownRight className="w-3.5 h-3.5 text-[#f2a900]" /> CONTROLS PANEL
                        </div>
                        
                        <div className="space-y-1.5 text-[9px] text-gray-300">
                          <p>✨ <strong className="text-white font-mono">A / D (Left/Right / Swipe):</strong> Lane Shift</p>
                          <p>🚀 <strong className="text-white font-mono">W (Up Arrow / Touch Tap):</strong> Dash Forward (Jump objects)</p>
                          <p>💨 <strong className="text-white font-mono">S (Down Arrow / Swipe Down):</strong> Crouch Slide (Under scanners)</p>
                        </div>
                      </div>

                      <button
                        onClick={startGameBtn}
                        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#f2a900] to-[#b17b00] text-[#07080b] font-black text-sm tracking-widest uppercase hover:scale-[1.03] transition-all shadow-[0_0_20px_rgba(242,169,0,0.35)]"
                      >
                        CLOCK IN TO WORK [SPACE]
                      </button>
                    </>
                  )}

                  {/* UTILITY FOOTER ROWS */}
                  <div className="flex gap-2 justify-center pt-2.5 border-t border-zinc-800/80 mt-2">
                    <button
                      onClick={toggleSound}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-[10px] font-bold transition-all font-mono ${
                        muted
                          ? "border-zinc-800 text-gray-500 bg-zinc-900/40"
                          : "border-[#f2a900]/30 text-[#f2a900] bg-[#f2a900]/5 hover:bg-[#f2a900]/10"
                      }`}
                    >
                      {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                      {muted ? "MUTED" : "SOUND ON"}
                    </button>

                    <button
                      onClick={handleExportGame}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-pink-500/30 text-pink-400 bg-pink-500/5 hover:bg-pink-500/15 text-[10px] font-bold transition-all font-mono"
                      title="Download standalone single HTML file ready to upload to CrazyGames!"
                    >
                      <Download className="w-3.5 h-3.5" />
                      EXPORT GAME
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* OVERLAY: GAME OVER RETRY */}
          <AnimatePresence>
            {gameState === "GAMEOVER" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/95 z-40 flex flex-col items-center justify-center p-6 text-center"
              >
                <div className="max-w-sm space-y-6">
                  <div className="inline-block px-3 py-1 rounded-full border border-red-500/30 bg-red-500/5 text-xs text-red-500 tracking-wider font-mono uppercase animate-pulse">
                    EMERGENCY TERMINATION
                  </div>

                  <div>
                    <h2 className="text-4xl font-extrabold text-red-500 tracking-wider uppercase [text-shadow:_0_0_15px_rgba(239,68,68,0.3)]">
                      SHREDDED!
                    </h2>
                    <p className="text-[10px] tracking-widest text-[#fafbfc] font-mono mt-1">
                      CONVEYOR BELT OVERRUN COMPROMISE
                    </p>
                  </div>

                  <p className="text-xs text-gray-400 font-mono">
                    You drifted too close to the spinning metallic rollers and were shredded into cardboard bits!
                  </p>

                  <div className="grid grid-columns-2 gap-3 p-4 rounded-lg border border-red-950/50 bg-zinc-950/90 font-mono text-left">
                    <div className="border-r border-[#222530] pr-3">
                      <span className="text-[9px] text-gray-500 uppercase">Stickers Collected</span>
                      <div className="text-2xl font-black text-pink-500">{score}</div>
                    </div>
                    <div>
                      <span className="text-[9px] text-gray-500 uppercase">Distance Run</span>
                      <div className="text-2xl font-black text-emerald-400">{distance}m</div>
                    </div>
                  </div>

                  <button
                    onClick={retryGameBtn}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-red-600 to-red-800 text-white font-black text-sm tracking-widest uppercase hover:scale-[1.03] transition-all shadow-[0_0_20px_rgba(239,68,68,0.35)]"
                  >
                    START RETRY OVER [SPACE]
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* OVERLAY: PAUSE SCREEN */}
          <AnimatePresence>
            {gameState === "PAUSED" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/90 z-40 flex flex-col items-center justify-center p-6 text-center font-mono"
              >
                <div className="space-y-4">
                  <ShieldAlert className="w-12 h-12 text-[#f2a900] mx-auto animate-bounce" />
                  <h3 className="text-2xl font-bold uppercase tracking-wider text-white">DUTY PAUSED</h3>
                  <p className="text-xs text-gray-400">Security stabilizers engaged. Belt holding position.</p>
                  <button
                    onClick={resumeGame}
                    className="px-6 py-2.5 rounded-lg bg-[#f2a900] text-black font-extrabold text-xs tracking-wider uppercase hover:scale-[1.05] transition-all"
                  >
                    RESUME ROUTINE
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ON-SCREEN MOBILE COMPRESSION BUTTONS (Hidden on Desktop) */}
          <div className="pointer-events-none absolute inset-x-0 bottom-4 px-4 flex justify-between z-20 md:hidden bg-transparent">
            {/* Shift Left */}
            <button
              onClick={() => handleLaneShift("L")}
              className="pointer-events-auto w-14 h-14 rounded-xl bg-black/75 border border-[#222530] text-white active:bg-[#f2a900] active:text-black font-black text-base flex items-center justify-center transition-all shadow-md"
            >
              ◀
            </button>
            
            {/* Speed Dash and Couch Slide stacked */}
            <div className="flex flex-col gap-2">
              <button
                onClick={handleUpDash}
                className="pointer-events-auto px-4 py-2 rounded-lg bg-black/75 border border-[#222530] text-[#f2a900] active:bg-[#f2a900] active:text-black font-extrabold text-[10px] uppercase transition-all shadow-md"
              >
                DASH [W]
              </button>
              <button
                onClick={handleDownSlide}
                className="pointer-events-auto px-4 py-2 rounded-lg bg-black/75 border border-[#222530] text-[#f2a900] active:bg-[#f2a900] active:text-black font-extrabold text-[10px] uppercase transition-all shadow-md"
              >
                SLIDE [S]
              </button>
            </div>

            {/* Shift Right */}
            <button
              onClick={() => handleLaneShift("R")}
              className="pointer-events-auto w-14 h-14 rounded-xl bg-black/75 border border-[#222530] text-white active:bg-[#f2a900] active:text-black font-black text-base flex items-center justify-center transition-all shadow-md"
            >
              ▶
            </button>
          </div>

          {/* Quick instructions floating helper */}
          {showTutorial && gameState === "PLAYING" && (
            <div className="absolute top-1/4 inset-x-6 mx-auto bg-black/90 p-3 rounded-lg border border-[#f2a900]/30 text-center z-30 font-mono text-[9px] text-gray-300 pointer-events-none animate-bounce">
              <p className="font-bold text-[#f2a900] mb-1">🎮 TIPS TO STAY OUT OF THE SHREDDER:</p>
              <p>Press A/D to shift lanes, W to DASH over luggage, S to SLIDE under scanners!</p>
              <p className="text-[8px] text-gray-500 mt-1">Press ESC to pause.</p>
              <button
                onClick={(e) => { e.stopPropagation(); setShowTutorial(false); }}
                className="pointer-events-auto mt-2 px-2 py-0.5 rounded bg-[#f2a900] text-black font-bold text-[8px]"
              >
                GOT IT!
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
