import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls';
import { Player } from './Player';
import { World } from './World';
import { Enemy } from './Enemy';

class Game {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050505);
    this.scene.fog = new THREE.Fog(0x050505, 0, 70);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 2, 10);
    this.camera.rotation.order = 'YXZ';

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    document.body.appendChild(this.renderer.domElement);

    this.scene.add(this.camera);
    this.controls = new PointerLockControls(this.camera, document.body);

    this.world = new World(this.scene);
    this.player = new Player(this.camera, this.controls, this.scene, this.world);

    this.enemies = [
      new Enemy(this.scene, this.player, this.world),
      new Enemy(this.scene, this.player, this.world)
    ];
    this.enemies.forEach(e => this.world.collidableObjects.push(e.mesh));

    this.clock = new THREE.Clock();
    this.gameState = 'START';
    this.currentLevel = 1;
    this.timeSurvived = 0;

    this.initLights();
    this.setupEventListeners();
    this.animate();
  }

  initLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    this.scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(10, 20, 10);
    this.scene.add(directionalLight);
  }

  setupEventListeners() {
    const startBtn = document.getElementById('start-button');
    const restartBtn = document.getElementById('restart-button');
    const startScreen = document.getElementById('start-screen');
    const gameOverScreen = document.getElementById('game-over-screen');

    startBtn.addEventListener('click', () => {
      this.gameState = 'PLAYING';
      startScreen.style.display = 'none';
      this.controls.lock();
    });

    restartBtn.addEventListener('click', () => {
      location.reload();
    });

    this.controls.addEventListener('lock', () => {
      if (this.gameState === 'PLAYING') {
        startScreen.style.display = 'none';
        gameOverScreen.style.display = 'none';
      }
    });

    this.controls.addEventListener('unlock', () => {
      // Pause or menu
    });

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    if (this.gameState === 'PLAYING') {
      const delta = this.clock.getDelta();
      this.timeSurvived += delta;

      // Check for Level Up: Every 200 points
      const currentScore = parseInt(document.getElementById('score').innerText);
      const targetLevel = Math.min(20, Math.floor(currentScore / 200) + 1);

      if (targetLevel > this.currentLevel) {
        this.updateLevel(targetLevel);
      }

      this.player.update(delta);
      this.enemies.forEach(enemy => enemy.update(delta));

      // Update Right Side Stats
      const enemiesAlive = this.enemies.filter(e => !e.isDead).length;
      const enemyAliveEl = document.getElementById('enemy-alive');
      const enemyCountEl = document.getElementById('enemy-count');
      const spawnRateEl = document.getElementById('spawn-rate');

      if (enemyAliveEl) enemyAliveEl.innerText = enemiesAlive;
      if (enemyCountEl) enemyCountEl.innerText = this.enemies.length;
      if (spawnRateEl && this.enemies.length > 0) {
        spawnRateEl.innerText = this.enemies[0].baseRespawnTime.toFixed(1);
      }

      if (this.player.isDead) {
        this.gameOver();
      }
    }

    this.renderer.render(this.scene, this.camera);
    this.drawMinimap();
  }

  drawMinimap() {
    const canvas = document.getElementById('minimap');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const size = canvas.width = canvas.height = 150;
    const center = size / 2;
    const scale = 1.0; // 1 unit in 3D = 1 pixel on map (zoomed in)

    ctx.clearRect(0, 0, size, size);

    // Draw Player (Green Dot)
    const px = this.camera.position.x;
    const pz = this.camera.position.z;

    // Draw all enemies
    this.enemies.forEach(enemy => {
      if (enemy.isDead) return;

      const dist = enemy.mesh.position.distanceTo(this.camera.position);

      // ONLY SHOW ENEMIES IN THEIR ATTACK RANGE
      if (dist <= enemy.maxRange) {
        const ex = enemy.mesh.position.x;
        const ez = enemy.mesh.position.z;

        // Coordinates relative to player
        const relX = (ex - px) * scale;
        const relZ = (ez - pz) * scale;

        // Draw Red Dot
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(center + relX, center + relZ, 4, 0, Math.PI * 2);
        ctx.fill();

        // Subtle pulse for enemies in range
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });

    // Draw Player Center Dot
    ctx.fillStyle = '#00ff00';
    ctx.beginPath();
    ctx.arc(center, center, 5, 0, Math.PI * 2);
    ctx.fill();

    // Draw View Direction Cone
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    const angle = this.camera.rotation.y;
    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.lineTo(center - Math.sin(angle) * 15, center - Math.cos(angle) * 15);
    ctx.stroke();
  }

  updateLevel(newLevel) {
    this.currentLevel = newLevel;
    const levelDisplay = document.getElementById('level');
    if (levelDisplay) levelDisplay.innerText = newLevel;

    // Scale existing enemies
    this.enemies.forEach(enemy => {
      enemy.level = newLevel;
      enemy.baseShootInterval = Math.max(0.5, 3.0 - (newLevel * 0.1));
      enemy.baseRespawnTime = Math.max(3, 10 - (newLevel * 0.35));
      enemy.accuracy = Math.min(1.0, 0.7 + (newLevel * 0.015));
    });

    // Add more enemies every 4 levels
    const targetCount = 2 + Math.floor((newLevel - 1) / 4);
    while (this.enemies.length < targetCount) {
      const enemy = new Enemy(this.scene, this.player, this.world, newLevel);
      this.enemies.push(enemy);
      this.world.collidableObjects.push(enemy.mesh);
    }

    console.log(`Leveled Up to ${newLevel}!`);
  }

  gameOver() {
    this.gameState = 'GAMEOVER';
    this.controls.unlock();

    document.getElementById('game-over-screen').style.display = 'flex';
    document.getElementById('final-score').innerText = document.getElementById('score').innerText;
    document.getElementById('final-time').innerText = Math.floor(this.timeSurvived);
  }
}

new Game();
