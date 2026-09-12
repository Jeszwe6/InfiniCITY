import * as THREE from 'three'

import { Ground } from './Ground'
import { ChunkManager } from './ChunkManager'

/**
 * World
 *
 * مسئول مدیریت دنیای سه‌بعدی بازی است.
 *
 * World فقط اجزای اصلی دنیا را مدیریت می‌کند.
 * مدیریت CityBlockها به ChunkManager سپرده شده است.
 *
 * World سه اطلاعات مهم را از Engine دریافت می‌کند:
 *
 * - موقعیت دوربین
 * - فاصله Zoom دوربین
 * - Delta Time
 *
 * فاصله دوربین برای مدیریت Chunkها استفاده می‌شود
 * و Delta Time برای Animation ساختمان‌ها و سایر
 * سیستم‌های زمان‌محور استفاده خواهد شد.
 */
export class World {
  public readonly group: THREE.Group

  private readonly chunkManager: ChunkManager

  constructor() {
    // -----------------------------
    // گروه اصلی World
    // -----------------------------

    this.group = new THREE.Group()
    this.group.name = 'World'

    // -----------------------------
    // Ground
    // -----------------------------

    const ground = new Ground()

    this.add(ground.mesh)

    // -----------------------------
    // Chunk Manager
    // -----------------------------

    this.chunkManager = new ChunkManager()

    this.add(this.chunkManager.group)
  }

  /**
   * به‌روزرسانی World
   *
   * cameraPosition:
   * موقعیت فعلی دوربین
   *
   * cameraDistance:
   * فاصله فعلی دوربین از مرکز Target.
   *
   * deltaTime:
   * مدت زمان گذشته از فریم قبلی.
   */
  public update(
    cameraPosition: THREE.Vector3,
    cameraDistance: number,
    deltaTime: number
  ): void {
    this.chunkManager.update(
      cameraPosition,
      cameraDistance,
      deltaTime
    )
  }

  /**
   * اضافه کردن آبجکت به World
   */
  public add(
    object: THREE.Object3D
  ): void {
    this.group.add(object)
  }

  /**
   * حذف آبجکت از World
   */
  public remove(
    object: THREE.Object3D
  ): void {
    this.group.remove(object)
  }

  /**
   * پاک کردن تمام آبجکت‌های World
   */
  public clear(): void {
    this.group.clear()
  }

  /**
   * آزاد کردن منابع World
   */
  public dispose(): void {
    this.group.clear()
  }
}