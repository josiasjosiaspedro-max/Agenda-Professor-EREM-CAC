/* Agenda Docente v6.1 — interface B, calendário semanal anual, SIEPE e notas expandidas. */
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
  let siepe = { rows:[], importedAt:'', source:'', totalExpected:null, totalReported:0 };
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
    if(listId==='siepe'){state.list='siepe';document.getElementById('homeHeader').classList.add('hidden');return renderSiepe();}
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
  const stat=(s)=>{const x=normalize(s);return /pendente|nao preenchido|nao informado|em aberto|falta registro/.test(x)?'pendente':/concluido|preenchido|realizado|registrado|ok\b/.test(x)?'concluido':'indefinido';};
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
        const ss=stat(raw[statusIndex]);if(ss!=='indefinido')result.push({...base,tipo:tipoIndex>=0&&/frequencia/.test(normalize(raw[tipoIndex]))?'Frequência':'Registro de aula',situacao:ss});
      }
    }
    return uniqueRows(result);
  }
  function uniqueRows(rows){
    const m=new Map();for(const r of rows){if(!r.turma)continue;const id=[r.turma,r.disciplina,r.data,r.tipo].map(normalize).join('|');m.set(id,r);}return [...m.values()];
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
      if(!confirm(`Relatório: ${file.name}\n\n${pending} pendência(s), ${done} concluído(s), ${uncertain} registro(s) sem status claro.\n\nSubstituir os dados da última importação por esses registros?`))return;
      siepe={...siepe,rows:found,importedAt:new Date().toISOString(),source:file.name,totalExpected:null,totalReported:found.length};persistSiepe();renderSiepe();
    }catch(err){if(textEl)textEl.textContent=err.message||String(err);alert('Importação não concluída: '+(err.message||err));}
    finally{event.target.value='';}
  }
  function progress(){
    const pending=siepe.rows.filter(r=>r.situacao==='pendente').length, done=siepe.rows.filter(r=>r.situacao==='concluido').length;
    const totalInput=Number(siepe.totalExpected);const total=(Number.isFinite(totalInput)&&totalInput>=(pending+done)&&totalInput>0)?totalInput:pending+done;
    const enough=total>0 && ((done>0&&pending>0)||(done>0&&pending===0)||(Number.isFinite(totalInput)&&totalInput>0&&totalInput>=pending+done));
    const countedDone=Number.isFinite(totalInput)&&totalInput>0&&totalInput>=pending+done ? total-pending : done;
    return {pending,done,total,complete:enough?Math.round(100*countedDone/total):null};
  }
  function renderSiepe(){
    showScreen('screen-siepe');
    const p=progress();const latest=siepe.importedAt?new Date(siepe.importedAt).toLocaleString('pt-BR'):'Nenhum relatório importado';
    const bar=p.complete===null?'':`<div class="siepe-progress" aria-label="${p.complete}% concluído, ${100-p.complete}% pendente"><span style="width:${p.complete}%"></span><span style="flex:1"></span></div><div class="row" style="justify-content:space-between"><strong style="color:#177749">${p.complete}% preenchido</strong><strong style="color:#c04747">${100-p.complete}% pendente</strong></div>`;
    const items=siepe.rows.filter(r=>r.situacao==='pendente');
    document.getElementById('screen-siepe').innerHTML=`
      <div class="topbar"><button onclick="renderHome()">← Início</button><div class="section-title" style="margin:0">Meu SIEPE</div></div>
      <div class="card"><div class="row" style="justify-content:space-between"><div><div class="title">Acompanhamento dos registros</div><div class="subtitle">Última importação: ${escape(latest)}</div></div><span style="font-size:25px">📊</span></div>
        ${bar ? bar + '<p class="small-note">Percentual referente apenas aos registros identificados neste relatório. Se o arquivo não incluir todo o período, o resultado não representa o preenchimento completo do SIEPE.</p>' : `<div class="siepe-hint" style="margin-top:12px">Percentual ainda indisponível: o relatório precisa informar os registros concluídos e pendentes, ou você pode preencher o total de registros esperados abaixo. Não exibimos um percentual inventado.</div>`}
        <div class="actions"><span class="siepe-tag">${p.pending} pendência(s)</span><span class="siepe-tag" style="background:#e9eff9;color:#245b95">${siepe.rows.length} item(ns) importado(s)</span></div>
        <label>Total de registros esperados no período (opcional)</label><input type="number" min="1" step="1" style="width:100%;border-radius:12px;border:1px solid var(--line);padding:11px" value="${siepe.totalExpected||''}" placeholder="Ex.: 120" onchange="agendaV6SiepeTotal(this.value)" /><div class="small-note">Preencha somente se souber o total correto. Esse número permite calcular a proporção de registros ainda pendentes.</div>
      </div>
      <div class="card"><div class="title">Atualizar relatórios</div><p class="small-note">Baixe o relatório no site oficial do SIEPE e importe aqui. O arquivo é analisado no seu navegador; somente os registros identificados ficam salvos no Agenda Docente.</p>
        <label>Relatório do SIEPE (XLSX, XLS, CSV, HTML ou PDF)</label><input type="file" accept=".xlsx,.xls,.xlsm,.ods,.csv,.tsv,.txt,.html,.htm,.pdf" onchange="agendaV6ImportSiepe(event)" /><div class="small-note" id="siepeImportStatus"></div>
        <div class="actions"><button class="outline-btn" onclick="window.open('https://www.siepe.educacao.pe.gov.br/ator/educadores','_blank','noopener')">Abrir SIEPE oficial ↗</button><button class="primary-btn" onclick="agendaV6Pending(true)">Pendências (${p.pending})</button></div>
      </div>
      <div class="card"><div class="title">Pendências identificadas</div><div class="subtitle">Frequência e registro de aulas por turma e data</div><div id="siepeList">${renderPending(items)}</div></div>
      `;
  }
  function renderPending(items){return items.length?items.slice(0,200).map((r,i)=>`<div class="siepe-item"><strong>${escape(r.turma)}${r.disciplina?' • '+escape(r.disciplina):''}</strong><small>${escape(r.tipo)} • ${escape(formatDate(r.data))} • Pendente</small></div>`).join(''):'<p class="small-note">Nenhuma pendência identificada nos registros carregados. Isso não comprova que o SIEPE esteja integralmente preenchido.</p>';}
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
    if(siepe.rows.length||siepe.importedAt||siepe.totalExpected) payload.siepe=JSON.parse(JSON.stringify(siepe));
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
