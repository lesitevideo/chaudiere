#!/usr/bin/env node
'use strict';

const { execFileSync } = require('node:child_process');

const CHIP = 'gpiochip0';
const LINE = 14;         // GPIO14
const ACTIVE_LOW = true; // confirmé par ton test: 0 = ON, 1 = OFF

function gpioset(value) {
  execFileSync('gpioset', ['-m', 'exit', CHIP, `${LINE}=${value}`], { stdio: 'inherit' });
}

function setRelay(on) {
  const value = ACTIVE_LOW ? (on ? 0 : 1) : (on ? 1 : 0);
  gpioset(value);
  console.log(`Relais ${on ? 'ON' : 'OFF'} (GPIO14=${value})`);
}

const cmd = process.argv[2];

if (cmd === 'on') {
  setRelay(true);
} else if (cmd === 'off') {
  setRelay(false);
} else if (cmd === 'pulse') {
  const seconds = Number(process.argv[3] || '10');
  setRelay(true);
  console.log(`Pulse ${seconds}s...`);
  setTimeout(() => {
    try { setRelay(false); } catch {}
    process.exit(0);
  }, Math.max(0, seconds) * 1000);
} else {
  console.log('Usage: sudo node relais.js on|off|pulse [seconds]');
  process.exit(1);
}
