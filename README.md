# Personagem Virtual (Neostore)

Personagem 3D cartoon ao vivo para eventos: um operador dispara animações e a boca
sincroniza com a voz do microfone. Alternativa ao MotionBuilder para esse uso.

**Status: teste de viabilidade (spike).** O código atual é descartável; serve para provar a ideia
e descobrir o melhor jeito de criar personagens com IA. O software de verdade vem depois,
com design e especificação aprovados.

## Como usar

1. Pegue o arquivo `personagem-virtual.html` (enviado na conversa, ou gere com `npm run build`: o resultado fica em `dist/`, que não é versionado por ser grande).
2. Abra no **Google Chrome** (duplo clique). Funciona offline; um único arquivo.
3. Abre com o **médico** (personagem padrão, já embutido no arquivo) e o consultório animado ao fundo. Use as teclas abaixo. O robô de teste é um botão à parte.
4. Para testar um personagem seu: **arraste o arquivo .glb** para a tela. Veja `docs/GUIA-CRIACAO-PERSONAGEM.md`.

| Tecla | Ação |
|---|---|
| `1`–`9` | Dispara a animação correspondente |
| `0` | Para a animação (volta à pose original) |
| `Q W E R T Y` | Câmeras: corpo inteiro, plano médio, close, 3/4 esquerda, 3/4 direita, plano aberto |
| `Espaço` (segurar) | Fala simulada (para testar sem microfone) |
| `Z X C V B` (segurar) | Força cada forma de boca |
| `M` | Liga/desliga microfone |
| `G` | Fundo verde (chroma key) |
| `F` | Tela cheia |
| `H` | Esconde o painel |

## Como funciona

- **Corpo:** animações do próprio arquivo .glb (ou do robô de teste), disparadas por tecla.
- **Boca:** uma imagem que troca entre 5 formas (fechada, pequena, "A", "O/U", "E/I"), projetada na superfície do rosto e presa ao osso da cabeça.
- **Lip-sync:** o volume da voz define a abertura; o timbre escolhe a vogal. É uma heurística — boa para ao vivo, não perfeita.
- **Saída:** janela em tela cheia para projetor, TV ou LED. Fundo: cor, chroma key (verde), imagem, vídeo ou o cenário pronto de consultório.

## Arquivos embutidos

`npm run build` embute no HTML (em base64) o que estiver em `assets/`: `medico.glb` (personagem padrão),
`consultorio.mp4` e `consultorio.webm` (fundo animado em loop de 12 s). Para trocar o personagem padrão, substitua
`assets/medico.glb` e rode o build. O vídeo de fundo é gerado por `tools/make-bg-video.mjs` (precisa de playwright-core e ffmpeg).

## Desenvolvimento

```
npm install
npm run build     # gera dist/personagem-virtual.html
```

Código em `src/` (three.js). Joystick ainda não implementado (o teste usa teclado/mouse).
