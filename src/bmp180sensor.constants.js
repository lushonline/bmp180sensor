const oversamplingSettings = {
  ultra_low_power: {
    mode: 0,
    command: 0x34,
    delay: 5,
  },
  standard: {
    mode: 1,
    command: 0x74,
    delay: 8,
  },
  high: {
    mode: 2,
    command: 0xb4,
    delay: 14,
  },
  ultra_high_resolution: {
    mode: 3,
    command: 0xf4,
    delay: 26,
  },
  temperature: {
    mode: 255,
    command: 0x2e,
    delay: 8,
  },
};

const registers = {
  calibration: 0xaa,
  chipid: 0xd0,
  version: 0xd1,
  softreset: 0xe0,
  control: 0xf4,
  results: 0xf6,
};

module.exports = {
  oversamplingSettings: Object.freeze(oversamplingSettings),
  registers: Object.freeze(registers),
};
