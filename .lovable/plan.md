

## Diagnóstico

No `ProspectCard.tsx` (linha 182), o `<NewProspectDialog>` está renderizado **dentro** da `<div>` raiz do card que possui `onClick={onSelect}` — esse handler abre o `ProspectWorkspace` (página completa do lead).

Quando o usuário clica em editar:
1. O botão chama `setEditOpen(true)` com `stopPropagation` ✓
2. O Dialog do Radix abre via Portal, mas eventos de foco/clique do conteúdo do Dialog (que React trata como filho lógico do card) acabam disparando o `onClick` do card pai em alguns casos
3. Resultado: **abre o Dialog de edição E o ProspectWorkspace ao mesmo tempo**, e como o Workspace é full-screen, ele "engole" o Dialog visualmente

## Solução

Duas correções pequenas e seguras no `src/components/comercial/ProspectCard.tsx`:

**1. Mover o `<NewProspectDialog>` para fora da div clicável do card**

Envolver o card em um Fragment (`<>...</>`) para que o Dialog seja irmão da div, não filho. Assim eventos do Dialog nunca borbulham para o `onClick={onSelect}`.

**2. Reforçar o stopPropagation no botão Pencil**

Adicionar também `e.preventDefault()` para garantir que nenhum comportamento padrão dispare a navegação.

### Mudança visual

```text
ANTES:                          DEPOIS:
<div onClick={onSelect}>        <>
  ...conteúdo do card...          <div onClick={onSelect}>
  <NewProspectDialog />            ...conteúdo do card...
</div>                            </div>
                                  <NewProspectDialog />
                                </>
```

### Arquivo afetado

| Arquivo | Mudança |
|---------|---------|
| `src/components/comercial/ProspectCard.tsx` | Mover `<NewProspectDialog>` para fora da `<div>` raiz (usar Fragment) e reforçar handler do botão editar |

Nenhuma outra página é afetada — a correção é isolada no card.

