// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// jsdom's test environment doesn't expose TextEncoder/TextDecoder as
// globals, but react-router v7 references them at import time.
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = global.TextEncoder || TextEncoder;
global.TextDecoder = global.TextDecoder || TextDecoder;

// jsdom has no real canvas support; several components (CanvasNetwork,
// CardLineageCanvas) draw on a rAF loop and would otherwise throw on
// `ctx.clearRect` etc. when rendered in tests.
HTMLCanvasElement.prototype.getContext = () => ({
  clearRect: () => {},
  beginPath: () => {},
  arc: () => {},
  moveTo: () => {},
  lineTo: () => {},
  stroke: () => {},
  fill: () => {},
});

// jsdom doesn't implement ResizeObserver (CardLineageCanvas uses it to
// resize its canvas backing store only when displayed size actually changes).
global.ResizeObserver = global.ResizeObserver || class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// jsdom doesn't implement IntersectionObserver (MemoryTimeline uses it for
// scroll-in animation on each memory card).
global.IntersectionObserver = global.IntersectionObserver || class IntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// jsdom doesn't implement scrollIntoView (used by ActivityFeed, various
// "jump to section" buttons across the app).
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
