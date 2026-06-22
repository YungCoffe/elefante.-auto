// ==UserScript==
// @name         Elefante Letrado - Integrado Via Browser v28.3
// @namespace    http://tampermonkey.net/
// @version      28.3
// @description  Automação integrada nativamente com o Termux via Fetch API para o Via Browser
// @author       yungcoffe
// @match        https://reader.elefanteletrado.com.br/*
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    console.log('[ElefanteScript] ===== v28.3 SISTEMA FIX ID NO VIA =====');

    let tokenValido = null;
    let idLivroReal = null;
    let painelCriado = false;
    let statusBackend = { rodando: false, tempo_acumulado: 0, minimo_exigido: 0, ciclo_atual: 0 };
    
    // URL FIXA DEFINITIVA DO SEU TÚNEL DO SERVEO
    const BACKEND_URL = "https://yungcoffe-elefante.serveousercontent.com";

    function validarEdefinirToken(rawToken) {
        if (!rawToken || tokenValido) return;
        let tokenLimpo = rawToken.trim();
        if (!tokenLimpo.startsWith('Bearer ')) {
            tokenLimpo = 'Bearer ' + tokenLimpo;
        }
        tokenValido = tokenLimpo;
        console.log('[ElefanteScript] Token capturado!');
        atualizarUI();
    }

    function definirIdLivro(id) {
        if (!id || idLivroReal) return;
        let limpo = id.toString().trim();
        if (!isNaN(parseInt(limpo))) {
            idLivroReal = limpo;
            console.log('[ElefanteScript] ID do Livro capturado com sucesso:', idLivroReal);
            atualizarUI();
        }
    }

    // ===================== INTERCEPTAÇÃO DE REDE =====================
    const oXHR = window.XMLHttpRequest.prototype.open;
    window.XMLHttpRequest.prototype.open = function(method, url) {
        this.addEventListener('readystatechange', function() {
            if (this.readyState === 4) {
                try {
                    if (url.includes('progress_em') || url.includes('books')) {
                        let authHeader = this.getAllResponseHeaders().match(/authorization:\s*(.*)/i);
                        if (authHeader && authHeader[1]) validarEdefinirToken(authHeader[1]);
                    }
                    if (url.includes('/books/') || url.includes('/read/')) {
                        let dados = JSON.parse(this.responseText);
                        if (dados && dados.id) definirIdLivro(dados.id);
                        if (dados && dados.book_id) definirIdLivro(dados.book_id);
                    }
                } catch(e) {}
            }
        });
        return oXHR.apply(this, arguments);
    };

    const oFetch = window.fetch;
    window.fetch = function(...args) {
        let url = args[0];
        let options = args[1];
        if (options && options.headers) {
            let headers = options.headers;
            let auth = headers['Authorization'] || headers['authorization'] || (typeof headers.get === 'function' && headers.get('Authorization'));
            if (auth) validarEdefinirToken(auth);
        }
        return oFetch.apply(this, args).then(response => {
            try {
                if (typeof url === 'string' && (url.includes('/books/') || url.includes('/read/'))) {
                    response.clone().json().then(dados => {
                        if (dados && dados.id) definirIdLivro(dados.id);
                        if (dados && dados.book_id) definirIdLivro(dados.book_id);
                    }).catch(e => {});
                }
            } catch(e) {}
            return response;
        });
    };

    // ===================== EXTRAÇÃO COMPLETA DO ID =====================
    function extrairIdLivro() {
        if (idLivroReal) return;
        try {
            const urlAtual = window.location.href;
            const params = new URLSearchParams(window.location.search || window.top.location.search);
            
            let pathMatches = urlAtual.match(/\/(?:books|book|reader|read)\/(\d+)/);
            if (pathMatches && pathMatches[1]) {
                definirIdLivro(pathMatches[1]);
                return;
            }

            let idDireto = params.get('id') || params.get('book_id') || params.get('bookId');
            if (idDireto && !isNaN(parseInt(idDireto))) {
                definirIdLivro(idDireto);
                return;
            }

            let idEncoded = params.get('id');
            if (idEncoded) {
                try {
                    let decoded = atob(idEncoded);
                    if (decoded && !isNaN(parseInt(decoded))) { definirIdLivro(decoded); return; }
                } catch(e) {}
            }
            let pi = params.get('pi');
            if (pi && pi !== 'NA==' && pi !== '') {
                try {
                    let d = atob(pi);
                    if (d && !isNaN(parseInt(d))) { definirIdLivro(d); return; }
                } catch(e) {
                    if (!isNaN(parseInt(pi))) { definirIdLivro(pi); }
                }
            }
        } catch(e) {}
    }

    function checarStorage() {
        try {
            for (let i = 0; i < localStorage.length; i++) {
                let chave = localStorage.key(i);
                if (chave.includes('token') || chave.includes('user') || chave.includes('auth')) {
                    let valor = localStorage.getItem(chave);
                    if (valor && valor.includes('access_token')) {
                        let dados = JSON.parse(valor);
                        if (dados.access_token) validarEdefinirToken(dados.access_token);
                    }
                }
            }
        } catch(e) {}
    }

    function extrairTotalPaginas() {
        const elementos = document.querySelectorAll('span, div, p, footer, [class*="page"], [class*="pagina"]');
        for (let el of elementos) {
            let texto = el.innerText ? el.innerText.trim() : '';
            let match = texto.match(/(\d+)\s*[\/|de]\s*(\d+)/);
            if (match) {
                let total = parseInt(match[2]);
                if (!isNaN(total) && total > 0) return total;
            }
        }
        return 144;
    }

    function segundosParaHumano(seg) {
        seg = Math.floor(seg);
        let h = Math.floor(seg / 3600);
        let m = Math.floor((seg % 3600) / 60);
        let s = seg % 60;
        let partes = [];
        if (h > 0) partes.push(h + 'h');
        if (m > 0) partes.push(m + 'min');
        if (s > 0 || partes.length === 0) partes.push(s + 's');
        return partes.join(' ');
    }

    // ADAPTAÇÃO NATIVA PARA O VIA BROWSER (USANDO FETCH API)
    function enviarComandoBackend(endpoint, payload = {}, callback = null) {
        fetch(`${BACKEND_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: Object.keys(payload).length ? JSON.stringify(payload) : null
        })
        .then(res => res.json())
        .then(dados => { if (callback) callback(dados); })
        .catch(err => console.error('[ViaScript] Erro backend:', err));
    }

    function sincronizarStatus() {
        fetch(`${BACKEND_URL}/status`)
        .then(res => res.json())
        .then(dados => {
            statusBackend = dados;
            atualizarInfoVisual();
        })
        .catch(e => {});
    }

    function alternarAutomaatizacao() {
        const btn = document.getElementById('btn-concluir');
        if (!tokenValido || !idLivroReal) return;

        if (statusBackend.rodando) {
            enviarComandoBackend('/parar', {}, () => {
                if (btn) {
                    btn.innerHTML = '▶️ INICIAR NO TERMUX';
                    btn.style.background = '#2980b9';
                }
            });
        } else {
            if (btn) {
                btn.innerHTML = '⏳ INICIALIZANDO BACKEND...';
                btn.style.background = '#d35400';
            }

            const dados = {
                token: tokenValido,
                livro_id: idLivroReal,
                referer: window.location.href,
                paginas: extrairTotalPaginas()
            };

            enviarComandoBackend('/iniciar', dados, (res) => {
                if (res && res.erro) {
                    alert('Erro: ' + res.erro);
                    atualizarUI();
                }
            });
        }
    }

    function criarInterface() {
        if (painelCriado || !document.body) return;

        const painel = document.createElement('div');
        painel.id = 'painel-elefante';
        painel.style.cssText = `
            position: fixed !important; bottom: 30px !important; right: 20px !important;
            z-index: 2147483647 !important; background: #1a1a2e !important; color: #eee !important;
            border-radius: 16px !important; padding: 18px !important; box-shadow: 0px 10px 30px rgba(0,0,0,0.6) !important;
            font-family: 'Segoe UI', system-ui, sans-serif !important; font-size: 13px !important;
            min-width: 240px !important; border: 1px solid #333 !important;
        `;

        painel.innerHTML = `
            <div style="font-weight:bold; margin-bottom:12px; font-size:16px; color:#00d4ff; text-align:center;">
                ⚡ Elefante Via v28.3
            </div>
            <div id="info-livro" style="margin-bottom:14px; font-size:12px; color:#888; background:#0f0f23; padding:10px; border-radius:8px; text-align:center;">
                ⏱️ Acumulado: --<br>🎯 Mínimo Exigido: --
            </div>
            <button id="btn-concluir" style="
                width:100%; padding:16px; background:#7f8c8d; color:white;
                border-radius:12px; font-weight:bold; border:none; cursor:pointer;
                font-size:15px; transition:all 0.2s;
            ">🔍 Procurando credenciais...</button>
            <div id="status-msg" style="margin-top:8px; font-size:11px; color:#666; text-align:center;">
                Inicializando extrator...
            </div>
        `;

        document.body.appendChild(painel);
        painelCriado = true;
        painel.querySelector('#btn-concluir').onclick = alternarAutomaatizacao;

        setInterval(sincronizarStatus, 2000);
        atualizarUI();
    }

    function atualizarInfoVisual() {
        const info = document.getElementById('info-livro');
        const btn = document.getElementById('btn-concluir');
        if (!info) return;

        let txtMinimo = statusBackend.minimo_exigido > 0 ? segundosParaHumano(statusBackend.minimo_exigido) : "Buscando...";
        info.innerHTML = `
            ⏱️ No Termux: <b style="color:#fff">${segundosParaHumano(statusBackend.tempo_acumulado)}</b><br>
            🎯 Exigido: <b style="color:#00d4ff">${txtMinimo}</b><br>
            <span style="color:#555; font-size:11px">(Próximo em: ${statusBackend.proxima_em || 'calculando...'})</span>
        `;

        if (btn && btn.dataset.pronto === 'true') {
            if (statusBackend.rodando) {
                btn.innerHTML = '🛑 PARAR AUTOMAÇÃO';
                btn.style.background = '#c0392b';
            } else if (statusBackend.minimo_exigido > 0 && statusBackend.tempo_acumulado >= statusBackend.minimo_exigido) {
                btn.innerHTML = '✅ PROGRESSED! (CONCLUÍDO)';
                btn.style.background = '#27ae60';
                btn.disabled = true;
            } else {
                btn.innerHTML = '▶️ INICIAR NO TERMUX';
                btn.style.background = '#2980b9';
            }
        }
    }

    function atualizarUI() {
        extrairIdLivro();
        checarStorage();
        const btn = document.getElementById('btn-concluir');
        const status = document.getElementById('status-msg');
        if (!btn) return;

        let info = [];
        if (tokenValido) info.push('✅ Token');
        if (idLivroReal) info.push(`✅ ID:${idLivroReal}`);

        if (tokenValido && idLivroReal && !btn.dataset.pronto) {
            btn.dataset.pronto = 'true';
            atualizarUI();
        }
        if (status) status.innerHTML = info.join(' <span style="color:#444">|</span> ') || '⏳ Procurando...';
    }

    function aguardarBody() {
        if (document.body) { criarInterface(); }
        else {
            const obs = new MutationObserver((mutations, observer) => {
                if (document.body) { observer.disconnect(); criarInterface(); }
            });
            obs.observe(document.documentElement, { childList: true, subtree: true });
        }
    }

    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', aguardarBody); }
    else { aguardarBody(); }

    setInterval(() => {
        if (!painelCriado || !document.getElementById('painel-elefante')) {
            painelCriado = false;
            criarInterface();
        }
        atualizarUI();
    }, 1500);

})();
