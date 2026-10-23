import { describe, expect, it } from 'vitest';
import {
  degreeName,
  intervalLongName,
  intervalName,
  midiInterval,
  pcDegree,
  pcInterval,
} from './interval';
import { hasPc, maskToPcs, pcsToMask, rotateMask } from './pcset';
import { octaveOf, pitchClassOf, toMidi } from './pitch';
import { midiToName, nameToMidi, pcName } from './spelling';

describe('pitch / spelling', () => {
  it('midi ↔ nombre', () => {
    expect(midiToName(60)).toBe('C4');
    expect(midiToName(52)).toBe('E3');
    expect(midiToName(36)).toBe('C2');
    expect(nameToMidi('E3')).toBe(52);
    expect(nameToMidi('C♯4')).toBe(61);
    expect(nameToMidi('Bb2')).toBe(46);
    expect(nameToMidi('H4')).toBeNull();
    for (let m = 36; m <= 96; m++) {
      expect(nameToMidi(midiToName(m, 'flats'))).toBe(m);
      expect(nameToMidi(midiToName(m, 'sharps'))).toBe(m);
    }
  });
  it('enarmonía según el modo', () => {
    expect(pcName(10, 'sharps')).toBe('A♯');
    expect(pcName(10, 'flats')).toBe('B♭');
    expect(pcName(0, 'flats')).toBe('C');
    expect(midiToName(46, 'flats')).toBe('B♭2');
  });
  it('clase de altura y octava', () => {
    expect(pitchClassOf(52)).toBe(4);
    expect(pitchClassOf(-1)).toBe(11);
    expect(octaveOf(59)).toBe(3);
    expect(toMidi(4, 3)).toBe(52);
  });
});

describe('interval / pcset', () => {
  it('intervalos entre clases de altura y nombres cortos/largos', () => {
    expect(pcInterval(9, 0)).toBe(3);
    expect(pcInterval(0, 9)).toBe(9);
    expect(midiInterval(48, 55)).toBe(7);
    expect(intervalName(3)).toBe('m3');
    expect(intervalName(7)).toBe('P5');
    expect(intervalName(10)).toBe('m7');
    expect(intervalLongName(0)).toBe('fundamental');
    expect(intervalLongName(3)).toBe('3ª menor');
    expect(intervalLongName(7)).toBe('5ª justa');
    expect(intervalLongName(10)).toBe('7ª menor');
    expect(intervalLongName(14)).toBe('9ª mayor');
  });
  it('grados respecto a la raíz', () => {
    expect(degreeName(0)).toBe('1');
    expect(degreeName(3)).toBe('♭3');
    expect(degreeName(4)).toBe('3');
    expect(degreeName(7)).toBe('5');
    expect(degreeName(10)).toBe('♭7');
    expect(degreeName(14)).toBe('9');
    expect(pcDegree(9, 0)).toBe('♭3');
    expect(pcDegree(9, 4)).toBe('5');
    expect(pcDegree(9, 7)).toBe('♭7');
  });
  it('máscaras de bits', () => {
    const m = pcsToMask([0, 4, 7]);
    expect(maskToPcs(m)).toEqual([0, 4, 7]);
    expect(hasPc(m, 4)).toBe(true);
    expect(hasPc(m, 5)).toBe(false);
    expect(maskToPcs(rotateMask(m, 9))).toEqual([1, 4, 9]);
  });
});
