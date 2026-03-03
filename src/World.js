import * as THREE from 'three';

export class World {
    constructor(scene) {
        this.scene = scene;
        this.targets = [];
        this.collidableObjects = [];
        this.init();
    }

    init() {
        this.createFloor();
        this.createWalls();
        this.createCoverBlocks();
        this.createTargets();
    }

    createCoverBlocks() {
        const material = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.1 });
        for (let i = 0; i < 20; i++) {
            const size = 2 + Math.random() * 4;
            const geo = new THREE.BoxGeometry(size, size * 2, size);
            const mesh = new THREE.Mesh(geo, material);

            mesh.position.set(
                (Math.random() - 0.5) * 70,
                size, // sit on floor
                (Math.random() - 0.5) * 70
            );
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.scene.add(mesh);
            this.collidableObjects.push(mesh);
        }
    }

    createFloor() {
        const floorGeometry = new THREE.PlaneGeometry(100, 100);
        // Use a nicer material for the floor
        const floorMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a1a1a,
            roughness: 0.9,
            metalness: 0.1
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);

        const grid = new THREE.GridHelper(100, 40, 0x333333, 0x222222);
        grid.position.y = 0.01;
        this.scene.add(grid);
    }

    createWalls() {
        const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x222222 });
        const wallHeight = 10;

        const walls = [
            { size: [100, wallHeight, 1], pos: [0, 5, -50] }, // North
            { size: [100, wallHeight, 1], pos: [0, 5, 50] },  // South
            { size: [1, wallHeight, 100], pos: [-50, 5, 0] }, // West
            { size: [1, wallHeight, 100], pos: [50, 5, 0] }   // East
        ];

        walls.forEach(w => {
            const geo = new THREE.BoxGeometry(...w.size);
            const mesh = new THREE.Mesh(geo, wallMaterial);
            mesh.position.set(...w.pos);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.scene.add(mesh);
            this.collidableObjects.push(mesh);
        });
    }

    createTargets() {
        for (let i = 0; i < 15; i++) {
            this.spawnTarget();
        }
    }

    spawnTarget() {
        const box = new THREE.Mesh(
            new THREE.BoxGeometry(2, 2, 2),
            new THREE.MeshStandardMaterial({ color: this.getRandomColor() })
        );
        box.position.x = (Math.random() - 0.5) * 80;
        box.position.z = (Math.random() - 0.5) * 80;
        box.position.y = 1;
        box.castShadow = true;
        box.receiveShadow = true;
        box.userData.isTarget = true;

        this.scene.add(box);
        this.targets.push(box);
        this.collidableObjects.push(box);
    }

    getRandomColor() {
        const colors = [0xff0055, 0x00ffcc, 0xffcc00, 0xaa00ff];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    removeTarget(target) {
        this.scene.remove(target);
        this.targets = this.targets.filter(t => t !== target);
        this.collidableObjects = this.collidableObjects.filter(obj => obj !== target);
        // Respawn after a delay
        setTimeout(() => this.spawnTarget(), 2000);
    }
}
