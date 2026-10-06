'use strict';
const fs=require('node:fs'),path=require('node:path');
const {collect}=require('../tests/text-layout-probe.cjs');
const before=collect(true),after=collect(false);
const summary=x=>({frames:x.frames,measureTextCalls:x.measureTextCalls,textDrawCalls:x.textDrawCalls,textTraceSha256:x.textTraceSha256,peakEntries:x.peakEntries,peakUnits:x.peakUnits});
const result={
 method:'Production Canvas code in the deterministic no-op harness. Following the same initial paint, cached versus recomputed wrapping runs 300 frames each.',
 covered:['hunter/vault/realm/settings/technique screens','390→320→430→360 widths','changing resource values','font-ready and font-loading events','changed letter spacing'],
 before:summary(before),after:summary(after),
 sameTextDrawOutput:before.textTraceSha256===after.textTraceSha256,
 sameGameplayState:JSON.stringify(before.state)===JSON.stringify(after.state),
 fewerMeasurementCallsPercent:+((1-after.measureTextCalls/before.measureTextCalls)*100).toFixed(2),
 limitation:'Counts repeated font measurements only. The Canvas is a no-op with approximate glyph metrics; this does not measure phone FPS, real font rasterization, GPU time, image decoding or user-reported lag.'
};
fs.writeFileSync(path.join(__dirname,'../docs/text-layout-study.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
