export function dateOnly(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '') || new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) !== value) throw new Error('Data inválida: ' + value);
  return value;
}

export function addDays(day, n) {
  return new Date(Date.parse(dateOnly(day) + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
}

export function localNow(now = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map(x => [x.type, x.value]));
  return { data: p.year + '-' + p.month + '-' + p.day, slot: p.hour + ':' + p.minute };
}

export function mediaUrl(media, cfg) {
  const relative = media.caminho_post || media.caminho_projeto;
  const value = media.url_publica || (relative && cfg.midia_base_url ? cfg.midia_base_url.replace(/\/$/, '') + '/' + relative.replace(/\\/g, '/').split('/').map(encodeURIComponent).join('/') : '');
  const match = /^https:\/\/([a-z0-9.-]+)(\/[^?#\s\\]*)$/i.exec(value);
  if (!match) throw new Error('URL deve ser HTTPS estável, sem credencial, query ou fragmento');
  const hostname = match[1].toLowerCase(), pathname = match[2];
  if (!cfg.media_hosts.includes(hostname)) throw new Error('Host de mídia não autorizado: ' + hostname);
  if (/(^|\/)\.\.(\/|$)/.test(decodeURIComponent(pathname))) throw new Error('Caminho de mídia inválido');
  return 'https://' + hostname + pathname;
}

export function validatePost(post, cfg) {
  if (!post || !/^[a-zA-Z0-9_-]{3,100}$/.test(post.id || '')) throw new Error('ID da peça inválido');
  if (typeof post.versao !== 'string' || !post.versao.trim() || post.versao.length > 100) throw new Error('Versão da peça obrigatória');
  if (post.tipo !== 'FEED') throw new Error('Somente FEED; Stories não são permitidos');
  if (!['IMAGE', 'REELS', 'CAROUSEL'].includes(post.ig_media_type)) throw new Error('Tipo de mídia não suportado');
  if (!Array.isArray(post.midias) || !post.midias.length) throw new Error('Peça sem mídia');
  if (post.ig_media_type === 'CAROUSEL' ? post.midias.length < 2 || post.midias.length > 10 : post.midias.length !== 1) throw new Error('Quantidade de mídias inválida; carrossel aceita 2 a 10');
  if (typeof post.legenda !== 'string' || !post.legenda.trim() || post.legenda.length > 2200) throw new Error('Legenda obrigatória, até 2200 caracteres');
  const sorted = post.midias.slice().sort((a, b) => a.ordem - b.ordem);
  if (sorted.some((m, i) => m.ordem !== i + 1)) throw new Error('Ordem das mídias deve ser única e contínua a partir de 1');
  const urls = sorted.map(m => mediaUrl(m, cfg));
  sorted.forEach((m, i) => {
    if (!/^[a-f0-9]{64}$/.test(m.sha256 || '')) throw new Error('SHA256 obrigatório para cada mídia');
    const ext = urls[i].toLowerCase();
    if (!/\.(jpe?g|mp4)$/.test(ext)) throw new Error('Formato deve ser JPEG ou MP4');
    if (post.ig_media_type === 'IMAGE' && !/\.jpe?g$/.test(ext)) throw new Error('IMAGE exige JPEG');
    if (post.ig_media_type === 'REELS' && !/\.mp4$/.test(ext)) throw new Error('REELS exige MP4');
  });
  const approval = post.aprovacao;
  if (post.status === 'pronto_para_postar' && (!approval || approval.por !== 'Gabriel' || !approval.em || !Number.isFinite(Date.parse(approval.em)) || approval.versao !== post.versao)) throw new Error('Aprovação do Gabriel precisa identificar data e versão exata');
  return { ...post, midias: sorted, urls, fingerprint: sorted.map(m => m.sha256).join(':') };
}

export function planBatches(calendar, existing, cfg, now = new Date()) {
  if (calendar.account?.toLowerCase() !== cfg.instagram || calendar.timezone !== cfg.timezone) throw new Error('Calendário pertence a outra conta ou fuso');
  if (!Array.isArray(calendar.lotes)) throw new Error('Calendário deve conter lotes');
  if (!Array.isArray(cfg.slots) || cfg.slots.length !== 3 || new Set(cfg.slots).size !== 3 || cfg.slots.some(s => !/^([01]\d|2[0-3]):[0-5]\d$/.test(s))) throw new Error('Configure exatamente três horários distintos');
  const current = localNow(now);
  const ids = new Set(existing.map(r => r.peca_id));
  const prints = new Set(existing.map(r => r.fingerprint).filter(Boolean));
  const taken = new Set(existing.map(r => r.data + 'T' + r.slot));
  const prepared = calendar.lotes.map(batch => {
    if (!/^[a-zA-Z0-9_-]{3,100}$/.test(batch.id || '') || !Array.isArray(batch.posts)) throw new Error('Lote inválido');
    return { ...batch, posts: batch.posts.map(p => validatePost(p, cfg)) };
  });
  const result = [];
  for (const batch of prepared) {
    const fresh = [];
    for (const p of batch.posts) {
      if (p.status !== 'pronto_para_postar' || ids.has(p.id) || prints.has(p.fingerprint)) continue;
      ids.add(p.id); prints.add(p.fingerprint); fresh.push(p);
    }
    let start = batch.inicio ? dateOnly(batch.inicio) : addDays(current.data, 1);
    if (start < current.data) start = current.data;
    let cursor = 0;
    for (let window = 0; cursor < fresh.length && window < 520; window++) {
      const available = [];
      for (let day = 0; day < cfg.dias_por_lote; day++) for (const slot of cfg.slots.slice().sort()) {
        const date = addDays(start, day + window * cfg.dias_por_lote);
        if (date + 'T' + slot <= current.data + 'T' + current.slot || taken.has(date + 'T' + slot)) continue;
        available.push({ data: date, slot });
      }
      const count = Math.min(available.length, fresh.length - cursor);
      for (let i = 0; i < count; i++) {
        const index = Math.floor((i + 0.5) * available.length / count);
        const scheduled = available[index], p = fresh[cursor++];
        taken.add(scheduled.data + 'T' + scheduled.slot);
        const payload = { ...p, ...scheduled, lote_id: batch.id };
        result.push({ peca_id: p.id, lote_id: batch.id, ...scheduled, fingerprint: p.fingerprint, estado: 'agendado', payload: JSON.stringify(payload) });
      }
    }
    if (cursor < fresh.length) throw new Error('Lote excede horizonte máximo de planejamento');
  }
  return result;
}

export function selectPost(rows, cfg, now = new Date()) {
  const current = localNow(now);
  const data = cfg.data_forcada || current.data, slot = cfg.slot_forcado || current.slot;
  dateOnly(data);
  if (!cfg.slots.includes(slot)) return { acao: 'nada', data, slot, motivo: 'Fora dos horários de postagem' };
  const matches = rows.filter(r => r.data === data && r.slot === slot && r.estado === 'agendado');
  if (!matches.length) return { acao: 'nada', data, slot, motivo: 'Sem peça programada' };
  if (matches.length !== 1) return { acao: 'pular', data, slot, motivo: 'Conflito: mais de uma peça neste horário' };
  try {
    const p = validatePost(JSON.parse(matches[0].payload), cfg);
    if (p.id !== matches[0].peca_id || p.fingerprint !== matches[0].fingerprint || p.data !== data || p.slot !== slot) throw new Error('Fila e conteúdo divergentes');
    if (p.status !== 'pronto_para_postar') throw new Error('Peça não aprovada');
    return { ...p, peca_id: p.id, data, slot, tipo: p.ig_media_type, acao: cfg.modo_teste ? 'simular' : 'publicar', ...prepareMedia(p) };
  } catch (e) { return { acao: 'pular', data, slot, peca_id: matches[0].peca_id, motivo: e.message }; }
}

export function prepareMedia(p) {
  if (p.ig_media_type === 'IMAGE') return { container_params: { image_url: p.urls[0], caption: p.legenda }, carrossel: [] };
  if (p.ig_media_type === 'REELS') return { container_params: { media_type: 'REELS', video_url: p.urls[0], caption: p.legenda, share_to_feed: true }, carrossel: [] };
  return { container_params: null, carrossel: p.urls.map(url => /\.mp4$/i.test(url) ? { media_type: 'VIDEO', video_url: url, is_carousel_item: true } : { image_url: url, is_carousel_item: true }) };
}

export function ownsClaim(rows, claimId, executionId) {
  const claims = rows.filter(r => r.resultado === 'reservado').sort((a, b) => Number(a.id) - Number(b.id));
  return !!claims.length && String(claims[0].id) === String(claimId) && claims[0].execution_id === executionId;
}

export function validateInstagramIdentity(profile, cfg) {
  // Instagram Login's user_id is the professional account ID; id may be app-scoped.
  const userId = String(profile?.user_id || '');
  if (String(profile?.username || '').toLowerCase() !== cfg.instagram || !/^\d{5,30}$/.test(userId) || userId !== cfg.ig_user_id) {
    throw new Error('Identidade Instagram divergente: publicação bloqueada');
  }
  return userId;
}

export function containerState(status, attempt, max = 16) {
  if (status === 'FINISHED') return 'publicar';
  if (status === 'IN_PROGRESS' && attempt < max) return 'aguardar';
  return 'erro';
}

export function validateMediaResponses(responses, expected) {
  if (responses.length !== expected) throw new Error('Conferência de mídia incompleta');
  for (const response of responses) {
    if (response.statusCode !== 200) throw new Error('Mídia indisponível: HTTP ' + response.statusCode);
    const type = String(response.headers?.['content-type'] || '').toLowerCase();
    if (!/^(image\/jpeg|video\/mp4|application\/octet-stream)(;|$)/.test(type)) throw new Error('Servidor não retornou mídia JPEG ou MP4');
    if (response.headers?.['content-length'] === '0') throw new Error('Mídia vazia');
  }
  return true;
}

export function redact(value) {
  return String(value || '').replace(/(access_token|authorization|api[_-]?key|secret|token)\s*[=:]\s*[^\s&,"}]+/gi, '$1=[REDACTED]').replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]').replace(/(?:EA|IG)[A-Za-z0-9_-]{30,}/g, '[REDACTED]').slice(0, 1000);
}
