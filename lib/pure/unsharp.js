// Unsharp mask filter
//
// http://stackoverflow.com/a/23322820/1031804
// USM(O) = O + (2 * (Amount / 100) * (O - GB))
// GB - gaussial blur.
//
// brightness = 0.299*R + 0.587*G + 0.114*B
// http://stackoverflow.com/a/596243/1031804
//
// To simplify math, normalize brighness mutipliers to 2^16:
//
// brightness = (19595*R + 38470*G + 7471*B) / 65536

'use strict';


var blur = require('./blur');


function clampTo8(i) { return i < 0 ? 0 : (i > 255 ? 255 : i); }

// Convert image to greyscale, 16bits FP result (8.8)
//
function greyscale(src, srcW, srcH) {
  var size = srcW * srcH;
  var result = new Uint16Array(size); // We don't use sign, but that helps to JIT
  var i, srcPtr;

  for (i = 0, srcPtr = 0; i < size; i++) {
    /*eslint-disable space-infix-ops*/
    result[i] = (src[srcPtr + 2] * 7471       // blue
               + src[srcPtr + 1] * 38470      // green
               + src[srcPtr] * 19595) >>> 8;  // red
    srcPtr = (srcPtr + 4)|0;
  }

  return result;
}

// Convert RGB image into HSV with separate layers and normalized integer values
//
function rgb2hsv(src, srcW, srcH) {
  var size = srcW * srcH;
  var hue = new Uint8Array(size);
  var saturation = new Uint8Array(size);
  var value = new Uint8Array(size);
  var alpha = new Uint8Array(size);
  var i, max, min, ptr = 0;
  var r, g, b, h, s, v, d;

  for (i = 0; i < size; i++) {
    r = src[ptr];
    g = src[ptr + 1];
    b = src[ptr + 2];
    // TODO: add fast divide: pt->r = (r+1 + (r >> 8)) >> 8; // fast way to divide by 255
    // test eslint rules exclusion
    /*eslint-disable curly*/
    if (r > 0) r = r / 255;
    if (g > 0) g = g / 255;
    if (b > 0) b = b / 255;

    max = Math.max(r, Math.max(g, b));
    min = Math.min(r, Math.min(g, b));

    h = s = v = max;
    d = max - min;

    if (max > 0) s = d / max;

    if (max === min) {
      h = 0;
    } else {
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h/= 6;
    }

    hue[i] = h * 255; // supposed to be between 0..360
    saturation[i] = s * 255; // supposed to be between 0..100
    value[i] = v * 255;
    alpha[i] = src[ptr + 3];
    ptr+=4;
  }

  return { hue: hue, saturation: saturation, value: value, alpha: alpha };
}

// Convert HSV image into RGB from separate layers
//
function hsv2rgb(src, srcW, srcH) {
  var size = srcW * srcH;
  var result = new Uint8Array(size * 4);
  var i, r, g, b, h, s, v, intH, modH, f, p, q, t, ptr = 0;

  for (i = 0; i < size; i++) {
    h = src.hue[i] / 255 * 6;
    s = src.saturation[i] / 255;
    v = src.value[i] / 255;

    intH = Math.floor(h);
    f = h - intH;
    p = v * (1 - s);
    q = v * (1 - f * s);
    t = v * (1 - (1 - f) * s);
    modH = intH % 6;
    r = [ v, q, p, p, t, v ][modH];
    g = [ t, v, v, q, p, p ][modH];
    b = [ p, p, t, v, v, q ][modH];

    result[ptr++] = r * 255;
    result[ptr++] = g * 255;
    result[ptr++] = b * 255;
    result[ptr++] = src.alpha[i];
  }

  return result;
}

// Apply unsharp mask to src
//
// NOTE: radius is ignored to simplify gaussian blur calculation
// on practice we need radius 0.3..2.0. Use 1.0 now.
//
function unsharp(src, srcW, srcH, amount, radius, threshold) {
  var diff, srcPtr, size = srcW * srcH;

  // separate image into hsv layers
  var layers = rgb2hsv(src, srcW, srcH);
  // blur v layer
  var blured = blur(layers.value, srcW, srcH, radius);

  // highlight edges in v layer with unsharp masking
  for (srcPtr = 0; srcPtr < size; srcPtr++) {
    diff = layers.value[srcPtr] - blured[srcPtr];

    if (Math.abs(diff) > threshold) {
      layers.value[srcPtr] = clampTo8(layers.value[srcPtr] + Math.floor(diff * amount / 500));
    }
  }

  // convert modified hsv image into rgb
  var result = hsv2rgb(layers, srcW, srcH);
  for (srcPtr = 0; srcPtr < size * 4; srcPtr++) {
    src[srcPtr] = result[srcPtr];
  }
}


module.exports = unsharp;
