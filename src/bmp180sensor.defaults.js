const { oversamplingSettings } = require('./bmp180sensor.constants');

const bmp180sensorDefaults = {
  oss: oversamplingSettings.standard,
};

module.exports = {
  bmp180sensorDefaults,
};
