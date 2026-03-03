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
    this.camera.rotation.order = 'YXZ'; // Essential for FPS look

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    document.body.appendChild(this.renderer.domElement);

    this.scene.add(this.camera);
    this.controls = new PointerLockControls(this.camera, document.body);
    this.controls.pointerSpeed = 1.0;

    this.world = new World(this.scene);
    this.player = new Player(this.camera, this.controls, this.scene, this.world);

    this.enemies = [
      new Enemy(this.scene, this.player, this.world),
      new Enemy(this.scene, this.player, this.world)
    ];
    this.enemies.forEach(e => this.world.collidableObjects.push(e.mesh));

    this.clock = new THREE.Clock();
    this.initLights();
    this.setupEventListeners();
    this.animate();
  }

  initLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0); // Full brightness ambient
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(10, 20, 10);
    this.scene.add(directionalLight);
  }

  setupEventListeners() {
    const info = document.getElementById('info');
    info.addEventListener('click', () => {
      this.controls.lock();
    });

    // Backup: Any click on the body locks the pointer if not already locked
    document.body.addEventListener('click', () => {
      if (!this.controls.isLocked) {
        this.controls.lock();
      }
    });

    this.controls.addEventListener('lock', () => {
      info.style.display = 'none';
    });

    this.controls.addEventListener('unlock', () => {
      info.style.display = 'block';
    });

    // Error handling
    document.addEventListener('pointerlockerror', (e) => {
      console.error('Pointer Lock Error:', e);
      document.getElementById('status').innerText += ' | LOCK ERROR!';
    });

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const delta = this.clock.getDelta();
    this.player.update(delta);
    this.enemies.forEach(enemy => enemy.update(delta));

    const status = document.getElementById('status');
    status.innerText = `Loop: Running | Locked: ${this.controls.isLocked}`;

    this.renderer.render(this.scene, this.camera);
  }
}

new Game();
