describe('Vessel Types - Create', () => {

  beforeEach(() => {
    cy.loginAsAdmin();

    cy.intercept('GET', 'https://localhost:7167/authtest/me', {
      statusCode: 200,
      body: {
        name: "DevLapr5 salvador",
        email: "salvadordevlapr@gmail.com",
        role: "admin",
        roles: ["admin"]
      }
    });

    // intercept da listagem inicial
    cy.intercept('GET', 'https://localhost:7167/api/VesselTypes').as('loadVesselTypes');

    cy.visit('/vessel-types');

    // ESPERAR pela tabela carregar
    cy.wait('@loadVesselTypes');

    // ESPERAR pela presença da secção Criar tipo (garante que o DOM está pronto)
    cy.contains('Criar tipo').should('exist');
  });

  it('should create a new vessel type', () => {

    // 1. Agora o formulário EXISTE, então podemos escrever
    cy.get('input[placeholder="ex: Container Ship"]').type('AutoTest Ship');
    cy.get('input[placeholder="Descrição opcional"]').type('Created via Cypress');

    cy.get('input[placeholder="0"]').eq(0).clear().type('1000');
    cy.get('input[placeholder="0"]').eq(1).clear().type('12');
    cy.get('input[placeholder="0"]').eq(2).clear().type('20');
    cy.get('input[placeholder="0"]').eq(3).clear().type('8');

    cy.contains('button', 'Criar').click();

    // 2. validar criação
    cy.contains('td', 'AutoTest Ship').should('exist');
  });

});
