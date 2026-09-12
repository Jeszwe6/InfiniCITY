import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * ==========================================
 * Tree
 * ==========================================
 *
 * درخت واقعی GLB
 *
 * Performance:
 * - مدل فقط یک بار Load می‌شود.
 * - درخواست‌های همزمان از یک Promise استفاده می‌کنند.
 * - درخت‌های بعدی Clone می‌شوند.
 * - Frustum Culling فعال است.
 * - Shadow برای درخت غیرفعال است.
 *
 * همچنین Material و Texture مدل GLB
 * هنگام Load بررسی و تنظیم می‌شوند
 * تا مدل در نور صحنه سیاه نمایش داده نشود.
 * ==========================================
 */

// ------------------------------------------
// Loader مشترک
// ------------------------------------------

const loader = new GLTFLoader();

// ------------------------------------------
// Cache مدل
// ------------------------------------------

let cachedModel: THREE.Object3D | null = null;

// ------------------------------------------
// جلوگیری از Load همزمان
// ------------------------------------------

let loadingPromise: Promise<THREE.Object3D> | null = null;

export class Tree {
  /**
   * مسیر مدل
   */
  public static readonly MODEL_PATH =
    "/assets/nature/Models/GLTF format/tree_default.glb";

  /**
   * Scale مدل
   */
  public static readonly SCALE = 2;

  /**
   * ارتفاع درخت
   */
  public static readonly Y = 0;

  /**
   * گروه اصلی
   */
  public readonly group: THREE.Group;

  constructor() {
    this.group = new THREE.Group();

    this.group.name = "Tree";

    void this.load();
  }

  /**
   * Load کردن درخت
   */
  private async load(): Promise<void> {
    try {
      const model = await Tree.loadModel();

      // Clone مدل Cached
      const tree = model.clone(true);

      // -----------------------------
      // Scale
      // -----------------------------

      tree.scale.setScalar(Tree.SCALE);

      // -----------------------------
      // Position
      // -----------------------------

      tree.position.y = Tree.Y;

      // -----------------------------
      // اضافه کردن به گروه
      // -----------------------------

      this.group.add(tree);
    } catch (error) {
      console.error("[Tree] Failed to load model:", error);
    }
  }

  /**
   * Load مشترک مدل
   */
  private static async loadModel(): Promise<THREE.Object3D> {
    // --------------------------------
    // استفاده از Cache
    // --------------------------------

    if (cachedModel) {
      return cachedModel;
    }

    // --------------------------------
    // اگر قبلاً در حال Load است
    // همان Promise را برگردان
    // --------------------------------

    if (loadingPromise) {
      return loadingPromise;
    }

    // --------------------------------
    // شروع Load
    // --------------------------------

    loadingPromise = loader
      .loadAsync(Tree.MODEL_PATH)
      .then((gltf) => {
        const model = gltf.scene;

        // --------------------------------
        // بررسی تمام Meshهای مدل
        // --------------------------------

        model.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            // -----------------------------
            // Frustum Culling
            // -----------------------------

            object.frustumCulled = true;

            // -----------------------------
            // Shadow
            // -----------------------------

            object.castShadow = false;

            object.receiveShadow = false;

            // -----------------------------
            // Material
            // -----------------------------

            const materials = Array.isArray(object.material)
              ? object.material
              : [object.material];

            for (const material of materials) {
              if (!material) {
                continue;
              }

              // --------------------------------
              // اگر Texture رنگی وجود دارد
              // Color Space آن باید sRGB باشد.
              // --------------------------------

              const standardMaterial = material as THREE.MeshStandardMaterial;

              if (standardMaterial.map) {
                standardMaterial.map.colorSpace = THREE.SRGBColorSpace;

                standardMaterial.map.needsUpdate = true;
              }

              // --------------------------------
              // جلوگیری از کاملاً تاریک شدن
              // Material در نور ضعیف
              // --------------------------------

              if (standardMaterial.isMeshStandardMaterial) {
                standardMaterial.roughness = Math.max(
                  standardMaterial.roughness,
                  0.65,
                );

                standardMaterial.metalness = 0;
              }

              material.needsUpdate = true;
            }
          }
        });

        // --------------------------------
        // ذخیره در Cache
        // --------------------------------

        cachedModel = model;

        return model;
      })
      .finally(() => {
        loadingPromise = null;
      });

    return loadingPromise;
  }
}
