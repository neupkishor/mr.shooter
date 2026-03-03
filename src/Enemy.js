import * as THREE from 'three';
import { audioManager } from './AudioManager';

export class Enemy {
    constructor(scene, player, world, level = 1) {
        this.scene = scene;
        this.player = player;
        this.world = world;
        this.level = level;

        this.mesh = null;
        this.isDead = false;
        this.shootTimer = 0;
        this.respawnTimer = 0;
        this.raycaster = new THREE.Raycaster();

        // Level Scaling
        this.baseShootInterval = Math.max(0.5, 3.0 - (this.level * 0.1));
        this.baseRespawnTime = Math.max(3, 10 - (this.level * 0.35));
        this.accuracy = Math.min(1.0, 0.7 + (this.level * 0.015));
        this.maxRange = 40 + (this.level * 0.5); // Enemies can only shoot within this distance

        this.init();
    }

    init() {
        const geometry = new THREE.CapsuleGeometry(0.5, 1, 4, 8);
        const material = new THREE.MeshStandardMaterial({ color: 0xff3333 });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.userData.isEnemy = true;
        this.mesh.userData.parent = this;

        this.spawn();
    }

    spawn() {
        this.isDead = false;
        const radius = 30 + Math.random() * 20;
        const angle = Math.random() * Math.PI * 2;
        this.mesh.position.set(
            Math.cos(angle) * radius,
            1.5,
            Math.sin(angle) * radius
        );
        this.scene.add(this.mesh);
        if (!this.world.collidableObjects.includes(this.mesh)) {
            this.world.collidableObjects.push(this.mesh);
        }
    }

    die() {
        this.isDead = true;
        this.scene.remove(this.mesh);
        this.world.collidableObjects = this.world.collidableObjects.filter(obj => obj !== this.mesh);
        this.respawnTimer = this.baseRespawnTime;
    }

    update(delta) {
        if (this.isDead) {
            this.respawnTimer -= delta;
            if (this.respawnTimer <= 0) {
                this.spawn();
            }
            return;
        }

        const playerPos = this.player.camera.position;
        const distance = this.mesh.position.distanceTo(playerPos);

        if (distance > 5) {
            const direction = new THREE.Vector3().subVectors(playerPos, this.mesh.position);
            direction.y = 0;
            direction.normalize();
            this.mesh.position.addScaledVector(direction, (4 + (this.level * 0.2)) * delta);
        }

        this.mesh.lookAt(playerPos.x, 1.5, playerPos.z);

        this.shootTimer += delta;
        if (this.shootTimer > this.baseShootInterval + (Math.random() * 1.0)) {
            this.shoot();
            this.shootTimer = 0;
        }
    }

    shoot() {
        audioManager.playEnemyShot();
        const playerPos = this.player.camera.position;
        const enemyHeadPos = this.mesh.position.clone();
        enemyHeadPos.y = 1.5;

        // Accuracy Check: Does the enemy aim correctly?
        const misAimOffset = (1.0 - this.accuracy) * 2.0;
        const targetPoint = playerPos.clone();
        if (Math.random() > this.accuracy) {
            // Apply slight random offset to miss the player
            targetPoint.x += (Math.random() - 0.5) * misAimOffset;
            targetPoint.y += (Math.random() - 0.5) * misAimOffset;
            targetPoint.z += (Math.random() - 0.5) * misAimOffset;
        }

        const direction = new THREE.Vector3().subVectors(targetPoint, enemyHeadPos).normalize();
        this.raycaster.set(enemyHeadPos, direction);

        const intersects = this.raycaster.intersectObjects(this.scene.children);
        let canHit = false;
        let blockedDist = Infinity;

        for (const intersect of intersects) {
            if (this.world.collidableObjects.includes(intersect.object) && intersect.object !== this.mesh) {
                blockedDist = intersect.distance;
                break;
            }
        }

        // Check if we hit the player (or would have if targetPoint was perfect)
        const distToRealPlayer = enemyHeadPos.distanceTo(playerPos);
        const distToTargetPoint = enemyHeadPos.distanceTo(targetPoint);

        // If the shot is clear AND targetPoint hit player AND within max shooting range
        if (distToTargetPoint < blockedDist && targetPoint.distanceTo(playerPos) < 1.0 && distToRealPlayer < this.maxRange) {
            canHit = true;
            this.player.takeDamage(5);
        }

        // Laser visual length limited by maxRange and obstacles
        const laserLen = Math.min(distToTargetPoint, blockedDist);
        const laserGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, -laserLen)
        ]);
        const laserMat = new THREE.LineBasicMaterial({ color: canHit ? 0xff0000 : 0x550000 });
        const laser = new THREE.Line(laserGeo, laserMat);

        laser.position.copy(enemyHeadPos);
        laser.lookAt(targetPoint);
        this.scene.add(laser);

        if (canHit) {
            const hud = document.getElementById('hud');
            if (hud) {
                hud.style.boxShadow = 'inset 0 0 50px rgba(255, 0, 0, 0.5)';
                setTimeout(() => { if (hud) hud.style.boxShadow = 'none'; }, 100);
            }
        }

        setTimeout(() => this.scene.remove(laser), 100);
    }
}
