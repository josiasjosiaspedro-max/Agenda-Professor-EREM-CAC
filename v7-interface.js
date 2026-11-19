/* V7 Interface B — status enxuto da nuvem, sem alterar as rotinas de autenticação. */
(function(){
  'use strict';
  const textEl=document.getElementById('v7SyncText'), strip=document.getElementById('v7SyncStrip');
  if(!strip || !textEl)return;
  function update(label,good){
    const raw=String(label||'').replace(/^☁\s*/,'').trim();
    let text='Nuvem · toque para verificar';
    if(good)text='Dados sincronizados';
    else if(/Enviando|Sincronizando/i.test(raw))text='Sincronizando dados...';
    else if(/Atenção|Erro/i.test(raw))text='Sincronização precisa de atenção';
    else if(/Configurar/i.test(raw))text='Conecte sua conta à nuvem';
    else if(/Nuvem OK/i.test(raw))text='Dados na nuvem';
    textEl.textContent=text;strip.classList.toggle('good',Boolean(good));
  }
  const original=window.agendaV6UpdateCloudButton;
  if(typeof original==='function'){
    window.agendaV6UpdateCloudButton=function(label,good){
      const hadStatus=arguments.length>0;original.apply(this,arguments);
      if(hadStatus)update(label,good);
    };
  }
  const head=document.getElementById('cloudHeaderButton');
  update(head?.querySelector('.cloud-label')?.textContent,head?.classList.contains('good'));
})();
