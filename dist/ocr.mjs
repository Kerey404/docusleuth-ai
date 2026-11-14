/* The bundled Tesseract.js 7 worker protocol lets us cancel initialization as
   well as recognition. Every failure settles the job and terminates the worker. */
export async function recognizeScan(canvas, language, {signal, onProgress}) {
  const worker = new Worker(new URL('./vendor/worker.min.js', import.meta.url));
  const pending = new Map();
  let nextJob = 0;

  function rejectPending(error) {
    for (const job of pending.values()) job.reject(error);
    pending.clear();
  }
  function abort() {
    rejectPending(signal.reason || new DOMException('OCR cancelled', 'AbortError'));
    worker.terminate();
  }
  worker.onmessage = ({data: message}) => {
    const job = pending.get(message.jobId);
    if (!job) return;
    if (message.status === 'progress') {
      onProgress(message.data);
      return;
    }
    pending.delete(message.jobId);
    if (message.status === 'resolve') job.resolve(message.data);
    else job.reject(new Error(String(message.data)));
  };
  worker.onerror = event => {
    event.preventDefault();
    rejectPending(new Error(event.message || 'OCR worker failed'));
  };
  worker.onmessageerror = () => rejectPending(new Error('Invalid OCR worker reply'));
  signal.addEventListener('abort', abort, {once: true});

  function request(action, payload) {
    signal.throwIfAborted();
    const jobId = String(++nextJob);
    return new Promise((resolve, reject) => {
      pending.set(jobId, {resolve, reject});
      worker.postMessage({workerId: 'docusleuth', jobId, action, payload});
    });
  }

  try {
    await request('load', {
      options: {
        lstmOnly: true,
        corePath: new URL('./vendor/core/', import.meta.url).href,
        logging: false
      }
    });
    await request('loadLanguage', {
      langs: language,
      options: {
        langPath: new URL('./vendor/lang/', import.meta.url).href,
        cacheMethod: 'none',
        gzip: true,
        lstmOnly: true
      }
    });
    await request('initialize', {langs: language, oem: 1, config: {}});
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(value => value ? resolve(value) : reject(new Error('Could not prepare scan')), 'image/png');
    });
    const image = new Uint8Array(await blob.arrayBuffer());
    return await request('recognize', {
      image,
      options: {rotateAuto: true},
      output: {text: true}
    });
  } finally {
    signal.removeEventListener('abort', abort);
    rejectPending(new DOMException('OCR finished', 'AbortError'));
    worker.terminate();
  }
}

