import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getNetworkInfo, watchNetworkInfo } from '../dist/index.js';
const nav = value => Object.defineProperty(globalThis,'navigator',{configurable:true,value});

test('network preserves zero and false values, strict shapes and API exposure',()=>{
  nav({onLine:true,connection:{effectiveType:'4g',type:'wifi',rtt:0,downlink:0,saveData:false},bluetooth:{requestDevice(){throw Error('Must not request devices');}},usb:{}});
  const info=getNetworkInfo();
  assert.deepEqual(info.rttMs,{value:0,source:'reported'});
  assert.equal(info.downlinkMbps.value,0);assert.equal(info.saveData.value,false);
  assert.equal(info.connectionType.value,'wifi');assert.equal(info.bluetoothApi.value,true);
  assert.equal(info.usbApi.value,true);
  for(const field of Object.values(info))assert.deepEqual(Object.keys(field).sort(),['source','value']);
});

test('partial, blocked and missing network APIs degrade per field',()=>{
  nav({onLine:false});let info=getNetworkInfo();
  assert.equal(info.online.value,false);assert.equal(info.rttMs.value,null);assert.equal(info.usbApi.value,false);
  nav({connection:{rtt:NaN,downlink:-1,get effectiveType(){throw Error('Denied');}}});
  info=getNetworkInfo();assert.equal(info.effectiveType.value,null);assert.equal(info.downlinkMbps.value,null);
  nav(undefined);for(const value of Object.values(getNetworkInfo()))assert.equal(value.source,'unavailable');
});

test('network updates and subscription cleanup work for connection and online/offline events',()=>{
  const conn=Object.assign(new EventTarget(),{effectiveType:'4g',rtt:50,downlink:10,saveData:false});
  const navigator={onLine:true,connection:conn};nav(navigator);globalThis.window=new EventTarget();
  const updates=[];const stop=watchNetworkInfo(info=>updates.push(info));
  conn.downlink=1.5;conn.saveData=true;conn.dispatchEvent(new Event('change'));
  navigator.onLine=false;window.dispatchEvent(new Event('offline'));
  navigator.onLine=true;window.dispatchEvent(new Event('online'));
  assert.equal(updates.length,4);assert.equal(updates[1].downlinkMbps.value,1.5);
  assert.equal(updates[1].saveData.value,true);assert.equal(updates[2].online.value,false);
  stop();stop();conn.dispatchEvent(new Event('change'));window.dispatchEvent(new Event('offline'));
  assert.equal(updates.length,4);
});
