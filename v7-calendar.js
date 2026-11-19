
(function(){
  // Eventos somente de referência (NÃO são gravados como tarefas e NÃO são enviados à nuvem).
  // Base: calendário escolar de 2026 da EREM Cônego Alexandre Cavalcanti enviado pelo usuário.
  const categories={
    feriado:{label:'Feriado / data não letiva',color:'#ef282c'},
    ferias:{label:'Férias',color:'#ffdf17'},
    letivo:{label:'Início, reinício ou término do período letivo',color:'#1783ba'},
    planejamento:{label:'Formação continuada / planejamento',color:'#8d70b3'},
    recesso:{label:'Recesso escolar',color:'#18b35d'},
    recuperacao:{label:'Período de recuperação paralela',color:'#f4b719'},
    oportunidade:{label:'Novas oportunidades de aprendizagem',color:'#a8e0e6'},
    mulheres:{label:'Semana de valorização de mulheres que fizeram história',color:'#e2add0'},
    familia:{label:'Dia da Família na Escola',color:'#e7af85'},
    reuniao:{label:'Reuniões com as famílias',color:'#acd08b'},
    estudante:{label:'Dia do Estudante',color:'#6c287d'},
    seguranca:{label:'Dia Nacional de Segurança e de Saúde nas Escolas',color:'#6c5558'},
    acaoGracas:{label:'Dia Nacional de Ação de Graças',color:'#69c5da'},
    encerramento:{label:'Término das atividades escolares / autoavaliação',color:'#357a43'},
    unidade:{label:'Início de unidade didática',color:'#7285ab'}
  };
  const dates=new Map();
  function add(date,type,title){
    const obj={type,title,color:categories[type].color,category:categories[type].label};
    const arr=dates.get(date)||[];
    if(!arr.some(e=>e.type===type&&e.title===title))arr.push(obj);
    dates.set(date,arr);
  }
  function weekdays(start,end,type,title){
    let current=new Date(start+'T12:00:00');
    const stop=new Date(end+'T12:00:00');
    for(;current<=stop;current.setDate(current.getDate()+1)){
      if(current.getDay()===0||current.getDay()===6)continue;
      const yyyy=current.getFullYear(),mm=String(current.getMonth()+1).padStart(2,'0'),dd=String(current.getDate()).padStart(2,'0');
      add(`${yyyy}-${mm}-${dd}`,type,title);
    }
  }
  function range(start,end,type,title){
    let current=new Date(start+'T12:00:00'); const stop=new Date(end+'T12:00:00');
    for(;current<=stop;current.setDate(current.getDate()+1)){
      const yyyy=current.getFullYear(),mm=String(current.getMonth()+1).padStart(2,'0'),dd=String(current.getDate()).padStart(2,'0');
      add(`${yyyy}-${mm}-${dd}`,type,title);
    }
  }
  // JANEIRO: férias em dias de semana conforme as marcações amarelas.
  weekdays('2026-01-02','2026-01-30','ferias','Férias escolares');
  // FEVEREIRO
  add('2026-02-02','planejamento','Formação continuada / planejamento');
  add('2026-02-03','letivo','Início do ano letivo e do 1º semestre');
  add('2026-02-03','unidade','Início da 1ª unidade didática');
  range('2026-02-16','2026-02-18','feriado','Carnaval (período indicado no calendário escolar)');
  add('2026-02-25','familia','Dia da Família na Escola');
  // MARÇO
  add('2026-03-06','feriado','Data Magna de Pernambuco');
  range('2026-03-09','2026-03-13','mulheres','Semana de Valorização de Mulheres que Fizeram História');
  // ABRIL
  range('2026-04-01','2026-04-03','feriado','Paixão de Cristo — período indicado no calendário escolar');
  add('2026-04-21','feriado','Tiradentes');
  // MAIO
  add('2026-05-01','feriado','Dia do Trabalhador');
  add('2026-05-11','reuniao','Reunião com as famílias');
  weekdays('2026-05-13','2026-05-15','recuperacao','Recuperação paralela');
  weekdays('2026-05-18','2026-05-19','recuperacao','Recuperação paralela');
  add('2026-05-20','planejamento','Formação continuada / planejamento');
  add('2026-05-21','unidade','Início da 2ª unidade didática');
  // JUNHO
  add('2026-06-04','feriado','Corpus Christi');
  add('2026-06-24','feriado','São João');
  // JULHO
  add('2026-07-09','letivo','Término do 1º semestre letivo');
  add('2026-07-10','recesso','Recesso escolar');
  weekdays('2026-07-13','2026-07-24','recesso','Recesso escolar');
  add('2026-07-27','letivo','Reinício das aulas — 2º semestre');
  // AGOSTO
  add('2026-08-06','familia','Dia da Família na Escola');
  add('2026-08-11','estudante','Dia do Estudante');
  add('2026-08-31','recuperacao','Recuperação paralela');
  // SETEMBRO
  weekdays('2026-09-01','2026-09-04','recuperacao','Recuperação paralela');
  add('2026-09-07','feriado','Independência do Brasil');
  add('2026-09-14','unidade','Início da 3ª unidade didática');
  add('2026-09-15','planejamento','Formação continuada / planejamento');
  add('2026-09-24','reuniao','Reunião com as famílias');
  // OUTUBRO
  add('2026-10-10','seguranca','Dia Nacional de Segurança e de Saúde nas Escolas');
  add('2026-10-12','feriado','Nossa Senhora Aparecida — Padroeira do Brasil');
  add('2026-10-15','feriado','Dia do Professor (marcado como data não letiva no calendário)');
  add('2026-10-28','feriado','Dia do Funcionário Público (marcado no calendário)');
  // NOVEMBRO
  add('2026-11-02','feriado','Finados');
  add('2026-11-15','feriado','Proclamação da República');
  add('2026-11-20','feriado','Dia Nacional de Zumbi e da Consciência Negra');
  add('2026-11-26','acaoGracas','Dia Nacional de Ação de Graças');
  // DEZEMBRO
  add('2026-12-01','reuniao','Reunião com as famílias');
  weekdays('2026-12-17','2026-12-18','recuperacao','Recuperação paralela');
  weekdays('2026-12-21','2026-12-22','recuperacao','Recuperação paralela');
  add('2026-12-23','letivo','Término do ano e do 2º semestre letivo');
  add('2026-12-25','feriado','Natal');
  weekdays('2026-12-28','2026-12-29','oportunidade','Novas oportunidades de aprendizagem');
  weekdays('2026-12-30','2026-12-31','encerramento','Término das atividades escolares / autoavaliação');

  const original=window.renderCalendar;
  if(typeof original!=='function')return;
  window.renderCalendar=function(){
    original();
    const root=document.getElementById('screen-calendar');
    if(!root)return;
    const y=calendarState.year, m=calendarState.month;
    const dayButtons=root.querySelectorAll('.cal-grid .cal-day');
    dayButtons.forEach((btn,i)=>{
      const iso=`${y}-${String(m+1).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`;
      const items=dates.get(iso)||[];
      if(!items.length)return;
      btn.classList.add('official-day');
      btn.style.setProperty('--official-color',items[0].color);
      btn.title=items.map(ev=>ev.title).join(' | ');
      btn.setAttribute('aria-label',btn.getAttribute('aria-label')+'; '+items.map(ev=>ev.title).join('; '));
      const dots=document.createElement('span');dots.className='school-markers';dots.setAttribute('aria-hidden','true');
      items.slice(0,4).forEach(item=>{const dot=document.createElement('i');dot.style.backgroundColor=item.color;dots.appendChild(dot);});
      btn.appendChild(dots);
    });
    const first=root.querySelector('.card');
    if(first){
      const legend=document.createElement('details');legend.className='school-legend';
      const types=['feriado','ferias','letivo','planejamento','recesso','recuperacao','oportunidade','mulheres','familia','reuniao','estudante','seguranca','acaoGracas','encerramento','unidade'];
      legend.innerHTML='<summary>Legenda das datas escolares · 2026</summary><div class="school-legend-items">'+types.map(type=>
        '<div class="school-legend-item"><span class="school-legend-dot" style="background:'+categories[type].color+'"></span><span>'+categories[type].label+'</span></div>'
      ).join('')+'</div>';
      first.appendChild(legend);
    }
    const dateTitle=root.querySelectorAll('.card')[1]?.querySelector('.title');
    if(dateTitle){
      const selected=calendarState.selected;
      const items=dates.get(selected)||[];
      let html='';
      if(items.length){
        html='<div class="school-events-header">📌 Datas do calendário escolar de 2026</div>'+items.map(e=>
          '<div class="school-event-card" style="--event-color:'+e.color+'"><div class="school-event-label">'+e.title+'</div><div class="school-event-category">'+e.category+'</div></div>'
        ).join('');
      }else if(y===2026){html='<div class="school-preview-note">Nenhuma data especial indicada para este dia no calendário escolar fornecido.</div>';}
      else {html='<div class="school-preview-note">As datas escolares pré-cadastradas abrangem somente 2026.</div>';}
      dateTitle.insertAdjacentHTML('afterend',html);
    }
  };
  // Disponibiliza evento para depuração da prévia sem alterar armazenamento real.
  window.agendaV7SchoolEvents2026=dates;
})();
