/* Agenda Docente V7.1 — tabelas de Notas: seleção integral de linha/coluna,
   ferramentas contextuais, desfazer/refazer, importação de tabelas.
   Não altera os nomes de armazenamento nem a integração Supabase. */
(function(){
  'use strict';
  const MAX_ROWS=40, MAX_COLS=10, HISTORY_MAX=35;
  let lastCell=null, mode=null, undoStack=[], redoStack=[], inputAt=0, inputCell=null;
  const baseOpen=window.openNotesEditor;
  const baseSave=window.saveNote;
  if(typeof baseOpen!=='function')return;
  function editor(){return document.getElementById('notesEditor');}
  function status(message,problem=false){
    const el=document.getElementById('notesTableFeedback');
    if(el){el.textContent=message;el.classList.toggle('problem',Boolean(problem));}
  }
  function cellFrom(target){
    const ed=editor();if(!ed||!target)return null;
    const element=target.nodeType===3?target.parentElement:target;
    if(!element?.closest)return null;
    const cell=element.closest('td,th');
    return cell&&ed.contains(cell)&&cell.closest('table')&&ed.contains(cell.closest('table'))?cell:null;
  }
  function snapshotHtml(){
    const ed=editor();if(!ed)return '';
    const copy=ed.cloneNode(true);
    copy.querySelectorAll('.v7-selected-row,.v7-selected-column,.v7-picked-cell').forEach(cell=>{
      cell.classList.remove('v7-selected-row','v7-selected-column','v7-picked-cell');
      if(!cell.getAttribute('class'))cell.removeAttribute('class');
    });
    return copy.innerHTML;
  }
  // Impede que os marcadores visuais de seleção sejam gravados nas notas/nuvem.
  if(typeof baseSave==='function'){
    window.saveNote=function(...args){
      const ed=editor();
      if(!ed)return baseSave(...args);
      const marks=[...ed.querySelectorAll('.v7-selected-row,.v7-selected-column,.v7-picked-cell')]
        .map(el=>[el,el.getAttribute('class')]);
      for(const [el] of marks){el.classList.remove('v7-selected-row','v7-selected-column','v7-picked-cell');if(!el.getAttribute('class'))el.removeAttribute('class');}
      try{return baseSave(...args);}finally{
        for(const [el,value] of marks)if(el.isConnected){if(value===null)el.removeAttribute('class');else el.setAttribute('class',value);}
      }
    };
  }
  function persist(){if(typeof window.saveNote==='function')window.saveNote(false);}
  function syncHistoryButtons(){
    const u=document.getElementById('v7UndoBtn'),r=document.getElementById('v7RedoBtn');
    if(u){u.hidden=!undoStack.length;u.disabled=!undoStack.length;}
    if(r){r.hidden=!redoStack.length;r.disabled=!redoStack.length;}
  }
  function selectionAddress(){
    const ed=editor(),c=lastCell;
    if(!ed||!c||!ed.contains(c))return null;
    const table=c.closest('table'),row=c.closest('tr');
    return {tableIndex:[...ed.querySelectorAll('table')].indexOf(table),row:[...table.rows].indexOf(row),col:[...row.cells].indexOf(c),mode};
  }
  function pushHistory(kind='structure'){
    const html=snapshotHtml();
    if(!editor())return;
    const now=Date.now(),address=selectionAddress();
    const key=address?`${address.tableIndex}:${address.row}:${address.col}`:'text';
    // Uma sequência de digitação na mesma célula é desfeita em um único passo.
    if(kind==='input'&&undoStack.length&&inputAt&&now-inputAt<1200&&inputCell===key){inputAt=now;return;}
    if(undoStack.at(-1)?.html!==html){undoStack.push({html,address});if(undoStack.length>HISTORY_MAX)undoStack.shift();}
    redoStack=[];
    inputAt=kind==='input'?now:0;
    inputCell=kind==='input'?key:null;
    syncHistoryButtons();
  }
  function clearHighlights(){
    editor()?.querySelectorAll('.v7-picked-cell,.v7-selected-row,.v7-selected-column').forEach(el=>{
      el.classList.remove('v7-picked-cell','v7-selected-row','v7-selected-column');
      if(!el.getAttribute('class'))el.removeAttribute('class');
    });
  }
  function hidePanel(){
    clearHighlights();mode=null;lastCell=null;
    const panel=document.getElementById('v7SelectionPanel');if(panel)panel.hidden=true;
  }
  window.agendaV7CloseSelection=hidePanel;
  function paintSelection(){
    clearHighlights();
    const cell=lastCell;if(!cell||!cell.isConnected)return;
    const table=cell.closest('table'),row=cell.closest('tr');
    const colIndex=[...row.cells].indexOf(cell);
    if(mode==='row')for(const c of row.cells)c.classList.add('v7-selected-row');
    else if(mode==='column')for(const r of table.rows)if(r.cells[colIndex])r.cells[colIndex].classList.add('v7-selected-column');
    else cell.classList.add('v7-picked-cell');
  }
  function renderSelectionPanel(){
    const panel=document.getElementById('v7SelectionPanel');if(!panel)return;
    const valid=lastCell&&editor()?.contains(lastCell);
    panel.hidden=!valid;
    if(!valid)return;
    const row=lastCell.closest('tr'),table=lastCell.closest('table');
    const indexRow=[...table.rows].indexOf(row)+1,indexCol=[...row.cells].indexOf(lastCell)+1;
    const hint=document.getElementById('v7SelectionHint');
    if(hint)hint.textContent=mode==='row'?`Linha ${indexRow} selecionada por completo (${row.cells.length} células).`:
      mode==='column'?`Coluna ${indexCol} selecionada por completo (${table.rows.length} linhas).`:
      `Célula da linha ${indexRow}, coluna ${indexCol}. Escolha o que deseja selecionar.`;
    panel.querySelectorAll('[data-select-mode]').forEach(btn=>{
      const active=btn.dataset.selectMode===mode;
      btn.classList.toggle('active',active);
      btn.setAttribute('aria-pressed',String(active));
    });
    const actions=document.getElementById('v7TableOperations');if(actions)actions.hidden=!mode;
    panel.querySelectorAll('[data-table-mode]').forEach(btn=>btn.hidden=btn.dataset.tableMode!==mode);
    paintSelection();
  }
  function rememberCell(target){
    const cell=cellFrom(target);
    if(!cell){hidePanel();return;}
    if(lastCell!==cell){lastCell=cell;mode=null;}
    renderSelectionPanel();
  }
  function activeCell(){return lastCell&&editor()?.contains(lastCell)?lastCell:null;}
  window.agendaV7SelectNotePart=function(which){
    if(!activeCell()){status('Toque primeiro numa célula da tabela.',true);return;}
    mode=which==='row'?'row':which==='column'?'column':null;
    renderSelectionPanel();
    status(mode==='row'?'Linha completa destacada. Use as opções para editar ou copiar.':'Coluna completa destacada. Use as opções para editar ou copiar.');
  };
  function focusCell(cell,which){
    if(!cell||!cell.isConnected){hidePanel();return;}
    lastCell=cell;mode=which;
    const ed=editor();ed?.focus();
    try{const range=document.createRange();range.selectNodeContents(cell);range.collapse(true);
      const sel=window.getSelection();sel.removeAllRanges();sel.addRange(range);
      if(typeof notesRememberRange==='function')notesRememberRange();
    }catch(_e){}
    renderSelectionPanel();
  }
  function restoreRecord(record){
    const ed=editor();if(!ed)return;
    hidePanel();ed.innerHTML=record.html;
    const a=record.address;
    if(a&&a.tableIndex>=0){const t=ed.querySelectorAll('table')[a.tableIndex];
      const c=t?.rows[a.row]?.cells[a.col];if(c){lastCell=c;mode=a.mode;renderSelectionPanel();}}
    persist();
  }
  window.agendaV7Undo=function(){
    if(!undoStack.length)return;
    const previous=undoStack.pop();
    redoStack.push({html:snapshotHtml(),address:selectionAddress()});
    inputAt=0;restoreRecord(previous);syncHistoryButtons();
    status('Última alteração desfeita.');
  };
  window.agendaV7Redo=function(){
    if(!redoStack.length)return;
    const next=redoStack.pop();
    undoStack.push({html:snapshotHtml(),address:selectionAddress()});
    inputAt=0;restoreRecord(next);syncHistoryButtons();
    status('Alteração refeita.');
  };
  function copyFallback(value){
    const ta=document.createElement('textarea');ta.value=value;
    ta.style.cssText='position:fixed;left:-9999px;top:0';document.body.appendChild(ta);
    ta.select();const result=document.execCommand('copy');ta.remove();
    if(!result)throw Error('Seu navegador não permitiu a cópia.');
  }
  window.agendaV7CopySelection=async function(){
    const cell=activeCell();if(!cell||!mode)return;
    const table=cell.closest('table'),row=cell.closest('tr'),ci=[...row.cells].indexOf(cell);
    const values=mode==='row'?[...[...row.cells].map(c=>c.innerText.trim())]:[...table.rows].map(r=>r.cells[ci]?.innerText.trim()||'');
    const text=values.join(mode==='row'?'\t':'\n');
    try{
      if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(text);else copyFallback(text);
      status(`${mode==='row'?'Linha':'Coluna'} copiada. Você pode colar em outra tabela.`);
    }catch(err){try{copyFallback(text);status('Seleção copiada.');}catch(_e){status('Não foi possível copiar: '+err.message,true);}}
  };
  function editTable(action){
    const cell=activeCell();
    if(!cell||!mode){status('Selecione a linha ou a coluna inteira para habilitar a edição.',true);return;}
    const table=cell.closest('table');
    if(!table||!editor()?.contains(table))return;
    if(table.querySelector('[rowspan]:not([rowspan="1"]),[colspan]:not([colspan="1"])')){
      status('Tabela com células mescladas. Importe uma versão sem mesclagens para alterar sua estrutura.',true);return;
    }
    const row=cell.closest('tr'),rows=[...table.rows],rowIndex=rows.indexOf(row),colIndex=[...row.cells].indexOf(cell);
    if(rowIndex<0||colIndex<0)return;
    const nrows=rows.length,ncols=Math.max(...rows.map(r=>r.cells.length));
    if(mode==='row'&&!['row-after','row-before','delete-row','delete-table'].includes(action))return;
    if(mode==='column'&&!['column-after','column-before','delete-column','delete-table'].includes(action))return;
    if(action.startsWith('row')&&nrows>=MAX_ROWS){status(`Limite de ${MAX_ROWS} linhas.`,true);return;}
    if(action.startsWith('column')&&ncols>=MAX_COLS){status(`Limite de ${MAX_COLS} colunas.`,true);return;}
    if(action==='delete-row'&&nrows<=1){status('Última linha: para remover tudo, use “Apagar tabela”.',true);return;}
    if(action==='delete-column'&&ncols<=1){status('Última coluna: para remover tudo, use “Apagar tabela”.',true);return;}
    if(action==='delete-row'&&!confirm('Excluir a linha selecionada inteira e todos os seus valores?'))return;
    if(action==='delete-column'&&!confirm('Excluir a coluna selecionada inteira e todos os seus valores?'))return;
    if(action==='delete-table'&&!confirm('Apagar esta tabela inteira? Você poderá usar “Desfazer” logo após a exclusão.'))return;
    pushHistory('structure');
    let next=null;
    if(action==='row-after'||action==='row-before'){
      const at=rowIndex+(action==='row-after'?1:0), tr=table.insertRow(at);
      for(let i=0;i<ncols;i++)tr.insertCell(i).innerHTML='<br>';
      next=tr.cells[Math.min(colIndex,ncols-1)];
    }else if(action==='column-after'||action==='column-before'){
      const at=colIndex+(action==='column-after'?1:0);
      rows.forEach(tr=>{const c=tr.insertCell(Math.min(at,tr.cells.length));c.innerHTML='<br>';});
      next=table.rows[rowIndex].cells[at];
    }else if(action==='delete-row'){
      table.deleteRow(rowIndex);next=table.rows[Math.min(rowIndex,table.rows.length-1)]?.cells[Math.min(colIndex,ncols-1)];
    }else if(action==='delete-column'){
      rows.forEach(tr=>{if(tr.cells[colIndex])tr.deleteCell(colIndex);});
      next=table.rows[rowIndex]?.cells[Math.min(colIndex,ncols-2)];
    }else if(action==='delete-table'){
      const p=document.createElement('p');p.innerHTML='<br>';table.replaceWith(p);
      hidePanel();persist();syncHistoryButtons();status('Tabela apagada. Use “Desfazer” para recuperá-la.');return;
    }
    persist();focusCell(next,mode);syncHistoryButtons();
    status(`Tabela atualizada: ${table.rows.length} linhas × ${table.rows[0]?.cells.length||0} colunas. Use “Desfazer” se necessário.`);
  }
  window.agendaV7EditTable=editTable;

  // Leitura de CSV com aspas, delimitadores e quebras de linha dentro de células.
  function parseDelimited(text,delimiter){
    const rows=[], row=[];let field='',quoted=false;
    for(let i=0;i<text.length;i++){
      const c=text[i];
      if(quoted){
        if(c==='"' && text[i+1]==='"'){field+='"';i++;}
        else if(c==='"')quoted=false;
        else field+=c;
      }else if(c==='"' && field==='')quoted=true;
      else if(c===delimiter){row.push(field);field='';}
      else if(c==='\n' || c==='\r'){
        if(c==='\r' && text[i+1]==='\n')i++;
        row.push(field);rows.push(row.splice(0));field='';
      }else field+=c;
    }
    row.push(field);rows.push(row);
    return rows;
  }
  function separatorOf(text,ext){
    if(ext==='tsv')return '\t';
    if(/^sep=([;,\t|])/i.test(text))return text.slice(4,5);
    const first=text.split(/\r?\n/).slice(0,6).join('\n');
    const candidates=['\t',';',','];
    let best=',',score=-Infinity;
    for(const d of candidates){
      const rs=parseDelimited(first,d), widths=rs.filter(r=>r.some(v=>v.trim()!=='')).map(r=>r.length);
      if(!widths.length)continue;
      const spread=Math.max(...widths)-Math.min(...widths);
      const value=widths.reduce((a,b)=>a+b,0)/widths.length - spread*3;
      if(value>score){score=value;best=d;}
    }
    return best;
  }
  function trimMatrix(input){
    let rows=input.map(row=>row.map(x=>String(x??'').replace(/\u0000/g,'')));
    while(rows.length && rows[rows.length-1].every(x=>x.trim()===''))rows.pop();
    while(rows.length && rows[0].every(x=>x.trim()===''))rows.shift();
    if(rows.length && rows[0][0]?.toLowerCase().startsWith('sep=') && rows[0].length===1)rows.shift();
    const cols=Math.max(0,...rows.map(r=>r.length));
    if(!rows.length||!cols)throw Error('A tabela está vazia.');
    if(rows.length>MAX_ROWS || cols>MAX_COLS)throw Error(`A tabela tem ${rows.length} linhas e ${cols} colunas. O limite é ${MAX_ROWS} × ${MAX_COLS}.`);
    return rows.map(r=>Array.from({length:cols},(_,i)=>r[i]??''));
  }
  function loadExcel(){
    if(window.XLSX)return Promise.resolve();
    return new Promise((resolve,reject)=>{
      const src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      const tag=document.createElement('script');tag.src=src;tag.async=true;
      tag.onload=()=>window.XLSX?resolve():reject(Error('Biblioteca de Excel indisponível.'));
      tag.onerror=()=>reject(Error('Não foi possível carregar o leitor do Excel. Conecte-se à internet ou salve a planilha como CSV.'));
      document.head.appendChild(tag);
    });
  }
  async function fileMatrix(file){
    const ext=file.name.split('.').pop().toLowerCase();
    if(['csv','tsv','txt'].includes(ext)){
      const buffer=await file.arrayBuffer();let text=new TextDecoder('utf-8').decode(buffer);
      if(text.includes('\uFFFD'))text=new TextDecoder('windows-1252').decode(buffer);
      text=text.replace(/^\uFEFF/,'');
      const delimiter=separatorOf(text,ext);
      if(/^sep=/.test(text.toLowerCase()))text=text.replace(/^sep=[^\r\n]+\r?\n/i,'');
      return trimMatrix(parseDelimited(text,delimiter));
    }
    if(['xlsx','xls','xlsm','ods'].includes(ext)){
      await loadExcel();
      const book=window.XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:false});
      if(!book.SheetNames.length)throw Error('A planilha não possui abas.');
      let name=book.SheetNames[0];
      if(book.SheetNames.length>1){
        const options=book.SheetNames.map((x,i)=>`${i+1}. ${x}`).join('\n');
        const chosen=prompt(`Qual aba deseja importar?\n${options}\n\nDigite o número:`, '1');
        if(chosen===null)return null;
        const n=Number(chosen);if(!Number.isInteger(n)||n<1||n>book.SheetNames.length)throw Error('Número de aba inválido.');
        name=book.SheetNames[n-1];
      }
      const rows=window.XLSX.utils.sheet_to_json(book.Sheets[name],{header:1,defval:'',raw:false,blankrows:false});
      return trimMatrix(rows);
    }
    if(['html','htm'].includes(ext)){
      const dom=new DOMParser().parseFromString(await file.text(),'text/html');
      const table=dom.querySelector('table');
      if(!table)throw Error('O arquivo HTML não contém tabela.');
      const rows=[...table.rows].map(tr=>[...tr.cells].map(c=>c.textContent.trim()));
      return trimMatrix(rows);
    }
    throw Error('Formato não suportado. Selecione XLSX, XLS, CSV, TSV ou HTML.');
  }
  function textEscape(value){
    return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function appendMatrix(rows){
    const ed=editor();if(!ed)throw Error('Abra uma nota antes de importar.');
    pushHistory('import');
    const table=document.createElement('table'),tbody=document.createElement('tbody');
    for(const line of rows){
      const tr=document.createElement('tr');
      for(const value of line){const td=document.createElement('td');td.textContent=value||'';if(!td.textContent)td.appendChild(document.createElement('br'));tr.appendChild(td);}
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    const wrap=document.createElement('p');wrap.innerHTML='<br>';
    ed.append(table,wrap);
    persist();focusCell(table.rows[0].cells[0],null);
    table.scrollIntoView({block:'nearest',behavior:'smooth'});
    syncHistoryButtons();
  }
  window.agendaV7ImportNoteTable=async function(ev){
    const input=ev.target,file=input.files?.[0];if(!file)return;
    status(`Lendo “${file.name}”...`);
    try{
      const matrix=await fileMatrix(file);
      if(!matrix){status('Importação cancelada.');return;}
      if(!confirm(`Importar tabela com ${matrix.length} linhas e ${matrix[0].length} colunas ao final desta nota?\nAs outras informações serão preservadas.`)){
        status('Importação cancelada.');return;
      }
      appendMatrix(matrix);
      status(`Tabela “${file.name}” importada. Toque em uma célula para selecionar sua linha ou coluna.`);
    }catch(err){status(err.message||'Não foi possível importar o arquivo.',true);}
    finally{input.value='';}
  };
  window.addNotesTable=function(){
    const askRows=prompt(`Quantidade de linhas (1 a ${MAX_ROWS}):`,'10');if(askRows===null)return;
    const rows=Number(askRows);
    if(!Number.isInteger(rows)||rows<1||rows>MAX_ROWS){alert(`Informe de 1 a ${MAX_ROWS} linhas.`);return;}
    const askCols=prompt(`Quantidade de colunas (1 a ${MAX_COLS}):`,'5');if(askCols===null)return;
    const cols=Number(askCols);
    if(!Number.isInteger(cols)||cols<1||cols>MAX_COLS){alert(`Informe de 1 a ${MAX_COLS} colunas.`);return;}
    appendMatrix(Array.from({length:rows},()=>Array(cols).fill('')));
    status(`Tabela criada: ${rows} linhas × ${cols} colunas. Toque numa célula para escolher linha ou coluna.`);
  };
  window.openNotesEditor=function(index){
    lastCell=null;mode=null;undoStack=[];redoStack=[];inputAt=0;inputCell=null;
    baseOpen(index);
    const ed=editor(),toolbar=document.querySelector('#screen-notes .notes-actions');
    if(!ed||!toolbar)return;
    const extras=document.createElement('div');extras.className='v7-notes-table-controls';
    extras.innerHTML=`
      <div class="v7-import-row">
        <button class="primary-btn" type="button" onclick="document.getElementById('v7ImportNoteFile').click()">📥 Importar tabela pronta</button>
        <button id="v7UndoBtn" class="outline-btn v7-undo-btn" type="button" onclick="agendaV7Undo()" hidden disabled aria-label="Desfazer última alteração">↶ Desfazer</button>
        <button id="v7RedoBtn" class="outline-btn v7-undo-btn" type="button" onclick="agendaV7Redo()" hidden disabled aria-label="Refazer última alteração">↷ Refazer</button>
        <span class="v7-import-caption">Excel, CSV ou TSV · até ${MAX_ROWS} × ${MAX_COLS}</span>
      </div>
      <input id="v7ImportNoteFile" type="file" accept=".xlsx,.xls,.xlsm,.ods,.csv,.tsv,.txt,.html,.htm" hidden onchange="agendaV7ImportNoteTable(event)">
      <div id="v7SelectionPanel" class="v7-selection-panel" hidden>
        <div class="v7-selection-head"><strong>Editar tabela</strong><button type="button" class="v7-mini-close" onclick="agendaV7CloseSelection()" aria-label="Fechar ferramentas de tabela">✕</button></div>
        <div id="v7SelectionHint" class="v7-editor-help">Toque em uma célula para escolher a seleção.</div>
        <div class="v7-select-actions" role="group" aria-label="Selecionar parte da tabela">
          <button type="button" data-select-mode="row" aria-pressed="false" onclick="agendaV7SelectNotePart('row')">↔ Selecionar linha inteira</button>
          <button type="button" data-select-mode="column" aria-pressed="false" onclick="agendaV7SelectNotePart('column')">↕ Selecionar coluna inteira</button>
        </div>
        <div id="v7TableOperations" class="v7-table-toolbar" hidden>
          <button type="button" data-table-mode="row" onclick="agendaV7EditTable('row-before')">＋ Linha acima</button>
          <button type="button" data-table-mode="row" onclick="agendaV7EditTable('row-after')">＋ Linha abaixo</button>
          <button type="button" data-table-mode="row" class="danger" onclick="agendaV7EditTable('delete-row')">− Excluir linha</button>
          <button type="button" data-table-mode="column" onclick="agendaV7EditTable('column-before')">＋ Coluna antes</button>
          <button type="button" data-table-mode="column" onclick="agendaV7EditTable('column-after')">＋ Coluna depois</button>
          <button type="button" data-table-mode="column" class="danger" onclick="agendaV7EditTable('delete-column')">− Excluir coluna</button>
          <button type="button" onclick="agendaV7CopySelection()">⧉ Copiar seleção</button>
          <button type="button" class="danger" onclick="agendaV7EditTable('delete-table')">🗑 Apagar tabela</button>
        </div>
      </div>
      <div id="notesTableFeedback" class="v7-notes-feedback" role="status">As ferramentas aparecem ao tocar numa célula e selecionar uma linha ou coluna.</div>`;
    toolbar.insertAdjacentElement('afterend',extras);
    ed.addEventListener('pointerdown',e=>{const cell=cellFrom(e.target);if(cell)rememberCell(cell);else hidePanel();});
    ed.addEventListener('click',e=>{const cell=cellFrom(e.target);if(cell)rememberCell(cell);});
    ed.addEventListener('focusin',e=>{const cell=cellFrom(e.target);if(cell)rememberCell(cell);});
    ed.addEventListener('beforeinput',e=>{
      const sel=window.getSelection();let cell=sel?.anchorNode?cellFrom(sel.anchorNode):activeCell();
      if(cell){lastCell=cell;pushHistory('input');}
      else if(e.inputType?.includes('insertFromPaste'))pushHistory('input');
    });
    ed.addEventListener('keydown',e=>{
      const key=e.key.toLowerCase();if((e.ctrlKey||e.metaKey)&&key==='z'&&undoStack.length){
        e.preventDefault();if(e.shiftKey)window.agendaV7Redo();else window.agendaV7Undo();
      }else if((e.ctrlKey||e.metaKey)&&key==='y'&&redoStack.length){e.preventDefault();window.agendaV7Redo();}
    });
    // Tocar fora da tabela encerra a seleção, sem apagar as edições feitas.
    document.querySelector('#screen-notes .topbar')?.addEventListener('pointerdown',hidePanel);
    syncHistoryButtons();
  };
})();
