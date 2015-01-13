// Blur filter
//

'use strict';


var _blurKernel = new Uint8Array([
  1, 2, 1,
  2, 4, 2,
  1, 2, 1
]);

var _bkWidth = Math.floor(Math.sqrt(_blurKernel.length));
var _bkHalf = Math.floor(_bkWidth / 2);
var _bkWsum = 0;
for (var wc = 0; wc < _blurKernel.length; wc++) { _bkWsum += _blurKernel[wc]; }


function blurPoint(gs, x, y, srcW, srcH) {
  var bx, by, sx, sy, w, wsum, br;
  var bPtr = 0;
  var blurKernel = _blurKernel;
  var bkHalf = _bkHalf;

  wsum = 0; // weight sum to normalize result
  br   = 0;

  if (x >= bkHalf && y >= bkHalf && x + bkHalf < srcW && y + bkHalf < srcH) {
    for (by = 0; by < 3; by++) {
      for (bx = 0; bx < 3; bx++) {
        sx = x + bx - bkHalf;
        sy = y + by - bkHalf;

        br += gs[sx + sy * srcW] * blurKernel[bPtr++];
      }
    }
    return (br - (br % _bkWsum)) / _bkWsum;
  }

  for (by = 0; by < 3; by++) {
    for (bx = 0; bx < 3; bx++) {
      sx = x + bx - bkHalf;
      sy = y + by - bkHalf;

      if (sx >= 0 && sx < srcW && sy >= 0 && sy < srcH) {
        w = blurKernel[bPtr];
        wsum += w;
        br += gs[sx + sy * srcW] * w;
      }
      bPtr++;
    }
  }
  /*eslint-disable space-infix-ops*/
  return ((br - (br % wsum)) / wsum)|0;
}

function blur(src, srcW, srcH, radius, iterations) {
  var i,
      output = new Uint16Array(src.length);

  // box blur is made by two passes of motion blur algorithm
  for (i = 0; i < iterations; i++) {
    output = blurMatrix(src, srcW, srcH, radius);
    src = blurMatrix(output, srcH, srcW, radius);
  }

  return src;
}

// Motion blur of a matrix, the result is a transponded
// matrix to be used for another pass
//
function blurMatrix(src, srcW, srcH, radius) {
  var x, y, i, sum, num,
      rowPtr,
      output = new Uint16Array(src.length);

  // make horizontal motion blur for each row
  for (y = 0; y < srcH; y++) {
    rowPtr = y * srcW;
    // calculate kernel for the first time
    sum = 0;
    num = radius + 1;
    for (i = 0; i <= radius; i++) {
      sum+= src[rowPtr + i];
    }
    output[y] = sum / num;

    for (x = 1; x < srcW; x++) {
      // add one more item to the kernel
      if (x < srcW - radius) {
        sum+= src[rowPtr + x + radius];
        num++;
      }
      // and remove one
      if (x > radius) {
        sum-= src[rowPtr + x - radius - 1];
        num--;
      }

      output[x * srcH + y] = sum / num;
    }
  }

  return output;
}

module.exports = blur;
