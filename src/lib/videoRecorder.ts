/** Thin wrapper around MediaRecorder for capturing a <canvas> animation to a video file. */
export class CanvasVideoRecorder {
	private recorder: MediaRecorder | null = null;
	private chunks: BlobPart[] = [];
	private mimeType: string;

	constructor(
		private canvas: HTMLCanvasElement,
		private fps = 30
	) {
		this.mimeType = CanvasVideoRecorder.pickSupportedMimeType();
	}

	static pickSupportedMimeType(): string {
		const candidates = [
			'video/webm;codecs=vp9',
			'video/webm;codecs=vp8',
			'video/webm',
			'video/mp4'
		];
		for (const type of candidates) {
			if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
				return type;
			}
		}
		return 'video/webm';
	}

	get isRecording(): boolean {
		return this.recorder?.state === 'recording';
	}

	start() {
		const stream = this.canvas.captureStream(this.fps);
		this.chunks = [];
		this.recorder = new MediaRecorder(stream, { mimeType: this.mimeType });
		this.recorder.ondataavailable = (e) => {
			if (e.data.size > 0) this.chunks.push(e.data);
		};
		this.recorder.start();
	}

	stop(): Promise<Blob> {
		return new Promise((resolve, reject) => {
			if (!this.recorder) {
				reject(new Error('Recorder was not started.'));
				return;
			}
			this.recorder.onstop = () => {
				resolve(new Blob(this.chunks, { type: this.mimeType }));
			};
			this.recorder.stop();
		});
	}
}

export function downloadBlob(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}
