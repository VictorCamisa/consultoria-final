import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface Props {
  feeVsDefault?: number;
}

export function ConfrontCalculator({ feeVsDefault = 800 }: Props) {
  const [salario, setSalario] = useState(2500);
  const [encargos, setEncargos] = useState(68);
  const [ferramentas, setFerramentas] = useState(300);
  const [horasDia, setHorasDia] = useState(4);
  const [feeVS, setFeeVS] = useState(feeVsDefault);

  const custoHumano = Math.round(salario * (1 + encargos / 100) + ferramentas);
  const economia = custoHumano - feeVS;
  const payback = economia > 0 ? (feeVS / economia).toFixed(1) : "—";

  const fmt = (n: number) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  const statusColor =
    economia > 0 ? "text-success border-success/30 bg-success/5" :
    economia === 0 ? "text-warning border-warning/30 bg-warning/5" :
    "text-destructive border-destructive/30 bg-destructive/5";

  const StatusIcon = economia > 0 ? TrendingUp : economia === 0 ? Minus : TrendingDown;

  return (
    <div className="space-y-4 p-1">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Calculadora de Confronto
      </p>

      <div className="grid grid-cols-2 gap-3">
        {/* Salário */}
        <div className="space-y-1.5">
          <Label className="text-xs">Salário do vendedor (R$)</Label>
          <Input
            type="number"
            value={salario}
            onChange={e => setSalario(Number(e.target.value))}
            className="h-8 text-sm"
          />
        </div>

        {/* Encargos */}
        <div className="space-y-1.5">
          <Label className="text-xs">Encargos trabalhistas (%)</Label>
          <Input
            type="number"
            value={encargos}
            onChange={e => setEncargos(Number(e.target.value))}
            className="h-8 text-sm"
          />
        </div>

        {/* Ferramentas */}
        <div className="space-y-1.5">
          <Label className="text-xs">Ferramentas atuais (R$/mês)</Label>
          <Input
            type="number"
            value={ferramentas}
            onChange={e => setFerramentas(Number(e.target.value))}
            className="h-8 text-sm"
          />
        </div>

        {/* Fee VS */}
        <div className="space-y-1.5">
          <Label className="text-xs">Fee VS (R$/mês)</Label>
          <Input
            type="number"
            value={feeVS}
            onChange={e => setFeeVS(Number(e.target.value))}
            className="h-8 text-sm"
          />
        </div>
      </div>

      {/* Horas/dia repetitivas */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Horas/dia em tarefas repetitivas</Label>
          <span className="text-sm font-bold text-primary">{horasDia}h</span>
        </div>
        <Slider
          min={1} max={8} step={1}
          value={[horasDia]}
          onValueChange={([v]) => setHorasDia(v)}
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>1h</span><span>8h</span>
        </div>
      </div>

      {/* Results */}
      <div className="grid grid-cols-2 gap-2 pt-2">
        <div className="bg-muted rounded-lg p-3 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Custo atual</p>
          <p className="text-lg font-bold tabular">{fmt(custoHumano)}<span className="text-xs font-normal text-muted-foreground">/mês</span></p>
        </div>
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Com VS</p>
          <p className="text-lg font-bold tabular text-primary">{fmt(feeVS)}<span className="text-xs font-normal text-muted-foreground">/mês</span></p>
        </div>
      </div>

      <div className={`rounded-lg border p-3 flex items-center justify-between ${statusColor}`}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-0.5">Economia mensal</p>
          <p className="text-xl font-bold tabular">
            {economia >= 0 ? fmt(economia) : `-${fmt(Math.abs(economia))}`}
          </p>
          {economia > 0 && (
            <p className="text-[10px] mt-0.5 opacity-70">Payback em {payback} meses</p>
          )}
        </div>
        <StatusIcon className="h-8 w-8 opacity-50" />
      </div>
    </div>
  );
}
