import * as THREE from 'three';

export class Enemy {
    constructor(scene, player, world) {
        this.scene = scene;
        this.player = player;
        this.world = world;

        this.mesh = null;
        this.isDead = false;
        this.shootTimer = 0;
        this.respawnTimer = 0;
        this.raycaster = new THREE.Raycaster();

        this.init();
    }

    init() {
        // Red enemy character
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
        this.respawnTimer = 10;

        const countdownInterval = setInterval(() => {
            if (this.respawnTimer <= 0) {
                clearInterval(countdownInterval);
                return;
            }
            console.log(`Enemy respawning in ${Math.ceil(this.respawnTimer)}s`);
        }, 1000);
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

        // Move towards player if not too close
        if (distance > 5) {
            const direction = new THREE.Vector3().subVectors(playerPos, this.mesh.position);
            direction.y = 0; // stay on ground
            direction.normalize();
            this.mesh.position.addScaledVector(direction, 4 * delta); // Slow chase speed
        }

        // Face player
        this.mesh.lookAt(playerPos.x, 1.5, playerPos.z);

        // Shooting logic
        this.shootTimer += delta;
        if (this.shootTimer > 2 + Math.random() * 2) {
            this.shoot();
            this.shootTimer = 0;
        }
    }

    shoot() {
        const playerPos = this.player.camera.position;
        const enemyHeadPos = this.mesh.position.clone();
        enemyHeadPos.y = 1.5;

        const direction = new THREE.Vector3().subVectors(playerPos, enemyHeadPos).normalize();
        this.raycaster.set(enemyHeadPos, direction);

        const intersects = this.raycaster.intersectObjects(this.scene.children);
        let canHit = false;
        let blockedDist = Infinity;

        for (const intersect of intersects) {
            // Check if any environment object blocks the shot
            if (this.world.collidableObjects.includes(intersect.object) && intersect.object !== this.mesh) {
                blockedDist = intersect.distance;
                break;
            }
        }

        const distToPlayer = enemyHeadPos.distanceTo(playerPos);
        if (distToPlayer < blockedDist) {
            canHit = true;
            this.player.takeDamage(5);
        }

        // Laser visual
        const laserLen = Math.min(distToPlayer, blockedDist);
        const laserGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, -laserLen)
        ]);
        const laserMat = new THREE.LineBasicMaterial({ color: canHit ? 0xff0000 : 0x550000 });
        const laser = new THREE.Line(laserGeo, laserMat);

        laser.position.copy(enemyHeadPos);
        laser.lookAt(playerPos);
        this.scene.add(laser);

        if (canHit) {
            const hud = document.getElementById('hud');
            hud.style.boxShadow = 'inset 0 0 50px rgba(255, 0, 0, 0.5)';
            setTimeout(() => { if (hud) hud.style.boxShadow = 'none'; }, 100);
        }

        setTimeout(() => this.scene.remove(laser), 100);
    }
}
