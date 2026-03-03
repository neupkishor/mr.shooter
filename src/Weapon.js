import * as THREE from 'three';
import { audioManager } from './AudioManager';

export const WEAPON_TYPES = {
    PISTOL: { name: 'Pistol', range: 50, color: 0x333333, size: [0.15, 0.15, 0.6] },
    SNIPER: { name: 'Sniper', range: 150, color: 0x111111, size: [0.1, 0.1, 1.2] },
    SHOTGUN: { name: 'Shotgun', range: 20, color: 0x444444, size: [0.2, 0.2, 0.8] },
    MACHINE_GUN: { name: 'Machine Gun', range: 100, color: 0xff00ff, size: [0.2, 0.2, 1.0] }
};

export class Weapon {
    constructor(camera, scene) {
        this.camera = camera;
        this.scene = scene;
        this.mesh = null;
        this.muzzleFlash = null;
        this.isShooting = false;

        this.currentType = WEAPON_TYPES.PISTOL;
        this.init();
    }

    init() {
        if (this.mesh) this.camera.remove(this.mesh);

        const { size, color } = this.currentType;
        const gunGeometry = new THREE.BoxGeometry(...size);
        const gunMaterial = new THREE.MeshStandardMaterial({ color: color, metalness: 0.8, roughness: 0.2 });
        this.mesh = new THREE.Mesh(gunGeometry, gunMaterial);

        // Fixed Position relative to camera (Classic FPS View)
        this.mesh.position.set(0.15, -0.3, -0.5);
        this.camera.add(this.mesh);

        // Muzzle flash
        const flashGeometry = new THREE.SphereGeometry(0.1, 8, 8);
        const flashMaterial = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
        this.muzzleFlash = new THREE.Mesh(flashGeometry, flashMaterial);
        this.muzzleFlash.position.set(0, 0, -(size[2] / 2 + 0.1));
        this.muzzleFlash.visible = false;
        this.mesh.add(this.muzzleFlash);

        this.flashLight = new THREE.PointLight(0xffaa00, 0, 5);
        this.mesh.add(this.flashLight);
    }

    switchWeapon(type) {
        this.currentType = type;
        this.init();

        const display = document.getElementById('weapon-name');
        if (display) display.innerText = type.name;

        console.log(`Switched to: ${type.name}`);
    }

    shoot() {
        if (this.isShooting) return;
        this.isShooting = true;

        // Play Sound
        if (this.currentType === WEAPON_TYPES.PISTOL) audioManager.playPistol();
        else if (this.currentType === WEAPON_TYPES.SHOTGUN) audioManager.playShotgun();
        else if (this.currentType === WEAPON_TYPES.SNIPER) audioManager.playSniper();

        const originalZ = this.mesh.position.z;
        this.mesh.position.z += 0.05;

        this.muzzleFlash.visible = true;
        this.flashLight.intensity = 2;

        setTimeout(() => {
            this.mesh.position.z = originalZ;
            this.muzzleFlash.visible = false;
            this.flashLight.intensity = 0;
            this.isShooting = false;
        }, 50);
    }

    // No longer moving the hand based on mouse, but we keep the method for small bobbing later
    updateOffset(offset) {
        // Hand is fixed now as per user request
        // We could add very subtle sway if needed
    }
}
