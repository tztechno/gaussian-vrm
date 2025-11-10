// Copyright (c) 2025 naruya
// Licensed under the MIT License. See LICENSE file in the project root for full license information.


import * as THREE from 'three';
import { XRControllerModelFactory } from "three/addons/webxr/XRControllerModelFactory.js";

/**
 * インタラクティブパネルを作成
 */
function createInteractivePanel(text, color) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = 512;
  canvas.height = 256;

  // 背景
  context.fillStyle = 'rgba(0, 0, 0, 0.8)';
  context.fillRect(0, 0, canvas.width, canvas.height);

  // 枠線
  context.strokeStyle = color;
  context.lineWidth = 8;
  context.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);

  // テキスト（改行対応）
  context.font = 'Bold 48px Arial';
  context.fillStyle = 'white';
  context.textAlign = 'center';
  context.textBaseline = 'middle';

  const lines = text.split('\n');
  const lineHeight = 60;
  const totalHeight = lines.length * lineHeight;
  const startY = (canvas.height - totalHeight) / 2 + lineHeight / 2;

  lines.forEach((line, index) => {
    context.fillText(line, canvas.width / 2, startY + index * lineHeight);
  });

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide
  });
  const geometry = new THREE.PlaneGeometry(0.5, 0.25);
  const mesh = new THREE.Mesh(geometry, material);

  return mesh;
}

/**
 * VR機能をセットアップする
 * @param {THREE.WebGLRenderer} renderer - Three.jsのレンダラー
 * @param {HTMLElement} container - コンテナ（未使用）
 * @param {THREE.Scene} scene - Three.jsのシーン
 * @param {Object} gvrm - GVRMオブジェクト
 * @param {Array} gvrmFiles - GVRMファイルのパス配列
 * @param {Array} fbxFiles - FBXファイルのパス配列
 * @param {THREE.Camera} camera - カメラ
 * @param {string} fileName - ファイル名
 * @returns {Object} VRコントローラーオブジェクト
 */
export function setupVR(renderer, container, scene, gvrm, gvrmFiles, fbxFiles, camera, fileName) {
  renderer.xr.enabled = true;

  const controllerModelFactory = new XRControllerModelFactory();

  // コントローラーのレイライン
  const lineGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -1),
  ]);
  const line = new THREE.Line(lineGeometry);
  line.name = "line";
  line.scale.z = 5;

  function addController(index) {
    const controller = renderer.xr.getController(index);
    scene.add(controller);

    const controllerGrip = renderer.xr.getControllerGrip(index);
    controllerGrip.add(
      controllerModelFactory.createControllerModel(controllerGrip)
    );
    scene.add(controllerGrip);

    controller.add(line.clone());
    return controller;
  }

  const controller0 = addController(0);
  const controller1 = addController(1);

  // インタラクティブパネルの作成
  const leftPanel = createInteractivePanel('Switch\nAvatar', '#ff4444');
  const rightPanel = createInteractivePanel('Switch\nAnimation', '#4444ff');

  leftPanel.name = 'switchAvatarPanel';
  rightPanel.name = 'switchAnimationPanel';

  scene.add(leftPanel);
  scene.add(rightPanel);

  // レイキャスター
  const raycaster = new THREE.Raycaster();
  const tempMatrix = new THREE.Matrix4();

  let currentGvrmIndex = 0;
  let currentFbxIndex = 0;

  // コントローラーのセレクトイベント
  async function onSelectStart(event) {
    const controller = event.target;

    // コントローラーの向きでレイキャスト
    tempMatrix.identity().extractRotation(controller.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

    const intersects = raycaster.intersectObjects([leftPanel, rightPanel], true);

    if (intersects.length > 0) {
      const intersectedObject = intersects[0].object;

      if (intersectedObject === leftPanel) {
        // Switch Avatar
        if (!gvrm || !gvrm.isReady || gvrm.character.isLoading()) return;
        currentGvrmIndex = (currentGvrmIndex + 1) % gvrmFiles.length;
        await gvrm.remove(scene);
        await gvrm.load(gvrmFiles[currentGvrmIndex], scene, camera, renderer, fileName);
        await gvrm.changeFBX(fbxFiles[currentFbxIndex]);
      } else if (intersectedObject === rightPanel) {
        // Switch Animation
        if (!gvrm) return;
        currentFbxIndex = (currentFbxIndex + 1) % fbxFiles.length;
        await gvrm.changeFBX(fbxFiles[currentFbxIndex]);
      }
    }
  }

  controller0.addEventListener("selectstart", onSelectStart);
  controller1.addEventListener("selectstart", onSelectStart);

  /**
   * パネルの位置を更新（アバターの左右に配置）
   */
  function updatePanels() {
    if (!gvrm || !gvrm.character || !gvrm.character.currentVrm) return;

    const avatarScene = gvrm.character.currentVrm.scene;
    const avatarPosition = avatarScene.position;

    // アバターの左側に「Switch Avatar」パネル
    leftPanel.position.set(
      avatarPosition.x - 0.6,  // 左に60cm
      avatarPosition.y + 1.2,  // 高さ1.2m（胸あたり）
      avatarPosition.z
    );
    leftPanel.lookAt(camera.position);

    // アバターの右側に「Switch Animation」パネル
    rightPanel.position.set(
      avatarPosition.x + 0.6,  // 右に60cm
      avatarPosition.y + 1.2,  // 高さ1.2m（胸あたり）
      avatarPosition.z
    );
    rightPanel.lookAt(camera.position);

    // VRセッション中のみ表示
    const isVRActive = renderer.xr.isPresenting;
    leftPanel.visible = isVRActive;
    rightPanel.visible = isVRActive;
  }

  return {
    controller0,
    controller1,
    getCurrentGvrmIndex: () => currentGvrmIndex,
    getCurrentFbxIndex: () => currentFbxIndex,
    setCurrentGvrmIndex: (index) => { currentGvrmIndex = index; },
    setCurrentFbxIndex: (index) => { currentFbxIndex = index; },
    update: updatePanels
  };
}
