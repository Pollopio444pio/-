/**
 * worker.js
 * ------------------------------------------------------------------------
 * Runs the actual pixel processing off the main thread so drag/drop,
 * scrolling, animations and keyboard input never freeze while a large
 * (potentially HD, up to 8192x8192) template is being converted.
 *
 * Protocol (postMessage), all messages are { id, ... }:
 *   -> { type: 'convert', id, kind: 'shirt'|'pants', bitmap, width, height, smoothing }
 *   <- { type: 'progress', id, done, total }
 *   <- { type: 'result', id, blob, outputSize }
 *   <- { type: 'error', id, message }
 *
 * `bitmap` is an ImageBitmap sent as a transferable, so handing it to the
 * worker is a zero-copy operation on the sending side.
 * ------------------------------------------------------------------------
 */

import { convertFromSource } from './converter.js';
import { canvasToBlob, closeBitmapSafe } from './imageProcessor.js';

self.onmessage = async (event) => {
  const message = event.data;
  if (message?.type !== 'convert') return;

  const { id, kind, bitmap, width, height, smoothing } = message;

  try {
    const { canvas, outputSize } = convertFromSource(kind, bitmap, width, height, {
      smoothing,
      onStep: (done, total) => {
        self.postMessage({ type: 'progress', id, done, total });
      },
    });

    const blob = await canvasToBlob(canvas);
    self.postMessage({ type: 'result', id, blob, outputSize });
  } catch (error) {
    self.postMessage({ type: 'error', id, message: error.message || 'Conversion failed.' });
  } finally {
    closeBitmapSafe(bitmap);
  }
};
