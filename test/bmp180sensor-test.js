const chai = require('chai');
const { describe, it } = require('mocha');
const { openSync } = require('i2c-bus');

const { Bmp180sensor } = require('../src/bmp180sensor.js');
const { oversamplingSettings } = require('../src/bmp180sensor.constants');

// This is the start of the set of tests associated with the test cases
describe('Bmp180sensor Test Suite', () => {
  it('HELPERS1: Confirm error thrown if we dont pass I2c bus', () => {
    const badFn = () => {
      // eslint-disable-next-line no-unused-vars
      const test = new Bmp180sensor();
    };
    chai.expect(badFn).to.throw(TypeError, 'Invalid bus it must a number or an i2c-bus.Bus');
  });

  it('HELPERS2: Confirm error thrown if we pass I2c a none numeric bus', () => {
    const badFn = () => {
      // eslint-disable-next-line no-unused-vars
      const test = new Bmp180sensor('bad');
    };
    chai.expect(badFn).to.throw(TypeError, 'Invalid bus it must a number or an i2c-bus.Bus');
  });

  it('HELPERS3: Confirm error thrown if we pass I2c a null bus', () => {
    const badFn = () => {
      // eslint-disable-next-line no-unused-vars
      const test = new Bmp180sensor(null);
    };
    chai.expect(badFn).to.throw(TypeError, 'Invalid bus it must a number or an i2c-bus.Bus');
  });

  it('HELPERS4: Confirm we can pass i2c-bus Bus object', () => {
    const i2cbus = openSync(1);
    const bmp180 = new Bmp180sensor(i2cbus);
    chai.expect(bmp180.isValidBus).to.equal(true);
  });

  it('HELPERS5: Confirm we can pass numeric bus', () => {
    const bmp180 = new Bmp180sensor(1);
    chai.expect(bmp180.isValidBus).to.equal(true);
  });

  it('COMMANDS1: name() - Confirm we can retrieve our sensor name', () => {
    const bmp180 = new Bmp180sensor(1);
    chai.expect(bmp180.name).to.equal('BMP180');
  });

  it('COMMANDS2: isValidChipId() - need to have BMP180 connected to bus 1, at address 0x77', async () => {
    const bmp180 = new Bmp180sensor(1);
    let success = false;

    try {
      success = await bmp180.isValidChipId();
    } catch (e) {
      throw new Error(`Got an unexpected exception: ${e.message}`);
    }

    chai.expect(success).to.equal(true);
  });

  it('COMMANDS3: softreset() - need to have BMP180 connected to bus 1, at address 0x77', async () => {
    const bmp180 = new Bmp180sensor(1);
    let success = false;

    try {
      success = await bmp180.softreset();
    } catch (e) {
      throw new Error(`Got an unexpected exception: ${e.message}`);
    }

    chai.expect(success).to.equal(true);
  });

  it('COMMANDS4: calibrate() - need to have BMP180 connected to bus 1, at address 0x77', async () => {
    const bmp180 = new Bmp180sensor(1);
    let success = false;

    try {
      success = await bmp180.calibrate();
    } catch (e) {
      throw new Error(`Got an unexpected exception: ${e.message}`);
    }

    chai.expect(success).to.equal(true);
    chai.expect(bmp180.isCalibrated).to.equal(true);
  });

  it('COMMANDS5: initialize() - need to have BMP180 connected to bus 1, at address 0x77', async () => {
    const bmp180 = new Bmp180sensor(1);
    let success = false;

    try {
      success = await bmp180.initialize();
    } catch (e) {
      throw new Error(`Got an unexpected exception: ${e.message}`);
    }

    chai.expect(success).to.equal(true);
    chai.expect(bmp180.isCalibrated).to.equal(true);
    chai.expect(bmp180.isInitialized).to.equal(true);
  });

  it('COMMANDS6: temperature() - need to have BMP180 connected to bus 1, at address 0x77', async () => {
    const bmp180 = new Bmp180sensor(1);
    let value = null;

    try {
      await bmp180.initialize().then(async () => {
        value = await bmp180.temperature();
      });
    } catch (e) {
      throw new Error(`Got an unexpected exception: ${e.message}`);
    }

    chai.expect(value).to.be.a('number');
    chai.expect(bmp180.isCalibrated).to.equal(true);
    chai.expect(bmp180.isInitialized).to.equal(true);
  });

  it('COMMANDS7: pressure() - need to have BMP180 connected to bus 1, at address 0x77', async () => {
    const bmp180 = new Bmp180sensor(1);
    let value = null;

    try {
      await bmp180.initialize().then(async () => {
        value = await bmp180.pressure();
      });
    } catch (e) {
      throw new Error(`Got an unexpected exception: ${e.message}`);
    }

    chai.expect(value).to.be.a('number');
    chai.expect(bmp180.isCalibrated).to.equal(true);
    chai.expect(bmp180.isInitialized).to.equal(true);
  });

  it('COMMANDS8: close() bus created by sensor class - need to have BMP180 connected to bus 1, at address 0x77', async () => {
    const bmp180 = new Bmp180sensor(1);
    let success = false;

    try {
      await bmp180.initialize().then(async () => {
        success = await bmp180.close();
      });
    } catch (e) {
      throw new Error(`Got an unexpected exception: ${e.message}`);
    }

    chai.expect(success).to.equal(true);
  });

  it('COMMANDS9: close() bus created and passed to sensor class - need to have BMP180 connected to bus 1, at address 0x77', async () => {
    const i2cbus = openSync(1);
    const bmp180 = new Bmp180sensor(i2cbus);
    let success = null;

    try {
      await bmp180.initialize().then(async () => {
        success = await bmp180.close();
      });
    } catch (e) {
      throw new Error(`Got an unexpected exception: ${e.message}`);
    }

    chai.expect(success).to.equal(false);
  });

  it('OSS1: Confirm we can get the pressure oversampling', () => {
    const bmp180 = new Bmp180sensor(1);
    const value = bmp180.oss;
    chai.expect(value).to.deep.equal(oversamplingSettings.standard);
  });

  it('OSS2: Confirm we can set the pressure oversampling', () => {
    const bmp180 = new Bmp180sensor(1);
    const originalvalue = bmp180.oss;

    bmp180.oss = oversamplingSettings.high;
    const value = bmp180.oss;

    chai.expect(originalvalue).to.deep.equal(oversamplingSettings.standard);
    chai.expect(value).to.deep.equal(oversamplingSettings.high);
  });
});
