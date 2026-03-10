import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls';
import { Player } from './Player';
import { World } from './World';
import { Enemy } from './Enemy';
import { Rival } from './Rival';
import { io } from 'socket.io-client';

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
    this.pickups = [];
    this.pickupSpawnTimer = 0;
    this.machineGunSpawnTimer = 0;
    this.machineGunActiveTimer = 0;
    this.activeMachineGun = null;

    // Difficulty and Scores
    this.difficulty = localStorage.getItem('funny_shooter_difficulty') || 'medium';
    this.highScores = JSON.parse(localStorage.getItem('funny_shooter_scores')) || [];

    // Multiplayer initialization
    this.rivals = {};
    this.initSocket();

    this.initLights();
    this.setupEventListeners();
    this.updateLeaderboardUI();
    this.updateDifficultyUI();
    this.animate();
  }

  initLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    this.scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(10, 20, 10);
    this.scene.add(directionalLight);
  }

  initSocket() {
    // Connect to the local Node server (runs on port 3000)
    this.socket = io(`http://${window.location.hostname}:3000`);

    this.socket.on('currentPlayers', (players) => {
      Object.keys(players).forEach((id) => {
        if (id !== this.socket.id && players[id].name !== "Anonymous") {
          if (!this.rivals[id]) {
            this.rivals[id] = new Rival(this.scene, id, players[id]);
          }
        }
      });
    });

    this.socket.on('playerFired', (data) => {
      if (this.rivals[data.id]) {
        // Play sound based on distance for a 3D effect spatialized feel
        const dist = this.camera.position.distanceTo(this.rivals[data.id].mesh.position);
        if (dist < 50) {
          audioManager.playPistol(); // For now use pistol sound for all rivals
        }
      }
    });

    this.socket.on('scoreUpdate', (rankings) => {
      this.updateMultiplayerScoreboardUI(rankings);
    });

    this.socket.on('newPlayer', (playerData) => {
      if (!this.rivals[playerData.id]) {
        this.rivals[playerData.id] = new Rival(this.scene, playerData.id, playerData);
        this.showNotification(`NEW PLAYER: ${playerData.name}`);
      }
    });

    this.socket.on('playerMoved', (data) => {
      if (this.rivals[data.id]) {
        this.rivals[data.id].updatePosition(data.position, data.rotation);
      }
    });

    this.socket.on('playerDisconnected', (id) => {
      if (this.rivals[id]) {
        this.rivals[id].remove();
        delete this.rivals[id];
      }
    });

    this.socket.on('healthUpdate', (data) => {
      if (data.id === this.socket.id) {
        this.player.health = data.health;
        this.player.updateHealthUI();
      } else if (this.rivals[data.id]) {
        this.rivals[data.id].updateHealth(data.health);
      }
    });

    this.socket.on('playerDeath', (data) => {
      if (data.victimId === this.socket.id) {
        this.showNotification(`KILLED BY RIVAL!`);
        this.player.die();
      }
    });

    this.socket.on('playerRespawned', (data) => {
      if (data.id === this.socket.id) {
        this.player.health = 100;
        this.player.isDead = false;
        this.camera.position.set(data.position.x, data.position.y, data.position.z);
        this.player.updateHealthUI();
      } else if (this.rivals[data.id]) {
        this.rivals[data.id].respawn(data.position);
      }
    });

    this.player.onShoot = () => {
      if (this.socket && this.socket.connected) {
        this.socket.emit('playerShoot', {
          origin: this.camera.position,
          direction: this.camera.getWorldDirection(new THREE.Vector3()),
          range: this.player.weapon.currentType.range
        });
      }
    };

    // Hook up player hit detection to broadcast
    this.player.onRivalHit = (rivalId) => {
      this.socket.emit('playerHit', { victimId: rivalId, damage: 15 });
      this.showNotification("HIT RIVAL!");
    };
  }

  updateMultiplayerScoreboardUI(rankings) {
    const list = document.getElementById('rankings-list');
    if (!list) return;
    list.innerHTML = rankings
      .map((r, i) => `
              <div class="ranking-item">
                  <span>${i + 1}. ${r.name}</span>
                  <span>${r.score}</span>
              </div>
          `).join('');
  }

  startMultiplayer(name) {
    this.gameState = 'PLAYING';
    document.getElementById('name-screen').style.display = 'none';
    document.getElementById('multiplayer-scoreboard').style.display = 'block';
    this.controls.lock();

    this.socket.emit('join', { name: name });
  }

  setupEventListeners() {
    // Menu Buttons
    document.getElementById('start-mission-btn').addEventListener('click', () => this.startGame());

    document.getElementById('multiplayer-btn').addEventListener('click', () => {
      document.getElementById('main-menu').style.display = 'none';
      document.getElementById('name-screen').style.display = 'flex';
    });

    document.getElementById('join-multiplayer-btn').addEventListener('click', () => {
      const name = document.getElementById('player-name-input').value.trim();
      if (name) {
        this.startMultiplayer(name);
      } else {
        this.showNotification("PLEASE ENTER A CODENAME");
      }
    });

    document.getElementById('back-from-name-btn').addEventListener('click', () => {
      document.getElementById('name-screen').style.display = 'none';
      document.getElementById('main-menu').style.display = 'flex';
    });

    document.getElementById('open-settings-btn').addEventListener('click', () => {
      document.getElementById('main-menu').style.display = 'none';
      document.getElementById('settings-screen').style.display = 'flex';
    });
    document.getElementById('back-to-menu-btn').addEventListener('click', () => {
      document.getElementById('settings-screen').style.display = 'none';
      document.getElementById('main-menu').style.display = 'flex';
    });
    document.getElementById('restart-button').addEventListener('click', () => {
      if (this.socket && this.socket.connected) {
        this.socket.emit('playerRespawn');
        document.getElementById('game-over-screen').style.display = 'none';
        this.controls.lock();
      } else {
        location.reload();
      }
    });
    document.getElementById('menu-from-death-btn').addEventListener('click', () => {
      location.reload(); // Simplest way to reset for now
    });

    // Difficulty Buttons
    document.querySelectorAll('.diff-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.difficulty = e.target.dataset.level;
        localStorage.setItem('funny_shooter_difficulty', this.difficulty);
        this.updateDifficultyUI();
      });
    });

    this.controls.addEventListener('lock', () => {
      if (this.gameState === 'PLAYING') {
        document.getElementById('main-menu').style.display = 'none';
        document.getElementById('game-over-screen').style.display = 'none';
      }
    });

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  updateDifficultyUI() {
    document.querySelectorAll('.diff-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.level === this.difficulty);
    });
  }

  updateLeaderboardUI() {
    const list = document.getElementById('high-scores-list');
    if (this.highScores.length === 0) {
      list.innerHTML = '<li>NONE YET</li>';
      return;
    }
    list.innerHTML = this.highScores
      .sort((a, b) => b - a)
      .slice(0, 5)
      .map(score => `<li><span>PTS</span> <span>${score}</span></li>`)
      .join('');
  }

  saveScore(score) {
    this.highScores.push(score);
    this.highScores = this.highScores.sort((a, b) => b - a).slice(0, 10);
    localStorage.setItem('funny_shooter_scores', JSON.stringify(this.highScores));
    this.updateLeaderboardUI();
  }

  startGame() {
    this.gameState = 'PLAYING';
    document.getElementById('main-menu').style.display = 'none';
    this.controls.lock();

    // Apply difficulty modifiers
    let hpMod = 1.0;
    if (this.difficulty === 'easy') hpMod = 1.5;
    if (this.difficulty === 'hard') hpMod = 0.7;

    this.player.health = 100 * hpMod;
    this.player.updateHealthUI();

    // Scale enemies based on difficulty
    this.enemies.forEach(enemy => {
      if (this.difficulty === 'easy') {
        enemy.baseShootInterval *= 1.5;
        enemy.accuracy *= 0.8;
      } else if (this.difficulty === 'hard') {
        enemy.baseShootInterval *= 0.7;
        enemy.accuracy = Math.min(1.0, enemy.accuracy * 1.2);
      }
    });
  }

  spawnPickup() {
    const isHealth = Math.random() > 0.5;
    const type = isHealth ? 'health' : 'ammo';
    const color = isHealth ? 0x00ff00 : 0xffff00;

    // Rectangular crate shape
    const pickupGeo = new THREE.BoxGeometry(1.2, 0.8, 0.6);
    const pickupMat = new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 0.5 });
    const mesh = new THREE.Mesh(pickupGeo, pickupMat);

    // Position on ground at a random location
    mesh.position.set(
      (Math.random() - 0.5) * 80,
      0.4,
      (Math.random() - 0.5) * 80
    );

    this.scene.add(mesh);

    const pickup = {
      mesh: mesh,
      type: type,
      expires: Date.now() + 10000,
      moveDir: new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(),
      moveSpeed: 2 + Math.random() * 3
    };

    this.pickups.push(pickup);
  }

  spawnMachineGun() {
    const mgGeo = new THREE.TorusGeometry(1, 0.2, 8, 24);
    const mgMat = new THREE.MeshStandardMaterial({ color: 0xff00ff, emissive: 0xff00ff, emissiveIntensity: 1 });
    const mesh = new THREE.Mesh(mgGeo, mgMat);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set((Math.random() - 0.5) * 60, 1, (Math.random() - 0.5) * 60);
    this.scene.add(mesh);

    this.activeMachineGun = {
      mesh: mesh,
      expires: Date.now() + 10000
    };
    this.showNotification("MACHINE GUN SPAWNED!");
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

      // Handle Pickups
      this.pickupSpawnTimer += delta;
      if (this.pickupSpawnTimer > 15) {
        this.spawnPickup();
        this.pickupSpawnTimer = 0;
      }

      // Handle Machine Gun
      this.machineGunSpawnTimer += delta;
      if (this.machineGunSpawnTimer > 60 && !this.activeMachineGun && !this.player.isMachineGunMode) {
        this.spawnMachineGun();
        this.machineGunSpawnTimer = 0;
      }

      const now = Date.now();

      if (this.activeMachineGun) {
        // Pulse the machine gun
        this.activeMachineGun.mesh.scale.setScalar(1 + Math.sin(now / 100) * 0.2);

        if (now > this.activeMachineGun.expires) {
          this.scene.remove(this.activeMachineGun.mesh);
          this.activeMachineGun = null;
        } else if (this.activeMachineGun.mesh.position.distanceTo(this.camera.position) < 3) {
          this.player.setMachineGunMode(true);
          this.machineGunActiveTimer = 20; // 20 seconds duration
          this.scene.remove(this.activeMachineGun.mesh);
          this.activeMachineGun = null;
          this.showNotification("MACHINE GUN ACTIVE!");
        }
      }

      if (this.player.isMachineGunMode) {
        this.machineGunActiveTimer -= delta;
        if (this.machineGunActiveTimer <= 0 || this.player.machineGunBullets <= 0) {
          this.player.setMachineGunMode(false);
          this.showNotification("No Machine Gun, Back Human");
        }
      }
      this.pickups = this.pickups.filter(p => {
        // Check expiration
        if (now > p.expires) {
          this.scene.remove(p.mesh);
          return false;
        }

        // Ground Movement (Wandering)
        p.mesh.position.addScaledVector(p.moveDir, p.moveSpeed * delta);
        p.mesh.rotation.y += delta;

        // Simple boundary check for wandering pickups
        if (Math.abs(p.mesh.position.x) > 45 || Math.abs(p.mesh.position.z) > 45) {
          p.moveDir.multiplyScalar(-1);
        }

        // Collision with player
        if (p.mesh.position.distanceTo(this.camera.position) < 2) {
          if (p.type === 'health') {
            this.player.heal(30);
            this.showNotification("30 HP INCREASED");
          } else {
            this.player.addAmmo(15);
            this.showNotification("15 AMMO ADDED");
          }

          this.scene.remove(p.mesh);
          return false;
        }
        return true;
      });

      this.player.update(delta);
      this.enemies.forEach(enemy => enemy.update(delta));

      // Synchronize movement to server
      if (this.socket && this.socket.connected) {
        this.socket.emit('playerMovement', {
          position: { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z },
          rotation: { y: this.camera.rotation.y }
        });
      }

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
    const scale = 1.0;
    const now = Date.now();

    ctx.clearRect(0, 0, size, size);

    // Save context for rotation
    ctx.save();
    ctx.translate(center, center);

    // Rotate map so player's view is always UP
    // We rotate by -rotation.y because we want the world to rotate around us
    const playerRotY = this.camera.rotation.y;
    ctx.rotate(-playerRotY);

    const px = this.camera.position.x;
    const pz = this.camera.position.z;

    // Proximity Check (uses 3D distance, unaffected by map rotation logic)
    let nearPickup = false;
    this.pickups.forEach(p => {
      if (p.mesh.position.distanceTo(this.camera.position) < 20) {
        nearPickup = true;
      }
    });

    if (nearPickup) {
      canvas.style.borderColor = '#ffff00';
      canvas.style.boxShadow = '0 0 20px rgba(255, 255, 0, 0.8)';
    } else if (this.activeMachineGun && Math.floor(now / 200) % 2 === 0) {
      canvas.style.borderColor = '#ff00ff';
      canvas.style.boxShadow = '0 0 30px rgba(255, 0, 255, 1)';
    } else {
      canvas.style.borderColor = '#0ff';
      canvas.style.boxShadow = '0 0 20px rgba(0, 255, 255, 0.3)';
    }

    // Draw Machine Gun Object on Rotated Map
    if (this.activeMachineGun) {
      const relX = (this.activeMachineGun.mesh.position.x - px) * scale;
      const relZ = (this.activeMachineGun.mesh.position.z - pz) * scale;
      ctx.fillStyle = '#ff00ff';
      ctx.beginPath();
      ctx.arc(relX, relZ, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw all enemies on Rotated Map
    this.enemies.forEach(enemy => {
      if (enemy.isDead) return;
      const dist = enemy.mesh.position.distanceTo(this.camera.position);

      if (dist <= enemy.maxRange) {
        const relX = (enemy.mesh.position.x - px) * scale;
        const relZ = (enemy.mesh.position.z - pz) * scale;

        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(relX, relZ, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 0, 0, 0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });

    // Restore rotation before drawing static player indicators
    ctx.restore();

    // Draw Player Center Dot (Static middle)
    ctx.fillStyle = '#00ff00';
    ctx.beginPath();
    ctx.arc(center, center, 5, 0, Math.PI * 2);
    ctx.fill();

    // Draw Static View Direction Indicator (Facing UP)
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.lineTo(center, center - 20); // Always point UP
    ctx.stroke();

    // Subtle North indicator
    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(-playerRotY);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.font = '10px monospace';
    ctx.fillText('N', 0, -center + 15);
    ctx.restore();
  }

  showNotification(message) {
    const area = document.getElementById('notification-area');
    if (!area) return;

    const el = document.createElement('div');
    el.className = 'game-notification';
    el.innerText = message;
    area.appendChild(el);

    setTimeout(() => {
      if (el.parentNode) area.removeChild(el);
    }, 2000);
  }

  updateLevel(newLevel) {
    this.currentLevel = newLevel;
    this.showNotification(`GETTING TO LEVEL ${newLevel}`);
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

    const score = parseInt(document.getElementById('score').innerText);
    this.saveScore(score);

    document.getElementById('game-over-screen').style.display = 'flex';
    document.getElementById('final-score').innerText = score;
    document.getElementById('final-time').innerText = Math.floor(this.timeSurvived);
  }
}

new Game();
