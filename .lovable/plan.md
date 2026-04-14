

## Diagnóstico

O problema atual: os botões de toggle foram colocados como barras verticais **à direita de cada painel**, criando faixas cinzas feias entre os blocos. O layout ficou amador.

## Solução: Redesign profissional dos toggles

A abordagem correta é:

1. **Remover as barras verticais de toggle** — eliminar os `<button>` de 6px de largura que ficam entre os painéis
2. **Colocar os toggles no header de cada painel** — botões discretos no topo de cada bloco (IA Coach e Ações), integrados ao título da seção
3. **Quando fechado, mostrar uma aba mínima** — uma aba vertical fina (tipo tab lateral) colada à borda direita da tela com o nome do painel, clicável para reabrir
4. **Painel central (IA Coach)**: quando fecha, colapsa para a direita e o chat expande; uma aba "IA Coach" aparece na borda
5. **Painel direito (Ações)**: quando fecha, colapsa para a direita e some; uma aba "Ações" aparece na borda direita

### Estrutura visual

```text
Aberto:
┌──────────┬─────────────────┬──────────────┐
│  Chat    │  IA Coach  [×]  │  Ações  [×]  │
│  (fixo)  │  (flex-1)       │  (320px)     │
└──────────┴─────────────────┴──────────────┘

Centro fechado:
┌──────────┬──────────────┬───┐
│  Chat    │  Ações  [×]  │IA │  ← aba vertical "IA"
│  (fixo)  │  (flex-1)    │   │
└──────────┴──────────────┴───┘

Ambos fechados:
┌────────────────────────┬───┬───┐
│  Chat (fixo, não exp.) │IA │Aç │  ← abas verticais
└────────────────────────┴───┴───┘
```

### Mudanças no arquivo

**`src/components/comercial/ProspectWorkspace.tsx`**:

- Remover as `<button>` strips verticais dos dois painéis
- Adicionar botão de fechar (ícone X ou PanelRightClose) no **header interno** de cada painel
- Quando painel está fechado, renderizar uma **aba vertical rotacionada** (`writing-mode: vertical-rl`) na borda direita com texto + ícone, clicável para reabrir
- Manter `transition-all duration-300` para animação suave
- Chat permanece com largura fixa (`w-[400px] lg:w-[440px]`) — nunca expande
- Painel central usa `flex-1` quando aberto
- Remover `min-w-[480px]` e `min-w-[400px]` do conteúdo interno (causa scroll horizontal desnecessário agora que o painel central é flex-1)

