# 📚 Matryoshka-Harness Experience Library (Harness² Meta-Learning)

Biblioteca canônica de lições arquiteturais, cicatrizes de segurança e governança agêntica acumuladas pelo projeto Matryoshka-Harness.

---

## 🛡️ Lições de Segurança & Isolamento Agêntico
- [security] OpenCode Console Breach & Distillation Attack: Em outubro de 2026, invasores comprometeram sistemas legados do OpenCode extraindo API keys privadas (Anthropic, OpenAI, Google) de 1.4% dos usuários para conduzir ataques massivos de destilação de modelos em labs externos (gerando faturas de $10.000 a $45.700 overnight). Lição: NUNCA persista API keys em texto claro na workspace; adote chaves efêmeras, mascaramento DLP e limites orçamentários rígidos.
- [security] CVE-2026-22812 & Unauthenticated Localhost RCE: Servidores HTTP de ferramentas agênticas ouvindo em localhost sem autenticação e com CORS frouxo permitem que páginas web maliciosas executem código no host do usuário. Lição: Ferramentas agênticas devem se comunicar exclusivamente via stdio (Model Context Protocol - MCP) ou sockets Unix fechados, dispensando portas TCP desnecessárias.
- [security] Airgap Zero-Egress Inegociável: Ferramentas de auto-harness devem assumir que o agente pode sofrer prompt injection ao ler dependências alienígenas. A cerca de execução deve operar com isolamento de kernel (--network none), bloqueando exfiltração de dados (C2 beaconing).

---

## 🧩 Convergência Universal de Plugins Agênticos
- [interoperability] Convergência de SKILL.md (Claude, Gemini, Codex, OpenCode): A indústria agêntica padronizou a especificação de Agent Skills em pastas isoladas com frontmatter YAML (skills/<nome>/SKILL.md). Um único repositório de skills pode ser consumido nativamente pelo Gemini CLI (gemini extensions install), Claude Code (claude --plugin-dir), OpenAI Codex e OpenCode sem duplicar regras de negócio.
- [interoperability] Dual Manifesto de Extensão: Para distribuição universal zero-install, o projeto mantém gemini-extension.json (para o Gemini CLI) e .claude-plugin/plugin.json (para o Claude Code) na raiz, permitindo instalação de 1 clique direto dos repositórios GitHub.
- [mcp] Model Context Protocol como Barramento de Ferramental: Em vez de bibliotecas pesadas instaladas localmente no host do cliente, o MCP via stdio é o padrão ouro para expor comandos de inspeção e remediação (mcp_matryoshka_scan, mcp_matryoshka_wrap).

---

## 📐 Governança de Código & Anti-Slop Adaptativo
- [governance] Zero SOLID Forçado em Arquétipos Não-Compatíveis: Forçar princípios SOLID puros em bases procedurais (WordPress/Drupal/PHP legado) ou em componentes reativos (React/Vue/Next.js) gera código prolixo, alucinação de classes abstratas desnecessárias e inchaço de tokens. O AGENTS.md deve detectar o arquétipo real do projeto e priorizar DRY e YAGNI, aplicando SOLID apenas onde a arquitetura comportar (Go, Rust, NestJS, Spring).
- [governance] Defesa em Profundidade para Merge Gates (CODEOWNERS + Status Check): Configurar apenas CODEOWNERS pode ser contornado se a política de branch protection falhar ou não exigir aprovação explícita de Code Owners. Implementar uma camada dupla com `.github/CODEOWNERS` e um workflow dedicado (`maintainer-gate.yml`) que verifica o autor e as revisões via GitHub API garante bloqueio determinístico de merges não autorizados na branch `main`.
- [ast] AST de SQL & Detecção Estática de Fragilidades: O uso de parsers de AST de SQL (sqlparser-rs / node-sql-parser) permite auditar queries em código de backend sem necessidade de conexão ativa com o banco, capturando anti-patterns críticos (SELECT * em tabelas grandes, N+1 em loops de ORM, ausência de índices em WHERE/JOIN e risco de injection) antes do commit.
- [finops] Modularização em SKILLS.md por Especialidade: Em vez de um AGENTS.md monolítico de 500 linhas que sobrecarrega a janela de contexto, decomponha as instruções em skills especializadas (.gemini/skills/ ou .cursor/skills/): skill-backend.md, skill-frontend.md, skill-api.md e skill-security.md. Carregar apenas a skill necessária reduz o custo por turno em até 60%.
- [harness] Oráculo de Avaliação vs Remediação Ativa: Não reinvente a roda. Utilize o paladini/harness-score como o oráculo determinístico de maturidade (L0 a L4) e concentre o valor do Matryoshka na remediação automatizada (wrap), gerando tráfego e prestígio mútuo para o software livre.

---

## ⚡ Portabilidade & Ergonomia de Terminal
- [tooling] Zero-Runtime Dependencies para o Usuário Final: Distribuir ferramentas CLI via Bun/Node (npx / bunx) garante que desenvolvedores de qualquer stack (PHP, Python, Ruby, Go) executem a cerca sem precisar de compiladores C/Rust ou runtimes adicionais no host.
- [ux] Naming Ergonomics (Baba / Baba-Yaga vs Matryoshka): Nomes complexos como 'matryoshka' sofrem com typos frequentes (matrioska, matrioshka). Fornecer atalhos de 4 letras no terminal como 'baba' (matriarca eslava) ou 'bbyg' (baba-yaga: remediação que parece bruxaria) maximiza a ergonomia sem perder a identidade visual do projeto.
- [ci] Bun Frozen-Lockfile & CI Verification Gate: Em pipelines GitHub Actions com Bun (oven-sh/setup-bun), a execução de 'bun install --frozen-lockfile' antes de 'bun test' e 'bun run build' garante reprodutibilidade hermética sem risco de drift de dependências transitivas. A compilação estática prévia valida a integridade de empacotamento antes de qualquer avanço na esteira.
- [release] Pipeline de SemVer Automatizado & Fetch Depth: Workflows de release acionados por push na branch 'main' que calculam bump SemVer via Conventional Commits exigem 'actions/checkout@v4' configurado com 'fetch-depth: 0'. O checkout shallow padrão (depth 1) omite tags e histórico prévio de commits, impossibilitando a detecção correta da última versão estável e gerando cálculos incorretos de bump.
