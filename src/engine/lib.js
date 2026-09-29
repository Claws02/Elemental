// ============================================================
// LIB — the one place the engine libraries are imported from
// ============================================================
//
// three.js r186 and cannon-es 0.20 are ES modules, vendored in vendor/ and
// imported by relative path: no bundler, no import map, nothing that depends
// on the WebView supporting more than plain ES modules. Every other file
// imports THREE and CANNON from here, so an engine upgrade touches this file
// and vendor/, not forty import lines.
// ============================================================

export * as THREE from '../../vendor/three.module.min.js';
export * as CANNON from '../../vendor/cannon-es.min.js';
