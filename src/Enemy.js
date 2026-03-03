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
        this.mesh.position.set(
            (Math.random() - 0.5) * 80,
            1,
            (Math.random() - 0.5) * 80
        );
        this.scene.add(this.mesh);
    }

    die() {
        this.isDead = true;
        this.scene.remove(this.mesh);
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

        // Face player
        this.mesh.lookAt(this.player.camera.position.x, 1, this.player.camera.position.z);

        // Simple shooting logic
        this.shootTimer += delta;
        if (this.shootTimer > 3) { // Shoot every 3 seconds
            this.shoot();
            this.shootTimer = 0;
        }
    }

    shoot() {
        // Simple visual bullet or effect
        console.log("Enemy shoots at player!");
        // We could implement player health here later
    }
}
