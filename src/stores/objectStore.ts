/**
 * 对象状态 Store
 * 管理 SVG 对象的位置、缩放和选中状态
 */

import { createStore, produce } from 'solid-js/store';
import type { Vector3D } from '@/core/types';
import { INTERACTION_CONFIG, getSVGObjectInitialState } from '@/config';
import { syncSVGObjectPosition, syncSVGObjectRotation, syncSVGObjectScale, syncAllSVGObjectsSelected } from '@/utils/three-sync';

export interface ObjectState {
  position: Vector3D;
  scale: number;
  rotation: Vector3D;
  selected: boolean;
}

export type ObjectStoreState = {
  selectedObjectId: string | null;
  objects: Record<string, ObjectState>;
  initialPositions: Record<string, Vector3D>;
  initialRotations: Record<string, Vector3D>;
  initialScales: Record<string, number>;
};

// 使用配置文件统一管理初始状态
const initialObjects: Record<string, ObjectState> = {
  v: getSVGObjectInitialState(),
  b: getSVGObjectInitialState(),
  o: getSVGObjectInitialState(),
  t: getSVGObjectInitialState(),
  flower: getSVGObjectInitialState(),
  bot: getSVGObjectInitialState(),
};

const initialState: ObjectStoreState = {
  selectedObjectId: null,
  objects: initialObjects,
  initialPositions: {},
  initialRotations: {},
  initialScales: {},
};

export const [objectStore, setObjectStore] = createStore(initialState);

/**
 * Actions - 状态更新函数
 */
export const objectActions = {
  /**
   * 选择对象
   */
  selectObject(id: string | null) {
    // 取消之前选中的对象
    if (objectStore.selectedObjectId) {
      setObjectStore('objects', objectStore.selectedObjectId, 'selected', false);
    }

    if (id) {
      setObjectStore('objects', id, 'selected', true);
    }
    setObjectStore({ selectedObjectId: id });
  },

  /**
   * 更新对象位置
   */
  updateObjectPosition(id: string, position: Partial<Vector3D>) {
    setObjectStore('objects', id, 'position', produce((pos) => {
      if (position.x !== undefined) pos.x = position.x;
      if (position.y !== undefined) pos.y = position.y;
      if (position.z !== undefined) pos.z = position.z;
    }));
  },

  /**
   * 设置对象位置（直接设置）
   */
  setObjectPosition(id: string, position: Vector3D) {
    setObjectStore('objects', id, 'position', { ...position });
  },

  /**
   * 更新对象缩放
   */
  updateObjectScale(id: string, scale: number) {
    const clampedScale = Math.max(
      INTERACTION_CONFIG.SCALE_MIN,
      Math.min(INTERACTION_CONFIG.SCALE_MAX, scale)
    );
    setObjectStore('objects', id, 'scale', clampedScale);
  },

  /**
   * 更新对象旋转
   */
  updateObjectRotation(id: string, rotation: Vector3D) {
    setObjectStore('objects', id, 'rotation', { ...rotation });
  },

  /**
   * 更新所有对象旋转 (用于视差效果)
   */
  setAllObjectsRotation(rotation: Vector3D) {
    const ids = Object.keys(objectStore.objects);
    // 为每个对象单独更新旋转
    ids.forEach(id => {
      setObjectStore('objects', id, 'rotation', { ...rotation });
    });
  },

  /**
   * 重置所有对象到初始状态（位置、旋转、缩放）
   */
  resetAllObjects() {
    const resetState: Record<string, ObjectState> = {};
    const initialPositions = objectStore.initialPositions;
    const initialRotations = objectStore.initialRotations;
    const initialScales = objectStore.initialScales;

    Object.keys(initialObjects).forEach(id => {
      // 使用保存的初始值，如果没有则使用默认值
      const initialPos = initialPositions[id] || { x: 0, y: 0, z: 0 };
      const initialRot = initialRotations[id] || { x: 0, y: 0, z: 0 };
      const initialScale = initialScales[id] ?? 1.0;

      resetState[id] = {
        position: { ...initialPos },
        scale: initialScale,
        rotation: { ...initialRot },
        selected: false,
      };

      // 同步到 Three.js 场景
      syncSVGObjectPosition(id, initialPos);
      syncSVGObjectRotation(id, initialRot);
      syncSVGObjectScale(id, initialScale);
    });

    // 取消所有选中高亮
    syncAllSVGObjectsSelected(false);

    setObjectStore({ selectedObjectId: null, objects: resetState });
  },

  /**
   * 设置多个对象的初始位置（用于初始化）
   * 注意：此方法只保存初始值，不更新当前对象状态
   */
  setInitialPositions(positions: Record<string, Vector3D>) {
    // 保存初始位置供 reset 使用
    setObjectStore('initialPositions', { ...positions });
  },

  /**
   * 设置多个对象的初始旋转（用于初始化）
   * 注意：此方法只保存初始值，不更新当前对象状态
   */
  setInitialRotations(rotations: Record<string, Vector3D>) {
    // 保存初始旋转供 reset 使用
    setObjectStore('initialRotations', { ...rotations });
  },

  /**
   * 设置多个对象的初始缩放（用于初始化）
   * 注意：此方法只保存初始值，不更新当前对象状态
   */
  setInitialScales(scales: Record<string, number>) {
    // 保存初始缩放供 reset 使用
    setObjectStore('initialScales', { ...scales });
  },
};
