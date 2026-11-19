/* Agenda Docente v6.3 — Trimestres, comparativo e alerta de pendências anteriores. */
(() => {
  'use strict';
  const isScheduledList = (id) => id === 'planning' || id === 'activity';
  const escape = (x) => escapeHtml(x);
  const originalRenderHome = window.renderHome;
  const originalOpenList = window.openList;
  const originalRenderDays = window.renderDays;
  const originalRenderDayDetail = window.renderDayDetail;
  const originalOpenNotesEditor = window.openNotesEditor;
  const originalAddNotesTable = window.addNotesTable;
  const originalBackup = window.exportAgendaBackup;
  const originalRestore = window.importAgendaBackup;
  const originalReadCloud = window.agendaReadCloudPayload;
  const originalApplyCloud = window.agendaApplyCloudPayload;
  const siepeKey = 'agenda-docente-siepe-v6';
  let siepe = { rows:[], importedAt:'', source:'', totalExpected:null, totalReported:0, termStarts:{}, selectedYear:null, selectedTrimester:null, pendingType:'todos' };
  try { const stored=JSON.parse(localStorage.getItem(siepeKey)||'null');if(stored && typeof stored==='object' && Array.isArray(stored.rows)) siepe={...siepe,...stored}; }catch(_e){}
  const actual = new Date();
  const week = {selected:localDateISO(actual),anchor:localDateISO(monday(actual))};
  const fmtDate = (d, options) => new Intl.DateTimeFormat('pt-BR',options).format(d);
  const longDate = (iso) => fmtDate(fromISO(iso), {weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const dateDay = (iso) => {const d=fromISO(iso).getDay();return d===0?7:d;};
  function monday(d){const result=new Date(d.getFullYear(),d.getMonth(),d.getDate());result.setDate(result.getDate() - (result.getDay()+6)%7);return result;}
  function dateOffset(date, days){const d=fromISO(date);d.setDate(d.getDate()+days);return localDateISO(d);}
  const dateDiff=(a,b)=>Math.round((fromISO(a)-fromISO(b))/86400000);
  function changeDate(iso, openDetail=false){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(iso)||Number.isNaN(fromISO(iso).getTime()))return;
    week.selected=iso;week.anchor=localDateISO(monday(fromISO(iso)));
    state.selectedDate=iso;
    state.weekday=dateDay(iso);
    if(openDetail) window.renderDayDetail(); else window.renderDays();
  }
  function moveWeek(delta){ changeDate(dateOffset(week.selected,delta*7)); }
  function selectYear(year){ const y=Number(year);if(y<2000||y>2100)return;const old=fromISO(week.selected);old.setFullYear(y); changeDate(localDateISO(old));}
  function goToday(){changeDate(localDateISO(new Date()));}
  function getDateRefs(listId, date, blockId){
    const refs = [];
    const here = getTasks(listId,date,blockId);
    here.forEach((task,index)=>refs.push({task,index,sourceDate:date}));
    for(const [key,tasks] of Object.entries(taskStore)){
      const pre=`${listId}|`;
      if(!key.startsWith(pre)||!key.endsWith('|'+blockId))continue;
      const source=key.slice(pre.length,pre.length-blockId.length-1);
      if(!/^\d{4}-\d{2}-\d{2}$/.test(source)||source===date||dateDiff(date,source)<0||dateDiff(date,source)%7!==0)continue;
      if(Array.isArray(tasks)) tasks.forEach((task,index)=>{if(task.repeat)refs.push({task,index,sourceDate:source,recurring:true});});
    }
    return refs;
  }
  function dailyCount(date){
    const day=dateDay(date), blocks=schedule[state.list]?.[day]||[];
    return blocks.reduce((n,_b,i)=>n+getDateRefs(state.list,date,blockKey(state.list,day,i)).length,0);
  }
  function renderWeek(){
    showScreen('screen-days');
    const list=lists.find(item=>item.id===state.list), start=fromISO(week.anchor),end=fromISO(dateOffset(week.anchor,6));
    const yearOptions=[];for(let y=2024;y<=new Date().getFullYear()+5;y++) yearOptions.push(`<option value="${y}" ${y===fromISO(week.selected).getFullYear()?'selected':''}>${y}</option>`);
    const days=Array.from({length:7},(_,i)=>{
      const iso=dateOffset(week.anchor,i),dd=fromISO(iso),cnt=dailyCount(iso);
      const hasBlocks=(schedule[state.list][i+1]||[]).length>0;
      return `<button class="week-day ${week.selected===iso?'selected':''} ${iso===localDateISO(new Date())?'today':''} ${i>4?'weekend':''}" onclick="agendaV6Pick('${iso}')" aria-label="${longDate(iso)}"><span>${['SEG','TER','QUA','QUI','SEX','SÁB','DOM'][i]}</span><strong>${dd.getDate()}</strong><em>${cnt?cnt+' ✓':hasBlocks?'•':' '}</em></button>`;
    });
    document.getElementById('screen-days').innerHTML=`
      <div class="topbar"><button onclick="renderHome()">← Início</button><div class="section-title" style="margin:0">${escape(list.name)}</div></div>
      <div class="card"><div class="week-nav"><button class="pill-btn" onclick="agendaV6Week(-1)" aria-label="Semana anterior">‹</button>
      <strong>${fmtDate(start,{day:'2-digit',month:'short'})} — ${fmtDate(end,{day:'2-digit',month:'short',year:'numeric'})}</strong><button class="pill-btn" onclick="agendaV6Week(1)" aria-label="Próxima semana">›</button></div>
      <div class="week-buttons"><span style="font-size:12px;color:#5c718e">Ano <select aria-label="Selecionar ano" onchange="agendaV6Year(this.value)" style="border:1px solid #dce6f0;border-radius:9px;background:#fff;padding:9px;font:inherit">${yearOptions.join('')}</select></span>
      <input type="date" aria-label="Ir para data" value="${week.selected}" onchange="agendaV6Jump(this.value)" />
      <button class="outline-btn" onclick="agendaV6Today()">Hoje</button></div>
      <div class="week-grid">${days.join('')}</div><p class="week-hint">Veja todas as semanas do ano pelas setas. Toque em uma data para consultar, planejar ou editar as atividades daquele dia. O ponto indica horário cadastrado; ✓ indica registro salvo.</p>
      </div>
      <div class="card" onclick="agendaV6Pick('${week.selected}')" style="cursor:pointer"><div class="row"><div style="flex:1"><div class="title">${escape(longDate(week.selected))}</div><div class="subtitle">${dailyCount(week.selected)} registro(s) encontrado(s) para esta data</div></div><span style="font-size:23px;color:#93a5bf">›</span></div></div>`;
  }
  function renderSelectedDay(){
    if(!isScheduledList(state.list)) return originalRenderDayDetail();
    state.selectedDate=week.selected; state.weekday=dateDay(week.selected);
    showScreen('screen-daydetail');
    const list=lists.find(l=>l.id===state.list),blocks=schedule[state.list][state.weekday]||[];
    let html=`<div class="topbar"><button onclick="renderDays()">← Semana</button><div><div class="section-title" style="margin:0">${escape(list.name)}</div><div class="subtitle">${escape(longDate(week.selected))}</div></div></div>
      <div class="date-heading">Horários de ${escape(weekdays[state.weekday])} • ${fmtDate(fromISO(week.selected),{day:'2-digit',month:'2-digit',year:'numeric'})}</div>`;
    html += blocks.length ? blocks.map((block,index)=>{
      const bid=blockKey(state.list,state.weekday,index), refs=getDateRefs(state.list,week.selected,bid);
      const legacy=getTasks(state.list,state.weekday,bid);
      const saved=refs.map(({task,index:taskIndex,sourceDate,recurring})=>`${recurring?'<div class="small-note">↻ Planejamento semanal recorrente</div>':''}`+taskPreview(task,`agendaV6Edit(${index},${taskIndex},'${sourceDate}')`)).join('');
      return `<div class="card"><div class="block-header"><div class="bar"></div><div style="flex:1"><div class="title">${escape(block.label)}</div><div class="subtitle">${block.periods} ${block.periods===1?'aula':'aulas'} • ${escape(block.time)}</div></div><button class="primary-btn" onclick="agendaV6New(${index})">Planejar</button></div>
        <div style="margin-top:10px">${saved || '<span class="muted">Nenhum registro para esta data.</span>'}</div>
        ${legacy.length?`<details class="legacy-fold"><summary>Registros anteriores sem data (${legacy.length})</summary><p class="small-note">Estes registros da versão antiga foram preservados. Como não possuem data específica, ficam separados do calendário.</p>${legacy.map((task,i)=>taskPreview(task,`agendaV6Edit(${index},${i},${state.weekday})`)).join('')}</details>`:''}
        </div>`;
    }).join('') : '<div class="card muted">Não há aulas ou aulas-atividade programadas neste dia.</div>';
    document.getElementById('screen-daydetail').innerHTML=html;
  }
  function openEntry(blockIndex,taskIndex=null,source=null){
    const block=schedule[state.list]?.[state.weekday]?.[blockIndex];if(!block)return;
    state.editSourceDay=source===null ? week.selected : source;
    const label=`${block.label} (${block.periods} ${block.periods===1?'aula':'aulas'} • ${block.time}) • ${longDate(week.selected)}`;
    openModal(blockKey(state.list,state.weekday,blockIndex),label,state.list,taskIndex);
  }
  window.renderDays=function(){return isScheduledList(state.list)?renderWeek():originalRenderDays();};
  window.renderDayDetail=renderSelectedDay;
  window.openList=function(listId){
    if(listId==='siepe'){state.list='siepe';siepe.selectedYear=new Date().getFullYear();siepe.selectedTrimester=null;siepe.pendingType='todos';document.getElementById('homeHeader').classList.add('hidden');return renderSiepe();}
    if(isScheduledList(listId)){
      state.list=listId;state.selectedDate=week.selected;state.weekday=dateDay(week.selected);
      document.getElementById('homeHeader').classList.add('hidden');return renderWeek();
    }
    return originalOpenList(listId);
  };
  window.agendaV6Week=moveWeek;window.agendaV6Pick=(iso)=>changeDate(iso,true);
  window.agendaV6Jump=(iso)=>changeDate(iso,false);window.agendaV6Year=selectYear;window.agendaV6Today=goToday;
  window.agendaV6New=(idx)=>openEntry(idx);window.agendaV6Edit=openEntry;

  // Interface B: marca e menu preservados, sincronização só no cabeçalho.
  window.renderHome=function(){
    originalRenderHome();
    const home=document.getElementById('screen-home');
    if(!home)return;
    const backup = [...home.querySelectorAll('.card')].find(c=>c.textContent.includes('Backup dos seus registros'));
    let backupHtml = '';
    if (backup) { backupHtml=backup.innerHTML; backup.remove(); }
    const siepeCard=`<div class="card clickable" onclick="openList('siepe')"><div class="row"><div class="icon-box icon-blue">📊</div><div style="flex:1"><div class="title">Meu SIEPE</div><div class="subtitle">Acompanhamento das pendências de registros.</div></div><span style="color:#9ca3af">›</span></div></div>`;
    home.insertAdjacentHTML('beforeend',siepeCard);
    if (backupHtml) home.insertAdjacentHTML('beforeend',`<details class="legacy-fold"><summary>Backup e restauração</summary><div style="padding:12px 3px">${backupHtml}</div></details>`);
    window.agendaV6UpdateCloudButton?.();
  };
  window.agendaV6OpenCloud=function(){
    document.getElementById('homeHeader').classList.add('hidden');
    showScreen('screen-cloud');
    window.agendaCloudRender?.();
  };
  window.agendaV6UpdateCloudButton=function(status='☁ Nuvem',good=false){
    const btn=document.getElementById('cloudHeaderButton');if(!btn)return;
    btn.classList.toggle('good',good);btn.querySelector('.cloud-label').textContent=status;
  };
  // Tabelas de até 40 linhas e 10 colunas, inclusive colagem de Excel/Planilhas.
  window.addNotesTable=function(){
    const rows=Number(prompt('Quantidade de linhas da tabela (1 a 40):','10'));
    if(!Number.isInteger(rows)||rows<1||rows>40)return alert('A tabela deve ter entre 1 e 40 linhas.');
    const cols=Number(prompt('Quantidade de colunas da tabela (1 a 10):','5'));
    if(!Number.isInteger(cols)||cols<1||cols>10)return alert('A tabela deve ter entre 1 e 10 colunas.');
    const html='<table><tbody>'+Array.from({length:rows},()=>'<tr>'+('<td><br></td>'.repeat(cols))+'</tr>').join('')+'</tbody></table><p><br></p>';
    notesRestoreRange();document.execCommand('insertHTML',false,html);saveNote(false);
  };
  function clipboardPaste(e){
    const editor=e.currentTarget;
    const html=e.clipboardData?.getData('text/html')||'';
    const txt=e.clipboardData?.getData('text/plain')||'';
    let rows=null;
    if(html && /<table[\s>]/i.test(html)){
      const temp=document.createElement('template');temp.innerHTML=html;
      const table=temp.content.querySelector('table');
      if(table)rows=[...table.querySelectorAll('tr')].map(tr=>[...tr.querySelectorAll('th,td')].map(c=>c.textContent.trim()));
    } else if(txt.includes('\t')){
      rows=txt.trimEnd().split(/\r?\n/).map(l=>l.split('\t'));
    }
    if(!rows||!rows.length)return;
    const maxcols=Math.max(...rows.map(r=>r.length));
    if(rows.length>40||maxcols>10){e.preventDefault();alert(`A tabela copiada tem ${rows.length} linhas e ${maxcols} colunas. O limite é 40 × 10.`);return;}
    e.preventDefault();const markup='<table><tbody>'+rows.map(row=>'<tr>'+Array.from({length:maxcols},(_,i)=>'<td>'+escape(row[i]??'')+'</td>').join('')+'</tr>').join('')+'</tbody></table><p><br></p>';
    editor.focus();document.execCommand('insertHTML',false,markup);saveNote(false);
  }
  window.openNotesEditor=function(index){
    originalOpenNotesEditor(index);
    const editor=document.getElementById('notesEditor');editor?.addEventListener('paste',clipboardPaste);
    const status=document.getElementById('noteSaveStatus');if(status)status.textContent='Tabelas: até 40 linhas × 10 colunas. Você pode colar tabelas do Excel e de outros aplicativos.';
  };

  // Meu SIEPE: importa planilhas/relatórios locais sem recolher login ou senha do SIEPE.
  const normalize=(v)=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const stat=(s)=>{const x=normalize(s);return /pendente|nao preenchido|nao informado|nao lancado|sem registro|incompleto|em aberto|falta registro/.test(x)?'pendente':/concluido|preenchido|realizado|registrado|ok\b/.test(x)?'concluido':'indefinido';};
  function persistSiepe(){localStorage.setItem(siepeKey,JSON.stringify(siepe));persist();}
  const cleanDate=(v)=>{
    if(typeof v==='number'&&v>30000&&v<90000){const d=new Date(Math.round((v-25569)*86400000));return localDateISO(new Date(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()));}
    const x=String(v??'').trim();const d=x.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);if(d)return `${d[3]}-${d[2].padStart(2,'0')}-${d[1].padStart(2,'0')}`;
    if(/^\d{4}-\d{2}-\d{2}$/.test(x))return x;return '';
  };
  function formatDate(iso){return iso?fmtDate(fromISO(iso),{day:'2-digit',month:'2-digit',year:'numeric'}):'Data não identificada';}
  function normalizeHeader(s){return normalize(s).replace(/[^a-z0-9 ]/g,'');}
  function parseGrid(matrix){
    const grid=matrix.filter(r=>Array.isArray(r)&&r.some(v=>String(v??'').trim())).map(r=>r.map(x=>String(x??'').trim()));
    if(!grid.length)return [];
    let headerIndex=grid.findIndex(r=>r.some(v=>/\bturma\b|componente curricular|disciplina/.test(normalizeHeader(v)))&&r.some(v=>/frequencia|conteud|apontamento|situacao|data|registro/.test(normalizeHeader(v))));
    if(headerIndex<0)headerIndex=grid.findIndex(r=>r.some(v=>/\bturma\b|componente curricular/.test(normalizeHeader(v))));
    if(headerIndex<0)throw Error('Não identifiquei as colunas do relatório. Use um arquivo com Turma e campos de frequência/conteúdos.');
    const head=grid[headerIndex].map(normalizeHeader);
    const col=(...needles)=>head.findIndex(h=>needles.some(n=>h.includes(n)));
    const turmaIndex=col('turma'),serie=col('serie'),comp=col('componente','disciplina'),dateIndex=col('data','dia letivo'), statusIndex=col('situacao','status'),freqIndex=col('frequencia'),contIndex=col('conteudo','registro de aula','situacao didatica','monitoramento'),tipoIndex=col('tipo','apontamento');
    const result=[];
    for(const raw of grid.slice(headerIndex+1)){
      const classroom=String(raw[turmaIndex]??raw[serie]??'').trim();if(!classroom||/total|professor/i.test(classroom)&&raw.length<3)continue;
      const subject=comp>=0?String(raw[comp]||'').trim():'';
      const rowDate=dateIndex>=0?cleanDate(raw[dateIndex]):'';
      const base={turma:classroom,disciplina:subject,data:rowDate,source:'Relatório importado'};
      if(freqIndex>=0||contIndex>=0){
        for(const [ix,type] of [[freqIndex,'Frequência'],[contIndex,'Registro de aula']]){
          if(ix<0)continue;
          const cell=String(raw[ix]||'').trim();if(!cell)continue;
          const s=stat(cell), dates=[...cell.matchAll(/\d{1,2}[\/-]\d{1,2}[\/-]\d{4}/g)].map(m=>cleanDate(m[0]));
          if(s==='indefinido'&&dates.length===0)continue;
          for(const date of dates.length?dates:[rowDate])result.push({...base,data:date,tipo:type,situacao:s});
        }
      } else if(statusIndex>=0){
        const ss=stat(raw[statusIndex]);if(String(raw[statusIndex]||'').trim())result.push({...base,tipo:tipoIndex>=0&&/frequencia/.test(normalize(raw[tipoIndex]))?'Frequência':'Registro de aula',situacao:ss});
      }
    }
    return uniqueRows(result);
  }
  function uniqueRows(rows){
    const m=new Map();for(const r of rows){if(!r.turma)continue;const id=[r.turma,r.disciplina,r.data,r.tipo].map(normalize).join('|');if(r.situacao==='indefinido'&&m.has(id)&&m.get(id).situacao!=='indefinido')continue;m.set(id,r);}return [...m.values()];
  }
  function parseCsv(source){
    const sep=(source.split(/\r?\n/)[0]||'').split(';').length>(source.split(/\r?\n/)[0]||'').split('\t').length?';':source.includes('\t')?'\t':',';
    const rows=[];let row=[],cell='',quoted=false;
    for(let i=0;i<source.length;i++){
      const c=source[i];if(c==='"'){if(quoted&&source[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
      else if(c===sep&&!quoted){row.push(cell);cell='';}
      else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&source[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell='';}
      else cell+=c;
    }row.push(cell);rows.push(row);return rows;
  }
  function parseHtmlTable(text){
    const doc=new DOMParser().parseFromString(text,'text/html');const table=doc.querySelector('table');
    return table?[...table.querySelectorAll('tr')].map(tr=>[...tr.querySelectorAll('td,th')].map(td=>td.textContent.trim())):[];
  }
  async function loadScript(src,check){if(check())return;await new Promise((resolve,reject)=>{const tag=document.createElement('script');tag.src=src;tag.onload=resolve;tag.onerror=()=>reject(Error('Não foi possível carregar a biblioteca de leitura. Verifique a conexão.'));document.head.appendChild(tag);});}
  async function importReport(event){
    const file=event.target.files?.[0];if(!file)return;
    const textEl=document.getElementById('siepeImportStatus');if(textEl)textEl.textContent='Lendo relatório...';
    try{
      let matrix=[];const ext=file.name.split('.').pop().toLowerCase();
      if(['csv','tsv','txt','html','htm'].includes(ext)){
        const text=await file.text();matrix=['html','htm'].includes(ext)?parseHtmlTable(text):parseCsv(text);
      }else if(['xls','xlsx','xlsm','ods'].includes(ext)){
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',()=>Boolean(window.XLSX));
        const workbook=window.XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:false});
        for(const name of workbook.SheetNames){const arr=window.XLSX.utils.sheet_to_json(workbook.Sheets[name],{header:1,defval:''});try{matrix.push(...arr);if(parseGrid(matrix).length)break;}catch(_e){matrix=[];}}
      }else if(ext==='pdf'){
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',()=>Boolean(window.pdfjsLib));
        window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        const pdf=await window.pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
        const lines=[];for(let p=1;p<=Math.min(pdf.numPages,30);p++){const page=await pdf.getPage(p);const content=await page.getTextContent();const byY=new Map();for(const x of content.items){const y=Math.round(x.transform?.[5]||0);if(!byY.has(y))byY.set(y,[]);byY.get(y).push(x);}for(const [y,a] of [...byY].sort((a,b)=>b[0]-a[0]))lines.push(a.sort((a,b)=>(a.transform?.[4]||0)-(b.transform?.[4]||0)).map(x=>x.str).join(' | '));}
        matrix=lines.map(l=>l.split(' | '));
      }else throw Error('Formato não reconhecido. Utilize XLSX, XLS, CSV, TSV, HTML ou PDF.');
      const found=parseGrid(matrix);
      if(!found.length)throw Error('O arquivo foi lido, mas nenhuma frequência ou registro com situação identificável foi encontrado. Isso pode acontecer com outro formato de relatório ou PDF digitalizado. Nenhuma informação foi substituída.');
      const pending=found.filter(r=>r.situacao==='pendente').length,done=found.filter(r=>r.situacao==='concluido').length,uncertain=found.length-pending-done;
      if(!confirm(`Relatório: ${file.name}\n\n${pending} pendência(s), ${done} concluído(s), ${uncertain} registro(s) sem status claro.\n\nImportar esses registros? A situação mais recente substitui a anterior para a mesma turma, disciplina, data e tipo de registro. Os outros trimestres serão preservados.`))return;
      const yearCount={}; for(const row of found){const yr=/^\d{4}-/.test(row.data||'')?row.data.slice(0,4):'';if(yr)yearCount[yr]=(yearCount[yr]||0)+1;}
      const focusYear=Number(Object.keys(yearCount).sort((a,b)=>yearCount[b]-yearCount[a])[0]||new Date().getFullYear());
      const merged=uniqueRows([...(siepe.rows||[]),...found]);
      siepe={...siepe,rows:merged,importedAt:new Date().toISOString(),source:file.name,totalExpected:null,totalReported:merged.length,selectedYear:focusYear,selectedTrimester:null,pendingType:'todos'};persistSiepe();renderSiepe();
    }catch(err){if(textEl)textEl.textContent=err.message||String(err);alert('Importação não concluída: '+(err.message||err));}
    finally{event.target.value='';}
  }
  // Datas padrão são provisórias até o usuário configurar a divisão do calendário letivo.
  // A classificação por trimestre considera a DATA do registro, nunca apenas a data de importação.
  function startsFor(year){
    const data=siepe.termStarts?.[String(year)];
    const d2=data?.second||`${year}-05-01`,d3=data?.third||`${year}-09-01`;
    return {second:d2,third:d3,configured:!!data};
  }
  function termForDate(date,year){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||Number(date.slice(0,4))!==Number(year))return null;
    const starts=startsFor(year);
    return date < starts.second ? 1 : date < starts.third ? 2 : 3;
  }
  function rowStats(rows){
    const done=rows.filter(r=>r.situacao==='concluido').length;
    const pending=rows.filter(r=>r.situacao==='pendente').length;
    const unknown=rows.length-done-pending;
    // Relatório só com pendências não permite calcular preenchimento geral.
    // Percentuais são do conjunto de registros identificados, não de todo o SIEPE.
    const pct=done>0?Math.round(done/(done+pending)*100):null;
    return {rows,done,pending,unknown,pct};
  }
  function termStats(year,term){
    return rowStats(siepe.rows.filter(r=>termForDate(r.data,year)===term));
  }
  function statusText(stats){
    if(!stats.rows.length)return 'Sem dados';
    if(stats.pct===null)return stats.pending?'Somente pendências':'Dados insuficientes';
    return stats.pending?`${stats.pending} pendência(s)`:'Nenhuma pendência no relatório';
  }
  function comparisonPercent(stats){
    return stats.pct===null?'—':`${stats.pct}%`;
  }
  function comparisonRows(year,currentTerm){
    const terms=[1,2,3];
    return `<div class="siepe-comparison-scroll"><table class="siepe-comparison" aria-label="Comparação dos registros importados por trimestre">
      <thead><tr><th>Trimestre</th><th>Geral</th><th>Frequência</th><th>Aulas</th><th>Pendentes</th></tr></thead>
      <tbody>${terms.map(term=>{
        const a=termStats(year,term);
        const f=rowStats(a.rows.filter(r=>r.tipo==='Frequência'));
        const l=rowStats(a.rows.filter(r=>r.tipo==='Registro de aula'));
        return `<tr class="${term===currentTerm&&year===new Date().getFullYear()?'siepe-comparison-current':''}">
          <th scope="row"><button class="siepe-comparison-link" onclick="agendaV62Term(${term})">${term}º ${term===currentTerm&&year===new Date().getFullYear()?'<span class="siepe-compare-actual">Atual</span>':''}</button></th>
          <td>${comparisonPercent(a)}</td><td>${comparisonPercent(f)}</td><td>${comparisonPercent(l)}</td><td class="${a.pending?'siepe-compare-pending':''}">${a.rows.length?a.pending:'—'}</td></tr>`;
      }).join('')}</tbody>
    </table></div><p class="small-note" style="margin-top:9px">“—” indica ausência de base suficiente para um percentual. Toque no trimestre para consultar os detalhes. Comparação limitada aos relatórios importados.</p>`;
  }
  function pastAlerts(year,currentTerm){
    if(year!==new Date().getFullYear()||currentTerm<2)return '';
    const older=Array.from({length:currentTerm-1},(_,i)=>({term:i+1,stats:termStats(year,i+1)}));
    const withPending=older.filter(item=>item.stats.pending>0);
    if(withPending.length){
      const total=withPending.reduce((n,item)=>n+item.stats.pending,0);
      return `<div class="card siepe-old-alert" role="status">
        <div class="row" style="align-items:flex-start"><span class="siepe-alert-emoji">⚠️</span><div style="flex:1">
          <div class="title">${total} pendência(s) de trimestres anteriores</div>
          <p class="small-note">Há registros de períodos anteriores ainda marcados como pendentes nos relatórios importados.</p>
          <div class="siepe-alert-actions">${withPending.map(item=>`<button onclick="agendaV62Term(${item.term})">Ver ${item.term}º trimestre (${item.stats.pending})</button>`).join('')}</div>
        </div></div></div>`;
    }
    if(older.some(item=>!item.stats.rows.length))return `<div class="siepe-past-info">ℹ️ Ainda não há relatórios importados de todos os trimestres anteriores. Não é possível afirmar que não existem pendências.</div>`;
    return `<div class="siepe-past-info">✓ Nenhuma pendência de trimestre anterior foi identificada nos relatórios importados.</div>`;
  }
  function siteFocusYear(){
    const years=[...new Set(siepe.rows.map(r=>Number((r.data||'').slice(0,4))).filter(y=>y>2000&&y<2200))];
    const selected=Number(siepe.selectedYear);
    if(selected>2000&&selected<2200)return selected;
    const todayYear=new Date().getFullYear();
    return years.includes(todayYear)?todayYear:(years.sort((a,b)=>b-a)[0]||todayYear);
  }
  function defaultTerm(year){
    if(year===new Date().getFullYear())return termForDate(localDateISO(new Date()),year)||3;
    for(let t=3;t>=1;t--)if(termStats(year,t).rows.length)return t;
    return 3;
  }
  const pctLabel=(v)=>v===null?'Sem dados suficientes':`${v}%`;
  function termCard(year,term,active,focus){
    const stats=termStats(year,term),selected=Number(active)===term;
    const current=year===new Date().getFullYear()&&term===focus;
    const title=`${term}º trimestre`;
    const text=statusText(stats);
    const bar=stats.pct===null?'<div class="siepe-term-empty"></div>':`<div class="siepe-term-track"><span class="siepe-term-done" style="width:${stats.pct}%"></span><span class="siepe-term-todo" style="flex:1"></span></div>`;
    return `<button class="siepe-term-card ${selected?'selected':''} ${current?'current':''}" onclick="agendaV62Term(${term})" aria-pressed="${selected}">
      <span class="siepe-term-title">${title}</span>${current?'<span class="siepe-current-label">ATUAL</span>':''}
      <strong>${stats.pct===null?'—':stats.pct+'%'}</strong>
      ${bar}<small>${text}</small></button>`;
  }
  function miniStat(title,items){
    const a=rowStats(items);
    return `<div class="siepe-kpi"><div class="row" style="justify-content:space-between"><strong>${title}</strong><strong>${comparisonPercent(a)}</strong></div>
      <div class="siepe-mini-track ${a.pct===null?'siepe-empty-track':''}" role="img" aria-label="${statusText(a)}"><span style="width:${a.pct??0}%"></span></div>
      <small>${a.done} concluído(s) · ${a.pending} pendente(s)${a.unknown?' · '+a.unknown+' sem status':''}</small>
      ${a.pct===null?`<small>${statusText(a)}</small>`:''}</div>`;
  }
  function byClassroom(rows){
    const result=new Map();
    for(const row of rows){
      const key=(row.turma||'Turma não identificada')+(row.disciplina?' • '+row.disciplina:'');
      if(!result.has(key))result.set(key,[]);
      result.get(key).push(row);
    }
    return [...result.entries()].sort((a,b)=>a[0].localeCompare(b[0],'pt-BR'));
  }
  function detailedClassrooms(rows){
    if(!rows.length)return '<div class="small-note">Nenhum registro do trimestre disponível para análise por turma.</div>';
    return byClassroom(rows).map(([name,records])=>{
      const a=rowStats(records);
      return `<div class="siepe-class-row"><div class="row" style="justify-content:space-between"><strong>${escape(name)}</strong><span class="siepe-class-percent">${comparisonPercent(a)}</span></div>
      <div class="siepe-mini-track ${a.pct===null?'siepe-empty-track':''}"><span style="width:${a.pct??0}%"></span></div><small>${a.done} concluído(s), ${a.pending} pendente(s)${a.unknown?', '+a.unknown+' sem status':''} — registros importados</small>${a.pct===null?`<small>${statusText(a)}</small>`:''}</div>`;
    }).join('');
  }
  function renderPending(items){
    if(!items.length)return '<p class="small-note">Nenhuma pendência identificada neste trimestre nos registros importados. Isso não comprova que o trimestre esteja integralmente preenchido no SIEPE.</p>';
    const groups=byClassroom(items);
    return groups.map(([label,records])=>{
      const sorted=records.slice().sort((a,b)=>(a.data||'').localeCompare(b.data||'')||a.tipo.localeCompare(b.tipo));
      return `<div class="siepe-pending-group"><div class="siepe-group-head"><strong>${escape(label)}</strong><span>${records.length} pendência(s)</span></div>${sorted.map(r=>`<div class="siepe-item"><small><strong>${escape(r.tipo)}</strong>${escape(formatDate(r.data))} • Pendente</small></div>`).join('')}</div>`;
    }).join('');
  }
  function renderSiepe(){
    showScreen('screen-siepe');
    const year=siteFocusYear();
    const currentTerm=defaultTerm(year);
    const active=Number(siepe.selectedTrimester)||currentTerm;
    const t=termStats(year,active);
    const latest=siepe.importedAt?new Date(siepe.importedAt).toLocaleString('pt-BR'):'Nenhum relatório importado';
    const allowedYears=[...new Set([year,new Date().getFullYear(),...siepe.rows.map(r=>Number((r.data||'').slice(0,4))).filter(y=>y>2000&&y<2200)])].sort((a,b)=>b-a);
    const yearOptions=allowedYears.map(y=>`<option value="${y}" ${y===year?'selected':''}>${y}</option>`).join('');
    const dateValid=siepe.rows.filter(r=>/^\d{4}-\d{2}-\d{2}$/.test(r.data||''));
    const noDate=siepe.rows.length-dateValid.length;
    const otherYears=dateValid.filter(r=>Number(r.data.slice(0,4))!==year).length;
    const pending=t.rows.filter(r=>r.situacao==='pendente');
    const filter=siepe.pendingType||'todos';
    const filtered=filter==='todos'?pending:pending.filter(r=>r.tipo===filter);
    const aDates=t.rows.map(r=>r.data).sort();
    const periodHint=t.rows.length?`Dados de ${escape(formatDate(aDates[0]))} a ${escape(formatDate(aDates[aDates.length-1]))} (${t.rows.length} registros importados)`:'Não há registros deste trimestre no relatório atual';
    const starts=startsFor(year);
    const freq=t.rows.filter(r=>r.tipo==='Frequência'), lessons=t.rows.filter(r=>r.tipo==='Registro de aula');
    const bar=t.pct!==null?`<div class="siepe-progress" role="img" aria-label="${t.pct}% concluído nos registros importados"><span style="width:${t.pct}%"></span><span style="flex:1"></span></div>
      <div class="row" style="justify-content:space-between"><strong style="color:#177749">${t.pct}% concluído</strong><strong style="color:#c04747">${100-t.pct}% pendente</strong></div>` : '<div class="siepe-hint">Sem dados suficientes para calcular o percentual deste trimestre.</div>';
    document.getElementById('screen-siepe').innerHTML=`
      <div class="topbar"><button onclick="renderHome()">← Início</button><div class="section-title" style="margin:0">Meu SIEPE</div></div>
      <div class="card siepe-priority"><div class="row" style="justify-content:space-between;align-items:flex-start"><div>
        <div class="title">Situação por trimestre</div><div class="subtitle">Última importação: ${escape(latest)}</div></div>
        <label class="siepe-year-label">Ano <select onchange="agendaV62Year(this.value)">${yearOptions}</select></label></div>
        <div class="siepe-term-grid">${[1,2,3].map(term=>termCard(year,term,active,currentTerm)).join('')}</div>
        <p class="small-note" style="margin-top:10px">O trimestre atual fica destacado automaticamente. <strong>Verde</strong>: registros concluídos; <strong>vermelho</strong>: pendentes; <strong>cinza</strong>: sem dados suficientes. Os percentuais referem-se apenas aos relatórios importados.</p></div>
      ${pastAlerts(year,currentTerm)}
      <div class="card"><div class="row" style="justify-content:space-between;align-items:flex-start"><div>
        <div class="title">${active}º trimestre ${active===currentTerm&&year===new Date().getFullYear()?'<span class="siepe-active-label">PRIORIDADE</span>':''}</div>
        <div class="subtitle">${periodHint}</div></div><span style="font-size:23px">📊</span></div>
        ${bar}<div class="siepe-summary-numbers"><span><b>${t.done}</b> concluídos</span><span><b>${t.pending}</b> pendentes</span><span><b>${t.rows.length}</b> registros</span></div>
        ${t.unknown?`<div class="small-note">${t.unknown} registro(s) com status não identificado, excluídos do cálculo percentual.</div>`:''}
        ${t.rows.length?`<hr class="sep" /><div class="siepe-kpi-grid">${miniStat('Frequência',freq)}${miniStat('Registro de aula',lessons)}</div>`:''}
      </div>
      <div class="card"><div class="title">Comparativo dos três trimestres</div><div class="subtitle">Geral, frequência, registro de aulas e pendências</div>${comparisonRows(year,currentTerm)}</div>
      <div class="card"><div class="title">Situação por turma</div><div class="subtitle">${active}º trimestre · percentual dos registros importados</div>${detailedClassrooms(t.rows)}</div>
      <div class="card"><div class="row" style="justify-content:space-between"><div><div class="title">Pendências do ${active}º trimestre</div><div class="subtitle">Por turma, data e tipo de registro</div></div><span class="siepe-tag">${t.pending} pendência(s)</span></div>
        <div class="siepe-filters"><button class="${filter==='todos'?'active':''}" onclick="agendaV62PendingType('todos')">Todas</button>
          <button class="${filter==='Frequência'?'active':''}" onclick="agendaV62PendingType('Frequência')">Frequência</button>
          <button class="${filter==='Registro de aula'?'active':''}" onclick="agendaV62PendingType('Registro de aula')">Registro de aula</button></div>
        <div id="siepeList">${renderPending(filtered)}</div></div>
      <div class="card"><div class="title">Atualizar relatório</div>
        <p class="small-note">Importe um relatório exportado do SIEPE. Registros anteriores de outros trimestres são mantidos; dados da mesma turma, data e tipo são atualizados. Para percentuais confiáveis, inclua turmas concluídas e pendentes.</p>
        <label>Relatório (XLSX, XLS, CSV, HTML ou PDF)</label><input type="file" accept=".xlsx,.xls,.xlsm,.ods,.csv,.tsv,.txt,.html,.htm,.pdf" onchange="agendaV6ImportSiepe(event)" />
        <div class="small-note" id="siepeImportStatus"></div><div class="actions">
          <button class="outline-btn" onclick="window.open('https://www.siepe.educacao.pe.gov.br/','_blank','noopener')">Abrir SIEPE oficial ↗</button>
          <button class="primary-btn" onclick="agendaV6Pending()">Pendências (${t.pending})</button></div>
        <div class="small-note">${noDate?`⚠ ${noDate} registro(s) sem data ficaram fora do cálculo trimestral. `:''}${otherYears?`${otherYears} registro(s) pertencem a outro ano e não estão nesta visão. `:''}</div></div>
      <details class="legacy-fold"><summary>Configurar datas dos trimestres de ${year}</summary>
        <p class="small-note">As datas sugeridas são <strong>provisórias</strong>. Ajuste os inícios de cada trimestre de acordo com o calendário letivo oficial da escola. O 1º começa no início do ano; os outros períodos começam nas datas abaixo.</p>
        <label>Início do 2º trimestre</label><input type="date" value="${starts.second}" onchange="agendaV62SetTerm(2,this.value)" style="width:100%;padding:10px;border:1px solid #dce5f0;border-radius:10px" />
        <label>Início do 3º trimestre</label><input type="date" value="${starts.third}" onchange="agendaV62SetTerm(3,this.value)" style="width:100%;padding:10px;border:1px solid #dce5f0;border-radius:10px" />
        <div class="small-note">${starts.configured?'Datas configuradas para este ano.':'Datas ainda não confirmadas pelo calendário letivo.'}</div>
      </details>`;
  }
  window.agendaV62Term=(t)=>{if(![1,2,3].includes(Number(t)))return;siepe.selectedTrimester=Number(t);siepe.pendingType='todos';persistSiepe();renderSiepe();};
  window.agendaV62Year=(y)=>{y=Number(y);if(y<2000||y>2200)return;siepe.selectedYear=y;siepe.selectedTrimester=null;siepe.pendingType='todos';persistSiepe();renderSiepe();};
  window.agendaV62PendingType=(type)=>{siepe.pendingType=type;persistSiepe();renderSiepe();document.getElementById('siepeList')?.scrollIntoView({behavior:'smooth',block:'start'});};
  window.agendaV62SetTerm=(term,date)=>{
    const year=siteFocusYear(), starts=startsFor(year);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||Number(date.slice(0,4))!==year){alert('Informe uma data válida dentro do ano selecionado.');renderSiepe();return;}
    const next={second:term===2?date:starts.second,third:term===3?date:starts.third};
    if(next.second>=next.third){alert('O 2º trimestre deve começar antes do 3º.');renderSiepe();return;}
    siepe.termStarts={...(siepe.termStarts||{}),[String(year)]:next};siepe.selectedTrimester=null;persistSiepe();renderSiepe();
  };
  window.agendaV6Pending=()=>{document.getElementById('siepeList')?.scrollIntoView({behavior:'smooth',block:'start'});};
  window.agendaV6ImportSiepe=importReport;
  window.agendaV6SiepeTotal=(value)=>{const n=Number(value);siepe.totalExpected=value&&Number.isInteger(n)&&n>0?n:null;persistSiepe();renderSiepe();};
  window.exportAgendaBackup=function(){
    // Preserva o mesmo formato de backup e inclui o painel SIEPE, sem senha ou relatórios brutos.
    const data={type:'agenda-docente-backup',version:2,exportedAt:new Date().toISOString(),tasks:JSON.parse(localStorage.getItem('agenda-docente-demo-v2')||'{}'),notes:JSON.parse(localStorage.getItem('agenda-docente-notas-v4')||'{}'),siepe};
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='backup-agenda-docente-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);
  };
  window.importAgendaBackup=async function(event){
    const file=event.target.files?.[0];if(!file)return;
    try{
      const data=JSON.parse(await file.text());
      if(data.type!=='agenda-docente-backup'||!data.tasks||!data.notes||typeof data.tasks!=='object'||typeof data.notes!=='object'||Array.isArray(data.tasks)||Array.isArray(data.notes))throw Error('Arquivo de backup inválido.');
      if(!confirm('Este backup substituirá os registros locais, inclusive o Meu SIEPE se presente. Deseja continuar?'))return;
      localStorage.setItem('agenda-docente-demo-v2',JSON.stringify(data.tasks));localStorage.setItem('agenda-docente-notas-v4',JSON.stringify(data.notes));
      if(data.siepe&&Array.isArray(data.siepe.rows))localStorage.setItem(siepeKey,JSON.stringify(data.siepe));
      alert('Backup restaurado. Reabrindo o aplicativo.');location.reload();
    }catch(err){alert('Não foi possível restaurar: '+err.message);}finally{event.target.value='';}
  };
  window.agendaReadCloudPayload=function(){
    const payload=originalReadCloud();
    // Compatibilidade com a v5: sem dados SIEPE, não altera o formato original da nuvem.
    if(siepe.rows.length||siepe.importedAt||siepe.totalExpected||Object.keys(siepe.termStarts||{}).length) payload.siepe=JSON.parse(JSON.stringify(siepe));
    return payload;
  };
  window.agendaApplyCloudPayload=function(payload){
    originalApplyCloud(payload);
    if(payload?.siepe&&Array.isArray(payload.siepe.rows)){
      siepe={...siepe,...payload.siepe};localStorage.setItem(siepeKey,JSON.stringify(siepe));
    }
  };
  // Não tocar na instalação ou nos dados antigos do navegador: apenas adições.
  const home=document.getElementById('screen-home');
  if(home)window.renderHome();
})();
