# Bunny Runner

Endless runner inspirado no **Chrome Dino**, com o coelho e o pássaro das imagens fornecidas como personagens.

## Como jogar

Abra `index.html` no navegador (duplo clique) ou sirva a pasta com qualquer servidor estático local.

- **ESPAÇO** ou **↑** — pular
- **↓** (segurar) — agachar
- **Clique / toque** — começar, reiniciar ou pular
- **Enter** — começar / reiniciar
- **Celular**: toque para pular; use o botão **↓ AGACHAR** ou deslize o dedo para baixo

## Estrutura

- `index.html` — página
- `styles.css` — layout responsivo e minimalista
- `game.js` — loop com `requestAnimationFrame`, física em passo fixo, obstáculos, colisões, pontuação e recorde
- `assets/bunny.png` — coelho (recorte transparente original)
- `assets/bird.png` — pássaro (recorte transparente original)

O recorde é salvo no `localStorage` do navegador (`bunnyRunner.hi`).
