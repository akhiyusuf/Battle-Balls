/**
 * The "studio" recorder: captures the Pixi canvas to a .webm clip at
 * 1080x1920 / 60fps — Ball Thing's "export fights into videos quickly".
 */
export class ClipRecorder {
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];

  get recording() {
    return this.rec !== null;
  }

  static supported(canvas: HTMLCanvasElement): boolean {
    return typeof canvas.captureStream === "function" && "MediaRecorder" in window;
  }

  start(canvas: HTMLCanvasElement) {
    if (this.rec) return;
    const stream = canvas.captureStream(60);
    const mime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]
      .find(m => MediaRecorder.isTypeSupported(m)) ?? "";
    this.chunks = [];
    this.rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12_000_000 });
    this.rec.ondataavailable = (e) => { if (e.data.size) this.chunks.push(e.data); };
    this.rec.start();
  }

  /** Stops and downloads the clip. Resolves once the file has been handed to the browser. */
  stop(filename: string): Promise<void> {
    return new Promise((resolve) => {
      const rec = this.rec;
      if (!rec) { resolve(); return; }
      this.rec = null;
      rec.onstop = () => {
        const blob = new Blob(this.chunks, { type: "video/webm" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        resolve();
      };
      rec.stop();
    });
  }
}
