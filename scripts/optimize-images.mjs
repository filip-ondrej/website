// Image pipeline: converts heavy source images to web-ready WebP.
// Run with: npm run img   (re-run whenever source images change)
//
// Currently covers the 4 hero parallax layers (the loader is gated on them, so
// their weight IS the perceived load time). Add new entries to JOBS as real
// content images arrive — originals are never modified, WebP is emitted
// alongside and the components reference the .webp paths.
import sharp from 'sharp';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

// width: the design's retina reference (1440 logical @2x = 2880). Sources above
// that are downscaled; smaller sources pass through at native size.
const JOBS = [
    ...[1, 2, 3, 4].map((n) => ({
        src: `public/images/filip-layer-${n}.png`,
        out: `public/images/filip-layer-${n}.webp`,
        width: 2880,
        quality: 82, // visually lossless for photographic layers; alpha preserved
    })),
    // Footer timeline gallery (~700px logical @2x = 1600 is plenty)
    ...Array.from({ length: 10 }, (_, i) => 2016 + i).map((year) => ({
        src: `public/timeline/${year}.jpg`,
        out: `public/timeline/${year}.webp`,
        width: 1600,
        quality: 80,
    })),
];

let totalIn = 0;
let totalOut = 0;

for (const job of JOBS) {
    const srcAbs = path.join(ROOT, job.src);
    if (!existsSync(srcAbs)) {
        console.warn(`SKIP (missing): ${job.src}`);
        continue;
    }
    const outAbs = path.join(ROOT, job.out);
    await sharp(srcAbs)
        .resize({ width: job.width, withoutEnlargement: true })
        .webp({ quality: job.quality, effort: 5 })
        .toFile(outAbs);
    const inKB = statSync(srcAbs).size / 1024;
    const outKB = statSync(outAbs).size / 1024;
    totalIn += inKB;
    totalOut += outKB;
    console.log(
        `${job.src} ${(inKB / 1024).toFixed(1)}MB -> ${job.out} ${outKB.toFixed(0)}KB`
    );
}

console.log(
    `TOTAL ${(totalIn / 1024).toFixed(1)}MB -> ${(totalOut / 1024).toFixed(1)}MB`
);
