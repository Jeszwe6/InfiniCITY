import * as THREE from 'three'

/**
 * Ground
 *
 * مسئول ساخت سطح پایه شهر است.
 *
 * فعلاً یک سطح ساده می‌سازیم.
 * در مراحل بعد این سطح به ساختار Chunkهای
 * شهر Infinitown متصل خواهد شد.
 */
export class Ground {
  public readonly mesh: THREE.Mesh

  constructor() {
    // اندازه زمین پایه
    const size = 100

    // ساخت هندسه زمین
    const geometry = new THREE.PlaneGeometry(
      size,
      size
    )

    // متریال ساده و مات
    const material = new THREE.MeshStandardMaterial({
      color: 0x6b8e23,
      roughness: 1,
    })

    // ساخت Mesh زمین
    this.mesh = new THREE.Mesh(
      geometry,
      material
    )

    // PlaneGeometry به صورت پیش‌فرض عمودی است.
    // آن را افقی می‌کنیم.
    this.mesh.rotation.x = -Math.PI / 2

    // نام برای Debug
    this.mesh.name = 'Ground'
  }
}