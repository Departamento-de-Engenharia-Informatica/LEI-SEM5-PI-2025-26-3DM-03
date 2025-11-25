import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DailyScheduleResponse, SchedulingService } from '../../services/scheduling/scheduling.service';

@Component({
  selector: 'app-scheduling-dev',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './scheduling-dev.component.html',
  styleUrls: ['./scheduling-dev.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SchedulingDevComponent {
  date = this.todayIso();
  algorithm: 'heuristic' | 'prolog' | 'multi_crane' = 'heuristic';
  status: 'idle' | 'computing' | 'success' | 'error' = 'idle';
  statusMessage = 'Escolha uma data e algoritmo e clique em "Testar".';
  errorMessage: string | null = null;
  response: DailyScheduleResponse | null = null;

  constructor(private readonly schedulingService: SchedulingService) {}

  async run(): Promise<void> {
    this.status = 'computing';
    this.statusMessage = 'A contactar Prolog2...';
    this.errorMessage = null;
    this.response = null;

    try {
      const payload = { date: this.date } as any;
      const algo = this.algorithm === 'multi_crane' ? 'prolog' : this.algorithm;
      const result = await this.schedulingService.generateDailySchedule(payload, algo);
      this.response = result;
      this.status = 'success';
      this.statusMessage = 'Resposta recebida com sucesso.';
    } catch (err: any) {
      this.status = 'error';
      this.statusMessage = 'Falha ao contactar o módulo Prolog2.';
      this.errorMessage = err?.message ?? String(err);
    }
  }

  private todayIso(): string {
    const now = new Date();
    const pad = (v: number) => v.toString().padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }
}
