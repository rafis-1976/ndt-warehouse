import React, { useMemo } from 'react';

// Implementación del generador de QR (basado en qrcode-generator, sin dependencias externas)
const qrCodeGenerator = (() => {
  function QR8bitByte(data: string) {
    this.mode = 4; this.data = data; this.parsedData = [];
    for (let i = 0; i < this.data.length; i++) {
      const byteArray = [];
      let code = this.data.charCodeAt(i);
      if (code > 0x10000) {
        byteArray[0] = 0xF0 | ((code & 0x1C0000) >>> 18);
        byteArray[1] = 0x80 | ((code & 0x3F000) >>> 12);
        byteArray[2] = 0x80 | ((code & 0xFC0) >>> 6);
        byteArray[3] = 0x80 | (code & 0x3F);
        code = 0x10000;
      } else if (code > 0x800) {
        byteArray[0] = 0xE0 | ((code & 0xF000) >>> 12);
        byteArray[1] = 0x80 | ((code & 0xFC0) >>> 6);
        byteArray[2] = 0x80 | (code & 0x3F);
        code = 0x800;
      } else if (code > 0x80) {
        byteArray[0] = 0xC0 | ((code & 0x7C0) >>> 6);
        byteArray[1] = 0x80 | (code & 0x3F);
        code = 0x80;
      }
      if (code <= 0x80) byteArray.unshift(code);
      this.parsedData.push(byteArray);
    }
    this.parsedData = Array.prototype.concat.apply([], this.parsedData);
    if (this.parsedData.length != this.data.length) {
      this.parsedData.unshift(191); this.parsedData.unshift(187); this.parsedData.unshift(239);
    }
  }
  QR8bitByte.prototype = {
    getLength: function () { return this.parsedData.length; },
    write: function (buffer) { for (let i = 0; i < this.parsedData.length; i++) buffer.put(this.parsedData[i], 8); }
  };

  const QRMath = {
    glog: function (n: number) { if (n < 1) throw new Error("glog(" + n + ")"); return QRMath.LOG_TABLE[n]; },
    gexp: function (n: number) { while (n < 0) n += 255; while (n >= 256) n -= 255; return QRMath.EXP_TABLE[n]; },
    EXP_TABLE: new Array(256), LOG_TABLE: new Array(256)
  };
  for (let i = 0; i < 8; i++) QRMath.EXP_TABLE[i] = 1 << i;
  for (let i = 8; i < 256; i++) QRMath.EXP_TABLE[i] = QRMath.EXP_TABLE[i - 4] ^ QRMath.EXP_TABLE[i - 5] ^ QRMath.EXP_TABLE[i - 6] ^ QRMath.EXP_TABLE[i - 8];
  for (let i = 0; i < 255; i++) QRMath.LOG_TABLE[QRMath.EXP_TABLE[i]] = i;

  function QRPolynomial(num: number[], shift: number) {
    if (num.length == undefined) throw new Error(num.length + "/" + shift);
    let offset = 0; while (offset < num.length && num[offset] == 0) offset++;
    this.num = new Array(num.length - offset + shift);
    for (let i = 0; i < num.length - offset; i++) this.num[i] = num[i + offset];
  }
  QRPolynomial.prototype = {
    get: function (index: number) { return this.num[index]; },
    getLength: function () { return this.num.length; },
    multiply: function (e: any) {
      const num = new Array(this.getLength() + e.getLength() - 1).fill(0);
      for (let i = 0; i < this.getLength(); i++) for (let j = 0; j < e.getLength(); j++) num[i + j] ^= QRMath.gexp(QRMath.glog(this.get(i)) + QRMath.glog(e.get(j)));
      return new QRPolynomial(num, 0);
    },
    mod: function (e: any) {
      if (this.getLength() - e.getLength() < 0) return this;
      const ratio = QRMath.glog(this.get(0)) - QRMath.glog(e.get(0));
      const num = new Array(this.getLength());
      for (let i = 0; i < this.getLength(); i++) num[i] = this.get(i);
      for (let i = 0; i < e.getLength(); i++) num[i] ^= QRMath.gexp(QRMath.glog(e.get(i)) + ratio);
      return new QRPolynomial(num, 0).mod(e);
    }
  };

  function QRRSBlock(totalCount: number, dataCount: number) { this.totalCount = totalCount; this.dataCount = dataCount; }
  QRRSBlock.RS_BLOCK_TABLE = [
    1, 26, 19, 1, 26, 16, 1, 26, 13, 1, 26, 9, 1, 44, 34, 1, 44, 28, 1, 44, 22, 1, 44, 16, 1, 70, 55, 1, 70, 44, 1, 70, 34, 1, 70, 26, 1, 100, 80, 1, 100, 64, 1, 100, 48, 1, 100, 36, 1, 134, 108, 1, 134, 86, 1, 134, 62, 1, 134, 46, 2, 86, 68, 2, 86, 54, 2, 86, 42, 2, 86, 30, 2, 98, 78, 2, 98, 62, 2, 98, 46, 2, 98, 34, 2, 121, 97, 2, 121, 75, 2, 121, 55, 2, 121, 41, 2, 146, 116, 2, 146, 94, 2, 146, 68, 2, 146, 50, 2, 86, 68, 3, 86, 54, 3, 86, 42, 3, 86, 30, 2, 98, 78, 3, 98, 62, 3, 98, 46, 3, 98, 34, 3, 121, 97, 2, 121, 75, 3, 121, 55, 3, 121, 41, 3, 146, 116, 3, 146, 94, 2, 146, 68, 3, 146, 50
  ];
  function getRSBlocks(typeNumber: number, errorCorrectionLevel: string) {
    const rsBlock = QRRSBlock.RS_BLOCK_TABLE;
    const length = rsBlock.length / 3;
    const offset = (function () {
      switch (errorCorrectionLevel) { case 'L': return 0; case 'M': return 1; case 'Q': return 2; case 'H': return 3; }
      return 0;
    })();
    const index = (typeNumber - 1) * 4 + offset;
    return [new QRRSBlock(rsBlock[index * 3], rsBlock[index * 3 + 1])];
  }

  const QRUtil = {
    PATTERN_POSITION_TABLE: [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50], [6, 30, 54], [6, 32, 58], [6, 34, 62], [6, 26, 46, 66], [6, 26, 48, 70], [6, 26, 50, 74], [6, 30, 54, 78], [6, 30, 56, 82], [6, 30, 58, 86], [6, 34, 62, 90], [6, 28, 50, 72, 94], [6, 26, 50, 74, 98], [6, 30, 54, 78, 102], [6, 28, 54, 80, 106], [6, 32, 58, 84, 110], [6, 30, 58, 86, 114], [6, 34, 62, 90, 118], [6, 26, 50, 74, 98, 122], [6, 30, 54, 78, 102, 126], [6, 26, 52, 78, 104, 130], [6, 30, 56, 82, 108, 134], [6, 34, 60, 86, 112, 138], [6, 30, 58, 86, 114, 142], [6, 34, 62, 90, 118, 146], [6, 30, 54, 78, 102, 126, 150], [6, 24, 50, 76, 102, 128, 154], [6, 28, 54, 80, 106, 132, 158], [6, 32, 58, 84, 110, 136, 162], [6, 26, 54, 82, 110, 138, 166], [6, 30, 58, 86, 114, 142, 170]],
    G15: (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0),
    G18: (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0),
    G15_MASK: (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1),
    getBCHTypeInfo: function (data: number) {
      let d = data << 10;
      while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15) >= 0) d ^= (QRUtil.G15 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15)));
      return ((data << 10) | d) ^ QRUtil.G15_MASK;
    },
    getBCHTypeNumber: function (data: number) {
      let d = data << 12;
      while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18) >= 0) d ^= (QRUtil.G18 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18)));
      return (data << 12) | d;
    },
    getBCHDigit: function (data: number) { let digit = 0; while (data != 0) { digit++; data >>>= 1; } return digit; },
    getPatternPosition: function (typeNumber: number) { return QRUtil.PATTERN_POSITION_TABLE[typeNumber - 1]; },
    getMask: function (maskPattern: number, i: number, j: number) {
      switch (maskPattern) {
        case 0: return (i + j) % 2 == 0;
        case 1: return i % 2 == 0;
        case 2: return j % 3 == 0;
        case 3: return (i + j) % 3 == 0;
        case 4: return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 == 0;
        case 5: return (i * j) % 2 + (i * j) % 3 == 0;
        case 6: return ((i * j) % 2 + (i * j) % 3) % 2 == 0;
        case 7: return ((i * j) % 3 + (i + j) % 2) % 2 == 0;
        default: throw new Error("bad maskPattern:" + maskPattern);
      }
    },
    getErrorCorrectPolynomial: function (errorCorrectLength: number) {
      let a = new QRPolynomial([1], 0);
      for (let i = 0; i < errorCorrectLength; i++) a = a.multiply(new QRPolynomial([1, QRMath.gexp(i)], 0));
      return a;
    },
    getLengthInBits: function (mode: number, type: number) {
      if (1 <= type && type < 10) return mode == 8 ? 8 : 16;
      else if (type < 27) return mode == 8 ? 16 : 16;
      else if (type < 41) return mode == 8 ? 16 : 16;
      else throw new Error("type:" + type);
    },
    getLostPoint: function (qrCode: any) {
      let lostPoint = 0;
      const moduleCount = qrCode.getModuleCount();
      for (let row = 0; row < moduleCount; row++) {
        for (let col = 0; col < moduleCount; col++) {
          let sameCount = 0;
          const dark = qrCode.isDark(row, col);
          for (let r = -1; r <= 1; r++) {
            if (row + r < 0 || moduleCount <= row + r) continue;
            for (let c = -1; c <= 1; c++) {
              if (col + c < 0 || moduleCount <= col + c) continue;
              if (r == 0 && c == 0) continue;
              if (dark == qrCode.isDark(row + r, col + c)) sameCount++;
            }
          }
          if (sameCount > 5) lostPoint += (3 + sameCount - 5);
        }
      }
      return lostPoint;
    }
  };

  return function (data: string) {
    const qr = new (function() {
      this.typeNumber = -1; this.errorCorrectionLevel = 'L'; this.modules = null; this.moduleCount = 0; this.dataCache = null; this.dataList = [];
      this.addData = function(data: string) { this.dataList.push(new QR8bitByte(data)); this.dataCache = null; };
      this.make = function() {
        if (this.typeNumber < 1) {
          let typeNumber = 1;
          for (typeNumber = 1; typeNumber < 40; typeNumber++) {
            const rsBlocks = getRSBlocks(typeNumber, this.errorCorrectionLevel);
            let totalDataCount = 0;
            for (let i = 0; i < rsBlocks.length; i++) totalDataCount += rsBlocks[i].dataCount;
            if (this.dataList.reduce((acc, d) => acc + d.getLength(), 0) <= totalDataCount * 8) break;
          }
          this.typeNumber = typeNumber;
        }
        this.makeImpl(false, this.getBestMaskPattern());
      };
      this.makeImpl = function(test: boolean, maskPattern: number) {
        this.moduleCount = this.typeNumber * 4 + 17;
        this.modules = new Array(this.moduleCount).fill(0).map(() => new Array(this.moduleCount).fill(null));
        this.setupPositionProbePattern(0, 0); this.setupPositionProbePattern(this.moduleCount - 7, 0); this.setupPositionProbePattern(0, this.moduleCount - 7);
        this.setupPositionAdjustPattern(); this.setupTimingPattern(); this.setupTypeInfo(test, maskPattern);
        if (this.typeNumber >= 7) this.setupTypeNumber(test);
        if (this.dataCache == null) this.dataCache = this.createData(this.typeNumber, this.errorCorrectionLevel, this.dataList);
        this.mapData(this.dataCache, maskPattern);
      };
      this.setupPositionProbePattern = function(row: number, col: number) {
        for (let r = -1; r <= 7; r++) {
          if (row + r <= -1 || this.moduleCount <= row + r) continue;
          for (let c = -1; c <= 7; c++) {
            if (col + c <= -1 || this.moduleCount <= col + c) continue;
            this.modules[row + r][col + c] = (0 <= r && r <= 6 && (c == 0 || c == 6)) || (0 <= c && c <= 6 && (r == 0 || r == 6)) || (2 <= r && r <= 4 && 2 <= c && c <= 4);
          }
        }
      };
      this.getBestMaskPattern = function() {
        let minLostPoint = 0, pattern = 0;
        for (let i = 0; i < 8; i++) {
          this.makeImpl(true, i);
          const lostPoint = QRUtil.getLostPoint(this);
          if (i == 0 || minLostPoint > lostPoint) { minLostPoint = lostPoint; pattern = i; }
        }
        return pattern;
      };
      this.setupTimingPattern = function() {
        for (let r = 8; r < this.moduleCount - 8; r++) { if (this.modules[r][6] != null) continue; this.modules[r][6] = (r % 2 == 0); }
        for (let c = 8; c < this.moduleCount - 8; c++) { if (this.modules[6][c] != null) continue; this.modules[6][c] = (c % 2 == 0); }
      };
      this.setupPositionAdjustPattern = function() {
        const pos = QRUtil.getPatternPosition(this.typeNumber);
        for (let i = 0; i < pos.length; i++) {
          for (let j = 0; j < pos.length; j++) {
            const row = pos[i], col = pos[j];
            if (this.modules[row][col] != null) continue;
            for (let r = -2; r <= 2; r++) for (let c = -2; c <= 2; c++) this.modules[row + r][col + c] = (r == -2 || r == 2 || c == -2 || c == 2 || (r == 0 && c == 0));
          }
        }
      };
      this.setupTypeNumber = function(test: boolean) {
        const bits = QRUtil.getBCHTypeNumber(this.typeNumber);
        for (let i = 0; i < 18; i++) {
          const mod = (!test && ((bits >> i) & 1) == 1);
          this.modules[Math.floor(i / 3)][i % 3 + this.moduleCount - 8 - 3] = mod;
        }
        for (let i = 0; i < 18; i++) {
          const mod = (!test && ((bits >> i) & 1) == 1);
          this.modules[i % 3 + this.moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
        }
      };
      this.setupTypeInfo = function(test: boolean, maskPattern: number) {
        const data = (this.errorCorrectionLevel << 3) | maskPattern;
        const bits = QRUtil.getBCHTypeInfo(data);
        for (let i = 0; i < 15; i++) {
          const mod = (!test && ((bits >> i) & 1) == 1);
          if (i < 6) this.modules[i][8] = mod;
          else if (i < 8) this.modules[i + 1][8] = mod;
          else this.modules[this.moduleCount - 15 + i][8] = mod;
        }
        for (let i = 0; i < 15; i++) {
          const mod = (!test && ((bits >> i) & 1) == 1);
          if (i < 8) this.modules[8][this.moduleCount - i - 1] = mod;
          else if (i < 9) this.modules[8][15 - i - 1 + 1] = mod;
          else this.modules[8][15 - i - 1] = mod;
        }
        this.modules[this.moduleCount - 8][8] = (!test);
      };
      this.mapData = function(data: number[], maskPattern: number) {
        let inc = -1, row = this.moduleCount - 1, bitIndex = 7, byteIndex = 0;
        for (let col = this.moduleCount - 1; col > 0; col -= 2) {
          if (col == 6) col--;
          while (true) {
            for (let c = 0; c < 2; c++) {
              if (this.modules[row][col - c] == null) {
                let dark = false;
                if (byteIndex < data.length) dark = (((data[byteIndex] >>> bitIndex) & 1) == 1);
                const mask = QRUtil.getMask(maskPattern, row, col - c);
                if (mask) dark = !dark;
                this.modules[row][col - c] = dark;
                bitIndex--;
                if (bitIndex == -1) { byteIndex++; bitIndex = 7; }
              }
            }
            row += inc;
            if (row < 0 || this.moduleCount <= row) { row -= inc; inc = -inc; break; }
          }
        }
      };
      this.createData = function(typeNumber: number, errorCorrectionLevel: string, dataList: any[]) {
        const rsBlocks = getRSBlocks(typeNumber, errorCorrectionLevel);
        const buffer = new (function() {
          this.buffer = []; this.length = 0;
          this.put = function(num: number, length: number) {
            for (let i = 0; i < length; i++) this.putBit(((num >>> (length - i - 1)) & 1) == 1);
          };
          this.putBit = function(bit: boolean) {
            const bufIndex = Math.floor(this.length / 8);
            if (this.buffer.length <= bufIndex) this.buffer.push(0);
            if (bit) this.buffer[bufIndex] |= (0x80 >>> (this.length % 8));
            this.length++;
          };
        })();
        for (let i = 0; i < dataList.length; i++) {
          const data = dataList[i];
          buffer.put(data.mode, 4);
          buffer.put(data.getLength(), QRUtil.getLengthInBits(data.mode, typeNumber));
          data.write(buffer);
        }
        let totalDataCount = 0;
        for (let i = 0; i < rsBlocks.length; i++) totalDataCount += rsBlocks[i].dataCount;
        if (buffer.length + 4 <= totalDataCount * 8) buffer.put(0, 4);
        while (buffer.length % 8 != 0) buffer.putBit(false);
        while (true) {
          if (buffer.length >= totalDataCount * 8) break;
          buffer.put(0xEC, 8);
          if (buffer.length >= totalDataCount * 8) break;
          buffer.put(0x11, 8);
        }
        return this.createBytes(buffer, rsBlocks);
      };
      this.createBytes = function(buffer: any, rsBlocks: any[]) {
        let offset = 0, maxDcCount = 0, maxEcCount = 0;
        const dcdata = new Array(rsBlocks.length), ecdata = new Array(rsBlocks.length);
        for (let r = 0; r < rsBlocks.length; r++) {
          const dcCount = rsBlocks[r].dataCount, ecCount = rsBlocks[r].totalCount - dcCount;
          maxDcCount = Math.max(maxDcCount, dcCount); maxEcCount = Math.max(maxEcCount, ecCount);
          dcdata[r] = new Array(dcCount);
          for (let i = 0; i < dcCount; i++) dcdata[r][i] = 0xff & buffer.buffer[i + offset];
          offset += dcCount;
          const rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
          const rawPoly = new QRPolynomial(dcdata[r], rsPoly.getLength() - 1);
          const modPoly = rawPoly.mod(rsPoly);
          ecdata[r] = new Array(rsPoly.getLength() - 1);
          for (let i = 0; i < ecdata[r].length; i++) {
            const modIndex = i + modPoly.getLength() - ecdata[r].length;
            ecdata[r][i] = (modIndex >= 0) ? modPoly.get(modIndex) : 0;
          }
        }
        let totalCodeCount = 0;
        for (let i = 0; i < rsBlocks.length; i++) totalCodeCount += rsBlocks[i].totalCount;
        const data = new Array(totalCodeCount);
        let index = 0;
        for (let i = 0; i < maxDcCount; i++) for (let r = 0; r < rsBlocks.length; r++) if (i < dcdata[r].length) data[index++] = dcdata[r][i];
        for (let i = 0; i < maxEcCount; i++) for (let r = 0; r < rsBlocks.length; r++) if (i < ecdata[r].length) data[index++] = ecdata[r][i];
        return data;
      };
    })();
    
    qr.addData(data);
    qr.make();
    return qr;
  };
})();

export function QRCodeSVG({ value, size = 100, className = '' }: { value: string, size?: number, className?: string }) {
  const qr = useMemo(() => {
    try {
      return qrCodeGenerator(value || ' ');
    } catch (e) {
      console.error("Error generating QR:", e);
      return null;
    }
  }, [value]);

  if (!qr) return null;

  const count = qr.moduleCount;
  const cellSize = size / count;
  const margin = 2; // Margen de 2 módulos alrededor
  const totalSize = size + margin * 2 * cellSize;

  let path = '';
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) {
        path += `M${(c + margin) * cellSize},${(r + margin) * cellSize}h${cellSize}v${cellSize}h-${cellSize}z `;
      }
    }
  }

  return (
    <svg 
      width={totalSize} 
      height={totalSize} 
      viewBox={`0 0 ${totalSize} ${totalSize}`} 
      className={className}
      shapeRendering="crispEdges"
    >
      <rect width="100%" height="100%" fill="#ffffff" />
      <path d={path} fill="#00205B" />
    </svg>
  );
}