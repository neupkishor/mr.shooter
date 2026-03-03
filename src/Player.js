import * as THREE from 'three';
import { Weapon, WEAPON_TYPES } from './Weapon';

export class Player {
    constructor(camera, controls, scene, world) {
        this.camera = camera;
        this.controls = controls;
        this.scene = scene;
        this.world = world;

        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();

        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.canJump = false;
        this.ammo = 30;

        this.weapon = new Weapon(this.camera, this.scene);
        this.raycaster = new THREE.Raycaster();

        this.setupControls();
    }

    setupControls() {
        const onKeyDown = (event) => {
            switch (event.code) {
                case 'KeyW': this.moveForward = true; break;
                case 'KeyS': this.moveBackward = true; break;
                case 'KeyA': this.rotateLeft = true; break;
                case 'KeyD': this.rotateRight = true; break;
                case 'Space': if (this.canJump === true) this.velocity.y += 25; this.canJump = false; break;
                case 'Digit1': this.weapon.switchWeapon(WEAPON_TYPES.PISTOL); break;
                case 'Digit2': this.weapon.switchWeapon(WEAPON_TYPES.SHOTGUN); break;
                case 'Digit3': this.weapon.switchWeapon(WEAPON_TYPES.SNIPER); break;
            }
        };

        const onKeyUp = (event) => {
            switch (event.code) {
                case 'KeyW': this.moveForward = false; break;
                case 'KeyS': this.moveBackward = false; break;
                case 'KeyA': this.rotateLeft = false; break;
                case 'KeyD': this.rotateRight = false; break;
            }
        };

        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);

        // Fixed hand: Crosshair stays in center
        this.mouseOffset = new THREE.Vector2(0, 0);
        const crosshair = document.getElementById('crosshair');
        if (crosshair) {
            crosshair.style.transform = 'translate(0, 0)';
        }

        document.addEventListener('mousedown', () => {
            if (this.controls.isLocked) {
                this.shoot();
            }
        });
    }

    shoot() {
        if (this.ammo <= 0) return;

        this.weapon.shoot();
        this.ammo--;
        document.getElementById('ammo').innerText = this.ammo;

        // Shoot towards center with range limit
        this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
        this.raycaster.far = this.weapon.currentType.range;

        const intersects = this.raycaster.intersectObjects(this.scene.children);

        for (let i = 0; i < intersects.length; i++) {
            const obj = intersects[i].object;
            if (obj.userData.isTarget) {
                this.onHit(obj);
                break;
            }
            if (obj.userData.isEnemy) {
                obj.userData.parent.die();
                const scoreElement = document.getElementById('score');
                scoreElement.innerText = parseInt(scoreElement.innerText) + 50;
                break;
            }
        }
    }

    onHit(target) {
        target.material.color.setHex(0xff0000);
        setTimeout(() => {
            this.world.removeTarget(target);
            const scoreElement = document.getElementById('score');
            scoreElement.innerText = parseInt(scoreElement.innerText) + 10;

            // Refill ammo on hit maybe?
            this.ammo = Math.min(this.ammo + 5, 30);
            document.getElementById('ammo').innerText = this.ammo;
        }, 100);
    }

    update(delta) {
        delta = Math.min(delta, 0.1);
        if (delta === 0) delta = 0.016;

        if (!this.controls.isLocked) return;

        // Rotation (A/D) - Fixed direction
        const rotationSpeed = 2.5;
        if (this.rotateLeft) this.camera.rotation.y -= rotationSpeed * delta;
        if (this.rotateRight) this.camera.rotation.y += rotationSpeed * delta;

        // Forward/Backward movement (W/S)
        this.velocity.z -= this.velocity.z * 10.0 * delta;
        this.velocity.y -= 9.8 * 60.0 * delta;

        const moveSpeed = 600.0;
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        forward.y = 0;
        forward.normalize();

        if (this.moveForward) this.velocity.z += moveSpeed * delta;
        if (this.moveBackward) this.velocity.z -= moveSpeed * delta;

        // Apply movement
        this.camera.position.addScaledVector(forward, this.velocity.z * delta);
        this.camera.position.y += (this.velocity.y * delta);

        if (this.camera.position.y < 2) {
            this.velocity.y = 0;
            this.camera.position.y = 2;
            this.canJump = true;
        }

        // Boundary check
        const pos = this.camera.position;
        const boundary = 48;
        if (pos.x > boundary) pos.x = boundary;
        if (pos.x < -boundary) pos.x = -boundary;
        if (pos.z > boundary) pos.z = boundary;
        if (pos.z < -boundary) pos.z = -boundary;
    }
}
