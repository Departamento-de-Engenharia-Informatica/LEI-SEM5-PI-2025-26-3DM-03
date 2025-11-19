
describe('Smoke Test — App Loads', () => {

  it('should load the homepage', () => {
    cy.visit('http://localhost:4200');  // abre a tua aplicação Angular

    cy.get('header').should('exist');
    cy.contains('Port').should('exist'); // troca por algo que exista no teu header
  });

});
