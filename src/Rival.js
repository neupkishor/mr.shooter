import * as THREE from 'three';

export class Rival {
    constructor(scene, id, data) {
        this.scene = scene;
        this.id = id;
        this.health = data.health || 100;
        this.name = data.name;

        this.mesh = null;
        this.init(data.position);
    }

    init(position) {
        // More "Funny" look for rivals
        const geometry = new THREE.CapsuleGeometry(0.5, 1, 4, 8);
        const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 }); // Green for other players
        this.mesh = new THREE.Mesh(geometry, material);

        this.mesh.position.set(position.x, position.y, position.z);
        this.mesh.userData.isRival = true;
        this.mesh.userData.rivalId = this.id;
        this.mesh.userData.parent = this;

        this.scene.add(this.mesh);

        // Name tag
        this.nameTag = this.createNameTag();
        this.mesh.add(this.nameTag);
    }

    createNameTag() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 64;

        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, 256, 64);
        ctx.fillStyle = '#0ff';
        ctx.font = 'bold 32px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(this.name, 128, 45);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.scale.set(2, 0.5, 1);
        sprite.position.y = 1.5;
        return sprite;
    }

    updatePosition(pos, rot) {
        this.mesh.position.lerp(new THREE.Vector3(pos.x, pos.y, pos.z), 0.2);
        this.mesh.rotation.y = rot.y;
    }

    updateHealth(hp) {
        this.health = hp;
        if (hp <= 0) {
            this.mesh.visible = false;
        } else {
            this.mesh.visible = true;
        }
    }

    die() {
        this.mesh.visible = false;
        // Effect?
    }

    respawn(pos) {
        this.mesh.position.set(pos.x, pos.y, pos.z);
        this.mesh.visible = true;
        this.health = 100;
    }

    remove() {
        this.scene.remove(this.mesh);
    }
}
