/**
 * Tests for the ObjectFactory.
 */
import objectFactory from '@/models/ObjectFactory';
import {
  EllipseInterface,
  ImageInterface,
  LineInterface,
  RectangleInterface,
  TextInterface,
} from '@/models/GraphicObjectInterface';
import { describe, it, expect } from 'vitest';

describe('ObjectFactory', () => {
  it('creates a rectangle with default properties', () => {
    const obj = objectFactory('rectangle') as RectangleInterface;
    expect(obj.type).toBe('rectangle');
    expect(obj.scale.width).toBe(100);
    expect(obj.scale.height).toBe(100);
    expect(obj.color).toBe('#D9D9D9');
    expect(obj.rotation).toBe(0);
    expect(obj.id).toBeTruthy();
  });

  it('creates an ellipse with default properties', () => {
    const obj = objectFactory('ellipse') as EllipseInterface;
    expect(obj.type).toBe('ellipse');
    expect('scale' in obj).toBe(true);
  });

  it('creates a line with default properties', () => {
    const obj = objectFactory('line') as LineInterface;
    expect(obj.type).toBe('line');
    expect(obj.length).toBe(250);
    expect(obj.strokeWidth).toBe(2);
    expect('scale' in obj).toBe(false);
  });

  it('creates a text object with default properties', () => {
    const obj = objectFactory('text') as TextInterface;
    expect(obj.type).toBe('text');
    expect(obj.text).toBe('new text');
    expect(obj.textSize).toBe(16);
    expect(obj.textColor).toBe('#000000');
  });

  it('creates an image with default properties', () => {
    const obj = objectFactory('image') as ImageInterface;
    expect(obj.type).toBe('image');
    expect(obj.imgSrc).toBeTruthy();
    expect('scale' in obj).toBe(true);
  });

  it('each created object has a unique id', () => {
    const a = objectFactory('rectangle');
    const b = objectFactory('rectangle');
    expect(a.id).not.toBe(b.id);
  });
});
