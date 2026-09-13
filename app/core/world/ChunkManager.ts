import * as THREE from "three";

import { CityBlock } from "./CityBlock";

import type { BuildingType } from "./BuildingFactory";

/**
 * ==========================================
 * ZoneType
 * ==========================================
 *
 * نوع ناحیه‌ای که ChunkManager برای انتخاب
 * نوع CityBlock استفاده می‌کند.
 *
 * توجه:
 * CityBlock مستقیماً ZoneType دریافت نمی‌کند.
 *
 * residential -> suburban
 * commercial -> commercial
 * industrial -> industrial
 * ==========================================
 */
type ZoneType = "residential" | "commercial" | "industrial";

/**
 * ==========================================
 * ChunkManager
 * ==========================================
 *
 * مسئول مدیریت CityBlockهای اطراف دوربین است.
 *
 * نکات مهم معماری:
 *
 * - ChunkManager خودش Camera را مالک نیست.
 * - موقعیت دوربین از World دریافت می‌شود.
 * - Chunkها به‌صورت async ساخته می‌شوند.
 * - تعداد activation در هر update محدود است.
 * - Chunkهای خارج از محدوده به Pool برمی‌گردند.
 *
 * برای نزدیک شدن به رفتار Infinitown:
 *
 * - Chunk نزدیک دوربین اول ساخته می‌شود.
 * - سپس Chunkهای اطراف ساخته می‌شوند.
 * - ساخت Chunkها به صورت تدریجی انجام می‌شود.
 *
 * این ساختار برای Performance روی دستگاه‌های
 * ضعیف‌تر نیز مناسب‌تر است.
 * ==========================================
 */
export class ChunkManager {
  // ------------------------------------------------------------
  // تنظیمات اصلی
  // ------------------------------------------------------------

  /**
   * اندازه هر CityBlock.
   *
   * CityBlock فعلی:
   *
   * 32 × 32
   */
  private static readonly CHUNK_SIZE = 32;

  /**
   * تعداد Chunk فعال در هر طرف دوربین.
   *
   * مقدار 2 یعنی:
   *
   * 5 × 5 = حداکثر 25 Chunk
   */
  private static readonly VIEW_DISTANCE = 2;

  /**
   * حداکثر تعداد Chunkهایی که هم‌زمان
   * در حال آماده‌سازی هستند.
   *
   * برای جلوگیری از فشار زیاد روی CPU/GPU
   * مخصوصاً روی موبایل‌ها.
   */
  private static readonly MAX_PREPARING_CHUNKS = 2;

  /**
   * حداکثر تعداد Chunkهایی که در یک update
   * وارد Scene می‌شوند.
   */
  private static readonly MAX_ACTIVATIONS_PER_UPDATE = 2;

  /**
   * گروه اصلی ChunkManager.
   */
  public readonly group: THREE.Group;

  /**
   * Chunkهای فعال.
   *
   * key:
   * x:z
   */
  private readonly activeChunks = new Map<string, CityBlock>();

  /**
   * Chunkهایی که در حال ساخته شدن هستند.
   */
  private readonly preparingChunks = new Map<string, Promise<CityBlock>>();

  /**
   * Chunkهای آماده‌شده که هنوز وارد Scene نشده‌اند.
   */
  private readonly pendingChunks: CityBlock[] = [];

  /**
   * Pool برای استفاده مجدد از CityBlockها.
   *
   * این کار allocation و GC را کاهش می‌دهد.
   */
  private readonly chunkPool: Record<ZoneType, CityBlock[]> = {
    residential: [],
    commercial: [],
    industrial: [],
  };

  /**
   * مختصات آخرین Chunk دوربین.
   */
  private currentChunkX = Number.NaN;
  private currentChunkZ = Number.NaN;

  /**
   * آیا اولین update انجام شده است؟
   */
  private initialized = false;

  /**
   * جلوگیری از اجرای عملیات بعد از dispose.
   */
  private disposed = false;

  /**
   * آمار ساخت Chunk.
   */
  private createdCount = 0;

  /**
   * آمار استفاده مجدد از Pool.
   */
  private reusedCount = 0;

  // ------------------------------------------------------------
  // Constructor
  // ------------------------------------------------------------

  constructor() {
    this.group = new THREE.Group();

    this.group.name = "ChunkManager";

    this.group.userData.isChunkManager = true;
  }

  // ------------------------------------------------------------
  // Initialize
  // ------------------------------------------------------------

  /**
   * آماده‌سازی اولیه.
   *
   * موقعیت دوربین در World.update() دریافت می‌شود،
   * بنابراین initialize به Camera نیاز ندارد.
   */
  public async initialize(cameraPosition?: THREE.Vector3): Promise<void> {
    if (this.disposed) {
      return;
    }

    if (cameraPosition) {
      this.update(cameraPosition, 0, 0);
    }

    await this.processPendingChunks();
  }

  // ------------------------------------------------------------
  // Update
  // ------------------------------------------------------------

  /**
   * به‌روزرسانی Chunkها.
   *
   * امضای متد عمداً با World.update()
   * هماهنگ شده است.
   */
  public update(
    cameraPosition: THREE.Vector3,
    _cameraDistance: number,
    _deltaTime: number,
  ): void {
    if (this.disposed) {
      return;
    }

    /**
     * جلوگیری از خطا در صورت ارسال position نامعتبر.
     */
    if (!cameraPosition) {
      return;
    }

    const chunkX = this.worldToChunk(cameraPosition.x);

    const chunkZ = this.worldToChunk(cameraPosition.z);

    /**
     * اولین update همیشه باید محدوده اولیه را بسازد.
     */
    const force = !this.initialized;

    /**
     * اگر دوربین هنوز در همان Chunk قبلی است،
     * نیازی به محاسبه دوباره محدوده نداریم.
     *
     * اما pending و preparingها همچنان پردازش می‌شوند.
     */
    if (
      !force &&
      chunkX === this.currentChunkX &&
      chunkZ === this.currentChunkZ
    ) {
      void this.processPendingChunks();

      /**
       * اگر Chunk جدیدی آزاد شده باشد،
       * ساخت Chunkهای بعدی نیز ادامه پیدا می‌کند.
       */
      this.updateRequiredChunks(chunkX, chunkZ);

      return;
    }

    this.initialized = true;

    this.currentChunkX = chunkX;
    this.currentChunkZ = chunkZ;

    /**
     * پیدا کردن Chunkهای موردنیاز.
     *
     * Chunk نزدیک دوربین در اولویت است.
     */
    this.updateRequiredChunks(chunkX, chunkZ);

    /**
     * حذف Chunkهای خارج از محدوده.
     */
    this.removeUnusedChunks(chunkX, chunkZ);

    /**
     * فعال‌سازی async.
     */
    void this.processPendingChunks();
  }

  // ------------------------------------------------------------
  // Wait Until Ready
  // ------------------------------------------------------------

  /**
   * صبر کردن تا pending Chunkها پردازش شوند.
   */
  public async waitUntilReady(): Promise<void> {
    if (this.disposed) {
      return;
    }

    await this.processPendingChunks();
  }

  // ------------------------------------------------------------
  // Stats
  // ------------------------------------------------------------

  /**
   * آمار فعلی ChunkManager.
   */
  public getStats() {
    return {
      active: this.activeChunks.size,
      preparing: this.preparingChunks.size,
      pending: this.pendingChunks.length,
      residentialPool: this.chunkPool.residential.length,
      commercialPool: this.chunkPool.commercial.length,
      industrialPool: this.chunkPool.industrial.length,
      created: this.createdCount,
      reused: this.reusedCount,
    };
  }

  // ------------------------------------------------------------
  // Coordinate Helpers
  // ------------------------------------------------------------

  /**
   * تبدیل مختصات World به مختصات Chunk.
   */
  private worldToChunk(value: number): number {
    return Math.floor(value / ChunkManager.CHUNK_SIZE);
  }

  /**
   * ساخت شناسه یکتا برای Chunk.
   */
  private getChunkKey(chunkX: number, chunkZ: number): string {
    return `${chunkX}:${chunkZ}`;
  }

  // ------------------------------------------------------------
  // Required Chunks
  // ------------------------------------------------------------

  /**
   * مشخص کردن Chunkهایی که باید اطراف دوربین
   * وجود داشته باشند.
   *
   * نکته مهم:
   *
   * قبلاً حلقه از -2 شروع می‌شد و بنابراین
   * ممکن بود ابتدا Chunkهای بسیار دور ساخته شوند.
   *
   * اکنون مختصات بر اساس فاصله از مرکز
   * مرتب می‌شوند تا نزدیک‌ترین Chunkها اول ساخته شوند.
   */
  private updateRequiredChunks(centerX: number, centerZ: number): void {
    if (this.disposed) {
      return;
    }

    /**
     * تمام مختصات محدوده فعال را جمع می‌کنیم.
     *
     * این آرایه فقط هنگام تغییر Chunk دوربین
     * یا آزاد شدن preparingها بررسی می‌شود،
     * نه به عنوان یک عملیات سنگین در هر Frame.
     */
    const requiredCoordinates: Array<{
      x: number;
      z: number;
      distance: number;
    }> = [];

    for (
      let z = -ChunkManager.VIEW_DISTANCE;
      z <= ChunkManager.VIEW_DISTANCE;
      z++
    ) {
      for (
        let x = -ChunkManager.VIEW_DISTANCE;
        x <= ChunkManager.VIEW_DISTANCE;
        x++
      ) {
        const chunkX = centerX + x;
        const chunkZ = centerZ + z;

        /**
         * فاصله Manhattan برای اولویت‌بندی.
         *
         * برای ایجاد سریع مرکز شهر کافی است
         * و محاسبه‌اش از sqrt سبک‌تر است.
         */
        const distance = Math.abs(x) + Math.abs(z);

        requiredCoordinates.push({
          x: chunkX,
          z: chunkZ,
          distance,
        });
      }
    }

    /**
     * نزدیک‌ترین Chunkها اول.
     *
     * در صورت مساوی بودن فاصله،
     * ترتیب ثابت حفظ می‌شود.
     */
    requiredCoordinates.sort((a, b) => a.distance - b.distance);

    /**
     * شروع ساخت فقط تا سقف preparing.
     */
    for (const coordinate of requiredCoordinates) {
      if (this.preparingChunks.size >= ChunkManager.MAX_PREPARING_CHUNKS) {
        return;
      }

      const key = this.getChunkKey(coordinate.x, coordinate.z);

      /**
       * اگر Chunk فعال یا در حال آماده‌سازی است،
       * دوباره ایجاد نمی‌کنیم.
       */
      if (this.activeChunks.has(key) || this.preparingChunks.has(key)) {
        continue;
      }

      this.prepareChunk(coordinate.x, coordinate.z);
    }
  }

  // ------------------------------------------------------------
  // Prepare Chunk
  // ------------------------------------------------------------

  /**
   * شروع ساخت یک Chunk.
   */
  private prepareChunk(chunkX: number, chunkZ: number): void {
    if (this.disposed) {
      return;
    }

    /**
     * جلوگیری از عبور از سقف preparing.
     */
    if (this.preparingChunks.size >= ChunkManager.MAX_PREPARING_CHUNKS) {
      return;
    }

    const key = this.getChunkKey(chunkX, chunkZ);

    if (this.activeChunks.has(key) || this.preparingChunks.has(key)) {
      return;
    }

    const zoneType = this.getZoneType(chunkX, chunkZ);

    /**
     * ساخت Block بدون اضافه کردن مستقیم
     * به Scene.
     */
    const promise = this.createBlock(zoneType);

    this.preparingChunks.set(key, promise);

    promise
      .then((block) => {
        /**
         * اگر Manager در زمان آماده شدن Block
         * dispose شده باشد، Block را آزاد می‌کنیم.
         */
        if (this.disposed) {
          this.disposeBlock(block);
          return;
        }

        this.preparingChunks.delete(key);

        /**
         * جایگذاری Block در World.
         */
        this.positionBlock(block, chunkX, chunkZ);

        /**
         * ذخیره اطلاعات Chunk.
         */
        block.group.userData.chunkX = chunkX;

        block.group.userData.chunkZ = chunkZ;

        block.group.userData.chunkKey = key;

        block.group.userData.zoneType = zoneType;

        /**
         * انتقال به pending.
         */
        this.pendingChunks.push(block);

        /**
         * تلاش برای فعال‌سازی.
         */
        void this.processPendingChunks();

        /**
         * مهم:
         *
         * وقتی این Chunk آماده شد،
         * حالا یک slot از preparing آزاد شده است.
         *
         * بنابراین باید ساخت Chunk بعدی
         * را بلافاصله ادامه بدهیم.
         *
         * این بخش مشکل اصلی نسخه قبلی را حل می‌کند.
         */
        this.updateRequiredChunks(this.currentChunkX, this.currentChunkZ);
      })
      .catch((error) => {
        this.preparingChunks.delete(key);

        console.error(`[ChunkManager] Failed to prepare chunk ${key}:`, error);

        /**
         * اگر ساخت Chunk شکست خورد نیز
         * باید slot آزادشده برای Chunk بعدی
         * استفاده شود.
         */
        if (!this.disposed) {
          this.updateRequiredChunks(this.currentChunkX, this.currentChunkZ);
        }
      });
  }

  // ------------------------------------------------------------
  // Create / Reuse Block
  // ------------------------------------------------------------

  /**
   * ساخت CityBlock جدید یا استفاده مجدد
   * از Block موجود در Pool.
   */
  private async createBlock(zoneType: ZoneType): Promise<CityBlock> {
    const pool = this.chunkPool[zoneType];

    /**
     * ابتدا Pool را بررسی می‌کنیم.
     */
    const pooledBlock = pool.pop();

    if (pooledBlock) {
      this.reusedCount++;

      await pooledBlock.waitUntilReady();

      return pooledBlock;
    }

    /**
     * تبدیل ZoneType به BuildingType واقعی.
     *
     * residential در CityBlock با suburban ساخته می‌شود.
     */
    const buildingType: BuildingType =
      zoneType === "residential" ? "suburban" : zoneType;

    /**
     * CityBlock فقط BuildingType می‌گیرد.
     */
    const block = new CityBlock(buildingType);

    this.createdCount++;

    await block.waitUntilReady();

    return block;
  }

  // ------------------------------------------------------------
  // Activate Pending Chunks
  // ------------------------------------------------------------

  /**
   * فعال‌سازی تعداد محدودی Chunk در هر مرحله.
   */
  private async processPendingChunks(): Promise<void> {
    if (this.disposed) {
      return;
    }

    let activated = 0;

    while (
      this.pendingChunks.length > 0 &&
      activated < ChunkManager.MAX_ACTIVATIONS_PER_UPDATE
    ) {
      const block = this.pendingChunks.shift();

      if (!block) {
        break;
      }

      const chunkX = Number(block.group.userData.chunkX);

      const chunkZ = Number(block.group.userData.chunkZ);

      const key = this.getChunkKey(chunkX, chunkZ);

      /**
       * ممکن است هنگام آماده شدن Chunk،
       * دوربین از محدوده آن خارج شده باشد.
       */
      if (!this.isChunkRequired(chunkX, chunkZ)) {
        this.returnBlockToPool(block);

        continue;
      }

      /**
       * جلوگیری از duplicate.
       */
      if (this.activeChunks.has(key)) {
        this.returnBlockToPool(block);

        continue;
      }

      this.activeChunks.set(key, block);

      this.group.add(block.group);

      activated++;
    }
  }

  // ------------------------------------------------------------
  // Required Check
  // ------------------------------------------------------------

  /**
   * بررسی اینکه Chunk هنوز در محدوده
   * فعال‌سازی قرار دارد یا نه.
   */
  private isChunkRequired(chunkX: number, chunkZ: number): boolean {
    const distanceX = Math.abs(chunkX - this.currentChunkX);

    const distanceZ = Math.abs(chunkZ - this.currentChunkZ);

    return (
      distanceX <= ChunkManager.VIEW_DISTANCE &&
      distanceZ <= ChunkManager.VIEW_DISTANCE
    );
  }

  // ------------------------------------------------------------
  // Remove Unused
  // ------------------------------------------------------------

  /**
   * حذف Chunkهایی که دیگر لازم نیستند.
   */
  private removeUnusedChunks(centerX: number, centerZ: number): void {
    const blocksToRemove: Array<{
      key: string;
      block: CityBlock;
    }> = [];

    for (const [key, block] of this.activeChunks) {
      const chunkX = Number(block.group.userData.chunkX);

      const chunkZ = Number(block.group.userData.chunkZ);

      const distanceX = Math.abs(chunkX - centerX);

      const distanceZ = Math.abs(chunkZ - centerZ);

      if (
        distanceX > ChunkManager.VIEW_DISTANCE ||
        distanceZ > ChunkManager.VIEW_DISTANCE
      ) {
        blocksToRemove.push({
          key,
          block,
        });
      }
    }

    for (const item of blocksToRemove) {
      this.activeChunks.delete(item.key);

      this.group.remove(item.block.group);

      this.returnBlockToPool(item.block);
    }
  }

  // ------------------------------------------------------------
  // Pool
  // ------------------------------------------------------------

  /**
   * برگرداندن Block به Pool.
   *
   * resetForReuse استفاده نمی‌شود،
   * چون CityBlock فعلی چنین متدی ندارد.
   */
  private returnBlockToPool(block: CityBlock): void {
    if (this.disposed) {
      this.disposeBlock(block);
      return;
    }

    const zoneType = this.getBlockZoneType(block);

    this.group.remove(block.group);

    this.chunkPool[zoneType].push(block);
  }

  // ------------------------------------------------------------
  // Zone Type From Block
  // ------------------------------------------------------------

  /**
   * تشخیص ZoneType یک Block.
   */
  private getBlockZoneType(block: CityBlock): ZoneType {
    const value = block.group.userData.zoneType;

    if (
      value === "residential" ||
      value === "commercial" ||
      value === "industrial"
    ) {
      return value;
    }

    /**
     * fallback امن.
     */
    return "residential";
  }

  // ------------------------------------------------------------
  // Position
  // ------------------------------------------------------------

  /**
   * قرار دادن CityBlock در مختصات World.
   *
   * هر Block:
   *
   * 32 × 32
   */
  private positionBlock(
    block: CityBlock,
    chunkX: number,
    chunkZ: number,
  ): void {
    if (!block || !block.group) {
      return;
    }

    block.group.position.set(
      chunkX * ChunkManager.CHUNK_SIZE,
      0,
      chunkZ * ChunkManager.CHUNK_SIZE,
    );
  }

  // ------------------------------------------------------------
  // Zone Generation
  // ------------------------------------------------------------

  /**
   * انتخاب deterministic نوع ناحیه.
   *
   * یک مختصات مشخص همیشه همان ZoneType
   * را تولید می‌کند.
   */
  private getZoneType(chunkX: number, chunkZ: number): ZoneType {
    /**
     * مرکز شهر مسکونی باشد.
     */
    if (chunkX === 0 && chunkZ === 0) {
      return "residential";
    }

    /**
     * pseudo-random deterministic.
     */
    const value = Math.abs(chunkX * 73856093 + chunkZ * 19349663) % 10;

    /**
     * Residential بیشترین سهم را دارد
     * تا ظاهر شهر به Infinitown نزدیک بماند.
     */
    if (value <= 5) {
      return "residential";
    }

    if (value <= 7) {
      return "commercial";
    }

    return "industrial";
  }

  // ------------------------------------------------------------
  // Dispose
  // ------------------------------------------------------------

  /**
   * آزادسازی یک CityBlock.
   */
  private disposeBlock(block: CityBlock): void {
    try {
      block.dispose();
    } catch (error) {
      console.warn("[ChunkManager] Error while disposing CityBlock:", error);
    }
  }

  /**
   * آزادسازی تمام Blockهای یک Pool.
   */
  private disposePool(pool: CityBlock[]): void {
    for (const block of pool) {
      this.disposeBlock(block);
    }
  }

  /**
   * آزادسازی کامل ChunkManager.
   */
  public dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    /**
     * Chunkهای فعال.
     */
    for (const block of this.activeChunks.values()) {
      this.disposeBlock(block);
    }

    this.activeChunks.clear();

    /**
     * Promiseهای preparing قابل cancel نیستند،
     * اما نتیجه آنها بعد از dispose نادیده گرفته می‌شود.
     */
    this.preparingChunks.clear();

    /**
     * Chunkهای pending.
     */
    for (const block of this.pendingChunks) {
      this.disposeBlock(block);
    }

    this.pendingChunks.length = 0;

    /**
     * Poolها.
     */
    this.disposePool(this.chunkPool.residential);

    this.disposePool(this.chunkPool.commercial);

    this.disposePool(this.chunkPool.industrial);

    this.chunkPool.residential.length = 0;
    this.chunkPool.commercial.length = 0;
    this.chunkPool.industrial.length = 0;

    /**
     * پاک کردن Group.
     */
    this.group.clear();
  }
}
