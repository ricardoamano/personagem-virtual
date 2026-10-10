# Guia: criar um personagem com IA (versão de teste)

> **Status:** rascunho para o primeiro teste. Os prompts abaixo são hipóteses — a ideia é
> testar, anotar o que deu certo e melhorar. Os menus da Meshy mudam; se algo tiver outro nome, vale o espírito do passo.

## O que o software precisa do personagem

| Item | Por quê |
|---|---|
| Arquivo **.glb** | É o formato que o visualizador lê |
| **Corpo inteiro** com rig humanoide (esqueleto) | Para tocar as animações |
| **Rosto SEM boca desenhada** | A boca animada é colada na superfície do rosto; uma boca já pintada ficaria por baixo e atrapalharia |
| Pelo menos uma animação (ideal: uma "parado/idle") | Para o personagem não ficar duro |

## Passo a passo

### 1. Gerar o personagem
Na Meshy: **Text to 3D**. Prompt-modelo (troque só a parte entre colchetes):

```
cute cartoon [boy / girl / robot / doctor] mascot, full body, standing in neutral A-pose
with arms slightly away from the body, facing front, big head, simple stylized proportions,
no mouth, smooth blank face below the nose, no lips, no mouth line, neutral expression, plain colors, no accessories in the hands,
no cape, no loose hair or long clothes
```

Por que cada parte existe:
- **full body / A-pose / facing front** → o auto-rig só funciona bem com corpo inteiro, braços afastados e de frente.
- **no mouth, smooth blank face** → deixa o rosto limpo para a nossa boca. Se a IA desenhar uma boca mesmo assim, marque "Esconder a boca quando fechada" no visualizador.
- **no cape, no loose hair, no long clothes** → roupas soltas deformam feio quando o corpo anima.
- **big head, simple proportions** → combina com o estilo cartoon dos personagens da Neostore.

Se escolher o estilo/pose nas opções da ferramenta, use **cartoon** e **A-pose**.

### 2. Rig e animações
No modelo gerado, use **Rig / Auto-Rig** (humanoide). Escolha 3 a 4 animações prontas
(ex.: idle, acenar, dançar, comemorar).

### 3. Baixar
Exporte em **GLB**. Se a ferramenta gerar um arquivo por animação, baixe todos e me avise.

### 4. Testar no visualizador
Abra `personagem-virtual.html` no Chrome e **arraste o .glb para a tela**.
- A boca aparece posicionada automaticamente. Se ficar errada: **Posicionar boca** → clique no rosto.
- Ajuste o **Tamanho da boca** com o controle deslizante.
- Segure **Espaço** (fala simulada) ou ligue o microfone para ver a boca mexer.

## Imagens da boca (opcional no primeiro teste)

O visualizador já tem 5 bocas padrão. Para personalizar, gere 5 imagens PNG **com fundo
transparente**, nesta ordem (nomeie `boca_1.png` … `boca_5.png`):

1. fechada · 2. pequena aberta · 3. bem aberta ("A") · 4. redonda ("O/U") · 5. larga com dentes ("E/I")

Prompt-modelo (gerador de imagem de sua preferência), mesmo estilo de traço do personagem:

```
cartoon mouth only, front view, [closed smile / small open / wide open as saying "ah" /
round as saying "oh" / wide smile showing teeth], flat colors, thick outline,
isolated on a plain white background
```

Depois remova o fundo (ex.: recurso "remover fundo" do Canva) e carregue as 5 em **Imagens da boca**.
Importante: as 5 devem ter o **mesmo tamanho e enquadramento**, senão a boca "pula" ao trocar.

## O que anotar no teste (para melhorarmos o prompt)

- O rig funcionou de primeira? Os braços deformam estranho?
- Quais animações vieram? Servem para evento?
- A boca padrão ficou bem no rosto? O tamanho/posição ficou fácil de ajustar?
- O lip-sync com a sua voz parece natural? Qual sensibilidade ficou boa?
- Quantos créditos gastou até chegar num personagem utilizável?

## Pontos de atenção

- **Licença:** antes de usar um personagem em trabalho para cliente, confira os termos de uso comercial da ferramenta e do plano usado.
- **Estilos muito diferentes** (olhos enormes, sem pescoço) podem exigir ajuste manual da boca.
- Personagens **sem corpo humanoide** (animais de quatro patas, objetos) provavelmente não funcionam com o auto-rig humanoide.


## Fundos (cenários)

O visualizador aceita **imagem (JPG/PNG) ou vídeo (MP4)** como fundo, em "Imagem ou vídeo de fundo".
Não precisa ser 3D: a imagem fica parada atrás do personagem. Já vem pronto o **Consultório médico (cartoon)**.

Dicas para o fundo ficar bom:
- formato **16:9** (1920×1080 ou maior);
- **chão visível na parte de baixo**, com o centro livre para o personagem;
- estilo cartoon parecido com o do personagem.

Prompt-modelo para gerar um cenário:

```
cartoon [medical office / TV studio / stage / classroom] interior, wide shot, 16:9, flat colors with soft shading,
clean simple shapes, bright friendly lighting, empty floor space in the center for a character to stand,
the floor visible in the lower third, no people, no text
```
