import * as THREE from "three";

import { CityBlock } from "./CityBlock";

import type { ZoneType } from "./CityBlock";

import { BuildingFactory } from "./BuildingFactory";

/**
 * ==========================================
 * Shared Building Factory
 * ==========================================
 *
 * یک BuildingFactory مشترک برای تمام Chunkها.
 *
 * مدل‌های GLB فقط یک بار Load می‌شوند و بین
 * تمام CityBlockها به اشتراک گذاشته می‌شوند.
 */
const sharedBuildingFactory = new BuildingFactory();

/**
 * ==========================================
 * ChunkManager
 * ==========================================
 *
 * مسئول مدیریت Chunkهای شهر است.
 *
 * این نسخه بر پایه همان سیستم قبلی است
 * و CameraController را دستکاری نمی‌کند.
 *
 * تفاوت اصلی:
 *
 * - محدوده دید نزدیک بزرگ‌تر شده است.
 * - Chunkهای بیشتری از قبل آماده هستند.
 * - تغییر Zoom باعث حذف سریع Chunkها نمی‌شود.
 * - Pool قبلی حفظ شده است.
 * - CityBlock فقط یک بار ساخته می‌شود و بعد
 *   در صورت نیاز دوباره استفاده می‌شود.
 *
 * هدف:
 *
 * ساختمان‌ها جلوتر از دوربین هم وجود داشته باشند
 * تا وقتی دوربین حرکت می‌کند، شهر از دور قابل
 * مشاهده باشد و ناگهان جلوی دوربین ساخته نشود.
 */
export class ChunkManager {
  /**
   * Group اصلی Chunkها
   */
  public readonly group: THREE.Group;

  // ==========================================
  // View Distance
  // ==========================================

  /**
   * وقتی دوربین نزدیک است:
   *
   * 2 خانه در هر طرف
   *
   * یعنی:
   *
   * 5 × 5 = 25 Chunk
   *
   * این مقدار نسبت به نسخه قبلی بیشتر است
   * تا شهر جلوتر از دوربین نیز وجود داشته باشد.
   */
  private readonly nearViewDistance = 2;

  /**
   * وقتی دوربین کمی دورتر است:
   *
   * 7 × 7 = 49 Chunk
   */
  private readonly mediumViewDistance = 3;

  /**
   * حداکثر محدوده دید.
   *
   * عمداً زیادتر از 3 نمی‌کنیم تا تعداد
   * ساختمان‌ها برای موبایل‌های ضعیف بیش از
   * حد لازم نشود.
   */
  private readonly farViewDistance = 3;

  // ==========================================
  // Distance Thresholds
  // ==========================================

  /**
   * فاصله دوربین برای افزایش محدوده دید.
   *
   * این Thresholdها فقط زمانی استفاده می‌شوند
   * که واقعاً لازم باشد.
   */
  private readonly mediumDistance = 55;

  private readonly farDistance = 100;

  // ==========================================
  // Active Chunks
  // ==========================================

  /**
   * Chunkهایی که در حال حاضر در World هستند.
   */
  private readonly activeChunks =
    new Map<string, CityBlock>();

  // ==========================================
  // Chunk Pool
  // ==========================================

  /**
   * Chunkهای کاملاً ساخته‌شده که می‌توانند
   * دوباره مورد استفاده قرار بگیرند.
   */
  private readonly chunkPool: Record<
    ZoneType,
    CityBlock[]
  > = {
    residential: [],
    commercial: [],
    industrial: [],
  };

  // ==========================================
  // Chunks Being Prepared
  // ==========================================

  /**
   * Chunkهایی که هنوز در حال آماده شدن هستند.
   *
   * تا وقتی کامل آماده نشده‌اند وارد World
   * نمی‌شوند.
   */
  private readonly preparingChunks =
    new Map<string, Promise<CityBlock>>();

  // ==========================================
  // Camera State
  // ==========================================

  private currentChunkX: number | null = null;

  private currentChunkZ: number | null = null;

  private currentViewDistance: number | null = null;

  // ==========================================
  // Constructor
  // ==========================================

  constructor() {
    this.group = new THREE.Group();

    this.group.name = "ChunkManager";

    /**
     * ابتدا مدل‌های GLB را preload می‌کنیم.
     *
     * این کار باعث می‌شود هنگام ساخت Chunkها
     * مدل‌ها دوباره از ابتدا دانلود نشوند.
     */
    void this.preloadBuildings();
  }

  // ==========================================
  // Preload Buildings
  // ==========================================

  private async preloadBuildings(): Promise<void> {
    try {
      await sharedBuildingFactory.preloadAll();
    } catch (error) {
      console.warn(
        "[ChunkManager] Building preload failed:",
        error,
      );
    }
  }

  // ==========================================
  // Chunk Key
  // ==========================================

  private getChunkKey(
    chunkX: number,
    chunkZ: number,
  ): string {
    return `${chunkX},${chunkZ}`;
  }

  // ==========================================
  // View Distance
  // ==========================================

  private getViewDistance(
    cameraDistance: number,
  ): number {
    /**
     * دوربین نزدیک:
     *
     * همیشه حداقل 25 Chunk داریم.
     *
     * این مهم‌ترین تغییر این نسخه است.
     */
    if (
      cameraDistance <
      this.mediumDistance
    ) {
      return this.nearViewDistance;
    }

    /**
     * دوربین در فاصله متوسط:
     *
     * 49 Chunk
     */
    if (
      cameraDistance <
      this.farDistance
    ) {
      return this.mediumViewDistance;
    }

    /**
     * حداکثر:
     *
     * 49 Chunk
     */
    return this.farViewDistance;
  }

  // ==========================================
  // Zone Type
  // ==========================================

  /**
   * تقسیم‌بندی فعلی شهر:
   *
   * Z < 0
   * → Residential
   *
   * Z = 0
   * → Commercial
   *
   * Z > 0
   * → Industrial
   */
  private getZoneType(
    chunkZ: number,
  ): ZoneType {
    if (chunkZ < 0) {
      return "residential";
    }

    if (chunkZ === 0) {
      return "commercial";
    }

    return "industrial";
  }

  // ==========================================
  // World → Chunk
  // ==========================================

  public getChunkPosition(
    worldX: number,
    worldZ: number,
  ): {
    x: number;
    z: number;
  } {
    return {
      x: Math.floor(
        worldX /
          CityBlock.WIDTH,
      ),

      z: Math.floor(
        worldZ /
          CityBlock.DEPTH,
      ),
    };
  }

  // ==========================================
  // Update
  // ==========================================

  public update(
    cameraPosition: THREE.Vector3,
    cameraDistance: number = 5,
    deltaTime: number = 0,
  ): void {
    /**
     * ----------------------------------------
     * Update Animation
     * ----------------------------------------
     */
    this.updateAnimations(
      deltaTime,
    );

    /**
     * ----------------------------------------
     * Camera Chunk
     * ----------------------------------------
     */
    const chunkPosition =
      this.getChunkPosition(
        cameraPosition.x,
        cameraPosition.z,
      );

    /**
     * ----------------------------------------
     * View Distance
     * ----------------------------------------
     */
    const viewDistance =
      this.getViewDistance(
        cameraDistance,
      );

    /**
     * ----------------------------------------
     * بررسی تغییر
     * ----------------------------------------
     */
    const sameChunk =
      this.currentChunkX ===
        chunkPosition.x &&
      this.currentChunkZ ===
        chunkPosition.z;

    const sameViewDistance =
      this.currentViewDistance ===
      viewDistance;

    /**
     * اگر Chunk و محدوده دید تغییری نکرده‌اند،
     * هیچ عملیات Chunk انجام نمی‌دهیم.
     */
    if (
      sameChunk &&
      sameViewDistance
    ) {
      return;
    }

    /**
     * ----------------------------------------
     * ذخیره State
     * ----------------------------------------
     */
    this.currentChunkX =
      chunkPosition.x;

    this.currentChunkZ =
      chunkPosition.z;

    this.currentViewDistance =
      viewDistance;

    /**
     * ----------------------------------------
     * بروزرسانی Grid
     * ----------------------------------------
     */
    this.updateChunks(
      chunkPosition.x,
      chunkPosition.z,
      viewDistance,
    );
  }

  // ==========================================
  // Update Animations
  // ==========================================

  private updateAnimations(
    deltaTime: number,
  ): void {
    if (deltaTime <= 0) {
      return;
    }

    for (
      const block of
      this.activeChunks.values()
    ) {
      block.update(
        deltaTime,
      );
    }
  }

  // ==========================================
  // Update Chunks
  // ==========================================

  private updateChunks(
    centerX: number,
    centerZ: number,
    viewDistance: number,
  ): void {
    /**
     * ----------------------------------------
     * اول Chunkهای دور را حذف می‌کنیم.
     * ----------------------------------------
     *
     * فقط Chunkهایی که واقعاً از محدوده
     * خارج شده‌اند حذف می‌شوند.
     */
    this.removeDistantChunks(
      centerX,
      centerZ,
      viewDistance,
    );

    /**
     * ----------------------------------------
     * سپس Chunkهای موردنیاز را آماده می‌کنیم.
     * ----------------------------------------
     */
    for (
      let x =
        centerX -
        viewDistance;

      x <=
        centerX +
        viewDistance;

      x++
    ) {
      for (
        let z =
          centerZ -
          viewDistance;

        z <=
          centerZ +
          viewDistance;

        z++
      ) {
        this.createOrPrepareBlock(
          x,
          z,
        );
      }
    }
  }

  // ==========================================
  // Create / Prepare Block
  // ==========================================

  private createOrPrepareBlock(
    chunkX: number,
    chunkZ: number,
  ): void {
    const key =
      this.getChunkKey(
        chunkX,
        chunkZ,
      );

    /**
     * اگر فعال است، هیچ کاری نکن.
     */
    if (
      this.activeChunks.has(key)
    ) {
      return;
    }

    /**
     * اگر قبلاً در حال آماده شدن است،
     * دوباره نساز.
     */
    if (
      this.preparingChunks.has(key)
    ) {
      return;
    }

    /**
     * Zone
     */
    const zoneType =
      this.getZoneType(
        chunkZ,
      );

    /**
     * ----------------------------------------
     * استفاده از Pool
     * ----------------------------------------
     */
    const pool =
      this.chunkPool[
        zoneType
      ];

    const pooledBlock =
      pool.pop();

    if (pooledBlock) {
      /**
       * این Block قبلاً کاملاً آماده شده،
       * بنابراین مستقیماً استفاده می‌شود.
       */
      this.activateBlock(
        key,
        chunkX,
        chunkZ,
        pooledBlock,
      );

      return;
    }

    /**
     * ----------------------------------------
     * ساخت CityBlock جدید
     * ----------------------------------------
     */
    const promise =
      this.prepareNewBlock(
        zoneType,
      );

    this.preparingChunks.set(
      key,
      promise,
    );

    /**
     * ----------------------------------------
     * انتظار برای آماده شدن
     * ----------------------------------------
     */
    void promise
      .then((block) => {
        /**
         * بررسی می‌کنیم که هنوز Chunk
         * در محدوده دید باشد.
         */
        const stillNeeded =
          this.isChunkInsideCurrentView(
            chunkX,
            chunkZ,
          );

        if (!stillNeeded) {
          block.group.visible = false;

          this.chunkPool[
            zoneType
          ].push(block);

          return;
        }

        /**
         * حالا که Block کاملاً آماده است،
         * وارد World می‌شود.
         */
        this.activateBlock(
          key,
          chunkX,
          chunkZ,
          block,
        );
      })
      .catch((error) => {
        console.warn(
          `[ChunkManager] Failed to prepare chunk ${key}:`,
          error,
        );
      })
      .finally(() => {
        this.preparingChunks.delete(
          key,
        );
      });
  }

  // ==========================================
  // Prepare New Block
  // ==========================================

  private async prepareNewBlock(
    zoneType: ZoneType,
  ): Promise<CityBlock> {
    const block =
      new CityBlock(
        zoneType,
      );

    /**
     * منتظر می‌مانیم تمام Plotها،
     * ساختمان‌ها و Decorationها آماده شوند.
     */
    await block.waitUntilReady();

    return block;
  }

  // ==========================================
  // Activate Block
  // ==========================================

  private activateBlock(
    key: string,
    chunkX: number,
    chunkZ: number,
    block: CityBlock,
  ): void {
    /**
     * اگر در این فاصله Chunk دیگری با
     * همین Key فعال شده باشد، کاری نکن.
     */
    if (
      this.activeChunks.has(key)
    ) {
      return;
    }

    /**
     * Reset
     */
    block.resetForReuse();

    /**
     * Position
     */
    block.group.position.set(
      chunkX *
        CityBlock.WIDTH,

      0,

      chunkZ *
        CityBlock.DEPTH,
    );

    /**
     * Visible
     */
    block.group.visible = true;

    /**
     * Debug Name
     */
    block.group.name =
      `CityBlock_${block.getZoneType()}_${chunkX}_${chunkZ}`;

    /**
     * Scene
     */
    this.group.add(
      block.group,
    );

    /**
     * Active
     */
    this.activeChunks.set(
      key,
      block,
    );
  }

  // ==========================================
  // Is Chunk Needed?
  // ==========================================

  private isChunkInsideCurrentView(
    chunkX: number,
    chunkZ: number,
  ): boolean {
    /**
     * اگر State هنوز مشخص نشده،
     * Chunk را لازم فرض می‌کنیم.
     */
    if (
      this.currentChunkX === null ||
      this.currentChunkZ === null ||
      this.currentViewDistance === null
    ) {
      return true;
    }

    const distanceX =
      Math.abs(
        chunkX -
          this.currentChunkX,
      );

    const distanceZ =
      Math.abs(
        chunkZ -
          this.currentChunkZ,
      );

    return (
      distanceX <=
        this.currentViewDistance &&
      distanceZ <=
        this.currentViewDistance
    );
  }

  // ==========================================
  // Remove Distant Chunks
  // ==========================================

  private removeDistantChunks(
    centerX: number,
    centerZ: number,
    viewDistance: number,
  ): void {
    for (
      const [key, block] of
      this.activeChunks
    ) {
      const chunkX =
        this.getChunkXFromKey(
          key,
        );

      const chunkZ =
        this.getChunkZFromKey(
          key,
        );

      const distanceX =
        Math.abs(
          chunkX -
            centerX,
        );

      const distanceZ =
        Math.abs(
          chunkZ -
            centerZ,
        );

      /**
       * فقط اگر واقعاً از محدوده خارج شده
       * باشد، آن را Pool می‌کنیم.
       */
      if (
        distanceX >
          viewDistance ||
        distanceZ >
          viewDistance
      ) {
        this.removeBlock(
          key,
          block,
        );
      }
    }
  }

  // ==========================================
  // Get X From Key
  // ==========================================

  private getChunkXFromKey(
    key: string,
  ): number {
    return Number(
      key.split(",")[0],
    );
  }

  // ==========================================
  // Get Z From Key
  // ==========================================

  private getChunkZFromKey(
    key: string,
  ): number {
    return Number(
      key.split(",")[1],
    );
  }

  // ==========================================
  // Remove / Pool
  // ==========================================

  private removeBlock(
    key: string,
    block: CityBlock,
  ): void {
    /**
     * حذف از Scene
     */
    this.group.remove(
      block.group,
    );

    /**
     * مخفی کردن
     */
    block.group.visible = false;

    /**
     * حذف از Active
     */
    this.activeChunks.delete(
      key,
    );

    /**
     * قرار دادن در Pool مناسب
     */
    const zoneType =
      block.getZoneType();

    this.chunkPool[
      zoneType
    ].push(block);
  }

  // ==========================================
  // Active Count
  // ==========================================

  public getActiveChunkCount(): number {
    return this.activeChunks.size;
  }

  // ==========================================
  // Pooled Count
  // ==========================================

  public getPooledChunkCount(): number {
    return (
      this.chunkPool.residential.length +
      this.chunkPool.commercial.length +
      this.chunkPool.industrial.length
    );
  }

  // ==========================================
  // Preparing Count
  // ==========================================

  public getPreparingChunkCount(): number {
    return this.preparingChunks.size;
  }

  // ==========================================
  // Dispose
  // ==========================================

  public dispose(): void {
    /**
     * ----------------------------------------
     * Active
     * ----------------------------------------
     */
    for (
      const block of
      this.activeChunks.values()
    ) {
      this.group.remove(
        block.group,
      );
    }

    this.activeChunks.clear();

    /**
     * ----------------------------------------
     * Pool
     * ----------------------------------------
     */
    this.chunkPool.residential.length = 0;

    this.chunkPool.commercial.length = 0;

    this.chunkPool.industrial.length = 0;

    /**
     * ----------------------------------------
     * Preparing
     * ----------------------------------------
     */
    this.preparingChunks.clear();

    /**
     * ----------------------------------------
     * Group
     * ----------------------------------------
     */
    this.group.clear();

    /**
     * ----------------------------------------
     * Camera State
     * ----------------------------------------
     */
    this.currentChunkX = null;

    this.currentChunkZ = null;

    this.currentViewDistance = null;
  }
}