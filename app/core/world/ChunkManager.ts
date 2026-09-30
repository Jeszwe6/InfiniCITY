import * as THREE from "three";

import { CityBlock } from "./CityBlock";

import type { BuildingType } from "./BuildingFactory";

import { Road } from "./Road";

/**
 * ==========================================
 * ZoneType
 * ==========================================
 */
type ZoneType = "residential" | "commercial" | "industrial";

/**
 * ==========================================
 * ChunkManager
 * ==========================================
 */
export class ChunkManager {
  /**
   * اندازه هر CityBlock.
   */
  private static readonly CHUNK_SIZE = 32;

  /**
   * محدوده فعال اطراف دوربین.
   */
  private static readonly VIEW_DISTANCE = 2;

  /**
   * حداکثر Chunkهای هم‌زمان در حال ساخت.
   */
  private static readonly MAX_PREPARING_CHUNKS = 2;

  /**
   * حداکثر Activation در هر Update.
   */
  private static readonly MAX_ACTIVATIONS_PER_UPDATE = 2;

  /**
   * Group اصلی.
   */
  public readonly group: THREE.Group;

  /**
   * Chunkهای فعال.
   */
  private readonly activeChunks = new Map<string, CityBlock>();

  /**
   * Chunkهای در حال آماده‌سازی.
   */
  private readonly preparingChunks = new Map<string, Promise<CityBlock>>();

  /**
   * Chunkهای آماده اما هنوز فعال‌نشده.
   */
  private readonly pendingChunks: CityBlock[] = [];

  /**
   * Pool.
   */
  private readonly chunkPool: Record<ZoneType, CityBlock[]> = {
    residential: [],
    commercial: [],
    industrial: [],
  };

  /**
   * مختصات Chunk فعلی دوربین.
   */
  private currentChunkX = Number.NaN;
  private currentChunkZ = Number.NaN;

  /**
   * وضعیت اولیه.
   */
  private initialized = false;

  /**
   * Dispose.
   */
  private disposed = false;

  /**
   * آمار.
   */
  private createdCount = 0;
  private reusedCount = 0;

  /**
   * ==========================================
   * Constructor
   * ==========================================
   */
  constructor() {
    this.group = new THREE.Group();

    this.group.name = "ChunkManager";

    this.group.userData.isChunkManager = true;
  }

  /**
   * ==========================================
   * Initialize
   * ==========================================
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

  /**
   * ==========================================
   * Update
   * ==========================================
   */
  public update(
    cameraPosition: THREE.Vector3,
    _cameraDistance: number,
    _deltaTime: number,
  ): void {
    if (this.disposed) {
      return;
    }

    if (!cameraPosition) {
      return;
    }

    const chunkX = this.worldToChunk(cameraPosition.x);

    const chunkZ = this.worldToChunk(cameraPosition.z);

    const force = !this.initialized;

    if (
      !force &&
      chunkX === this.currentChunkX &&
      chunkZ === this.currentChunkZ
    ) {
      void this.processPendingChunks();

      this.updateRequiredChunks(chunkX, chunkZ);

      return;
    }

    this.initialized = true;

    this.currentChunkX = chunkX;
    this.currentChunkZ = chunkZ;

    this.updateRequiredChunks(chunkX, chunkZ);

    this.removeUnusedChunks(chunkX, chunkZ);

    void this.processPendingChunks();
  }

  /**
   * ==========================================
   * Active Roads
   * ==========================================
   *
   * تمام Roadهای CityBlockهای فعال را
   * در اختیار Traffic قرار می‌دهد.
   *
   * نکته:
   *
   * فقط Roadهای Active برگردانده می‌شوند.
   *
   * بنابراین Traffic مجبور نیست کل شهر
   * را بررسی کند.
   */
  public getActiveRoads(): Road[] {
    const roads: Road[] = [];

    for (const block of this.activeChunks.values()) {
      /**
       * Roadهای واقعی Block.
       */
      const blockRoads = block.getRoads();

      for (const road of blockRoads) {
        roads.push(road);
      }
    }

    return roads;
  }

  /**
   * ==========================================
   * Active CityBlocks
   * ==========================================
   *
   * در صورت نیاز سیستم‌های دیگر می‌توانند
   * Blockهای فعال را دریافت کنند.
   */
  public getActiveCityBlocks(): CityBlock[] {
    return Array.from(this.activeChunks.values());
  }

  /**
   * ==========================================
   * Wait Until Ready
   * ==========================================
   */
  public async waitUntilReady(): Promise<void> {
    if (this.disposed) {
      return;
    }

    await this.processPendingChunks();
  }

  /**
   * ==========================================
   * Stats
   * ==========================================
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

  /**
   * ==========================================
   * Coordinate Helpers
   * ==========================================
   */
  private worldToChunk(value: number): number {
    return Math.floor(value / ChunkManager.CHUNK_SIZE);
  }

  private getChunkKey(chunkX: number, chunkZ: number): string {
    return `${chunkX}:${chunkZ}`;
  }

  /**
   * ==========================================
   * Required Chunks
   * ==========================================
   */
  private updateRequiredChunks(centerX: number, centerZ: number): void {
    if (this.disposed) {
      return;
    }

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

        const distance = Math.abs(x) + Math.abs(z);

        requiredCoordinates.push({
          x: chunkX,
          z: chunkZ,
          distance,
        });
      }
    }

    requiredCoordinates.sort((a, b) => a.distance - b.distance);

    for (const coordinate of requiredCoordinates) {
      if (this.preparingChunks.size >= ChunkManager.MAX_PREPARING_CHUNKS) {
        return;
      }

      const key = this.getChunkKey(coordinate.x, coordinate.z);

      if (this.activeChunks.has(key) || this.preparingChunks.has(key)) {
        continue;
      }

      this.prepareChunk(coordinate.x, coordinate.z);
    }
  }

  /**
   * ==========================================
   * Prepare Chunk
   * ==========================================
   */
  private prepareChunk(chunkX: number, chunkZ: number): void {
    if (this.disposed) {
      return;
    }

    if (this.preparingChunks.size >= ChunkManager.MAX_PREPARING_CHUNKS) {
      return;
    }

    const key = this.getChunkKey(chunkX, chunkZ);

    if (this.activeChunks.has(key) || this.preparingChunks.has(key)) {
      return;
    }

    const zoneType = this.getZoneType(chunkX, chunkZ);

    const promise = this.createBlock(zoneType);

    this.preparingChunks.set(key, promise);

    promise
      .then((block) => {
        if (this.disposed) {
          this.disposeBlock(block);
          return;
        }

        this.preparingChunks.delete(key);

        this.positionBlock(block, chunkX, chunkZ);

        block.group.userData.chunkX = chunkX;

        block.group.userData.chunkZ = chunkZ;

        block.group.userData.chunkKey = key;

        block.group.userData.zoneType = zoneType;

        this.pendingChunks.push(block);

        void this.processPendingChunks();

        this.updateRequiredChunks(this.currentChunkX, this.currentChunkZ);
      })
      .catch((error) => {
        this.preparingChunks.delete(key);

        console.error(`[ChunkManager] Failed to prepare chunk ${key}:`, error);

        if (!this.disposed) {
          this.updateRequiredChunks(this.currentChunkX, this.currentChunkZ);
        }
      });
  }

  /**
   * ==========================================
   * Create / Reuse Block
   * ==========================================
   */
  private async createBlock(zoneType: ZoneType): Promise<CityBlock> {
    const pool = this.chunkPool[zoneType];

    const pooledBlock = pool.pop();

    if (pooledBlock) {
      this.reusedCount++;

      await pooledBlock.waitUntilReady();

      return pooledBlock;
    }

    const buildingType: BuildingType =
      zoneType === "residential" ? "suburban" : zoneType;

    const block = new CityBlock(buildingType);

    this.createdCount++;

    await block.waitUntilReady();

    return block;
  }

  /**
   * ==========================================
   * Activate Pending Chunks
   * ==========================================
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

      if (!this.isChunkRequired(chunkX, chunkZ)) {
        this.returnBlockToPool(block);

        continue;
      }

      if (this.activeChunks.has(key)) {
        this.returnBlockToPool(block);

        continue;
      }

      this.activeChunks.set(key, block);

      this.group.add(block.group);

      activated++;
    }
  }

  /**
   * ==========================================
   * Required Check
   * ==========================================
   */
  private isChunkRequired(chunkX: number, chunkZ: number): boolean {
    const distanceX = Math.abs(chunkX - this.currentChunkX);

    const distanceZ = Math.abs(chunkZ - this.currentChunkZ);

    return (
      distanceX <= ChunkManager.VIEW_DISTANCE &&
      distanceZ <= ChunkManager.VIEW_DISTANCE
    );
  }

  /**
   * ==========================================
   * Remove Unused
   * ==========================================
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

  /**
   * ==========================================
   * Pool
   * ==========================================
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

  /**
   * ==========================================
   * Zone Type From Block
   * ==========================================
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

    return "residential";
  }

  /**
   * ==========================================
   * Position
   * ==========================================
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

  /**
   * ==========================================
   * Zone Generation
   * ==========================================
   */
  private getZoneType(chunkX: number, chunkZ: number): ZoneType {
    if (chunkX === 0 && chunkZ === 0) {
      return "residential";
    }

    const value = Math.abs(chunkX * 73856093 + chunkZ * 19349663) % 10;

    if (value <= 5) {
      return "residential";
    }

    if (value <= 7) {
      return "commercial";
    }

    return "industrial";
  }

  /**
   * ==========================================
   * Dispose Block
   * ==========================================
   */
  private disposeBlock(block: CityBlock): void {
    try {
      block.dispose();
    } catch (error) {
      console.warn("[ChunkManager] Error while disposing CityBlock:", error);
    }
  }

  /**
   * ==========================================
   * Dispose Pool
   * ==========================================
   */
  private disposePool(pool: CityBlock[]): void {
    for (const block of pool) {
      this.disposeBlock(block);
    }
  }

  /**
   * ==========================================
   * Dispose
   * ==========================================
   */
  public dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    for (const block of this.activeChunks.values()) {
      this.disposeBlock(block);
    }

    this.activeChunks.clear();

    this.preparingChunks.clear();

    for (const block of this.pendingChunks) {
      this.disposeBlock(block);
    }

    this.pendingChunks.length = 0;

    this.disposePool(this.chunkPool.residential);

    this.disposePool(this.chunkPool.commercial);

    this.disposePool(this.chunkPool.industrial);

    this.chunkPool.residential.length = 0;
    this.chunkPool.commercial.length = 0;
    this.chunkPool.industrial.length = 0;

    this.group.clear();
  }
}
