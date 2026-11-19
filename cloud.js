/* Agenda Docente v5 — login e sincronização opt-in, com RLS no Supabase.
 * OBS: Não armazenar segredos nesta aplicação web.
 */
(() => {
  'use strict';

  const snapshot = () => window.agendaReadCloudPayload();
  const config = window.AGENDA_SUPABASE || {};
  function isSecretKey(raw) {
    const key = String(raw || '').trim();
    if (/^sb_secret_/i.test(key) || /service_role/i.test(key)) return true;
    // As antigas chaves anon e service_role podem ser JWTs; a role deve ser anon.
    if (key.startsWith('eyJ')) {
      try {
        const body = JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
        return body.role === 'service_role';
      } catch (_) { return false; }
    }
    return false;
  }
  const unsafeKey = isSecretKey(config.publishableKey);
  const isConfigured = typeof config.url === 'string' &&
    /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(config.url.trim()) &&
    typeof config.publishableKey === 'string' &&
    !config.publishableKey.includes('COLE_AQUI') && config.publishableKey.length > 20 && !unsafeKey;

  const state = {
    client: null, user: null, revision: null, linked: false, cloudExists: false,
    syncing: false, changed: false, timer: null, loading: false, conflict: false,
    message: '', error: '', lastSync: '', syncedBy: null
  };

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  function syncMeta() {
    try { return JSON.parse(localStorage.getItem('agenda-cloud-meta-v5') || '{}'); }
    catch (_) { return {}; }
  }
  function saveSyncMeta() {
    localStorage.setItem('agenda-cloud-meta-v5', JSON.stringify({
      uid: state.user?.id || '', revision: state.revision, at: new Date().toISOString()
    }));
  }
  function isObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
  function validatePayload(payload) {
    if (!isObject(payload) || !isObject(payload.tasks) || !isObject(payload.notes)) {
      throw new Error('O registro da nuvem não tem o formato esperado. Não substituí os dados locais.');
    }
    return payload;
  }
  function sameContent(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

  function display() {
    const label=!state.user ? '☁ Entrar' : !state.linked ? '☁ Configurar' : state.error ? '☁ Atenção' : state.syncing || state.changed ? '☁ Enviando' : '☁ Nuvem OK';
    window.agendaV6UpdateCloudButton?.(label,Boolean(state.user && state.linked && !state.error && !state.changed));
    const el = document.getElementById('agendaCloudPanel');
    if (!el) return;
    const details = state.error
      ? `<p style="color:#b42318;font-size:12px;line-height:1.5">${esc(state.error)}</p>` : '';
    let body;
    if (!isConfigured) {
      body = unsafeKey
        ? `<p style="color:#b42318">Chave secreta detectada: não a publique no GitHub. Remova-a imediatamente e faça rotação no painel do Supabase.</p>`
        : `<p class="muted">A conexão não foi configurada. Preencha a URL e a chave publicável em <strong>supabase-config.js</strong> no GitHub.</p>`;
    } else if (!state.client) {
      body = `<p class="muted">Não foi possível carregar a biblioteca do Supabase. Verifique a internet.</p>`;
    } else if (state.loading) {
      body = `<p class="muted">Conferindo sua conta e os dados da nuvem...</p>`;
    } else if (!state.user) {
      body = `<p class="muted">Entre com sua conta Supabase para sincronizar somente os seus dados.</p>
        <label for="agendaCloudEmail">E-mail</label>
        <input type="email" id="agendaCloudEmail" autocomplete="username" placeholder="seuemail@exemplo.com" style="width:100%;padding:12px;border:1px solid #d9dee7;border-radius:12px" />
        <label for="agendaCloudPassword">Senha</label>
        <input type="password" id="agendaCloudPassword" autocomplete="current-password" placeholder="Sua senha" style="width:100%;padding:12px;border:1px solid #d9dee7;border-radius:12px" />
        <div class="actions">
          <button class="primary-btn" onclick="agendaCloudSignIn()">Entrar</button>
          <button class="outline-btn" onclick="agendaCloudSignUp()">Criar conta</button>
        </div>`;
    } else if (!state.linked) {
      const remote = state.cloudExists ?
        'Já existe um registro na nuvem. Escolha qual cópia manter.' :
        'Ainda não há uma cópia na nuvem. Envie seus dados deste aparelho para começar.';
      body = `<p class="muted">Conta: <strong>${esc(state.user.email || '')}</strong></p>
        <p class="muted">${esc(remote)} Nada será substituído automaticamente.</p>
        <div class="actions">
          <button class="primary-btn" onclick="agendaCloudUploadLocal()">Enviar dados deste aparelho</button>
          ${state.cloudExists ? '<button class="outline-btn" onclick="agendaCloudDownload()">Baixar da nuvem</button>' : ''}
          <button class="outline-btn" onclick="agendaCloudRefresh()">Conferir a nuvem</button>
          <button class="outline-btn" onclick="agendaCloudSignOut()">Sair</button>
        </div>`;
    } else {
      body = `<p class="muted">Conta: <strong>${esc(state.user.email || '')}</strong></p>
        <p class="muted">${state.syncing ? '⏳ Sincronizando...' : state.changed ? '⏳ Há alterações locais aguardando envio.' : '✓ Dados vinculados à nuvem.'}
        ${state.lastSync ? `<span style="display:block;margin-top:6px">Última sincronização: ${esc(state.lastSync)}</span>` : ''}</p>
        <div class="actions">
          <button class="primary-btn" onclick="agendaCloudSyncNow()">Sincronizar agora</button>
          <button class="outline-btn" onclick="agendaCloudDownload()">Atualizar deste banco</button>
          <button class="outline-btn" onclick="agendaCloudSignOut()">Sair</button>
        </div>`;
    }
    const msg = state.message ? `<p class="muted" style="margin-top:9px">${esc(state.message)}</p>` : '';
    el.innerHTML = `<div class="row" style="align-items:center"><span style="font-size:24px">☁️</span>
      <div><div class="title">Dados na nuvem (Supabase)</div>
      <div class="subtitle">Acesso com e-mail e senha • cópia local mantida</div></div></div>
      <div style="margin-top:11px">${body}${msg}${details}</div>`;
  }

  function installCard() {
    // A v6 deixou o painel completo em sua própria tela. No início mostra só o estado discreto.
    display();
  }
  const originalRenderHome = window.renderHome;
  window.renderHome = function (...args) {
    const result = originalRenderHome(...args);
    installCard();
    return result;
  };
  installCard();

  function errorMessage(err) {
    if (!err) return 'Erro desconhecido.';
    if (err.message === 'Failed to fetch' || /network|fetch/i.test(err.message)) {
      return 'Sem conexão com o Supabase. Seus dados locais foram preservados.';
    }
    return err.message || String(err);
  }

  async function fetchRemote() {
    const {data, error} = await state.client
      .from('agenda_state').select('payload,revision')
      .eq('user_id', state.user.id).maybeSingle();
    if (error) throw error;
    if (data) validatePayload(data.payload);
    return data;
  }

  function linkWith(revision) {
    state.linked = true;
    state.cloudExists = true;
    state.revision = revision;
    state.conflict = false;
    state.changed = false;
    state.lastSync = new Date().toLocaleString('pt-BR');
    saveSyncMeta();
    display();
  }

  async function loadAccount(force = false) {
    if (!state.client || state.loading) return;
    state.loading = true;
    state.error = '';
    display();
    try {
      const {data: sessionData, error: sessionError} = await state.client.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData?.session) {
        state.user = null;
        state.linked = false;
        state.cloudExists = false;
        state.revision = null;
        state.message = '';
        return;
      }
      const {data: {user}, error} = await state.client.auth.getUser();
      if (error) throw error;
      state.user = user;
      state.linked = false;
      if (!user) {
        state.cloudExists = false;
        state.revision = null;
        return;
      }
      const remote = await fetchRemote();
      state.cloudExists = Boolean(remote);
      state.revision = remote?.revision ?? null;
      if (!remote) {
        state.message = 'Configure a primeira cópia usando “Enviar dados deste aparelho”.';
        return;
      }
      const meta = syncMeta();
      const local = snapshot();
      if (sameContent(local, remote.payload)) {
        linkWith(remote.revision);
        state.message = 'A cópia local e a nuvem estão iguais.';
      } else if (!force && meta.uid === user.id && meta.revision === remote.revision) {
        // Este aparelho já havia sincronizado nessa revisão e fez edições locais off-line.
        state.linked = true;
        state.changed = true;
        state.revision = remote.revision;
        state.message = 'Alterações locais identificadas; envio pendente.';
        setTimeout(() => syncNow(), 300);
      } else {
        state.message = 'Há diferenças entre o aparelho e a nuvem. Faça um backup e escolha uma cópia.';
      }
    } catch(err) {
      state.error = errorMessage(err);
      state.linked = false;
    } finally {
      state.loading = false;
      display();
    }
  }

  async function signIn() {
    if (!state.client) return;
    const email = document.getElementById('agendaCloudEmail')?.value?.trim() || '';
    const password = document.getElementById('agendaCloudPassword')?.value || '';
    if (!email || !password) return alert('Informe o e-mail e a senha.');
    state.loading = true; state.error = ''; display();
    try {
      const {error} = await state.client.auth.signInWithPassword({email, password});
      if (error) throw error;
      state.message = 'Login realizado.';
    } catch(err) { state.error = errorMessage(err); }
    finally { state.loading = false; display(); }
    if (!state.error) await loadAccount();
  }

  async function signUp() {
    if (!state.client) return;
    const email = document.getElementById('agendaCloudEmail')?.value?.trim() || '';
    const password = document.getElementById('agendaCloudPassword')?.value || '';
    if (!email || password.length < 8) return alert('Informe seu e-mail e uma senha de pelo menos 8 caracteres.');
    state.loading = true; state.error = ''; display();
    try {
      const {data, error} = await state.client.auth.signUp({email, password});
      if (error) throw error;
      state.message = data.session
        ? 'Conta criada. Confira sua cópia local antes de enviar.'
        : 'Cadastro solicitado. Confirme o e-mail recebido, se necessário, e depois entre.';
    } catch(err) { state.error = errorMessage(err); }
    finally { state.loading = false; display(); }
    if (!state.error) await loadAccount();
  }

  async function signOut() {
    if (!state.client) return;
    if (!confirm('Sair da nuvem? Os dados que já estão salvos neste iPhone continuarão visíveis neste aparelho.')) return;
    try {
      const {error} = await state.client.auth.signOut();
      if (error) throw error;
      state.user = null; state.linked = false; state.cloudExists = false;
      state.revision = null; state.changed = false; state.error = '';
      state.message = 'Você saiu. Os dados locais não foram apagados.';
    } catch(err) { state.error = errorMessage(err); }
    display();
  }

  async function uploadLocal() {
    if (!state.client || !state.user || state.syncing) return;
    const warning = state.cloudExists
      ? 'ATENÇÃO: isto substituirá a cópia da nuvem pelos dados deste aparelho. Salve um backup antes de continuar.'
      : 'Enviar o planejamento e as notas deste aparelho ao Supabase? Faça um backup local antes de começar.';
    if (!confirm(warning)) return;
    state.error = ''; state.loading = true; display();
    try {
      const remote = await fetchRemote();
      // A revisão da nuvem pode ter mudado durante a confirmação.
      if ((remote?.revision ?? null) !== state.revision) {
        state.cloudExists = Boolean(remote);
        state.revision = remote?.revision ?? null;
        throw new Error('A nuvem mudou desde a última consulta. Clique em “Conferir a nuvem” e revise antes de continuar.');
      }
      const payload = snapshot();
      if (!remote) {
        const {data, error} = await state.client.from('agenda_state')
          .insert({user_id: state.user.id, revision:1, payload})
          .select('revision').single();
        if (error) throw error;
        linkWith(data.revision);
      } else {
        const {data, error} = await state.client.from('agenda_state')
          .update({payload, revision:remote.revision + 1, updated_at: new Date().toISOString()})
          .eq('user_id', state.user.id).eq('revision', remote.revision)
          .select('revision').maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('O conteúdo da nuvem mudou. Atualize antes de substituir.');
        linkWith(data.revision);
      }
      state.message = 'Cópia local enviada com sucesso.';
    } catch(err) { state.error = errorMessage(err); state.linked = false; }
    finally { state.loading = false; display(); }
  }

  async function download() {
    if (!state.client || !state.user || state.syncing) return;
    if (!confirm('Substituir os dados locais pelas informações da nuvem? Antes, use “Salvar backup” na tela inicial.')) return;
    state.loading = true; state.error = ''; display();
    try {
      const remote = await fetchRemote();
      if (!remote) throw new Error('Ainda não há dados na nuvem para baixar.');
      window.agendaApplyCloudPayload(remote.payload);
      linkWith(remote.revision);
      state.message = 'Dados da nuvem carregados neste aparelho.';
    } catch(err) { state.error = errorMessage(err); }
    finally { state.loading = false; display(); }
  }

  let changeCounter = 0;
  function localChanged() {
    if (!state.linked || !state.user) return;
    changeCounter++;
    state.changed = true;
    clearTimeout(state.timer);
    state.timer = setTimeout(syncNow, 1500);
  }

  async function syncNow() {
    if (!state.client || !state.user || !state.linked) return;
    if (state.syncing) { state.changed = true; return; }
    if (!state.changed) {
      state.message = 'Sem alterações locais pendentes.';
      display(); return;
    }
    const counter = changeCounter;
    const payload = snapshot();
    state.syncing = true; state.error = ''; display();
    try {
      const {data, error} = await state.client.from('agenda_state')
        .update({payload, revision:state.revision + 1, updated_at:new Date().toISOString()})
        .eq('user_id', state.user.id).eq('revision', state.revision)
        .select('revision').maybeSingle();
      if (error) throw error;
      if (!data) {
        state.linked = false;
        state.conflict = true;
        state.message = 'A cópia da nuvem foi alterada em outro lugar. Confira antes de escolher qual manter.';
        throw new Error('Conflito de sincronização. Seus dados locais foram preservados.');
      }
      state.revision = data.revision;
      state.cloudExists = true;
      state.changed = counter !== changeCounter;
      state.lastSync = new Date().toLocaleString('pt-BR');
      state.message = 'Dados salvos na nuvem.';
      saveSyncMeta();
    } catch(err) { state.error = errorMessage(err); state.changed = true; }
    finally {
      state.syncing = false; display();
      if (state.linked && state.changed && !state.error) {
        clearTimeout(state.timer);
        state.timer = setTimeout(syncNow, 500);
      }
    }
  }

  async function refresh() { await loadAccount(true); }

  // Arquivos reais são guardados no bucket privado Supabase Storage.
  async function uploadFiles(files) {
    if (!files.length) return [];
    if (!state.client || !state.user || !state.linked) {
      throw new Error('Entre na nuvem e sincronize seus dados antes de anexar arquivos reais.');
    }
    const result = [];
    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name}: o limite por arquivo é 10 MB.`);
      const clean = file.name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0,100) || 'arquivo';
      const path = `${state.user.id}/${crypto.randomUUID()}-${clean}`;
      const {error} = await state.client.storage.from('agenda-attachments').upload(path, file, {
        cacheControl:'3600', upsert:false, contentType:file.type || 'application/octet-stream'
      });
      if (error) throw error;
      result.push({name:file.name, path});
    }
    return result;
  }

  async function openFile(encodedPath) {
    if (!state.client || !state.user) return alert('Entre no Supabase para abrir o arquivo.');
    const path = decodeURIComponent(encodedPath);
    if (!path.startsWith(`${state.user.id}/`)) return alert('Arquivo de outra conta não autorizado.');
    const popup = window.open('', '_blank');
    try {
      const {data,error} = await state.client.storage.from('agenda-attachments')
        .createSignedUrl(path, 60);
      if (error) throw error;
      if (popup) popup.location.href = data.signedUrl;
      else location.href = data.signedUrl;
    } catch(err) {
      if (popup) popup.close();
      alert('Não foi possível abrir o arquivo: ' + errorMessage(err));
    }
  }

  // Funções públicas chamadas pelos controles da versão HTML.
  Object.assign(window, {
    agendaCloudRender: display,
    agendaCloudSignIn: signIn,
    agendaCloudSignUp: signUp,
    agendaCloudSignOut: signOut,
    agendaCloudRefresh: refresh,
    agendaCloudDownload: download,
    agendaCloudUploadLocal: uploadLocal,
    agendaCloudSyncNow: syncNow,
    agendaCloudUploadFiles: uploadFiles,
    agendaCloudIsConnected: () => Boolean(state.linked && state.user),
    openAgendaFile: openFile
  });

  // As funções existentes continuam salvando localmente; novas alterações também vão à nuvem.
  const oldPersist = window.persist;
  window.persist = function (...args) { const out = oldPersist(...args); localChanged(); return out; };
  const oldPersistNotes = window.persistNotes;
  window.persistNotes = function (...args) { const out = oldPersistNotes(...args); localChanged(); return out; };

  window.addEventListener('online', () => { if (state.linked && state.changed) syncNow(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.linked && state.changed) syncNow();
  });

  if (isConfigured && window.supabase?.createClient) {
    state.client = window.supabase.createClient(config.url.trim(), config.publishableKey.trim(), {
      auth: {autoRefreshToken:true, persistSession:true, detectSessionInUrl:true}
    });
    // A biblioteca reaproveita a sessão salva no próprio navegador.
    loadAccount();
  }
  display();
})();
