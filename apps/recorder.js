import * as THREE from 'three';


export class Recorder {
  constructor(scene, camera, renderer) {
    if (!window.MediaRecorder || !MediaRecorder.isTypeSupported("video/webm")) {
      console.warn("MediaRecorder or video/webm is not supported on this browser.");
      this.isSupported = false;
      return;
    }
    this.isSupported = true;

    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.isRecording = false;
    this.popup = null;

    const stream = renderer.domElement.captureStream(60);
    let options;
    if (MediaRecorder.isTypeSupported("video/mp4")) {
      options = { mimeType: "video/mp4" };
    } else if (MediaRecorder.isTypeSupported("video/webm;codecs=h264")) {
      options = { mimeType: "video/webm;codecs=h264" }; // MP4互換のH.264コーデック
    } else if (MediaRecorder.isTypeSupported("video/webm")) {
      options = { mimeType: "video/webm" };
    } else {
      console.warn("No suitable codec found");
      this.isSupported = false;
      return;
    }
    console.log("Using codec:", options.mimeType);
    const mediaRecorder = new MediaRecorder(stream, options);
    let recordedChunks = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        recordedChunks.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      const fileExt = options.mimeType && options.mimeType.includes("mp4") ? "mp4" : "webm";
      const blob = new Blob(recordedChunks, { type: options.mimeType || "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;

      // Generate filename
      let filename = 'recording';
      if (this.gvrm && this.gvrm.fileName) {
        const gvrmFileName = this.gvrm.fileName.split('/').pop().split('.').shift();
        filename = `recording_${gvrmFileName}`;
        if (this.gvrm.character && this.gvrm.character.animationUrl) {
          const animFileName = this.gvrm.character.animationUrl.split('/').pop().split('.').shift();
          filename = `recording_${gvrmFileName}_${animFileName}`;
        }
      }
      a.download = `${filename}.${fileExt}`;

      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
      recordedChunks = [];

      if (this.currentRecordingResolve) {
        this.currentRecordingResolve();
        this.currentRecordingResolve = null;
      }
    };

    this.mediaRecorder = mediaRecorder;
    this.recordedChunks = recordedChunks;
    this.options = options;
    this.currentRecordingResolve = null;

    // Setup keyboard listener for R key
    this.setupKeyboardListener();
  }

  setupKeyboardListener() {
    document.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        this.toggleRecording();
      }
    });
  }

  toggleRecording() {
    if (!this.isSupported) return;

    if (this.isRecording) {
      this.stopRecording();
    } else {
      this.startRecording();
    }
  }

  showPopup(message, isRecording = false) {
    // Remove existing popup if any
    this.hidePopup();

    // Create new popup
    this.popup = document.createElement('div');
    this.popup.id = 'recorder-popup';
    this.popup.style.cssText = `
      position: fixed;
      top: 10%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: ${isRecording ? 'rgba(255, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.8)'};
      color: white;
      padding: 20px 30px;
      border-radius: 10px;
      font-size: 16px;
      font-weight: bold;
      z-index: 10000;
      pointer-events: none;
    `;
    this.popup.textContent = message;
    document.body.appendChild(this.popup);

    // Auto-hide after 2 seconds if not recording
    if (!isRecording) {
      setTimeout(() => {
        this.hidePopup();
      }, 2000);
    }
  }

  hidePopup() {
    if (this.popup && this.popup.parentNode) {
      document.body.removeChild(this.popup);
      this.popup = null;
    }
  }

  startRecording() {
    if (!this.isSupported || this.isRecording) return;

    console.log("start recording");
    this.recordedChunks = [];
    this.mediaRecorder.start();
    this.isRecording = true;
    this.showPopup('● Recording...', true);
  }

  stopRecording() {
    if (!this.isSupported || !this.isRecording) return;

    console.log("stop recording");
    this.mediaRecorder.stop();
    this.isRecording = false;
    this.hidePopup();
    this.showPopup('Recording stopped', false);
  }

  setGVRM(gvrm) {
    this.gvrm = gvrm;
  }

  async recordAnimation(animationUrl) {
    if (!this.isSupported || !this.gvrm) {
      return Promise.resolve();
    }

    await this.gvrm.promise;
    await this.gvrm.changeFBX(animationUrl, true);

    const animationDuration = this.gvrm.character.action._clip.duration;
    this.gvrm.character.update();
    this.gvrm.updateByBones();

    return new Promise((resolve) => {
      this.currentRecordingResolve = resolve;

      let recording1Started = false;
      let recording2Started = false;
      let recordingFinished = false;
      let frameCount2 = 0;

      const frameCallback = () => {
        if (!recording1Started) {
          if (this.gvrm.character.action.time + 1.0/60 >= animationDuration) {
            // console.log("start!", this.gvrm.character.action.time, animationDuration);
            this.startRecording();
            recording1Started = true;
          }
        } else if (recording1Started && !recording2Started) {
          recording2Started = true;
        } else if (recording2Started) {
          frameCount2++;

          if (this.gvrm.character.action.time + 1.0/60 >= animationDuration && frameCount2 > 5) {
            // console.log("stop!", this.gvrm.character.action.time, animationDuration);
            // 1 additional frame ?
            requestAnimationFrame(() => {
              this.stopRecording();
              recordingFinished = true;
            });
          }
        }

        if (!recordingFinished) {
          requestAnimationFrame(frameCallback);
        }
      };

      requestAnimationFrame(frameCallback);
    });
  }
}
