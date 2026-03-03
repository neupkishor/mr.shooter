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
      location.reload(); // Simplest way to restart
    });

    this.controls.addEventListener('lock', () => {
      if (this.gameState === 'PLAYING') {
        startScreen.style.display = 'none';
        gameOverScreen.style.display = 'none';
      }
    });

    this.controls.addEventListener('unlock', () => {
      if (this.gameState === 'PLAYING') {
        // Pause logic could go here
      }
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

      this.player.update(delta);
      this.enemies.forEach(enemy => enemy.update(delta));

      if (this.player.isDead) {
        this.gameOver();
      }
    }

    this.renderer.render(this.scene, this.camera);
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
