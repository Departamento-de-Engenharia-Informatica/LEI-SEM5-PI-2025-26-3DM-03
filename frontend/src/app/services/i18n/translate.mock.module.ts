import { NgModule, Pipe, PipeTransform } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MockTranslateService } from './translate.mock.impl';

// Impure so it recomputes when language changes and on manual CD
@Pipe({ name: 'translate', standalone: true, pure: false })
export class TranslatePipe implements PipeTransform {
  constructor(private t: MockTranslateService) {}
  transform(value: string): string {
    try { return this.t.instant(value); } catch { return value; }
  }
}

@NgModule({
  imports: [CommonModule, TranslatePipe as any],
  declarations: [],
  exports: [],
  providers: [MockTranslateService]
})
export class TranslateMockModule {}
