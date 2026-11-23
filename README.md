# Rosi Reader

Leitor de livros para Windows 11 feito com **Tauri 2 + React + TypeScript**.

- Biblioteca em catálogo (capas, progresso, favoritos), busca, grade/lista e ordenação
- Formatos: PDF, EPUB, MOBI, AZW3, FB2, CBZ (quadrinhos) e TXT; arraste arquivos/pastas, ou dê duplo clique num livro no Windows
- PDF com efeito de virar página (page-flip) e zoom
- Sumário e busca dentro do livro (Ctrl+F)
- Marcadores, trechos, destaques com anotação (pintados no texto) e cartão de citação em imagem
- Estantes (Quero ler / Lendo / Lido) e coleções; autores com foto e favoritos; editar capa, título e autor
- Dicionário do idioma do app (Wikcionários: pt, en, es, fr, de, it) e Vocabulário; ler em voz alta; filtro de luz quente
- Estatísticas de leitura: meta diária, sequência de dias, gráfico da semana
- Backup e restauração dos dados; exportar trechos e destaques em Markdown
- Interface em português, inglês, espanhol, francês, alemão ou italiano (seleção nas Configurações)
- Tema Papel / Sépia / Noite; janela com **Mica** (efeito de vidro do Windows 11)

## Jeito mais fácil

Dê dois cliques em **`instalar.bat`**. Ele instala o que faltar (Node, Build Tools, Rust) via winget, compila e abre o instalador do app.

Alternativa sem instalar nada: suba o projeto num repositório do GitHub e rode a ação **Gerar instalador (Windows)** (aba Actions). O `.exe` fica nos artefatos.

## Requisitos manuais (Windows 11)

1. [Node.js LTS](https://nodejs.org)
2. [Rust](https://rustup.rs) (instala junto as "Build Tools do Visual Studio" com **Desktop development with C++**)
3. WebView2 (já vem no Windows 11)

## Rodar

```bash
npm install
npm run tauri dev
```

## Gerar o instalador

```bash
npm run tauri build
# saída: src-tauri/target/release/bundle/nsis/Rosi Reader_0.1.0_x64-setup.exe
```

## Onde ficam os dados

Biblioteca, marcadores, trechos e configurações ficam no armazenamento local do app
(`localStorage` do WebView2). Os livros **não são copiados**: o app guarda o caminho do arquivo,
então se você mover um livro de pasta, adicione-o de novo.

## Próximos passos

- Trocar o armazenamento por SQLite (`tauri-plugin-sql`)
- Atualização automática (precisa de chave de assinatura e de um local para hospedar as versões)
- Efeito de virar página também no EPUB
- Barra de título própria (estilo macOS) com `decorations: false`
