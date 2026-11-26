# JVM Dev

Home page de **JVM Dev**: desenvolvimento de software, ensino e pesquisa científica.
Por enquanto, uma página "em breve" com Three.js, até a landing page oficial.

Site: https://jvm.dev.br/

## Estrutura

| Arquivo | Função |
|---|---|
| `index.html` | Marcação, SEO/Open Graph, import map do Three.js (r160 via jsDelivr) |
| `style.css` | Layout, tipografia e animações de interface |
| `scene.js` | Cena 3D: esfera de partículas com ruído em shader, núcleo, órbitas, estrelas e bloom |
| `ui.js` | Ano no rodapé e terminal com digitação |
| `favicon.svg`, `404.html` | Ícone e redirecionamento de páginas inexistentes |
| `CNAME`, `.nojekyll` | Domínio customizado e publicação sem Jekyll |

Sem build e sem dependências locais.

## Rodar localmente

```bash
python -m http.server 8000
# abrir http://localhost:8000
```

## Publicação (GitHub Pages)

1. **Settings → Pages**: Source *Deploy from a branch*, `main` / `/ (root)`.
2. *Custom domain*: `jvm.dev.br`, depois **Enforce HTTPS**.
3. DNS do domínio:
   - `A` em `@`: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `CNAME` em `www`: `<seu-usuario>.github.io`
