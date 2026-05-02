export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      consultoria_acompanhamentos: {
        Row: {
          agendado_para: string
          cliente_id: string | null
          created_at: string | null
          id: string
          metricas_coletadas: Json | null
          observacoes: string | null
          oportunidade_upsell: boolean | null
          realizado_em: string | null
          responsavel: string | null
          status: string | null
          tipo: string
        }
        Insert: {
          agendado_para: string
          cliente_id?: string | null
          created_at?: string | null
          id?: string
          metricas_coletadas?: Json | null
          observacoes?: string | null
          oportunidade_upsell?: boolean | null
          realizado_em?: string | null
          responsavel?: string | null
          status?: string | null
          tipo: string
        }
        Update: {
          agendado_para?: string
          cliente_id?: string | null
          created_at?: string | null
          id?: string
          metricas_coletadas?: Json | null
          observacoes?: string | null
          oportunidade_upsell?: boolean | null
          realizado_em?: string | null
          responsavel?: string | null
          status?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultoria_acompanhamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "consultoria_clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      consultoria_cadencia: {
        Row: {
          agendado_para: string
          created_at: string | null
          dia: number
          enviado_em: string | null
          erro: string | null
          id: string
          mensagem_enviada: string | null
          prospect_id: string | null
          script_usado: string | null
          status: string
          tentativas: number | null
        }
        Insert: {
          agendado_para: string
          created_at?: string | null
          dia: number
          enviado_em?: string | null
          erro?: string | null
          id?: string
          mensagem_enviada?: string | null
          prospect_id?: string | null
          script_usado?: string | null
          status?: string
          tentativas?: number | null
        }
        Update: {
          agendado_para?: string
          created_at?: string | null
          dia?: number
          enviado_em?: string | null
          erro?: string | null
          id?: string
          mensagem_enviada?: string | null
          prospect_id?: string | null
          script_usado?: string | null
          status?: string
          tentativas?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "consultoria_cadencia_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "consultoria_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      consultoria_clientes: {
        Row: {
          cidade: string
          created_at: string | null
          data_fechamento: string | null
          data_imersao: string | null
          data_inicio: string | null
          data_pagamento: string | null
          data_prev_entrega: string | null
          decisor: string
          depoimento: string | null
          descricao_negocio: string | null
          dores_mapeadas: string | null
          email: string | null
          equipe_info: string | null
          faturamento_est: string | null
          faturamento_estimado: string | null
          github_url: string | null
          health_score: number | null
          historico: string | null
          id: string
          instagram: string | null
          legado: boolean
          metricas_antes_depois: string | null
          nicho: string
          nome_negocio: string
          nps: number | null
          obs_contrato: string | null
          obs_internas: string | null
          origem_prospect_id: string | null
          pagamento_confirmado: boolean | null
          potencial_upsell: string | null
          produto_vs: string | null
          projeto_legado: string | null
          prospect_id: string | null
          proximo_checkin: string | null
          responsavel: string | null
          responsavel_imersao: string | null
          resultados: string | null
          segmento: string | null
          sistemas_atuais: string | null
          site: string | null
          status: string
          tipo_cobranca: string
          updated_at: string | null
          valor_fee: number
          whatsapp: string
        }
        Insert: {
          cidade: string
          created_at?: string | null
          data_fechamento?: string | null
          data_imersao?: string | null
          data_inicio?: string | null
          data_pagamento?: string | null
          data_prev_entrega?: string | null
          decisor: string
          depoimento?: string | null
          descricao_negocio?: string | null
          dores_mapeadas?: string | null
          email?: string | null
          equipe_info?: string | null
          faturamento_est?: string | null
          faturamento_estimado?: string | null
          github_url?: string | null
          health_score?: number | null
          historico?: string | null
          id?: string
          instagram?: string | null
          legado?: boolean
          metricas_antes_depois?: string | null
          nicho: string
          nome_negocio: string
          nps?: number | null
          obs_contrato?: string | null
          obs_internas?: string | null
          origem_prospect_id?: string | null
          pagamento_confirmado?: boolean | null
          potencial_upsell?: string | null
          produto_vs?: string | null
          projeto_legado?: string | null
          prospect_id?: string | null
          proximo_checkin?: string | null
          responsavel?: string | null
          responsavel_imersao?: string | null
          resultados?: string | null
          segmento?: string | null
          sistemas_atuais?: string | null
          site?: string | null
          status?: string
          tipo_cobranca?: string
          updated_at?: string | null
          valor_fee: number
          whatsapp: string
        }
        Update: {
          cidade?: string
          created_at?: string | null
          data_fechamento?: string | null
          data_imersao?: string | null
          data_inicio?: string | null
          data_pagamento?: string | null
          data_prev_entrega?: string | null
          decisor?: string
          depoimento?: string | null
          descricao_negocio?: string | null
          dores_mapeadas?: string | null
          email?: string | null
          equipe_info?: string | null
          faturamento_est?: string | null
          faturamento_estimado?: string | null
          github_url?: string | null
          health_score?: number | null
          historico?: string | null
          id?: string
          instagram?: string | null
          legado?: boolean
          metricas_antes_depois?: string | null
          nicho?: string
          nome_negocio?: string
          nps?: number | null
          obs_contrato?: string | null
          obs_internas?: string | null
          origem_prospect_id?: string | null
          pagamento_confirmado?: boolean | null
          potencial_upsell?: string | null
          produto_vs?: string | null
          projeto_legado?: string | null
          prospect_id?: string | null
          proximo_checkin?: string | null
          responsavel?: string | null
          responsavel_imersao?: string | null
          resultados?: string | null
          segmento?: string | null
          sistemas_atuais?: string | null
          site?: string | null
          status?: string
          tipo_cobranca?: string
          updated_at?: string | null
          valor_fee?: number
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultoria_clientes_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "consultoria_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      consultoria_config: {
        Row: {
          criterios_qualificacao: Json
          followup_d1: string
          followup_d14: string
          followup_d3: string
          followup_d30: string
          followup_d7: string
          horario_fim: number
          horario_inicio: number
          ia_auto_reply: boolean
          id: string
          instancia_evolution: string
          nicho: string
          script_a: string
          script_b: string
          script_c: string
          system_prompt: string
          updated_at: string | null
        }
        Insert: {
          criterios_qualificacao?: Json
          followup_d1: string
          followup_d14: string
          followup_d3: string
          followup_d30: string
          followup_d7: string
          horario_fim?: number
          horario_inicio?: number
          ia_auto_reply?: boolean
          id?: string
          instancia_evolution: string
          nicho: string
          script_a: string
          script_b: string
          script_c: string
          system_prompt: string
          updated_at?: string | null
        }
        Update: {
          criterios_qualificacao?: Json
          followup_d1?: string
          followup_d14?: string
          followup_d3?: string
          followup_d30?: string
          followup_d7?: string
          horario_fim?: number
          horario_inicio?: number
          ia_auto_reply?: boolean
          id?: string
          instancia_evolution?: string
          nicho?: string
          script_a?: string
          script_b?: string
          script_c?: string
          system_prompt?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      consultoria_conversas: {
        Row: {
          conteudo: string
          created_at: string | null
          direcao: string
          id: string
          instance_name: string | null
          message_id: string | null
          origem: string | null
          processado_ia: boolean | null
          prospect_id: string | null
          reactions: Json | null
        }
        Insert: {
          conteudo: string
          created_at?: string | null
          direcao: string
          id?: string
          instance_name?: string | null
          message_id?: string | null
          origem?: string | null
          processado_ia?: boolean | null
          prospect_id?: string | null
          reactions?: Json | null
        }
        Update: {
          conteudo?: string
          created_at?: string | null
          direcao?: string
          id?: string
          instance_name?: string | null
          message_id?: string | null
          origem?: string | null
          processado_ia?: boolean | null
          prospect_id?: string | null
          reactions?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "consultoria_conversas_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "consultoria_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      consultoria_devolutivas: {
        Row: {
          apresentado_por: string | null
          checklist: Json
          checklist_completo: boolean | null
          cliente_id: string | null
          created_at: string | null
          data_devolutiva: string | null
          decisor_presente: boolean | null
          diagnostico_id: string | null
          documento_gerado_em: string | null
          documento_revisado: boolean | null
          documento_url: string | null
          id: string
          itens_criticos_pendentes: string[] | null
          proposta_mrr: number | null
          proximo_passo: string | null
          registro_entrega: Json | null
          resultado: string | null
          updated_at: string | null
        }
        Insert: {
          apresentado_por?: string | null
          checklist?: Json
          checklist_completo?: boolean | null
          cliente_id?: string | null
          created_at?: string | null
          data_devolutiva?: string | null
          decisor_presente?: boolean | null
          diagnostico_id?: string | null
          documento_gerado_em?: string | null
          documento_revisado?: boolean | null
          documento_url?: string | null
          id?: string
          itens_criticos_pendentes?: string[] | null
          proposta_mrr?: number | null
          proximo_passo?: string | null
          registro_entrega?: Json | null
          resultado?: string | null
          updated_at?: string | null
        }
        Update: {
          apresentado_por?: string | null
          checklist?: Json
          checklist_completo?: boolean | null
          cliente_id?: string | null
          created_at?: string | null
          data_devolutiva?: string | null
          decisor_presente?: boolean | null
          diagnostico_id?: string | null
          documento_gerado_em?: string | null
          documento_revisado?: boolean | null
          documento_url?: string | null
          id?: string
          itens_criticos_pendentes?: string[] | null
          proposta_mrr?: number | null
          proximo_passo?: string | null
          registro_entrega?: Json | null
          resultado?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consultoria_devolutivas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "consultoria_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultoria_devolutivas_diagnostico_id_fkey"
            columns: ["diagnostico_id"]
            isOneToOne: false
            referencedRelation: "consultoria_diagnosticos"
            referencedColumns: ["id"]
          },
        ]
      }
      consultoria_diagnosticos: {
        Row: {
          arquitetura: string | null
          cliente_id: string | null
          created_at: string | null
          gargalo_1: string | null
          gargalo_1_impacto: number | null
          gargalo_2: string | null
          gargalo_2_impacto: number | null
          gargalo_3: string | null
          gargalo_3_impacto: number | null
          id: string
          imersao_id: string | null
          impacto_base_inativa: number | null
          impacto_cancelamentos: number | null
          impacto_custo_oportunidade: number | null
          impacto_leads_perdidos: number | null
          impacto_total: number | null
          justificativa_arquitetura: string | null
          mrr_proposto: number | null
          nivel_atendimento: string | null
          nivel_comercial: string | null
          nivel_marketing: string | null
          nivel_operacao: string | null
          produtos_recomendados: string[] | null
          rascunho_diagnostico_detalhado: string | null
          rascunho_resumo_executivo: string | null
          rascunho_revisado: boolean | null
          responsavel: string | null
          score_atendimento: number | null
          score_comercial: number | null
          score_marketing: number | null
          score_operacao: number | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          arquitetura?: string | null
          cliente_id?: string | null
          created_at?: string | null
          gargalo_1?: string | null
          gargalo_1_impacto?: number | null
          gargalo_2?: string | null
          gargalo_2_impacto?: number | null
          gargalo_3?: string | null
          gargalo_3_impacto?: number | null
          id?: string
          imersao_id?: string | null
          impacto_base_inativa?: number | null
          impacto_cancelamentos?: number | null
          impacto_custo_oportunidade?: number | null
          impacto_leads_perdidos?: number | null
          impacto_total?: number | null
          justificativa_arquitetura?: string | null
          mrr_proposto?: number | null
          nivel_atendimento?: string | null
          nivel_comercial?: string | null
          nivel_marketing?: string | null
          nivel_operacao?: string | null
          produtos_recomendados?: string[] | null
          rascunho_diagnostico_detalhado?: string | null
          rascunho_resumo_executivo?: string | null
          rascunho_revisado?: boolean | null
          responsavel?: string | null
          score_atendimento?: number | null
          score_comercial?: number | null
          score_marketing?: number | null
          score_operacao?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          arquitetura?: string | null
          cliente_id?: string | null
          created_at?: string | null
          gargalo_1?: string | null
          gargalo_1_impacto?: number | null
          gargalo_2?: string | null
          gargalo_2_impacto?: number | null
          gargalo_3?: string | null
          gargalo_3_impacto?: number | null
          id?: string
          imersao_id?: string | null
          impacto_base_inativa?: number | null
          impacto_cancelamentos?: number | null
          impacto_custo_oportunidade?: number | null
          impacto_leads_perdidos?: number | null
          impacto_total?: number | null
          justificativa_arquitetura?: string | null
          mrr_proposto?: number | null
          nivel_atendimento?: string | null
          nivel_comercial?: string | null
          nivel_marketing?: string | null
          nivel_operacao?: string | null
          produtos_recomendados?: string[] | null
          rascunho_diagnostico_detalhado?: string | null
          rascunho_resumo_executivo?: string | null
          rascunho_revisado?: boolean | null
          responsavel?: string | null
          score_atendimento?: number | null
          score_comercial?: number | null
          score_marketing?: number | null
          score_operacao?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consultoria_diagnosticos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "consultoria_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultoria_diagnosticos_imersao_id_fkey"
            columns: ["imersao_id"]
            isOneToOne: false
            referencedRelation: "consultoria_imersoes"
            referencedColumns: ["id"]
          },
        ]
      }
      consultoria_imersoes: {
        Row: {
          campos_vazios: number | null
          canais_ativos: string[] | null
          cliente_id: string | null
          cobertura_fora_horario: boolean | null
          completa: boolean | null
          created_at: string | null
          crm_ferramenta: string | null
          dor_principal_declarada: string | null
          equipe_total: number | null
          faturamento_estimado: string | null
          faz_followup: string | null
          ferramentas_sistemas: string[] | null
          google_avaliacoes: number | null
          google_meu_negocio: boolean | null
          gravacao_url: string | null
          id: string
          leads_mes_estimado: number | null
          nome_decisor: string | null
          observacoes_livres: string | null
          percentual_dono_operacao: number | null
          quem_responde: string | null
          realizada_em: string | null
          realizada_por: string | null
          redes_sociais: string[] | null
          sabe_medir_roi: boolean | null
          sessao_complementar_necessaria: boolean | null
          taxa_conversao: string | null
          tem_lp_site: string | null
          tempo_resposta_medio: string | null
          trafego_pago_ativo: boolean | null
          trafego_pago_valor: number | null
          updated_at: string | null
        }
        Insert: {
          campos_vazios?: number | null
          canais_ativos?: string[] | null
          cliente_id?: string | null
          cobertura_fora_horario?: boolean | null
          completa?: boolean | null
          created_at?: string | null
          crm_ferramenta?: string | null
          dor_principal_declarada?: string | null
          equipe_total?: number | null
          faturamento_estimado?: string | null
          faz_followup?: string | null
          ferramentas_sistemas?: string[] | null
          google_avaliacoes?: number | null
          google_meu_negocio?: boolean | null
          gravacao_url?: string | null
          id?: string
          leads_mes_estimado?: number | null
          nome_decisor?: string | null
          observacoes_livres?: string | null
          percentual_dono_operacao?: number | null
          quem_responde?: string | null
          realizada_em?: string | null
          realizada_por?: string | null
          redes_sociais?: string[] | null
          sabe_medir_roi?: boolean | null
          sessao_complementar_necessaria?: boolean | null
          taxa_conversao?: string | null
          tem_lp_site?: string | null
          tempo_resposta_medio?: string | null
          trafego_pago_ativo?: boolean | null
          trafego_pago_valor?: number | null
          updated_at?: string | null
        }
        Update: {
          campos_vazios?: number | null
          canais_ativos?: string[] | null
          cliente_id?: string | null
          cobertura_fora_horario?: boolean | null
          completa?: boolean | null
          created_at?: string | null
          crm_ferramenta?: string | null
          dor_principal_declarada?: string | null
          equipe_total?: number | null
          faturamento_estimado?: string | null
          faz_followup?: string | null
          ferramentas_sistemas?: string[] | null
          google_avaliacoes?: number | null
          google_meu_negocio?: boolean | null
          gravacao_url?: string | null
          id?: string
          leads_mes_estimado?: number | null
          nome_decisor?: string | null
          observacoes_livres?: string | null
          percentual_dono_operacao?: number | null
          quem_responde?: string | null
          realizada_em?: string | null
          realizada_por?: string | null
          redes_sociais?: string[] | null
          sabe_medir_roi?: boolean | null
          sessao_complementar_necessaria?: boolean | null
          taxa_conversao?: string | null
          tem_lp_site?: string | null
          tempo_resposta_medio?: string | null
          trafego_pago_ativo?: boolean | null
          trafego_pago_valor?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consultoria_imersoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "consultoria_clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      consultoria_nichos: {
        Row: {
          color: string
          created_at: string | null
          dot: string
          icon: string | null
          id: string
          is_primary: boolean | null
          keywords: string[]
          label: string
          ordem: number | null
          search_value: string | null
        }
        Insert: {
          color?: string
          created_at?: string | null
          dot?: string
          icon?: string | null
          id?: string
          is_primary?: boolean | null
          keywords?: string[]
          label: string
          ordem?: number | null
          search_value?: string | null
        }
        Update: {
          color?: string
          created_at?: string | null
          dot?: string
          icon?: string | null
          id?: string
          is_primary?: boolean | null
          keywords?: string[]
          label?: string
          ordem?: number | null
          search_value?: string | null
        }
        Relationships: []
      }
      consultoria_notas_diagnostico: {
        Row: {
          created_at: string | null
          diagnostico_id: string | null
          dimensao: string
          id: string
          nota: number
          observacao: string | null
          pergunta_codigo: string
        }
        Insert: {
          created_at?: string | null
          diagnostico_id?: string | null
          dimensao: string
          id?: string
          nota: number
          observacao?: string | null
          pergunta_codigo: string
        }
        Update: {
          created_at?: string | null
          diagnostico_id?: string | null
          dimensao?: string
          id?: string
          nota?: number
          observacao?: string | null
          pergunta_codigo?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultoria_notas_diagnostico_diagnostico_id_fkey"
            columns: ["diagnostico_id"]
            isOneToOne: false
            referencedRelation: "consultoria_diagnosticos"
            referencedColumns: ["id"]
          },
        ]
      }
      consultoria_projetos: {
        Row: {
          cliente_id: string
          created_at: string | null
          data_conclusao: string | null
          data_inicio: string | null
          data_previsao: string | null
          descricao: string | null
          id: string
          nome: string
          observacoes: string | null
          prioridade: string | null
          responsavel: string | null
          status: string
          tipo: string
          updated_at: string | null
        }
        Insert: {
          cliente_id: string
          created_at?: string | null
          data_conclusao?: string | null
          data_inicio?: string | null
          data_previsao?: string | null
          descricao?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          prioridade?: string | null
          responsavel?: string | null
          status?: string
          tipo?: string
          updated_at?: string | null
        }
        Update: {
          cliente_id?: string
          created_at?: string | null
          data_conclusao?: string | null
          data_inicio?: string | null
          data_previsao?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          prioridade?: string | null
          responsavel?: string | null
          status?: string
          tipo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consultoria_projetos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "consultoria_clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      consultoria_prospects: {
        Row: {
          cidade: string
          classificacao_ia: string | null
          created_at: string | null
          data_abordagem: string | null
          data_proxima_acao: string | null
          data_ultima_interacao: string | null
          decisor: string | null
          dia_cadencia: number | null
          faturamento_estimado: string | null
          handoff_at: string | null
          handoff_reason: string | null
          id: string
          instagram: string | null
          linked_instance: string | null
          nicho: string
          nome_negocio: string
          observacoes: string | null
          origem: string | null
          remote_jid: string | null
          responsavel: string
          resumo_conversa: string | null
          score_qualificacao: number | null
          script_usado: string | null
          site: string | null
          status: string
          updated_at: string | null
          whatsapp: string
          whatsapp_valido: boolean | null
        }
        Insert: {
          cidade: string
          classificacao_ia?: string | null
          created_at?: string | null
          data_abordagem?: string | null
          data_proxima_acao?: string | null
          data_ultima_interacao?: string | null
          decisor?: string | null
          dia_cadencia?: number | null
          faturamento_estimado?: string | null
          handoff_at?: string | null
          handoff_reason?: string | null
          id?: string
          instagram?: string | null
          linked_instance?: string | null
          nicho: string
          nome_negocio: string
          observacoes?: string | null
          origem?: string | null
          remote_jid?: string | null
          responsavel?: string
          resumo_conversa?: string | null
          score_qualificacao?: number | null
          script_usado?: string | null
          site?: string | null
          status?: string
          updated_at?: string | null
          whatsapp: string
          whatsapp_valido?: boolean | null
        }
        Update: {
          cidade?: string
          classificacao_ia?: string | null
          created_at?: string | null
          data_abordagem?: string | null
          data_proxima_acao?: string | null
          data_ultima_interacao?: string | null
          decisor?: string | null
          dia_cadencia?: number | null
          faturamento_estimado?: string | null
          handoff_at?: string | null
          handoff_reason?: string | null
          id?: string
          instagram?: string | null
          linked_instance?: string | null
          nicho?: string
          nome_negocio?: string
          observacoes?: string | null
          origem?: string | null
          remote_jid?: string | null
          responsavel?: string
          resumo_conversa?: string | null
          score_qualificacao?: number | null
          script_usado?: string | null
          site?: string | null
          status?: string
          updated_at?: string | null
          whatsapp?: string
          whatsapp_valido?: boolean | null
        }
        Relationships: []
      }
      consultoria_tarefas: {
        Row: {
          concluida_em: string | null
          created_at: string | null
          descricao: string | null
          id: string
          ordem: number | null
          prazo: string | null
          prioridade: string | null
          projeto_id: string
          responsavel: string | null
          status: string
          titulo: string
          updated_at: string | null
        }
        Insert: {
          concluida_em?: string | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          ordem?: number | null
          prazo?: string | null
          prioridade?: string | null
          projeto_id: string
          responsavel?: string | null
          status?: string
          titulo: string
          updated_at?: string | null
        }
        Update: {
          concluida_em?: string | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          ordem?: number | null
          prazo?: string | null
          prioridade?: string | null
          projeto_id?: string
          responsavel?: string | null
          status?: string
          titulo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consultoria_tarefas_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "consultoria_projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      evolution_instances: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          instance_name: string
          state: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          instance_name: string
          state?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          instance_name?: string
          state?: string | null
        }
        Relationships: []
      }
      leads_raw: {
        Row: {
          created_at: string | null
          email: string | null
          enrichment_data: Json | null
          id: string
          name: string | null
          phone: string | null
          source: string
          status: string
          tags: string[] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          enrichment_data?: Json | null
          id?: string
          name?: string | null
          phone?: string | null
          source?: string
          status?: string
          tags?: string[] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          enrichment_data?: Json | null
          id?: string
          name?: string | null
          phone?: string | null
          source?: string
          status?: string
          tags?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      prospect_execution_state: {
        Row: {
          completed_steps: string[]
          context_snapshot: Json
          created_at: string
          current_step: string
          error: string | null
          id: string
          prospect_id: string
          retry_count: number
          status: string
          updated_at: string
        }
        Insert: {
          completed_steps?: string[]
          context_snapshot?: Json
          created_at?: string
          current_step?: string
          error?: string | null
          id?: string
          prospect_id: string
          retry_count?: number
          status?: string
          updated_at?: string
        }
        Update: {
          completed_steps?: string[]
          context_snapshot?: Json
          created_at?: string
          current_step?: string
          error?: string | null
          id?: string
          prospect_id?: string
          retry_count?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospect_execution_state_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: true
            referencedRelation: "consultoria_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_meddic: {
        Row: {
          confianca: number
          evidencia_citacao: string | null
          id: string
          pilar: string
          prospect_id: string
          score: number
          updated_at: string
        }
        Insert: {
          confianca?: number
          evidencia_citacao?: string | null
          id?: string
          pilar: string
          prospect_id: string
          score?: number
          updated_at?: string
        }
        Update: {
          confianca?: number
          evidencia_citacao?: string | null
          id?: string
          pilar?: string
          prospect_id?: string
          score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospect_meddic_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "consultoria_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_notas: {
        Row: {
          autor: string | null
          conteudo: string
          created_at: string
          id: string
          prospect_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          autor?: string | null
          conteudo: string
          created_at?: string
          id?: string
          prospect_id: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          autor?: string | null
          conteudo?: string
          created_at?: string
          id?: string
          prospect_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospect_notas_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "consultoria_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_session_memory: {
        Row: {
          confidence: number
          extracted_at: string
          fact_key: string
          fact_value: string
          id: string
          prospect_id: string
          source_message_id: string | null
        }
        Insert: {
          confidence?: number
          extracted_at?: string
          fact_key: string
          fact_value: string
          id?: string
          prospect_id: string
          source_message_id?: string | null
        }
        Update: {
          confidence?: number
          extracted_at?: string
          fact_key?: string
          fact_value?: string
          id?: string
          prospect_id?: string
          source_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospect_session_memory_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "consultoria_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      vendedor_company_profiles: {
        Row: {
          common_objections: string
          company_name: string
          created_at: string
          description: string
          differentials: string
          id: string
          products_services: string
          segment: string
          target_audience: string
          tone_of_voice: string
          updated_at: string
          user_id: string
        }
        Insert: {
          common_objections?: string
          company_name: string
          created_at?: string
          description?: string
          differentials?: string
          id?: string
          products_services?: string
          segment?: string
          target_audience?: string
          tone_of_voice?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          common_objections?: string
          company_name?: string
          created_at?: string
          description?: string
          differentials?: string
          id?: string
          products_services?: string
          segment?: string
          target_audience?: string
          tone_of_voice?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vendedor_knowledge: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          profile_id: string | null
          scenario_name: string
          source_evaluation: Json | null
          title: string
          user_id: string
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          id?: string
          profile_id?: string | null
          scenario_name?: string
          source_evaluation?: Json | null
          title: string
          user_id: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          profile_id?: string | null
          scenario_name?: string
          source_evaluation?: Json | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendedor_knowledge_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "vendedor_company_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vendedor_scenarios: {
        Row: {
          created_at: string
          customer_persona: string
          description: string
          difficulty: string
          id: string
          name: string
          profile_id: string
          system_prompt: string
        }
        Insert: {
          created_at?: string
          customer_persona?: string
          description?: string
          difficulty?: string
          id?: string
          name: string
          profile_id: string
          system_prompt?: string
        }
        Update: {
          created_at?: string
          customer_persona?: string
          description?: string
          difficulty?: string
          id?: string
          name?: string
          profile_id?: string
          system_prompt?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendedor_scenarios_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "vendedor_company_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vs_brand_assets: {
        Row: {
          content: string | null
          created_at: string
          file_url: string | null
          id: string
          is_active: boolean
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          file_url?: string | null
          id?: string
          is_active?: boolean
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          file_url?: string | null
          id?: string
          is_active?: boolean
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      vs_email_campaigns: {
        Row: {
          channel: string
          clicked_count: number
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          message_template: string | null
          name: string
          opened_count: number
          scheduled_for: string | null
          segment_audience: string
          segment_nichos: string[] | null
          segment_status: string[] | null
          sent_count: number
          status: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          channel?: string
          clicked_count?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          message_template?: string | null
          name: string
          opened_count?: number
          scheduled_for?: string | null
          segment_audience?: string
          segment_nichos?: string[] | null
          segment_status?: string[] | null
          sent_count?: number
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          channel?: string
          clicked_count?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          message_template?: string | null
          name?: string
          opened_count?: number
          scheduled_for?: string | null
          segment_audience?: string
          segment_nichos?: string[] | null
          segment_status?: string[] | null
          sent_count?: number
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      vs_ideias: {
        Row: {
          autor: string
          categoria: string
          created_at: string
          descricao: string | null
          esforco: number
          id: string
          impacto: number
          link_origem: string | null
          modulo: string | null
          observacoes: string | null
          score: number | null
          status: string
          tags: string[] | null
          titulo: string
          updated_at: string
        }
        Insert: {
          autor?: string
          categoria?: string
          created_at?: string
          descricao?: string | null
          esforco?: number
          id?: string
          impacto?: number
          link_origem?: string | null
          modulo?: string | null
          observacoes?: string | null
          score?: number | null
          status?: string
          tags?: string[] | null
          titulo: string
          updated_at?: string
        }
        Update: {
          autor?: string
          categoria?: string
          created_at?: string
          descricao?: string | null
          esforco?: number
          id?: string
          impacto?: number
          link_origem?: string | null
          modulo?: string | null
          observacoes?: string | null
          score?: number | null
          status?: string
          tags?: string[] | null
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      vs_marketing_posts: {
        Row: {
          best_time: string | null
          caption: string
          created_at: string
          created_by: string | null
          hashtags: Json
          id: string
          image_prompt: string | null
          image_url: string | null
          nicho: string | null
          platform: string
          prompt: string | null
          scheduled_for: string | null
          status: string
          updated_at: string
        }
        Insert: {
          best_time?: string | null
          caption?: string
          created_at?: string
          created_by?: string | null
          hashtags?: Json
          id?: string
          image_prompt?: string | null
          image_url?: string | null
          nicho?: string | null
          platform?: string
          prompt?: string | null
          scheduled_for?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          best_time?: string | null
          caption?: string
          created_at?: string
          created_by?: string | null
          hashtags?: Json
          id?: string
          image_prompt?: string | null
          image_url?: string | null
          nicho?: string | null
          platform?: string
          prompt?: string | null
          scheduled_for?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      vs_produtos: {
        Row: {
          ativo: boolean
          categoria: string
          created_at: string | null
          descricao: string | null
          destaque: boolean
          id: string
          nichos: string[] | null
          nome: string
          obs: string | null
          ordem: number | null
          preco: number | null
          preco_fixo: number | null
          preco_max: number | null
          preco_min: number | null
          tier: string | null
          tipo: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean
          categoria?: string
          created_at?: string | null
          descricao?: string | null
          destaque?: boolean
          id?: string
          nichos?: string[] | null
          nome: string
          obs?: string | null
          ordem?: number | null
          preco?: number | null
          preco_fixo?: number | null
          preco_max?: number | null
          preco_min?: number | null
          tier?: string | null
          tipo?: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean
          categoria?: string
          created_at?: string | null
          descricao?: string | null
          destaque?: boolean
          id?: string
          nichos?: string[] | null
          nome?: string
          obs?: string | null
          ordem?: number | null
          preco?: number | null
          preco_fixo?: number | null
          preco_max?: number | null
          preco_min?: number | null
          tier?: string | null
          tipo?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      vs_users: {
        Row: {
          created_at: string | null
          email: string
          id: string
          name: string
          role: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          name: string
          role: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          role?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
