// frameWorker.js
let canvas, ctx;
let prevROI = null;
let buffer = null; // reuse this

self.onmessage = async (e) => {
    const { type } = e.data;

    if (type === "init") {
        canvas = e.data.canvas;
        ctx = canvas.getContext("2d");
    }

    if (type === "process") {
        const { bitmap, roi, frameNum, time } = e.data;

        if (canvas.width !== bitmap.width || canvas.height !== bitmap.height) {
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
        }

        ctx.drawImage(bitmap, 0, 0);

        const imageData = ctx.getImageData(roi.x, roi.y, roi.w, roi.h);
        if (!buffer || buffer.length !== imageData.data.length / 4) {
            buffer = new Uint8Array(imageData.data.length / 4);
        }

        const score = compareROI(imageData, buffer);

        if (score > e.data.threshold) {
            // Only convert to PNG if needed
            canvas.convertToBlob({ type: "image/png" }).then(blob => {
                self.postMessage({
                    type: "result",
                    score,
                    frameNum,
                    time,
                    blob
                });
            });
        } else {
            self.postMessage({
                type: "result",
                score,
                frameNum,
                time
            });
        }
    }

};

// reuses buffer
function compareROI(current, buf) {
    const curr = preprocess(current.data, buf);

    if (!prevROI) {
        prevROI = new Uint8Array(curr);
        return 999;
    }

    let diff = 0;
    for (let i = 0; i < curr.length; i++) {
        diff += Math.abs(curr[i] - prevROI[i]);
        prevROI[i] = curr[i]; // update in-place
    }

    return diff / curr.length;
}

// reuse output array
function preprocess(data, out) {
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
        const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        out[j] = g > 140 ? 255 : 0;
    }
    return out;
}
