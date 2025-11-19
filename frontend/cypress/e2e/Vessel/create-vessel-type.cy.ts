describe('Vessel Types - Create', () => {
  beforeEach(() => {
    cy.loginAsAdmin();

    cy.intercept('GET', '**/authtest/me', {
      statusCode: 200,
      body: {
        name: 'DevLapr5 salvador',
        email: 'salvadordevlapr@gmail.com',
        role: 'admin',
        roles: ['admin'],
      },
    }).as('authMe');

    cy.intercept('GET', '**/api/VesselTypes').as('loadVesselTypes');

    cy.visit('/vessel-types');

    cy.wait(['@authMe', '@loadVesselTypes']);

    cy.contains('h2, h3, h4', 'Criar tipo').should('be.visible');
  });

  it('should create a new vessel type and display it in the listing', () => {
    const vesselTypeName = `AutoTest Ship ${Date.now()}`;

    cy.intercept('POST', '**/api/VesselTypes').as('createVesselType');

    cy.contains('h3', 'Criar tipo')
      .should('be.visible')
      .parents('section.card')
      .first()
      .as('createSection');

    cy.get('@createSection').within(() => {
      cy.contains('label', 'Nome').find('input').clear().type(vesselTypeName);
      cy.contains('label', 'Descrição').find('input').clear().type('Created via Cypress');
      cy.contains('label', 'Capacidade (TEU)').find('input[type="number"]').clear().type('1000');
      cy.contains('label', 'Max Rows').find('input[type="number"]').clear().type('12');
      cy.contains('label', 'Max Bays').find('input[type="number"]').clear().type('220');
      cy.contains('label', 'Max Tiers').find('input[type="number"]').clear().type('32');

      cy.contains('button', 'Criar').should('be.enabled').click();
    });

    cy.wait('@createVesselType').then(({ request, response }) => {
      expect(request.body).to.include({
        name: vesselTypeName,
        description: 'Created via Cypress',
      });
      expect(Number(request.body.capacity)).to.eq(1000);
      expect(Number(request.body.operationalConstraints?.maxRows)).to.eq(12);
      expect(Number(request.body.operationalConstraints?.maxBays)).to.eq(220);
      expect(Number(request.body.operationalConstraints?.maxTiers)).to.eq(32);
      expect(response?.statusCode).to.eq(201);
    });

    cy.contains('td', vesselTypeName, { timeout: 10_000 }).should('be.visible');
  });
});
