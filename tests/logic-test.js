const fs=require('fs'),vm=require('vm'),assert=require('assert');
const context={Math,Number,String,Array,Object,Map,Set,JSON,console,clamp:(v,a,b)=>Math.min(b,Math.max(a,v))};
vm.createContext(context);
vm.runInContext(fs.readFileSync('app-recalc.js','utf8'),context,{filename:'app-recalc.js'});
const source={rapport:3,repeats:4,stitchCount:12};
for (const [mode,raw,motifs] of [['nearest',18,0],['nearest',17,0],['rapport',19,0],['motifs',20,0],['motifCount',30,5],['auto',19,0]]) {
  const r=context.fitRound(source,raw,mode,motifs);
  assert.strictEqual(r.target,r.rapport*r.repeats,`${mode} must keep arithmetic consistency`);
}
let r=context.fitRound(source,18,'nearest',0);assert.strictEqual(r.rapport,3);assert.strictEqual(r.repeats,6);
r=context.fitRound(source,17,'nearest',0);assert.strictEqual(r.target,17);assert.strictEqual(r.rapport,1);assert.strictEqual(r.repeats,17);
const project={shape:'circle',originalSize:24,targetSize:36,gaugeSampleWidth:8,gaugeSampleHeight:7,gaugeStitches:20,gaugeRows:11,targetGaugeSampleWidth:12,targetGaugeSampleHeight:9,targetGaugeStitches:30,targetGaugeRows:15};
context.promoteTargetToSource(project);
assert.strictEqual(project.originalSize,36,'applied target must become the next source size');
assert.strictEqual(project.gaugeSampleWidth,12);assert.strictEqual(project.gaugeSampleHeight,9);assert.strictEqual(project.gaugeStitches,30);assert.strictEqual(project.gaugeRows,15);
const editor=fs.readFileSync('app-editor.js','utf8');
assert(editor.includes("state.manualSymbols.filter(m=>m.roundId===r.id).forEach(m=>m.rapportGroup=null)"),'new rapport must replace old rapport group');
assert(editor.includes('generatedPreviewNote'),'large generated previews must disclose sampling');
console.log('logic invariants OK');
