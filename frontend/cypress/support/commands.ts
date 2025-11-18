/// <reference types="cypress" />

declare global {
  namespace Cypress {
    interface Chainable {
      loginAsAdmin(): Chainable<void>;
    }
  }
}

Cypress.Commands.add('loginAsAdmin', () => {
  const user = {
    name: "DevLapr5 salvador",
    email: "salvadordevlapr@gmail.com",
    role: "admin",
    roles: ["admin"],
    avatarUrl: "https://lh3.googleusercontent.com/a/ACg8ocKzql...s96-c"
  };

  window.localStorage.setItem('user', JSON.stringify(user));
});

export {};
