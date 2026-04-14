

## Problema

Atualmente o campo "Nicho" no cadastro de prospect é um `Select` fixo com apenas 4 opções (Estética, Odonto, Advocacia, Revendas). Prospects como "Massas Quiririm" e "Pneuvip" não se encaixam e ficam invisíveis nos filtros.

## Solução: Nicho Personalizado + Filtro "Sem config."

### 1. Campo de Nicho no cadastro (NewProspectDialog)

Trocar o `Select` fixo por um campo híbrido:
- Manter os 4 nichos pré-definidos como **sugestões rápidas** (botões/chips clicáveis)
- Adicionar um `Input` de texto livre abaixo para digitar qualquer nicho personalizado (ex: "Alimentação", "Automotivo")
- Se o usuário clicar em um chip, preenche o input; se digitar manualmente, aceita qualquer valor

### 2. Filtro no Pipeline (Comercial.tsx)

No dropdown de filtro de nichos, adicionar uma nova opção **"Sem config."** (ou "Outros") que filtra prospects cujo nicho não corresponde a nenhuma das 4 categorias pré-definidas. Esses prospects continuam aparecendo normalmente quando "Todos nichos" está selecionado.

### 3. Alterações em types.ts

- Adicionar função `isNichoConfigurado(nicho: string): boolean` que retorna `true` se o nicho bate com alguma das keywords das 4 categorias
- Atualizar `matchesNichoFilter` para suportar o valor especial `"sem_config"` que filtra nichos não reconhecidos

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/components/comercial/types.ts` | Adicionar `isNichoConfigurado()`, atualizar `matchesNichoFilter` |
| `src/components/comercial/NewProspectDialog.tsx` | Input híbrido (chips + texto livre) |
| `src/pages/Comercial.tsx` | Adicionar "Sem config." no dropdown de filtro |

Nenhuma migração de banco necessária — o campo `nicho` já é `text` livre.

