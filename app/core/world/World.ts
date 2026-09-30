import * as THREE from "three";

import { Ground } from "./Ground";
import { ChunkManager } from "./ChunkManager";

/**
 * ==========================================
 * World
 * ==========================================
 *
 * World ریشه سیستم‌های اصلی محیط شهر است.
 *
 * مسئولیت‌های World:
 *
 * - Ground
 * - ChunkManager
 *
 * Traffic / CarManager در Engine مدیریت می‌شود
 * تا فقط یک CarManager در پروژه وجود داشته باشد.
 */
export class World {
  /**
   * ==========================================
   * Group اصلی World
   * ==========================================
   *
   * تمام اجزای محیط شهر زیر این Group قرار
   * می‌گیرند.
   */
  public readonly group: THREE.Group;

  /**
   * ==========================================
   * ChunkManager
   * ==========================================
   *
   * مدیریت Chunkهای فعال شهر.
   */
  private readonly chunkManager: ChunkManager;

  /**
   * ==========================================
   * Ground
   * ==========================================
   *
   * زمین اصلی شهر.
   */
  private readonly ground: Ground;

  /**
   * ==========================================
   * Constructor
   * ==========================================
   */
  constructor() {
    /**
     * ==========================================
     * World Group
     * ==========================================
     *
     * Group اصلی World ساخته می‌شود.
     */
    this.group = new THREE.Group();
    this.group.name = "World";

    /**
     * ==========================================
     * Ground
     * ==========================================
     *
     * Ground ابتدا ساخته شده و سپس به World
     * اضافه می‌شود.
     */
    this.ground = new Ground();

    this.add(this.ground.mesh);

    /**
     * ==========================================
     * ChunkManager
     * ==========================================
     *
     * ساخت و مدیریت Chunkهای شهر توسط
     * ChunkManager انجام می‌شود.
     */
    this.chunkManager = new ChunkManager();

    this.add(this.chunkManager.group);
  }

  /**
   * ==========================================
   * Update
   * ==========================================
   *
   * World در هر Frame به‌روزرسانی می‌شود.
   *
   * Traffic در اینجا Update نمی‌شود.
   * CarManager اصلی توسط Engine مدیریت می‌شود.
   */
  public update(
    cameraPosition: THREE.Vector3,
    cameraDistance: number,
    deltaTime: number,
  ): void {
    /**
     * ==========================================
     * Update ChunkManager
     * ==========================================
     *
     * ChunkManager بر اساس موقعیت و فاصله
     * Camera تصمیم می‌گیرد چه بخش‌هایی از
     * شهر باید ساخته یا فعال باشند.
     */
    this.chunkManager.update(
      cameraPosition,
      cameraDistance,
      deltaTime,
    );
  }

  /**
   * ==========================================
   * Add
   * ==========================================
   *
   * اضافه کردن یک Object به World.
   */
  public add(object: THREE.Object3D): void {
    this.group.add(object);
  }

  /**
   * ==========================================
   * Remove
   * ==========================================
   *
   * حذف یک Object از World.
   */
  public remove(object: THREE.Object3D): void {
    this.group.remove(object);
  }

  /**
   * ==========================================
   * Clear
   * ==========================================
   *
   * حذف Objectهای مستقیم داخل World.
   *
   * توجه:
   * این متد نباید برای مدیریت چرخه عمر
   * Ground یا ChunkManager استفاده شود.
   *
   * برای آزاد کردن کامل منابع World،
   * از dispose() استفاده می‌کنیم.
   */
  public clear(): void {
    /**
     * فقط Objectهای مستقیم را از Group جدا می‌کنیم.
     *
     * این متد عمداً منابع داخلی را dispose نمی‌کند.
     */
    this.group.clear();
  }

  /**
   * ==========================================
   * Dispose
   * ==========================================
   *
   * آزاد کردن منابع World.
   */
  public dispose(): void {
    /**
     * ==========================================
     * Dispose ChunkManager
     * ==========================================
     */
    this.chunkManager.dispose();

    /**
     * ==========================================
     * Dispose Ground
     * ==========================================
     */
    this.ground.dispose();

    /**
     * ==========================================
     * Clear World Group
     * ==========================================
     *
     * بعد از آزاد کردن منابع، Objectهای
     * باقی‌مانده از Group جدا می‌شوند.
     */
    this.group.clear();
  }
}