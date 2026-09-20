import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getGpuInfo } from '../dist/index.js';

function setup(webgl2=true,debug=true){
  let released=0;const calls=[];
  const values={1:'Masked GPU',2:'Masked vendor',3:'WebGL 2.0',4:16384,5:'WebGL GLSL ES 3.00',6:8192,7:16384,8:new Int32Array([16384,16384]),9:32,10:16,11:2048,12:256,13:4,14:8,100:'Actual GPU',101:'Actual vendor'};
  const gl={RENDERER:1,VENDOR:2,VERSION:3,MAX_TEXTURE_SIZE:4,SHADING_LANGUAGE_VERSION:5,MAX_CUBE_MAP_TEXTURE_SIZE:6,MAX_RENDERBUFFER_SIZE:7,MAX_VIEWPORT_DIMS:8,MAX_COMBINED_TEXTURE_IMAGE_UNITS:9,MAX_VERTEX_ATTRIBS:10,MAX_3D_TEXTURE_SIZE:11,MAX_ARRAY_TEXTURE_LAYERS:12,MAX_SAMPLES:13,MAX_COLOR_ATTACHMENTS:14,
    getParameter:key=>{calls.push(key);return values[key];},getContextAttributes:()=>({antialias:false}),getSupportedExtensions:()=>['EXT_test','WEBGL_test'],
    getExtension:name=>name==='WEBGL_debug_renderer_info'?(debug?{UNMASKED_RENDERER_WEBGL:100,UNMASKED_VENDOR_WEBGL:101}:null):name==='WEBGL_lose_context'?{loseContext:()=>released++}:null};
  globalThis.document={createElement:()=>({getContext:type=>type==='webgl2'&&!webgl2?null:gl})};
  return {gl,values,calls,released:()=>released};
}

test('WebGL2 reports limits and JSON-safe viewport, then releases the context',()=>{
  const env=setup();const info=getGpuInfo();
  assert.equal(info.renderer.value,'Actual GPU');assert.equal(info.rendererUnmasked.value,true);
  assert.deepEqual(info.maxViewportDimensions.value,[16384,16384]);assert.equal(info.maxSamples.value,4);
  assert.equal(info.antialias.value,false);assert.deepEqual(info.extensions.value,['EXT_test','WEBGL_test']);
  assert.equal(env.released(),1);
  for(const field of Object.values(info))assert.deepEqual(Object.keys(field).sort(),['source','value']);
});

test('WebGL1 with masked renderer does not query WebGL2-only limits',()=>{
  const env=setup(false,false);const info=getGpuInfo();
  assert.equal(info.renderer.value,'Masked GPU');assert.equal(info.rendererUnmasked.value,false);
  assert.equal(info.maxSamples.value,null);assert.equal(info.max3DTextureSize.value,null);
  assert.ok(!env.calls.includes(11));assert.equal(env.released(),1);
});

test('failed optional queries do not erase GPU identity or manufacture null/zero data',()=>{
  const env=setup();env.gl.getSupportedExtensions=()=>{throw Error('Denied');};env.values[4]=null;env.values[100]=null;
  const info=getGpuInfo();assert.equal(info.renderer.value,'Masked GPU');assert.equal(info.maxTextureSize.value,null);
  assert.equal(info.extensions.value,null);assert.equal(info.vendor.value,'Actual vendor');assert.equal(env.released(),1);
});

test('unavailable WebGL returns unavailable fields',()=>{
  globalThis.document={createElement:()=>({getContext:()=>null})};
  for(const field of Object.values(getGpuInfo()))assert.deepEqual(field,{value:null,source:'unavailable'});
});
