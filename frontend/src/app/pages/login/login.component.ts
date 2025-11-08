import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth/auth.service';
import { TranslationService } from '../../services/i18n/translation.service';
 
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent  {
  

constructor(  public i18n: TranslationService, public auth: AuthService) {}

   // Called by the Login button to start the login flow and show a transient UI state
  login(){
 //   this.loginInProgress = true;
    try{
      this.auth.login();
    } catch(e) {
      console.error('login redirect failed', e);
   //   this.loginInProgress = false;
    }
  }
}
