import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ComplementaryTaskCategoryDTO } from '../../models/complementary-task-category';
import { ComplementaryTaskCategoriesService } from '../../services/complementary-task-categories/complementary-task-categories.service';
import { ToastService } from '../../components/toast/toast.service';

@Component({
  selector: 'app-complementary-task-categories',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './complementary-task-categories.component.html',
  styleUrls: ['./complementary-task-categories.component.scss'],
})
export class ComplementaryTaskCategoriesComponent implements OnInit {
  filterForm: FormGroup;
  form: FormGroup;

  categories: ComplementaryTaskCategoryDTO[] = [];
  loading = false;
  saving = false;
  error: string | null = null;
  formError: string | null = null;
  editing: ComplementaryTaskCategoryDTO | null = null;
  deleting = new Set<number>();

  constructor(
    private readonly fb: FormBuilder,
    private readonly service: ComplementaryTaskCategoriesService,
    private readonly toast: ToastService,
    private readonly cdr: ChangeDetectorRef,
  ) {
    this.filterForm = this.fb.group({
      q: [''],
    });

    this.form = this.fb.group({
      code: ['', [Validators.required, Validators.pattern(/^CTC\d{3,}$/)]],
      name: ['', [Validators.required, Validators.minLength(2)]],
      description: [''],
      defaultDurationMinutes: ['', [Validators.pattern(/^\d+$/)]],
    });
  }

  ngOnInit(): void {
    this.loadCategories();
  }

  trackById(_: number, item: ComplementaryTaskCategoryDTO): number {
    return item.id;
  }

  async loadCategories(showSpinner = true): Promise<void> {
    if (showSpinner) {
      this.loading = true;
    }
    this.error = null;

    try {
      const filters = this.filterForm.value?.q
        ? { q: this.filterForm.value.q as string }
        : undefined;
      const items = await this.service.list(filters);
      this.categories = items.slice().sort((a, b) => a.code.localeCompare(b.code));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Falha ao carregar categorias.';
      this.error = message;
      this.toast.error(message);
    } finally {
      if (showSpinner) {
        this.loading = false;
      }
      this.cdr.markForCheck();
    }
  }

  async onSearch(): Promise<void> {
    await this.loadCategories();
  }

  async clearFilters(): Promise<void> {
    this.filterForm.reset({ q: '' });
    await this.loadCategories();
  }

  startCreate(): void {
    this.resetForm();
  }

  startEdit(category: ComplementaryTaskCategoryDTO): void {
    this.editing = category;
    this.form.reset({
      code: category.code,
      name: category.name,
      description: category.description ?? '',
      defaultDurationMinutes:
        category.defaultDurationMinutes !== null && category.defaultDurationMinutes !== undefined
          ? String(category.defaultDurationMinutes)
          : '',
    });
    this.form.markAsPristine();
    this.formError = null;
  }

  cancelEdit(): void {
    this.resetForm();
  }

  private resetForm(): void {
    this.editing = null;
    this.form.reset({
      code: '',
      name: '',
      description: '',
      defaultDurationMinutes: '',
    });
    this.form.markAsPristine();
    this.formError = null;
  }

  private buildPayload() {
    const raw = this.form.value;
    const payload = {
      code: String(raw.code ?? '').trim().toUpperCase(),
      name: String(raw.name ?? '').trim(),
      description: raw.description ? String(raw.description).trim() : undefined,
      defaultDurationMinutes: undefined as number | null | undefined,
    };

    const rawDuration = (raw.defaultDurationMinutes ?? '').toString().trim();
    if (rawDuration) {
      payload.defaultDurationMinutes = Number.parseInt(rawDuration, 10);
    } else {
      payload.defaultDurationMinutes = null;
    }

    if (!payload.description) {
      payload.description = undefined;
    }

    return payload;
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = this.buildPayload();
    this.saving = true;
    this.formError = null;

    try {
      if (this.editing) {
        const updated = await this.service.update(this.editing.id, payload);
        const merged = this.upsertLocalCategory(updated);
        this.startEdit(merged);
        this.toast.success('Categoria atualizada com sucesso.');
      } else {
        const created = await this.service.create(payload);
        this.upsertLocalCategory(created);
        this.toast.success('Categoria criada com sucesso.');
        this.resetForm();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Falha ao guardar categoria.';
      this.formError = message;
      this.toast.error(message);
    } finally {
      this.saving = false;
      this.cdr.markForCheck();
    }
  }

  private upsertLocalCategory(entry: ComplementaryTaskCategoryDTO): ComplementaryTaskCategoryDTO {
    const existingIndex = this.categories.findIndex((item) => item.id === entry.id);
    if (existingIndex >= 0) {
      const merged = { ...this.categories[existingIndex], ...entry };
      this.categories = [
        ...this.categories.slice(0, existingIndex),
        merged,
        ...this.categories.slice(existingIndex + 1),
      ];
      return merged;
    }

    const inserted = { ...entry };
    this.categories = [...this.categories, inserted].sort((a, b) => a.code.localeCompare(b.code));
    return inserted;
  }

  async deleteCategory(category: ComplementaryTaskCategoryDTO): Promise<void> {
    if (this.deleting.has(category.id)) {
      return;
    }

    const confirmDelete = window.confirm(`Remover categoria ${category.code}?`);
    if (!confirmDelete) {
      return;
    }

    this.deleting.add(category.id);

    try {
      await this.service.delete(category.id);
      this.categories = this.categories.filter((item) => item.id !== category.id);
      if (this.editing?.id === category.id) {
        this.resetForm();
      }
      this.toast.success('Categoria removida.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Falha ao remover categoria.';
      this.toast.error(message);
    } finally {
      this.deleting.delete(category.id);
      this.cdr.markForCheck();
    }
  }

  durationLabel(category: ComplementaryTaskCategoryDTO): string {
    return category.defaultDurationMinutes !== null && category.defaultDurationMinutes !== undefined
      ? `${category.defaultDurationMinutes} min`
      : '-';
  }

  formatDate(value?: string): string {
    if (!value) {
      return '-';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '-';
    }

    return date.toLocaleString('pt-PT', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
