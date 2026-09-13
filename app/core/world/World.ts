import * as THREE from "three";

import { Ground } from "./Ground";
import { ChunkManager } from "./ChunkManager";

/**
 * ==========================================
 * World
 * ==========================================
 *
 * مسئول مدیریت دنیای سه‌بعدی بازی است.
 *
 * ساختار:
 *
 * World
 *  ├── Ground
 *  └── ChunkManager
 *       └── CityBlocks
 *
 * World مسئول هماهنگ کردن اجزای اصلی دنیا است،
 * اما مدیریت Chunkها مستقیماً بر عهده ChunkManager است.
 * ==========================================
 */

export class World {
  /**
   * گروه اصلی World
   */
  public readonly group: THREE.Group;

  /**
   * مدیر Chunkها
   */
  private readonly chunkManager: ChunkManager;

  /**
   * زمین اصلی شهر
   *
   * Reference آن را نگه می‌داریم تا هنگام Dispose
   * بتوانیم منابع GPU مربوط به Ground را آزاد کنیم.
   */
  private readonly ground: Ground;

  constructor() {
    // ==========================================
    // World Group
    // ==========================================

    this.group = new THREE.Group();

    this.group.name = "World";

    // ==========================================
    // Ground
    // ==========================================

    this.ground = new Ground();

    // اضافه کردن زمین به World
    this.add(this.ground.mesh);

    // ==========================================
    // Chunk Manager
    // ==========================================

    this.chunkManager = new ChunkManager();

    // اضافه کردن ChunkManager به World
    this.add(this.chunkManager.group);
  }

  /**
   * ==========================================
   * Update
   * ==========================================
   *
   * این متد در هر Frame توسط Engine صدا زده می‌شود.
   *
   * cameraPosition:
   * موقعیت فعلی دوربین
   *
   * cameraDistance:
   * فاصله دوربین از Target
   *
   * deltaTime:
   * زمان گذشته از Frame قبلی
   */
  public update(
    cameraPosition: THREE.Vector3,
    cameraDistance: number,
    deltaTime: number,
  ): void {
    this.chunkManager.update(cameraPosition, cameraDistance, deltaTime);
  }

  /**
   * ==========================================
   * Add
   * ==========================================
   *
   * اضافه کردن Object به World
   */
  public add(object: THREE.Object3D): void {
    this.group.add(object);
  }

  /**
   * ==========================================
   * Remove
   * ==========================================
   *
   * حذف Object از World
   */
  public remove(object: THREE.Object3D): void {
    this.group.remove(object);
  }

  /**
   * ==========================================
   * Clear
   * ==========================================
   *
   * حذف تمام Objectهای داخل World.
   *
   * توجه:
   * این متد منابع GPU را Dispose نمی‌کند.
   * برای آزاد کردن منابع باید dispose() استفاده شود.
   */
  public clear(): void {
    this.group.clear();
  }

  /**
   * ==========================================
   * Dispose
   * ==========================================
   *
   * آزاد کردن منابعی که World مالک آن‌هاست.
   *
   * ترتیب:
   *
   * 1. توقف و پاک‌سازی ChunkManager
   * 2. آزاد کردن Ground
   * 3. پاک کردن Group
   * ==========================================
   */
  public dispose(): void {
    // ------------------------------------------
    // ChunkManager
    // ------------------------------------------

    this.chunkManager.dispose();

    // ------------------------------------------
    // Ground
    // ------------------------------------------

    this.ground.dispose();

    // ------------------------------------------
    // World Group
    // ------------------------------------------

    this.group.clear();
  }
}
