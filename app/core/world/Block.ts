import * as THREE from "three";

/**
 * Block
 *
 * یک بلوک پایه از دنیای Infinitown.
 *
 * فعلاً فقط برای تست معماری World ساخته می‌شود.
 * در مراحل بعد، Block به ساختار واقعی شهر تبدیل خواهد شد.
 */
export class Block {
  public readonly mesh: THREE.Mesh;

  constructor() {
    // هندسه ساده برای تست
    const geometry = new THREE.BoxGeometry(4, 1, 4);

    // متریال ساده
    const material = new THREE.MeshStandardMaterial({
      color: 0x4caf50,
    });

    // ساخت Mesh
    this.mesh = new THREE.Mesh(geometry, material);

    // قرار دادن بلوک روی سطح زمین
    this.mesh.position.set(0, -0.5, 0);

    // نام‌گذاری برای دیباگ
    this.mesh.name = "TestBlock";
  }
}
