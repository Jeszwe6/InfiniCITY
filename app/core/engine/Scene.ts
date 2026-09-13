import * as THREE from "three";

/**
 * ==========================================
 * Scene
 * ==========================================
 *
 * مسئول ساخت و نگهداری Scene اصلی Three.js
 *
 * شامل:
 * - نور محیطی
 * - نور خورشید
 * - نور آسمان
 * - Fog برای محو شدن تدریجی آبجکت‌های دور
 * ==========================================
 */
export class Scene {
  public readonly instance: THREE.Scene;

  constructor() {
    // -----------------------------
    // ساخت Scene
    // -----------------------------

    this.instance = new THREE.Scene();

    // -----------------------------
    // Background
    // -----------------------------

    const skyColor = new THREE.Color(0x87ceeb);

    this.instance.background = skyColor;

    // -----------------------------
    // Fog
    // -----------------------------
    //
    // آبجکت‌های نزدیک کاملاً واضح هستند.
    //
    // با افزایش فاصله، به‌تدریج با
    // رنگ آسمان ترکیب می‌شوند.
    //
    // ساختمان‌ها حذف نمی‌شوند؛
    // فقط از نظر بصری محوتر می‌شوند.
    // -----------------------------

    this.instance.fog = new THREE.Fog(skyColor, 55, 140);

    // -----------------------------
    // Ambient Light
    // -----------------------------

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.8);

    this.instance.add(ambientLight);

    // -----------------------------
    // Sun Light
    // -----------------------------

    const sunLight = new THREE.DirectionalLight(0xffffff, 2.2);

    sunLight.position.set(50, 80, 30);

    // Shadow فعلاً خاموش است
    // تا Performance بالا بماند.
    sunLight.castShadow = false;

    this.instance.add(sunLight);

    // -----------------------------
    // Hemisphere Light
    // -----------------------------

    const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x5f6b52, 0.6);

    this.instance.add(hemisphereLight);
  }
}
