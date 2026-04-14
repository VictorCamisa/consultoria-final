
Objetivo: corrigir exatamente o que você pediu no `ProspectWorkspace`: fazer o bloco do meio e o bloco da direita terem rolagem horizontal própria, cada um independente, para que o conteúdo possa ser lido quando ultrapassar a largura visível.

O que identifiquei no código:
- O painel do meio usa `ScrollArea` sem `ScrollBar orientation="horizontal"`.
- O painel da direita também usa `ScrollArea` sem barra horizontal.
- O componente base `src/components/ui/scroll-area.tsx` até suporta barra horizontal, mas hoje o atalho `ScrollArea` renderiza só a vertical por padrão.
- No `ProspectWorkspace`, o conteúdo do meio ainda está sendo forçado a quebrar linha (`overflowWrap: "anywhere"` / `wordBreak: "break-word"`), que é o oposto do comportamento que você quer.
- O painel direito também tem vários itens com `truncate`, então mesmo com espaço maior o texto ainda pode continuar cortado.

Plano de implementação:
1. Ajustar o `ProspectWorkspace` para que o painel central tenha duas direções de rolagem:
   - vertical para descer/subir o conteúdo
   - horizontal para arrastar lateralmente só o painel do meio
   - remover a quebra forçada de linha no container central
   - colocar o conteúdo interno com largura mínima baseada no conteúdo (`min-w-max` / wrapper interno apropriado)

2. Fazer o mesmo no painel da direita:
   - permitir scroll horizontal independente
   - aplicar um wrapper interno que possa crescer além da largura fixa da coluna
   - adicionar barra horizontal visível no próprio painel direito

3. Corrigir os elementos internos que hoje truncam ou comprimem demais:
   - revisar `truncate` em campos como detalhes, etapas e botões
   - manter truncamento apenas onde fizer sentido visualmente, e liberar largura real nos blocos em que o usuário precisa ler tudo
   - garantir que cards como “Insights”, “Próximo Passo” e “Mensagem Sugerida” acompanhem a largura rolável

4. Validar o comportamento no layout atual desktop:
   - confirmar que o chat à esquerda continua fixo
   - confirmar que o painel central rola lateralmente sem mexer no direito
   - confirmar que o painel direito rola lateralmente sem mexer no centro
   - conferir especialmente os casos do seu print: alerta amarelo, insights, próxima ação, mensagem sugerida e tabela de detalhes

Arquivos envolvidos:
- `src/components/comercial/ProspectWorkspace.tsx`
- possivelmente `src/components/ui/scroll-area.tsx` se eu precisar expor um padrão mais claro para scrollbar horizontal reutilizável

Resultado esperado:
- bloco do meio com barra horizontal própria
- bloco da direita com barra horizontal própria
- cada painel movendo sozinho
- texto legível sem depender de quebra artificial

Detalhe técnico:
Provável abordagem:
- importar `ScrollBar` junto com `ScrollArea`
- em cada painel usar estrutura do tipo:
```text
<ScrollArea className="flex-1">
  <div className="min-w-max p-4 ...">
    ...
  </div>
  <ScrollBar orientation="horizontal" />
</ScrollArea>
```
- no painel central, remover:
```text
overflowWrap: "anywhere"
wordBreak: "break-word"
```
- revisar `truncate` em itens do painel direito para não continuar escondendo conteúdo mesmo com scroll horizontal
