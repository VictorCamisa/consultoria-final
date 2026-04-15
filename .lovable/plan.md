

## Diagnóstico

Os nichos estão **hardcoded** em pelo menos 6 arquivos diferentes:
- `src/components/comercial/types.ts` — `NICHO_CATEGORIES` (fonte principal)
- `src/pages/Configuracoes.tsx` — `const NICHOS`
- `src/pages/Clientes.tsx` — `NICHOS_CLIENTE`
- `src/pages/Prospeccao.tsx` — `PRESET_SEGMENTS`
- `src/components/dashboard/ProspectingWizard.tsx` — `PRESET_SEGMENTS`
- `src/components/cliente/NewClientDialog.tsx` — `NICHOS`

Para adicionar "Casas de Ração" (ou qualquer novo nicho), seria necessário editar todos esses arquivos manualmente.

## Solução

Criar uma tabela `consultoria_nichos` no banco e um painel de gerenciamento na página de Configurações. Todos os pontos do sistema passam a ler dessa tabela.

## Mudanças

| Local | O que muda |
|-------|-----------|
| **Migração SQL** | Criar tabela `consultoria_nichos` (id, label, keywords[], color, dot, icon, search_value, primary, ordem) com seed dos 4 nichos atuais |
| **`src/hooks/useNichos.ts`** | Novo hook que busca os nichos do banco com `useQuery` e exporta helpers (`nichoCategory`, `matchesNichoFilter`, etc.) |
| **`src/components/comercial/types.ts`** | Manter funções como fallback mas o hook será a fonte principal |
| **`src/pages/Configuracoes.tsx`** | Adicionar seção "Gerenciar Nichos" com botão "+ Novo Nicho" que abre dialog para cadastrar label, keywords, cor e ícone |
| **6 arquivos consumidores** | Substituir arrays hardcoded por dados do hook `useNichos()` — Comercial, Leads, Clientes, Prospecção, ProspectingWizard, NewClientDialog |

### Fluxo do usuário

1. Vai em **Configurações** > seção "Nichos"
2. Clica **+ Novo Nicho**
3. Preenche: nome ("Casas de Ração"), palavras-chave ("ração, pet, animal"), ícone (🐾), cor
4. Salva — o nicho aparece imediatamente em todos os filtros, pipeline e prospecção

### Detalhe técnico — Tabela

```sql
CREATE TABLE consultoria_nichos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL UNIQUE,
  keywords text[] NOT NULL DEFAULT '{}',
  color text NOT NULL DEFAULT 'bg-gray-500/15 border-gray-500/30 text-gray-400',
  dot text NOT NULL DEFAULT 'bg-gray-500',
  icon text DEFAULT '🏢',
  search_value text DEFAULT '',
  is_primary boolean DEFAULT true,
  ordem integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Seed com os 4 atuais
INSERT INTO consultoria_nichos (label, keywords, color, dot, icon, search_value, is_primary, ordem) VALUES
('Estética', '{estética,estetic,bem-estar,cirurgia plástica}', 'bg-pink-500/15 border-pink-500/30 text-pink-400', 'bg-pink-500', '💆', 'clínicas estéticas', true, 1),
('Odonto', '{odonto,odontológ}', 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400', 'bg-cyan-500', '🦷', 'clínicas odontológicas', true, 2),
('Advocacia', '{advoca,advocacia,advogado,direito,jurídic}', 'bg-amber-500/15 border-amber-500/30 text-amber-400', 'bg-amber-500', '⚖️', 'escritórios de advocacia', true, 3),
('Revendas', '{revenda,veículo,seminov,motors,auto}', 'bg-blue-500/15 border-blue-500/30 text-blue-400', 'bg-blue-500', '🚗', 'revendas de veículos seminovos usados', true, 4);
```

