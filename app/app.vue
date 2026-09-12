<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from "vue";

import { Engine } from "./core/engine/Engine";

/**
 * ==========================================
 * Three.js Container
 * ==========================================
 */

const canvasContainer = ref<HTMLDivElement | null>(null);

/**
 * ==========================================
 * Intro State
 * ==========================================
 */

/**
 * نمایش Intro
 */
const showIntro = ref(true);

/**
 * مرحله شروع Intro
 *
 * false:
 * حالت اولیه
 *
 * true:
 * متن وارد می‌شود.
 */
const introStarted = ref(false);

/**
 * مرحله خروج Intro
 */
const introLeaving = ref(false);

/**
 * ==========================================
 * Timer
 * ==========================================
 *
 * برای اینکه هنگام خروج از صفحه
 * Timerها باقی نمانند.
 */

let introStartTimer: number | null = null;
let introLeaveTimer: number | null = null;
let introRemoveTimer: number | null = null;

/**
 * ==========================================
 * Engine
 * ==========================================
 */

let engine: Engine | null = null;

/**
 * ==========================================
 * شروع Intro
 * ==========================================
 */

function startIntro() {
  /**
   * یک فریم صبر می‌کنیم تا مرورگر
   * حالت اولیه Intro را Render کند.
   */
  requestAnimationFrame(() => {
    introStarted.value = true;
  });

  /**
   * ----------------------------------------
   * شروع خروج
   * ----------------------------------------
   *
   * Intro حدود 3.5 ثانیه روی صفحه می‌ماند.
   */
  introStartTimer = window.setTimeout(() => {
    introLeaving.value = true;

    /**
     * --------------------------------------
     * حذف Intro
     * --------------------------------------
     *
     * مدت Fade برابر 1200ms است.
     */
    introRemoveTimer = window.setTimeout(() => {
      showIntro.value = false;
    }, 1200);
  }, 3500);
}

/**
 * ==========================================
 * راه‌اندازی
 * ==========================================
 */

onMounted(() => {
  /**
   * ----------------------------------------
   * Three.js
   * ----------------------------------------
   */

  if (canvasContainer.value) {
    engine = new Engine();

    canvasContainer.value.appendChild(engine.renderer.instance.domElement);

    engine.start();
  }

  /**
   * ----------------------------------------
   * Intro
   * ----------------------------------------
   */

  introLeaveTimer = window.setTimeout(() => {
    startIntro();
  }, 50);
});

/**
 * ==========================================
 * پاک‌سازی
 * ==========================================
 */

onBeforeUnmount(() => {
  /**
   * پاک کردن Timerها
   */
  if (introStartTimer !== null) {
    window.clearTimeout(introStartTimer);
  }

  if (introLeaveTimer !== null) {
    window.clearTimeout(introLeaveTimer);
  }

  if (introRemoveTimer !== null) {
    window.clearTimeout(introRemoveTimer);
  }

  /**
   * پاک کردن Engine
   */
  engine?.dispose();

  engine = null;
});
</script>

<template>
  <div class="app">
    <!-- =====================================
         Three.js
         ===================================== -->

    <div ref="canvasContainer" class="three-container" />

    <!-- =====================================
         InfiniCITY Intro
         ===================================== -->

    <Transition name="intro">
      <div
        v-if="showIntro"
        class="intro"
        :class="{
          started: introStarted,
          leaving: introLeaving,
        }"
      >
        <!-- =================================
             مرکز Intro
             ================================= -->

        <div class="intro-content">
          <!-- ---------------------------------
               نام پروژه
               --------------------------------- -->

          <div class="intro-title">INFINICITY</div>

          <!-- سازنده -->
          <div class="intro-subtitle">
            MADE BY
            <span class="codinci">CODINCI</span>
          </div>
        </div>
      </div>
    </Transition>

    <!-- =====================================
         نام دائمی پروژه
         ===================================== -->

    <div class="site-title">INFINICITY</div>
  </div>
</template>

<style>
/* ==========================================
   Global
   ========================================== */

html,
body,
#__nuxt {
  margin: 0;

  width: 100%;
  height: 100%;

  overflow: hidden;
}

/* ==========================================
   Application
   ========================================== */

.app {
  position: relative;

  width: 100%;
  height: 100%;

  overflow: hidden;

  background: #08090b;
}

/* ==========================================
   Three.js
   ========================================== */

.three-container {
  position: absolute;

  inset: 0;

  width: 100%;
  height: 100%;

  z-index: 1;
}

.three-container canvas {
  display: block;

  width: 100%;
  height: 100%;
}

/* ==========================================
   Intro
   ========================================== */

.intro {
  position: fixed;

  inset: 0;

  z-index: 999999;

  display: flex;

  align-items: center;
  justify-content: center;

  background: #08090b;

  pointer-events: none;

  opacity: 1;
}

/* ==========================================
   محتوای Intro
   ========================================== */

.intro-content {
  display: flex;

  flex-direction: column;

  align-items: center;
  justify-content: center;

  opacity: 0;

  transform: translateY(18px) scale(0.94);

  filter: blur(5px);

  transition:
    opacity 1100ms ease,
    transform 1300ms cubic-bezier(0.22, 1, 0.36, 1),
    filter 1300ms ease;
}

/* ==========================================
   Intro شروع شده
   ========================================== */

.intro.started .intro-content {
  opacity: 1;

  transform: translateY(0) scale(1);

  filter: blur(0);
}

/* ==========================================
   خروج Intro
   ========================================== */

.intro.leaving {
  opacity: 0;

  transition: opacity 1200ms cubic-bezier(0.4, 0, 1, 1);
}

/* ==========================================
   عنوان اصلی
   ========================================== */

.intro-title {
  font-family: Arial, Helvetica, sans-serif;

  font-size: clamp(40px, 7vw, 80px);

  font-weight: 700;

  letter-spacing: 0.18em;

  color: #ffffff;

  white-space: nowrap;
}

/* ==========================================
   زیرعنوان
   ========================================== */

.intro-subtitle {
  margin-top: 14px;

  font-family: Arial, Helvetica, sans-serif;

  font-size: 11px;

  font-weight: 400;

  letter-spacing: 0.3em;

  color: rgba(255, 255, 255, 0.45);

  white-space: nowrap;

  opacity: 0;

  transform: translateY(8px);

  transition:
    opacity 900ms ease 300ms,
    transform 900ms cubic-bezier(0.22, 1, 0.36, 1) 300ms;
}

/* ==========================================
   CODINCI
   ========================================== */

.codinci {
  color: #9B5DE5;

  font-weight: 600;
}

/* ==========================================
   نمایش زیرعنوان
   ========================================== */

.intro.started .intro-subtitle {
  opacity: 1;

  transform: translateY(0);
}

/* ==========================================
   نام دائمی پروژه
   ========================================== */

.site-title {
  position: fixed;

  top: 22px;
  left: 24px;

  z-index: 1000000;

  font-family: Arial, Helvetica, sans-serif;

  font-size: 11px;

  font-weight: 600;

  letter-spacing: 0.18em;

  color: rgba(255, 255, 255, 0.82);

  pointer-events: none;

  user-select: none;
}

/* ==========================================
   موبایل
   ========================================== */

@media (max-width: 600px) {
  .intro-title {
    font-size: clamp(28px, 10vw, 48px);

    letter-spacing: 0.12em;
  }

  .intro-subtitle {
    margin-top: 10px;

    font-size: 9px;

    letter-spacing: 0.2em;
  }

  .site-title {
    top: 16px;
    left: 16px;

    font-size: 10px;
  }
}
</style>
