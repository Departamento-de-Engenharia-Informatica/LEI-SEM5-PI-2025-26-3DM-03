import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../services/admin/admin.service';
import { TranslationService } from '../../services/i18n/translation.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit {
  users: any[] = [];
  roles: any[] = [];
  lastActivationLink: { [userId: number]: { link: string; expiresAt: string } } = {};
  loading = false;
  error: string | null = null;

  // create form
  newEmail = '';
  newName = '';
  newRoleId: number | null = null;

  constructor(private admin: AdminService, private i18n: TranslationService, private cdr: ChangeDetectorRef) {}

  async ngOnInit() {
    await this.load();
  }

  async load() {
    this.loading = true; this.error = null;
    try {
      this.roles = await this.admin.getRoles();
      this.users = await this.admin.getUsers();
      if (!this.newRoleId && this.roles.length) this.newRoleId = this.roles[0].id;
    } catch (e: any) { this.error = e?.message || 'Erro'; }
    finally { this.loading = false; try { this.cdr.detectChanges(); } catch {} }
  }

  async create() {
    if (!this.newEmail) { this.error = 'Email required'; return; }
    try {
      await this.admin.createUser({ email: this.newEmail, name: this.newName || undefined, roleId: this.newRoleId ?? undefined, active: false });
      this.newEmail = ''; this.newName = '';
      await this.load();
    } catch (e: any) { this.error = e?.message || 'Failed'; }
  }

  async toggleActive(u: any) {
    try { await this.admin.setActive(u.id, !u.active); await this.load(); } catch (e: any) { this.error = e?.message || 'Failed'; }
  }

  async remove(u: any) {
    if (!confirm('Desativar este utilizador?')) return;
    try { await this.admin.deleteUser(u.id); await this.load(); } catch (e: any) { this.error = e?.message || 'Failed'; }
  }

  userHasRole(u: any, roleId: number): boolean {
    return Array.isArray(u.roles) && u.roles.some((r: any) => r.roleId === roleId);
  }

  async toggleRole(u: any, roleId: number, event: Event) {
    const checked = (event.target as HTMLInputElement)?.checked;
    const current = new Set<number>(Array.isArray(u.roles) ? u.roles.map((r: any) => r.roleId) : []);
    if (checked) current.add(roleId); else current.delete(roleId);
    try { await this.admin.updateUserRoles(u.id, Array.from(current)); await this.load(); } catch (e: any) { this.error = e?.message || 'Failed'; }
  }

  async sendActivation(u: any) {
    try {
      const res = await this.admin.sendActivationLink(u.id);
      if (res?.link) {
        this.lastActivationLink[u.id] = { link: res.link, expiresAt: res.expiresAtUtc };
        try { await navigator.clipboard.writeText(res.link); } catch {}
      }
      await this.load();
    } catch (e: any) { this.error = e?.message || 'Failed'; }
  }

  async sendRoleChange(u: any) {
    try {
      await this.admin.sendRoleChangeLink(u.id);
      await this.load();
    } catch (e: any) {
      this.error = e?.message || 'Failed';
    }
  }
}
