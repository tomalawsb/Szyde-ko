'use strict';
function densityPerSelectedUnit() {
  const g=gaugeInfo(),mult=state.project.unit==='mm'?.1:1;
  return { sourceStitch:g.sourceStitchPerCm*mult,targetStitch:g.targetStitchPerCm*mult,sourceRows:g.sourceRowPerCm*mult,targetRows:g.targetRowPerCm*mult };
}

function syncCalcInputs() {
  const p=state.project,u=p.unit,density=densityPerSelectedUnit();
  if(p.shape==='circle'){
    $('recalcDimensionFields').innerHTML=`<label>Średnica oryginału [${u}]<input id="calcOriginalSize" type="number" min="0.1" step="0.1" value="${p.originalSize}"></label><label>Średnica docelowa [${u}]<input id="calcTargetSize" type="number" min="0.1" step="0.1" value="${p.targetSize}"></label>`;
  }else{
    $('recalcDimensionFields').innerHTML=`<label>Szerokość oryg. [${u}]<input id="calcOriginalWidth" type="number" min="0.1" step="0.1" value="${p.originalWidth}"></label><label>Wysokość oryg. [${u}]<input id="calcOriginalHeight" type="number" min="0.1" step="0.1" value="${p.originalHeight}"></label><label>Szerokość docel. [${u}]<input id="calcTargetWidth" type="number" min="0.1" step="0.1" value="${p.targetWidth}"></label><label>Wysokość docel. [${u}]<input id="calcTargetHeight" type="number" min="0.1" step="0.1" value="${p.targetHeight}"></label>`;
  }
  $('calcGaugeSource').value=formatPlain(density.sourceStitch); $('calcGaugeTarget').value=formatPlain(density.targetStitch); $('calcRowsSource').value=formatPlain(density.sourceRows); $('calcRowsTarget').value=formatPlain(density.targetRows);
  [...$('recalcDimensionFields').querySelectorAll('input')].forEach(el=>el.addEventListener('input',updateCalcFactors));
  updateCalcFactors();
}

function formatPlain(n) { return Number.isFinite(n) ? Number(n.toFixed(4)) : 0; }

function calcDimensions() {
  const unit=state.project.unit;
  if(state.project.shape==='circle'){
    const o=unitToCm(Number($('calcOriginalSize')?.value)||state.project.originalSize,unit),t=unitToCm(Number($('calcTargetSize')?.value)||state.project.targetSize,unit);return{ow:o,oh:o,tw:t,th:t};
  }
  return {ow:unitToCm(Number($('calcOriginalWidth')?.value)||state.project.originalWidth,unit),oh:unitToCm(Number($('calcOriginalHeight')?.value)||state.project.originalHeight,unit),tw:unitToCm(Number($('calcTargetWidth')?.value)||state.project.targetWidth,unit),th:unitToCm(Number($('calcTargetHeight')?.value)||state.project.targetHeight,unit)};
}

function getCalcFactors() {
  const d=calcDimensions(),unit=state.project.unit,mult=unit==='mm'?10:1;
  const gs=(Number($('calcGaugeSource').value)||1)*mult,gt=(Number($('calcGaugeTarget').value)||1)*mult,rs=(Number($('calcRowsSource').value)||1)*mult,rt=(Number($('calcRowsTarget').value)||1)*mult;
  return { horizontal:safeRatio(d.tw,d.ow)*safeRatio(gt,gs), vertical:safeRatio(d.th,d.oh)*safeRatio(rt,rs), d, gs,gt,rs,rt };
}

function updateCalcFactors() {
  if(!$('calcGaugeSource'))return;
  const f=getCalcFactors(); $('calcHorizontalFactor').textContent=formatNum(f.horizontal,3)+'×'; $('calcVerticalFactor').textContent=formatNum(f.vertical,3)+'×'; $('calcTargetRounds').textContent=state.rounds.length?Math.max(1,Math.round(state.rounds.length*f.vertical)):'0';
}

function fitRound(source, raw, mode, targetMotifs) {
  let rapport=source.rapport,repeats=source.repeats,target=Math.max(1,Math.round(raw)),decision='zaokrąglenie';
  const byRapport=()=>{rapport=Math.max(1,source.rapport);repeats=Math.max(1,Math.round(raw/rapport));target=rapport*repeats;decision='zachowano raport';};
  const byMotifs=()=>{repeats=Math.max(1,source.repeats);rapport=Math.max(1,Math.round(raw/repeats));target=rapport*repeats;decision='zachowano liczbę motywów';};
  if(mode==='rapport')byRapport();
  else if(mode==='motifs')byMotifs();
  else if(mode==='motifCount'){repeats=Math.max(1,Math.round(targetMotifs||source.repeats));rapport=Math.max(1,Math.round(raw/repeats));target=rapport*repeats;decision=`ustawiono ${repeats} motywów`;}
  else if(mode==='auto'){
    const rapTarget=Math.max(source.rapport,Math.round(raw/source.rapport)*source.rapport),rapErr=Math.abs(rapTarget-raw)/Math.max(1,raw);
    const motifRap=Math.max(1,Math.round(raw/source.repeats)),motifTarget=motifRap*source.repeats,motifErr=Math.abs(motifTarget-raw)/Math.max(1,raw)+Math.abs(motifRap-source.rapport)/Math.max(1,source.rapport)*.12;
    if(rapErr<=motifErr+.025)byRapport(); else byMotifs(); decision='auto: '+decision;
  }
  return {target,rapport,repeats,decision};
}

function calculateAll() {
  if(!state.rounds.length)return toast('Najpierw utwórz wzór.');
  const f=getCalcFactors(); if(!Number.isFinite(f.horizontal)||!Number.isFinite(f.vertical)||f.horizontal<=0||f.vertical<=0)return toast('Nieprawidłowe dane przeliczenia.');
  const mode=$('calcMode').value,targetMotifs=Number($('targetMotifs').value)||1,source=state.rounds,targetCount=Math.max(1,Math.round(source.length*f.vertical)),out=[];
  for(let j=0;j<targetCount;j++){
    const srcPos=targetCount===1?0:j*(source.length-1)/Math.max(1,targetCount-1),srcIndex=clamp(Math.round(srcPos),0,source.length-1),src=source[srcIndex];
    const raw=src.stitchCount*f.horizontal,fit=fitRound(src,raw,mode,targetMotifs);
    out.push({ id:cryptoId(), n:j+1, stitchType:src.stitchType, stitchCount:fit.target, rapport:fit.rapport, repeats:fit.repeats, increase:0, note:src.note, sourceRoundId:src.id, sourceN:src.n, raw, decision:fit.decision });
  }
  out.forEach((r,i)=>r.increase=r.stitchCount-(out[i-1]?.stitchCount||0));
  const mappedManual=state.manualSymbols.map(m=>{
    const oldIdx=source.findIndex(r=>r.id===m.roundId),newIdx=oldIdx<0?0:(source.length===1?0:Math.round(oldIdx*(targetCount-1)/(source.length-1))),newRound=out[clamp(newIdx,0,out.length-1)];
    return {...m,id:cryptoId(),roundId:newRound.id};
  });
  calcDraft={rounds:out,manualSymbols:mappedManual,factors:f};
  $('calcResults').classList.remove('empty-state');
  $('calcResults').innerHTML=`<div class="hint">${source.length} → <b>${targetCount}</b> okrążeń/rzędów. Współczynnik oczek ${formatNum(f.horizontal,3)}×, rzędów ${formatNum(f.vertical,3)}×.</div>`+out.map(x=>`<div class="calc-row"><b>${x.n}</b><span>${x.sourceN}.: ${source[x.sourceN-1].stitchCount} → <strong>${x.stitchCount}</strong><div class="calc-meta">raport ${x.rapport} × ${x.repeats} · ${escapeHtml(x.decision)} · surowo ${formatNum(x.raw,1)}</div></span><span>${x.increase>=0?'+':''}${x.increase}</span></div>`).join('');
  $('applyCalcBtn').disabled=false;
}

function applyCalculation() {
  if(!calcDraft)return;
  mutate(()=>{
    state.rounds=calcDraft.rounds.map(({sourceRoundId,sourceN,raw,decision,...r})=>r); state.manualSymbols=calcDraft.manualSymbols; state.activeRoundId=state.rounds[0]?.id||null;
    if(state.project.shape==='circle'){state.project.originalSize=Number($('calcOriginalSize').value)||state.project.originalSize;state.project.targetSize=Number($('calcTargetSize').value)||state.project.targetSize;}
    else{state.project.originalWidth=Number($('calcOriginalWidth').value)||state.project.originalWidth;state.project.originalHeight=Number($('calcOriginalHeight').value)||state.project.originalHeight;state.project.targetWidth=Number($('calcTargetWidth').value)||state.project.targetWidth;state.project.targetHeight=Number($('calcTargetHeight').value)||state.project.targetHeight;}
    const unit=state.project.unit,base=unit==='mm'?1:1;
    state.project.gaugeSampleWidth=base;state.project.gaugeSampleHeight=base;state.project.targetGaugeSampleWidth=base;state.project.targetGaugeSampleHeight=base;
    state.project.gaugeStitches=Number($('calcGaugeSource').value)||state.project.gaugeStitches;state.project.targetGaugeStitches=Number($('calcGaugeTarget').value)||state.project.targetGaugeStitches;state.project.gaugeRows=Number($('calcRowsSource').value)||state.project.gaugeRows;state.project.targetGaugeRows=Number($('calcRowsTarget').value)||state.project.targetGaugeRows;
  });
  selectedManualIds.clear();calcDraft=null;$('applyCalcBtn').disabled=true;toast('Przeliczenie zastosowane.');
}

function analyze() {
  const items=[],g=gaugeInfo();
  if(g.sourceStitchPerCm<=0||g.sourceRowPerCm<=0||g.targetStitchPerCm<=0||g.targetRowPerCm<=0)items.push({type:'error',round:0,title:'Niepełna próbka',text:'Gęstość oczek i rzędów musi być większa od zera.'});
  state.rounds.forEach((r,i)=>{
    if(r.rapport>0&&r.stitchCount%r.rapport!==0){const low=Math.floor(r.stitchCount/r.rapport)*r.rapport,high=Math.ceil(r.stitchCount/r.rapport)*r.rapport;items.push({type:'error',round:r.n,title:'Liczba oczek nie pasuje do raportu',text:`${r.stitchCount} nie jest wielokrotnością ${r.rapport}. Najbliżej: ${Math.max(r.rapport,low)} lub ${Math.max(r.rapport,high)}.`});}
    if(r.rapport>0&&r.repeats*r.rapport!==r.stitchCount)items.push({type:'warning',round:r.n,title:'Niespójna liczba powtórzeń',text:`${r.repeats} × ${r.rapport} = ${r.repeats*r.rapport}, wpisano ${r.stitchCount}.`});
    const groups=new Map();state.manualSymbols.filter(m=>m.roundId===r.id&&m.rapportGroup).forEach(m=>groups.set(m.rapportGroup,(groups.get(m.rapportGroup)||0)+1));
    groups.forEach(count=>{if(count!==r.rapport)items.push({type:'warning',round:r.n,title:'Graficzny raport różni się od danych',text:`Zaznaczona grupa ma ${count} symboli, a raport liczbowy ${r.rapport}.`});});
    if(i>0){const prev=state.rounds[i-1],delta=r.stitchCount-prev.stitchCount;if(delta!==r.increase)items.push({type:'warning',round:r.n,title:'Przyrost nie zgadza się z liczbą oczek',text:`Z liczb wynika ${delta>=0?'+':''}${delta}, zapisano ${r.increase>=0?'+':''}${r.increase}.`});
      if(state.project.shape==='circle'){const expected=symbolById(r.stitchType).flatGrowth;if(expected>0){if(delta>expected*1.7)items.push({type:'warning',round:r.n,title:'Duży przyrost',text:`+${delta} jest dużo większe od prostego modelu (~${expected}). Możliwe falowanie.`});if(delta>=0&&delta<expected*.3)items.push({type:'warning',round:r.n,title:'Mały przyrost',text:`+${delta} jest małe względem prostego modelu (~${expected}). Możliwe podwijanie.`});}}
    }
  });
  state.manualSymbols.forEach(m=>{if(!state.rounds.some(r=>r.id===m.roundId))items.push({type:'error',round:0,title:'Osierocony symbol',text:'Ręczny symbol nie jest przypisany do istniejącego rzędu.'});});
  if(!items.length)items.push({type:'ok',round:0,title:'Brak oczywistych problemów',text:'Raporty, powtórzenia, przyrosty i próbka są arytmetycznie spójne.'});
  return items;
}

function runAnalysis() {
  const items=analyze();$('errorCount').textContent=items.filter(x=>x.type==='error').length;$('warningCount').textContent=items.filter(x=>x.type==='warning').length;$('analysisRoundCount').textContent=state.rounds.length;
  $('analysisList').innerHTML=items.map(x=>`<div class="analysis-item ${x.type}"><b>${x.round?`${rowWord(x.round)}: `:''}${escapeHtml(x.title)}</b><span>${escapeHtml(x.text)}</span></div>`).join('');
}

function renderSymbols() {
  $('symbolGrid').innerHTML=symbols.map(s=>`<article class="symbol-card"><div class="symbol-glyph">${escapeHtml(s.glyph)}</div><div><b>${escapeHtml(s.pl)} (${escapeHtml(s.short)})</b><small>US: ${escapeHtml(s.us)}<br>UK: ${escapeHtml(s.uk)}</small></div><button class="secondary" data-symbol-id="${s.id}">Użyj w edytorze</button></article>`).join('');
  $$('[data-symbol-id]').forEach(b=>b.addEventListener('click',()=>{state.editor.symbolId=b.dataset.symbolId;state.editor.mode='add';save();switchView('pattern');renderEditorControls();toast('Kliknij miejsce na schemacie.');}));
}

function render() {
  document.documentElement.style.setProperty('--ui-scale',String(state.uiScale||1));$('uiScale').value=String(state.uiScale||1);
  renderHome();renderProject();renderRounds();renderInspector();renderEditorControls();renderScheme();renderInstructions();renderSymbols();
  switchView(state.activeView||'home');updateUndoRedo();
}
